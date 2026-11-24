import { validateConferences, conferenceSchedule } from "./conferences.js";
import { createHash } from "node:crypto";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import staticPlugin from "@fastify/static";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import { resolve, join } from "node:path";
import { mkdirSync } from "node:fs";
import {
  nationalityValue,
  nationalitiesValue,
  profileNationalities,
} from "./profile.js";
import sharp from "sharp";
import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
import { ratedRating, ratingProgress } from "./ratings.js";
import { registerCatalogImages } from "./catalog-images.js";
import { registerBadgeImport } from "./badge-import.js";
import { deleteCompetition } from "./competition-deletion.js";
import { replacePlayer, fixturePlayers } from "./competitions.js";
import { competitionForecast } from "./competition-forecast.js";
import { bracketPredictions, saveBracketPrediction, lockBracketPredictions } from "./bracket-predictions.js";
import { matchContext } from "./match-context.js";
import {
  openDb,
  json,
  assert,
  fail,
  admin,
  organizer,
  textValue,
  integer,
  page,
  audit,
  notify,
} from "./db.js";
import {
  token,
  hash,
  passwordHash,
  passwordValid,
  register,
  publicUser,
  issueLink,
  getLink,
  handleValue,
  emailValue,
  mergePlayer,
} from "./auth.js";
import {
  getCompetition,
  entries,
  fixtureList,
  settings,
  addEntry,
  draw,
  progress,
  standings,
  serializeCompetition,
  qualificationCount,
} from "./competitions.js";
import {
  submit,
  accept,
  checkoff,
  setEloEnabled,
  edit,
  forfeit,
  getMatch,
  serializeMatch,
  rebuild,
  upgradeRatings,
  members,
  preview,
} from "./matches.js";
const root = resolve(import.meta.dirname, "..");
export async function createApp(options = {}) {
  const db =
    options.db ||
    openDb(
      options.database ||
        process.env.MIMELO_DATABASE ||
        join(root, ".runtime/book.sqlite"),
    );
  upgradeRatings(db);
  const uploads = options.uploads || join(root, ".runtime/uploads");
  mkdirSync(uploads, { recursive: true });
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 1024 * 1024,
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url.split("?")[0],
        remoteAddress: req.ip,
      }),
    },
    trustProxy: process.env.TRUST_PROXY === "1",
  });
  app.db = db;
  await app.register(cookie);
  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  });
  app.addHook("onRequest", async (req, reply) => {
    reply
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "same-origin")
      .header("X-Frame-Options", "DENY");
    reply.header(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    req.user = null;
    req.session = null;
    if (req.cookies.sid) {
      req.session = db
        .prepare("SELECT * FROM sessions WHERE token=? AND expires>?")
        .get(hash(req.cookies.sid), Date.now());
      if (req.session)
        req.user =
          db
            .prepare("SELECT * FROM accounts WHERE id=? AND active=1")
            .get(req.session.account_id) || null;
    }
    if (req.url.startsWith("/api/")) {
      reply.header("Cache-Control", "no-store");
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        assert(
          req.headers["x-mimelo-request"] === "1",
          "Missing request verification header.",
          403,
        );
        if (req.headers.origin) {
          const expected =
            process.env.APP_ORIGIN || `${req.protocol}://${req.host}`;
          assert(
            req.headers.origin === expected,
            "Cross-site requests are not allowed.",
            403,
          );
        }
        if (req.user)
          assert(
            req.headers["x-csrf-token"] === req.session.csrf,
            "Session verification failed. Reload and try again.",
            403,
          );
      }
    }
  });
  await app.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
    allowList: (req) => !req.url.startsWith("/api/"),
    keyGenerator: (req) => (req.user ? "account:" + req.user.id : req.ip),
  });
  app.addHook("preValidation", async (req) => {
    if (
      req.url.startsWith("/api/") &&
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      !req.isMultipart()
    ) {
      req.body ??= {};
      assert(
        typeof req.body === "object" && !Array.isArray(req.body),
        "Expected a JSON object.",
      );
    }
  });
  app.setErrorHandler((error, req, reply) => {
    let status = error.statusCode || 500,
      message = error.message;
    if (error.code?.startsWith("SQLITE_CONSTRAINT")) {
      status = 409;
      message = "This change conflicts with an existing record.";
    }
    if (status >= 500) {
      req.log.error(error);
      message = "The request could not be completed.";
    }
    reply.code(status).send({ error: message });
  });
  const signed = (req) => {
    assert(req.user, "Please log in.", 401);
    return req.user;
  };
  const site = (req) => {
    const u = signed(req);
    assert(u.site_admin, "Site admin access required.", 403);
    return u;
  };
  const participant = (req) => {
    const user = signed(req);
    assert(
      user.approved || user.site_admin,
      "Your account is awaiting site admin approval. You can browse as a spectator until approved.",
      403,
    );
    return user;
  };
  const gameAdmin = (req, g) => {
    const u = signed(req);
    assert(admin(db, u, g), "Game admin access required.", 403);
    return u;
  };
  const tx = (fn) => db.transaction(fn).immediate();
  const game = (g) => {
    const r = db.prepare("SELECT * FROM games WHERE slug=?").get(g);
    assert(r, "Game not found.", 404);
    return { ...r, weights: json(r.weights) };
  };
  registerCatalogImages(app, { db, uploads, game, gameAdmin });
  registerBadgeImport(app, { db, uploads, game, gameAdmin });
  function login(reply, u, req, remember = true) {
    const raw = token(),
      csrf = token(),
      duration = remember ? 30 * 864e5 : 12 * 36e5;
    db.prepare("INSERT INTO sessions VALUES(?,?,?,?,?,?)").run(
      hash(raw),
      u.id,
      csrf,
      Date.now(),
      Date.now() + duration,
      String(req.headers["user-agent"] || "").slice(0, 250),
    );
    reply.setCookie("sid", raw, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      ...(remember ? { maxAge: duration / 1000 } : {}),
    });
    return { user: publicUser(db, u), csrf };
  }
  app.get("/api/me", async (req) => ({
    user: publicUser(db, req.user),
    csrf: req.session?.csrf || null,
  }));
  app.post(
    "/api/signup",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const b = req.body || {},
        hashed = await passwordHash(b.password);
      const u = tx(() => {
        let id = null;
        if (b.claim) {
          const l = getLink(db, b.claim, "claim");
          id = l.target;
          db.prepare("UPDATE links SET used=1 WHERE token=?").run(l.token);
        }
        const user = register(db, b, hashed, id);
        db.prepare("UPDATE accounts SET approved=0 WHERE id=?").run(user.id);
        db.prepare(
          "INSERT INTO requests(kind,account_id,payload,created) VALUES('participation',?,'{}',?)",
        ).run(user.id, Date.now());
        return db.prepare("SELECT * FROM accounts WHERE id=?").get(user.id);
      });
      return login(reply, u, req);
    },
  );
  app.post(
    "/api/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const b = req.body || {},
        u = db
          .prepare(
            "SELECT * FROM accounts WHERE active=1 AND (handle=? OR email=?)",
          )
          .get(
            String(b.identity || "").replace(/^@/, ""),
            String(b.identity || ""),
          );
      assert(
        u && (await passwordValid(b.password, u.password)),
        "Incorrect login or password.",
        401,
      );
      return login(reply, u, req, b.remember !== false);
    },
  );
  app.post("/api/logout", async (req, reply) => {
    if (req.session)
      db.prepare("DELETE FROM sessions WHERE token=?").run(req.session.token);
    reply.clearCookie("sid", { path: "/" });
    return { ok: true };
  });
  app.patch("/api/me", async (req) => {
    const u = signed(req),
      b = req.body || {};
    return tx(() => {
      if (b.name !== undefined)
        db.prepare("UPDATE players SET name=? WHERE id=?").run(
          textValue(b.name, 80),
          u.player_id,
        );
      if (b.email !== undefined)
        db.prepare("UPDATE accounts SET email=? WHERE id=?").run(
          emailValue(b.email),
          u.id,
        );
      if (b.profile !== undefined) {
        assert(
          b.profile &&
            typeof b.profile === "object" &&
            !Array.isArray(b.profile),
          "Invalid profile.",
        );
        const old = json(
          db.prepare("SELECT profile FROM players WHERE id=?").get(u.player_id)
            .profile,
        );
        for (const k of ["bio", "nationality", "favoriteTeam", "tag", "mains"])
          if (k in b.profile)
            old[k] =
              k === "nationality"
                ? nationalityValue(b.profile[k], old[k])
                : String(b.profile[k] || "").slice(0, k === "bio" ? 500 : 160);
        if ("nationalities" in b.profile) {
          old.nationalities = nationalitiesValue(
            b.profile.nationalities,
            profileNationalities(old),
          );
          old.nationality = old.nationalities[0] || "";
        } else if ("nationality" in b.profile) {
          old.nationalities = old.nationality ? [old.nationality] : [];
        }
        db.prepare("UPDATE players SET profile=? WHERE id=?").run(
          JSON.stringify(old),
          u.player_id,
        );
      }
      if (b.preferences !== undefined) {
        const old = json(u.preferences);
        for (const k of ["submitted", "accepted", "rated", "competition"])
          if (k in b.preferences) old[k] = !!b.preferences[k];
        db.prepare("UPDATE accounts SET preferences=? WHERE id=?").run(
          JSON.stringify(old),
          u.id,
        );
      }
      return publicUser(
        db,
        db.prepare("SELECT * FROM accounts WHERE id=?").get(u.id),
      );
    });
  });
  app.post("/api/me/password", async (req) => {
    const u = signed(req);
    assert(
      await passwordValid(req.body.current, u.password),
      "Current password is incorrect.",
    );
    const pw = await passwordHash(req.body.password);
    tx(() => {
      db.prepare("UPDATE accounts SET password=? WHERE id=?").run(pw, u.id);
      db.prepare("DELETE FROM sessions WHERE account_id=? AND token<>?").run(
        u.id,
        req.session.token,
      );
    });
    return { ok: true };
  });
  app.get("/api/me/sessions", async (req) => {
    const u = signed(req);
    return db
      .prepare(
        "SELECT token,created,expires,agent FROM sessions WHERE account_id=? AND expires>?",
      )
      .all(u.id, Date.now())
      .map((s) => ({ ...s, current: s.token === req.session.token }));
  });
  app.delete("/api/me/sessions/:id", async (req) => {
    const u = signed(req);
    db.prepare("DELETE FROM sessions WHERE account_id=? AND token=?").run(
      u.id,
      req.params.id,
    );
    return { ok: true };
  });
  app.delete("/api/me/sessions", async (req) => {
    const u = signed(req);
    db.prepare("DELETE FROM sessions WHERE account_id=? AND token<>?").run(
      u.id,
      req.session.token,
    );
    return { ok: true };
  });
  async function savePlayerPhoto(req, playerId) {
    const file = await req.file();
    assert(file, "Choose a photo.");
    const buffer = await file.toBuffer();
    const name = token() + ".webp";
    try {
      await sharp(buffer, { limitInputPixels: 25000000 })
        .rotate()
        .resize(512, 512, { fit: "cover" })
        .webp({ quality: 85 })
        .toFile(join(uploads, name));
    } catch {
      fail("Choose a valid photo under 5 MB.");
    }
    const previous = db
      .prepare("SELECT photo FROM players WHERE id=?")
      .get(playerId)?.photo;
    db.prepare("UPDATE players SET photo=? WHERE id=?").run(
      "/uploads/" + name,
      playerId,
    );
    if (previous?.startsWith("/uploads/") && !previous.includes(".."))
      await import("node:fs/promises").then((fs) =>
        fs
          .unlink(join(uploads, previous.slice("/uploads/".length)))
          .catch(() => {}),
      );
    return { photo: "/uploads/" + name };
  }
  app.post("/api/me/photo", async (req) => {
    return savePlayerPhoto(req, signed(req).player_id);
  });
  app.delete("/api/me/photo", async (req) => {
    const u = signed(req);
    const previous = db
      .prepare("SELECT photo FROM players WHERE id=?")
      .get(u.player_id)?.photo;
    db.prepare("UPDATE players SET photo=NULL WHERE id=?").run(u.player_id);
    if (previous?.startsWith("/uploads/") && !previous.includes(".."))
      await import("node:fs/promises").then((fs) =>
        fs
          .unlink(join(uploads, previous.slice("/uploads/".length)))
          .catch(() => {}),
      );
    return { ok: true };
  });
  app.post("/api/me/handle-request", async (req) => {
    const u = signed(req),
      handle = handleValue(req.body.handle);
    assert(
      !db.prepare("SELECT 1 FROM accounts WHERE handle=?").get(handle),
      "Handle already in use.",
    );
    db.prepare(
      "INSERT INTO requests(kind,account_id,payload,created) VALUES('handle',?,?,?)",
    ).run(u.id, JSON.stringify({ handle }), Date.now());
    return { ok: true };
  });
  app.get("/api/link", async (req) => {
    const l = getLink(db, req.query.token, req.query.kind);
    const p =
      l.kind === "claim"
        ? db.prepare("SELECT name FROM players WHERE id=?").get(l.target)
        : null;
    return { kind: l.kind, name: p?.name || null };
  });
  app.post("/api/claim", async (req) => {
    const u = signed(req);
    return tx(() => {
      const l = getLink(db, req.body.token, "claim");
      assert(l.target !== u.player_id, "This is already your profile.");
      db.prepare(
        "INSERT INTO requests(kind,account_id,payload,created) VALUES('merge',?,?,?)",
      ).run(
        u.id,
        JSON.stringify({ source: l.target, target: u.player_id }),
        Date.now(),
      );
      db.prepare("UPDATE links SET used=1 WHERE token=?").run(l.token);
      return { ok: true };
    });
  });
  app.post("/api/reset-password", async (req) => {
    const l = getLink(db, req.body.token, "reset"),
      pw = await passwordHash(req.body.password);
    tx(() => {
      getLink(db, req.body.token, "reset");
      db.prepare("UPDATE accounts SET password=? WHERE id=?").run(pw, l.target);
      db.prepare("DELETE FROM sessions WHERE account_id=?").run(l.target);
      db.prepare("UPDATE links SET used=1 WHERE token=?").run(l.token);
    });
    return { ok: true };
  });
  app.get("/api/games", async () =>
    db
      .prepare("SELECT * FROM games")
      .all()
      .map((g) => ({
        ...g,
        weights: json(g.weights),
        players: db
          .prepare(
            "SELECT COUNT(DISTINCT mp.player_id) n FROM match_players mp JOIN matches m ON m.id=mp.match_id WHERE m.game=? AND m.status<>'voided'",
          )
          .get(g.slug).n,
        matches: db
          .prepare(
            "SELECT COUNT(*) n FROM matches WHERE game=? AND status<>'voided'",
          )
          .get(g.slug).n,
      })),
  );
  app.get("/api/games/:game", async (req) => game(req.params.game));
  app.patch("/api/games/:game/weights", async (req) => {
    const u = gameAdmin(req, req.params.game),
      g = game(req.params.game),
      w = { ...g.weights };
    for (const k in w)
      if (k in req.body) {
        const n = Number(req.body[k]);
        assert(
          Number.isFinite(n) && n >= 0 && n <= 3,
          "Weights must be between 0 and 3.",
        );
        w[k] = n;
      }
    db.prepare("UPDATE games SET weights=? WHERE slug=?").run(
      JSON.stringify(w),
      g.slug,
    );
    audit(db, u, "game.weights", g.slug, w);
    return w;
  });
  function playerRecords(id) {
    return db
      .prepare(
        "SELECT m.game,m.format,COUNT(*) matches,SUM(m.status='accepted') accepted,SUM(m.status='submitted') pending,COALESCE(SUM(m.status='accepted' AND m.winner=mp.side),0) w,COALESCE(SUM(m.status='accepted' AND m.winner IS NULL),0) d,COALESCE(SUM(m.status='accepted' AND m.winner IS NOT NULL AND m.winner<>mp.side),0) l FROM match_players mp JOIN matches m ON m.id=mp.match_id WHERE mp.player_id=? AND m.status<>'voided' GROUP BY m.game,m.format ORDER BY m.game,m.format",
      )
      .all(id);
  }
  function playerRows(q = {}) {
    const { limit, offset } = page(q),
      search = `%${String(q.q || "").slice(0, 80)}%`;
    const gameFilter = q.game ? game(q.game).slug : null;
    const where =
      "WHERE json_extract(p.profile,'$.merged_into') IS NULL AND (p.name LIKE ? OR a.handle LIKE ?)";
    const activity = gameFilter
      ? " AND EXISTS(SELECT 1 FROM match_players mp JOIN matches m ON m.id=mp.match_id WHERE mp.player_id=p.id AND m.game=? AND m.status<>'voided')"
      : "";
    const filters = [search, search, ...(gameFilter ? [gameFilter] : [])];
    const total = db
      .prepare(
        `SELECT COUNT(*) n FROM players p LEFT JOIN accounts a ON a.player_id=p.id ${where}${activity}`,
      )
      .get(...filters).n;
    return {
      total,
      limit,
      offset,
      rows: db
        .prepare(
          `SELECT p.*,a.handle,a.id AS account_id FROM players p LEFT JOIN accounts a ON a.player_id=p.id ${where}${activity} ORDER BY p.name,p.id LIMIT ? OFFSET ?`,
        )
        .all(...filters, limit, offset)
        .map((p) => ({
          ...p,
          profile: json(p.profile),
          records: playerRecords(p.id),
          ratings: db
            .prepare("SELECT * FROM ratings WHERE player_id=?")
            .all(p.id)
            .map((r) => ratedRating(db, r)),
        })),
    };
  }
  app.get("/api/players", async (req) => playerRows(req.query));
  app.get("/api/players/:id/last-team", async (req) => {
    const id = integer(req.params.id, 1),
      g = game(req.query.game || "eafc27");
    return (
      db
        .prepare(
          "SELECT t.* FROM matches m JOIN match_players mp ON mp.match_id=m.id JOIN teams t ON t.id=CASE WHEN mp.side=0 THEN json_extract(m.score,'$.teamA') ELSE json_extract(m.score,'$.teamB') END WHERE mp.player_id=? AND m.game=? AND m.status<>'voided' ORDER BY COALESCE(m.played_at,m.submitted) DESC,m.id DESC LIMIT 1",
        )
        .get(id, g.slug) || null
    );
  });
  app.get("/api/players/:id/record", async (req) => {
    const id = integer(req.params.id, 1),
      g = game(req.query.game || "eafc27"),
      format = req.query.format || "singles";
    assert(["singles", "doubles"].includes(format), "Invalid rating format.");
    const rating = db
      .prepare(
        "SELECT * FROM ratings WHERE game=? AND format=? AND player_id=?",
      )
      .get(g.slug, format, id);
    const rank = rating
      ? db
          .prepare(
            "SELECT COUNT(*)+1 n FROM ratings WHERE game=? AND format=? AND (elo>? OR (elo=? AND player_id<?))",
          )
          .get(g.slug, format, rating.elo, rating.elo, id).n
      : null;
    const record = db
      .prepare(
        "SELECT COUNT(*) played,COALESCE(SUM(m.winner=mp.side),0) w,COALESCE(SUM(m.winner IS NULL),0) d,COALESCE(SUM(m.winner IS NOT NULL AND m.winner<>mp.side),0) l FROM match_players mp JOIN matches m ON m.id=mp.match_id WHERE mp.player_id=? AND m.game=? AND m.format=? AND m.status='accepted'",
      )
      .get(id, g.slug, format);
    const history = db
      .prepare(
        "SELECT l.*,m.submitted,m.played_at FROM ledger l JOIN matches m ON m.id=l.match_id WHERE l.player_id=? AND m.game=? AND m.format=? ORDER BY COALESCE(m.played_at,m.submitted) DESC,m.id DESC LIMIT 200",
      )
      .all(id, g.slug, format);
    const teams =
      g.kind === "fc"
        ? db
            .prepare(
              "SELECT t.id,t.name,t.code,COUNT(*) appearances FROM teams t JOIN matches m ON t.id=CASE WHEN (SELECT side FROM match_players WHERE match_id=m.id AND player_id=?)=0 THEN json_extract(m.score,'$.teamA') ELSE json_extract(m.score,'$.teamB') END WHERE m.game=? AND m.status='accepted' AND EXISTS(SELECT 1 FROM match_players WHERE match_id=m.id AND player_id=?) GROUP BY t.id ORDER BY appearances DESC LIMIT 10",
            )
            .all(id, g.slug, id)
        : [];
    return {
      rank,
      ...record,
      history,
      teams,
      ...ratingProgress(db, g.slug, format, id),
    };
  });
  app.get("/api/players/:id", async (req) => {
    const id = integer(req.params.id, 1),
      p = db
        .prepare(
          "SELECT p.*,a.handle FROM players p LEFT JOIN accounts a ON a.player_id=p.id WHERE p.id=?",
        )
        .get(id);
    assert(p, "Player not found.", 404);
    const merged = json(p.profile).merged_into;
    if (merged) return { merged_into: merged };
    return {
      ...p,
      profile: json(p.profile),
      records: playerRecords(id),
      ratings: db
        .prepare("SELECT * FROM ratings WHERE player_id=?")
        .all(id)
        .map((r) => ratedRating(db, r)),
      history: db
        .prepare(
          "SELECT l.*,m.game,m.format,m.submitted,m.played_at FROM ledger l JOIN matches m ON m.id=l.match_id WHERE l.player_id=? ORDER BY COALESCE(m.played_at,m.submitted) DESC,m.id DESC LIMIT 200",
        )
        .all(id),
    };
  });
  app.post("/api/players", async (req) => {
    const u = signed(req);
    assert(
      u.site_admin ||
        db.prepare("SELECT 1 FROM game_admins WHERE account_id=?").get(u.id),
      "Only admins can create fill-ins.",
      403,
    );
    const id = Number(
      db
        .prepare("INSERT INTO players(name,created) VALUES(?,?)")
        .run(textValue(req.body.name, 80), Date.now()).lastInsertRowid,
    );
    return { id, ...issueLink(db, "claim", id, u) };
  });
  app.get("/api/teams/:game/:id", async (req) => {
    const t = db
      .prepare("SELECT * FROM teams WHERE game=? AND id=?")
      .get(req.params.game, integer(req.params.id, 1));
    assert(t, "Team not found.", 404);
    return t;
  });
  app.get("/api/teams/:game", async (req) => {
    game(req.params.game);
    const { limit, offset } = page(req.query),
      conditions = ["game=?", "(name LIKE ? OR code LIKE ?)"],
      q = `%${String(req.query.q || "").slice(0, 100)}%`,
      values = [req.params.game, q, q];
    for (const key of ["gender", "nation", "league"])
      if (req.query[key]) {
        conditions.push(
          key + "=?" + (key === "gender" ? " COLLATE NOCASE" : ""),
        );
        values.push(String(req.query[key]).slice(0, 100));
      }
    const where = conditions.join(" AND "),
      filters = {};
    for (const key of ["gender", "nation", "league"])
      filters[key] = db
        .prepare(
          "SELECT DISTINCT " +
            key +
            " AS value FROM teams WHERE game=? ORDER BY " +
            key,
        )
        .all(req.params.game)
        .map((r) => r.value);
    return {
      total: db
        .prepare("SELECT COUNT(*) n FROM teams WHERE " + where)
        .get(...values).n,
      rows: db
        .prepare(
          "SELECT * FROM teams WHERE " +
            where +
            " ORDER BY name LIMIT ? OFFSET ?",
        )
        .all(...values, limit, offset),
      limit,
      offset,
      filters,
    };
  });
  function saveTeam(g, t) {
    assert(game(g).kind === "fc", "Team catalogs are for EA FC.");
    const code = textValue(String(t.code || ""), 40),
      name = textValue(String(t.name || ""), 120),
      overall =
        t.overall == null || t.overall === "" ? null : Number(t.overall);
    assert(
      overall === null ||
        (Number.isFinite(overall) && overall >= 0 && overall <= 100),
      "Team overall must be 0–100, or empty.",
    );
    db.prepare(
      "INSERT INTO teams(game,code,name,overall,nation,league,gender,updated) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(game,code) DO UPDATE SET name=excluded.name,overall=excluded.overall,nation=excluded.nation,league=excluded.league,gender=excluded.gender,updated=excluded.updated",
    ).run(
      g,
      code,
      name,
      overall,
      String(t.nation || "").slice(0, 80),
      String(t.league || "").slice(0, 100),
      String(t.gender || "men").slice(0, 20),
      Date.now(),
    );
  }
  app.post("/api/teams/:game", async (req) => {
    const u = gameAdmin(req, req.params.game);
    tx(() => {
      saveTeam(req.params.game, req.body);
      audit(db, u, "team.update", req.params.game, { code: req.body.code });
    });
    return { ok: true };
  });
  app.post("/api/teams/:game/import", async (req) => {
    const u = gameAdmin(req, req.params.game),
      file = await req.file();
    assert(file, "Choose a CSV or XLSX file.");
    const data = await file.toBuffer();
    let rows;
    if (file.filename.toLowerCase().endsWith(".xlsx")) {
      const wb = new ExcelJS.Workbook();
      try {
        await wb.xlsx.load(data);
      } catch {
        fail("Could not read XLSX workbook.");
      }
      const sheet = wb.worksheets[0];
      assert(sheet, "Workbook is empty.");
      const headers = sheet
        .getRow(1)
        .values.slice(1)
        .map((x) =>
          String(x || "")
            .toLowerCase()
            .trim(),
        );
      rows = [];
      sheet.eachRow((row, n) => {
        if (n > 1)
          rows.push(
            Object.fromEntries(
              headers.map((h, i) => {
                const cell = row.getCell(i + 1),
                  value = cell.value;
                // Use the spreadsheet's cached value; never evaluate formulas.
                return [
                  h,
                  value && typeof value === "object"
                    ? "formula" in value || "sharedFormula" in value
                      ? value.result
                      : cell.text
                    : value,
                ];
              }),
            ),
          );
      });
    } else {
      try {
        rows = parse(data, {
          columns: (h) => h.map((x) => x.toLowerCase().trim()),
          skip_empty_lines: true,
          bom: true,
        });
      } catch {
        fail(
          "Could not read CSV. Use code,name,overall,nation,league,gender headers.",
        );
      }
    }
    assert(
      rows.length && rows.length <= 10000,
      "Import between 1 and 10,000 rows.",
    );
    tx(() => {
      rows.forEach((t) => saveTeam(req.params.game, t));
      audit(db, u, "teams.import", req.params.game, { rows: rows.length });
    });
    return { imported: rows.length };
  });
  app.get("/api/competitions", async (req) => {
    const { limit, offset } = page(req.query),
      g = req.query.game || "eafc27";
    game(g);
    const q = `%${String(req.query.q || "").slice(0, 100)}%`;
    return {
      total: db
        .prepare(
          "SELECT COUNT(*) n FROM competitions WHERE game=? AND name LIKE ?",
        )
        .get(g, q).n,
      rows: db
        .prepare(
          "SELECT * FROM competitions WHERE game=? AND name LIKE ? ORDER BY id DESC LIMIT ? OFFSET ?",
        )
        .all(g, q, limit, offset)
        .map((c) => ({
          ...c,
          settings: json(c.settings),
          entry_count: db
            .prepare("SELECT COUNT(*) n FROM entrants WHERE competition_id=?")
            .get(c.id).n,
          played: db
            .prepare(
              "SELECT COUNT(*) n FROM fixtures WHERE competition_id=? AND status='completed'",
            )
            .get(c.id).n,
          fixture_count: db
            .prepare(
              "SELECT COUNT(*) n FROM fixtures WHERE competition_id=? AND status NOT IN('cancelled','bye')",
            )
            .get(c.id).n,
        })),
      limit,
      offset,
    };
  });
  app.post("/api/competitions", async (req) => {
    const u = participant(req),
      b = req.body || {},
      g = game(b.game),
      format = b.format || "singles";
    assert(
      ["singles", "doubles"].includes(format) &&
        (format === "singles" ||
          ["tennis", "smash", "pickleball"].includes(g.kind)),
      "Unsupported match format.",
    );
    assert(
      ["league", "groups", "knockout"].includes(b.kind),
      "Choose a competition format.",
    );
    const enrollment = b.enrollment || "selected";
    assert(
      ["selected", "open", "both"].includes(enrollment),
      "Invalid enrollment mode.",
    );
    const deadline = b.deadline ? Number(b.deadline) : null;
    assert(
      enrollment === "selected" ||
        (Number.isFinite(deadline) && deadline > Date.now()),
      "Open signup needs a future deadline.",
    );
    return tx(() => {
      const rule = {
        ...settings(b.settings || {}, g.kind, format),
        weights: g.weights,
      };
      const id = Number(
        db
          .prepare(
            "INSERT INTO competitions(game,owner,name,kind,format,enrollment,deadline,settings,created) VALUES(?,?,?,?,?,?,?,?,?)",
          )
          .run(
            g.slug,
            u.id,
            textValue(b.name, 120),
            b.kind,
            format,
            enrollment,
            deadline,
            JSON.stringify(rule),
            Date.now(),
          ).lastInsertRowid,
      );
      const c = getCompetition(db, id);
      for (const [i, ids] of (b.entries || []).entries())
        addEntry(db, c, ids, b.seeds?.[i] ?? i + 1);
      audit(db, u, "competition.create", id);
      return serializeCompetition(db, c);
    });
  });
  const forecastCache = new Map();
  app.get("/api/competitions/:id/projection", async (req) => {
    const c = serializeCompetition(db, getCompetition(db, req.params.id));
    const ratingRows = db
      .prepare(
        "SELECT ep.entry_id,AVG(COALESCE(r.elo,1000)) elo FROM entrant_players ep LEFT JOIN ratings r ON r.player_id=ep.player_id AND r.game=? AND r.format=? WHERE ep.competition_id=? GROUP BY ep.entry_id",
      )
      .all(c.game, c.format, c.id);
    const ratings = Object.fromEntries(
      ratingRows.map((r) => [r.entry_id, r.elo]),
    );
    const football = game(c.game).kind === "fc";
    const history = db
      .prepare(
        "SELECT COUNT(*) n,COALESCE(SUM(outcome=0.5),0) draws FROM matches WHERE game=? AND status='accepted' AND forfeit=0",
      )
      .get(c.game);
    const drawRate = (history.draws + 2) / (history.n + 10);
    const signature = createHash("sha256")
      .update(JSON.stringify([c, ratings, drawRate]))
      .digest("hex");
    const cached = forecastCache.get(c.id);
    if (cached?.signature === signature) return cached.result;
    const result = competitionForecast(c, { ratings, football, drawRate });
    if (forecastCache.size >= 30)
      forecastCache.delete(forecastCache.keys().next().value);
    forecastCache.set(c.id, { signature, result });
    return result;
  });
  app.get("/api/competitions/:id", async (req) => {
    const c = getCompetition(db, req.params.id);
    return {
      ...serializeCompetition(db, c),
      canManage: organizer(db, req.user, c),
      canAdmin: admin(db, req.user, c.game),
    };
  });
  app.get("/api/competitions/:id/predictions", async (req) =>
    bracketPredictions(db, getCompetition(db, req.params.id), req.user),
  );
  app.put("/api/competitions/:id/predictions", async (req) => {
    const user = signed(req);
    return tx(() => saveBracketPrediction(
      db, getCompetition(db, req.params.id), user, req.body?.picks,
    ));
  });
  app.post("/api/competitions/:id/media/:kind", async (req) => {
    const user = signed(req);
    const c = getCompetition(db, req.params.id);
    assert(organizer(db, user, c), "Organizer access required.", 403);
    const kind = req.params.kind;
    assert(["banner", "trophy"].includes(kind), "Choose banner or trophy.");
    const file = await req.file();
    assert(file, "Choose an image.");
    let image;
    try {
      const buffer = await file.toBuffer();
      image = await sharp(buffer, { limitInputPixels: 25000000 })
        .rotate()
        .resize(
          kind === "banner" ? 1800 : 1000,
          kind === "banner" ? 520 : 1000,
          { fit: "inside", withoutEnlargement: true },
        )
        .webp({ quality: 84 })
        .toBuffer();
    } catch {
      fail("Choose a valid image under 5 MB.");
    }
    const previous = db
      .prepare(`SELECT ${kind} image FROM competitions WHERE id=?`)
      .get(c.id)?.image;
    const name = token() + ".webp";
    const fs = await import("node:fs/promises");
    await fs.writeFile(join(uploads, name), image);
    db.prepare("UPDATE competitions SET " + kind + "=? WHERE id=?").run(
      "/uploads/" + name,
      c.id,
    );
    if (previous?.startsWith("/uploads/") && !previous.includes(".."))
      await fs
        .unlink(join(uploads, previous.slice("/uploads/".length)))
        .catch(() => {});
    audit(db, user, "competition.media", c.id, { kind });
    return { [kind]: "/uploads/" + name };
  });
  app.delete("/api/competitions/:id/media/:kind", async (req) => {
    const user = signed(req);
    const c = getCompetition(db, req.params.id);
    assert(organizer(db, user, c), "Organizer access required.", 403);
    const kind = req.params.kind;
    assert(["banner", "trophy"].includes(kind), "Choose banner or trophy.");
    const previous = db
      .prepare(`SELECT ${kind} image FROM competitions WHERE id=?`)
      .get(c.id)?.image;
    db.prepare(`UPDATE competitions SET ${kind}=NULL WHERE id=?`).run(c.id);
    if (previous?.startsWith("/uploads/") && !previous.includes(".."))
      await import("node:fs/promises").then((fs) =>
        fs
          .unlink(join(uploads, previous.slice("/uploads/".length)))
          .catch(() => {}),
      );
    audit(db, user, "competition.media-remove", c.id, { kind });
    return { [kind]: null };
  });
  app.patch("/api/competitions/:id", async (req) => {
    const u = signed(req),
      b = req.body || {};
    return tx(() => {
      const c = getCompetition(db, req.params.id);
      assert(organizer(db, u, c), "Organizer access required.", 403);
      if (
        b.kind !== undefined ||
        b.format !== undefined ||
        b.enrollment !== undefined
      ) {
        assert(
          ["registration", "closed"].includes(c.state),
          "The draw is fixed.",
          409,
        );
        const kind = b.kind || c.kind,
          format = b.format || c.format,
          enrollment = b.enrollment || c.enrollment;
        assert(
          ["league", "groups", "knockout"].includes(kind) &&
            ["singles", "doubles"].includes(format) &&
            ["selected", "open", "both"].includes(enrollment),
          "Invalid competition settings.",
        );
        assert(
          format === "singles" ||
            ["tennis", "smash", "pickleball"].includes(game(c.game).kind),
          "Doubles is not available for this game.",
        );
        assert(
          format === "doubles" ||
            entries(db, c.id).every((e) => e.players.length === 1),
          "Remove pairs before switching to singles.",
        );
        assert(
          enrollment === "selected" ||
            (c.state === "closed" && enrollment === c.enrollment) ||
            Number(b.deadline || c.deadline) > Date.now(),
          "Open registration needs a future deadline.",
        );
        db.prepare(
          "UPDATE competitions SET kind=?,format=?,enrollment=? WHERE id=?",
        ).run(kind, format, enrollment, c.id);
        c.kind = kind;
        c.format = format;
        c.enrollment = enrollment;
      }
      if (b.name !== undefined)
        db.prepare("UPDATE competitions SET name=? WHERE id=?").run(
          textValue(b.name, 120),
          c.id,
        );
      if (b.description !== undefined)
        db.prepare("UPDATE competitions SET description=? WHERE id=?").run(
          typeof b.description === "string" && b.description.length <= 2000
            ? b.description.trim()
            : fail("Description must be 2,000 characters or fewer."),
          c.id,
        );
      if (b.settings !== undefined || b.format !== undefined) {
        assert(
          ["registration", "closed"].includes(c.state),
          "Rules are frozen once the draw starts.",
          409,
        );
        const s = {
          ...settings(
            { ...c.settings, ...b.settings },
            game(c.game).kind,
            c.format,
          ),
          weights: c.settings.weights,
          ...(c.kind === "league" && c.settings.conferenceLayout
            ? {
                conferenceLayout: c.settings.conferenceLayout,
                playoffs: true,
                elimination: "single",
                playoffCount: c.settings.playoffCount,
              }
            : {}),
        };
        db.prepare("UPDATE competitions SET settings=? WHERE id=?").run(
          JSON.stringify(s),
          c.id,
        );
      }
      if (b.deadline !== undefined) {
        assert(c.state === "registration", "Registration is closed.");
        assert(Number(b.deadline) > Date.now(), "Choose a future deadline.");
        db.prepare("UPDATE competitions SET deadline=? WHERE id=?").run(
          Number(b.deadline),
          c.id,
        );
      }
      audit(db, u, "competition.edit", c.id);
      return serializeCompetition(db, getCompetition(db, c.id));
    });
  });
  app.patch("/api/competitions/:id/conferences", async (req) =>
    tx(() => {
      const user = signed(req),
        c = getCompetition(db, req.params.id);
      assert(organizer(db, user, c), "Organizer access required.", 403);
      assert(
        c.kind === "league" && ["registration", "closed"].includes(c.state),
        "Configure conferences before generating a league draw.",
        409,
      );
      const layout = req.body.layout;
      if (layout !== null) {
        validateConferences(
          layout,
          entries(db, c.id)
            .filter((e) => !e.withdrawn)
            .map((e) => e.id),
        );
        conferenceSchedule(layout);
        c.settings.playoffs = true;
        c.settings.elimination = "single";
        c.settings.playoffCount = layout.conferences.reduce(
          (n, conf) => n + conf.divisions.length + layout.wildcards,
          0,
        );
      }
      c.settings.conferenceLayout = layout;
      db.prepare("UPDATE competitions SET settings=? WHERE id=?").run(
        JSON.stringify(c.settings),
        c.id,
      );
      audit(db, user, "competition.conferences", c.id);
      return { ok: true };
    }),
  );
  app.patch("/api/competitions/:id/table", async (req) =>
    tx(() => {
      const user = signed(req),
        c = getCompetition(db, req.params.id);
      assert(organizer(db, user, c), "Organizer access required.", 403);
      assert(c.kind !== "knockout", "This competition has no standings table.");
      const { tableColumns, tieBreaks, countNoContestForPct } = req.body;
      const next = {
        ...c.settings,
        ...(tableColumns === undefined ? {} : { tableColumns }),
      };
      const rulesChanged =
        (tieBreaks !== undefined &&
          JSON.stringify(tieBreaks) !== JSON.stringify(c.settings.tieBreaks)) ||
        (countNoContestForPct !== undefined &&
          countNoContestForPct !== !!c.settings.countNoContestForPct);
      if (rulesChanged) {
        const beforeDraw = ["registration", "closed"].includes(c.state);
        assert(
          beforeDraw ||
            (c.kind === "league" &&
              !c.settings.playoffs &&
              !c.settings.tieRounds?.length &&
              !db
                .prepare("SELECT 1 FROM qualifications WHERE competition_id=?")
                .get(c.id)),
          "Qualification rules are locked after the draw.",
          409,
        );
        if (tieBreaks !== undefined) next.tieBreaks = tieBreaks;
        if (countNoContestForPct !== undefined) {
          assert(
            typeof countNoContestForPct === "boolean",
            "Invalid no-contest setting.",
          );
          next.countNoContestForPct = countNoContestForPct;
        }
      }
      settings(next, game(c.game).kind, c.format);
      db.prepare("UPDATE competitions SET settings=? WHERE id=?").run(
        JSON.stringify(next),
        c.id,
      );
      if (rulesChanged && c.state === "completed") {
        const rows = standings(db, { ...c, settings: next });
        assert(
          rows.length && !rows[1]?.tiedWithPrevious,
          "These rules leave the championship tied.",
          409,
        );
        db.prepare("UPDATE competitions SET champion=? WHERE id=?").run(
          rows[0].entry,
          c.id,
        );
      } else if (rulesChanged && c.state === "active")
        progress(db, { ...c, settings: next });
      audit(db, user, "competition.table", c.id);
      return { ok: true };
    }),
  );
  app.post("/api/competitions/:id/entries", async (req) => {
    const u = participant(req);
    return tx(() => {
      const c = getCompetition(db, req.params.id);
      const manager = organizer(db, u, c);
      assert(
        manager ||
          (c.state === "registration" &&
            c.enrollment !== "selected" &&
            Date.now() < c.deadline),
        "Registration is closed or invitation-only.",
        403,
      );
      const ids = (req.body.players || []).map(Number);
      assert(
        manager || ids.includes(u.player_id),
        "You may register yourself or your own pair.",
        403,
      );
      const id = addEntry(db, c, ids, req.body.seed);
      return { id };
    });
  });
  app.post("/api/fixtures/:id/substitute", async (req) => {
    const user = participant(req);
    return tx(() => {
      const f = db
        .prepare("SELECT * FROM fixtures WHERE id=?")
        .get(integer(req.params.id, 1));
      assert(f, "Fixture not found.", 404);
      const c = getCompetition(db, f.competition_id);
      assert(organizer(db, user, c), "Organizer access required.", 403);
      assert(
        f.status === "ready" &&
          !db.prepare("SELECT 1 FROM matches WHERE fixture_id=?").get(f.id),
        "This fixture already has a result or is not ready.",
        409,
      );
      const entry = integer(req.body.entry, 1),
        outgoing = integer(req.body.outgoing, 1),
        incoming = integer(req.body.incoming, 1);
      assert([f.a, f.b].includes(entry), "Choose an entry in this fixture.");
      const roster = fixturePlayers(db, f.id, entry).map((p) => p.player_id);
      const opposing = fixturePlayers(db, f.id, f.a === entry ? f.b : f.a);
      assert(roster.includes(outgoing), "The original lineup changed.", 409);
      assert(
        !roster.includes(incoming) &&
          !opposing.some((p) => p.player_id === incoming),
        "This player is already in this match.",
        409,
      );
      const target = db
        .prepare("SELECT profile FROM players WHERE id=?")
        .get(incoming);
      assert(
        target && !json(target.profile).merged_into,
        "Choose an available substitute.",
      );
      db.prepare(
        "DELETE FROM fixture_rosters WHERE fixture_id=? AND entry_id=?",
      ).run(f.id, entry);
      for (const player of roster)
        db.prepare("INSERT INTO fixture_rosters VALUES(?,?,?)").run(
          f.id,
          entry,
          player === outgoing ? incoming : player,
        );
      const previous = db
        .prepare(
          "SELECT original FROM fixture_substitutions WHERE fixture_id=? AND entry_id=? AND substitute=?",
        )
        .get(f.id, entry, outgoing);
      const original = previous?.original ?? outgoing;
      if (previous)
        db.prepare(
          "DELETE FROM fixture_substitutions WHERE fixture_id=? AND entry_id=? AND original=?",
        ).run(f.id, entry, original);
      if (incoming !== original)
        db.prepare("INSERT INTO fixture_substitutions VALUES(?,?,?,?,?)").run(
          f.id,
          entry,
          original,
          incoming,
          Date.now(),
        );
      audit(db, user, "fixture.substitute", f.id, {
        entry,
        outgoing,
        incoming,
      });
      return { ok: true };
    });
  });
  app.post("/api/competitions/:id/entries/:entry/withdraw", async (req) => {
    const user = signed(req);
    return tx(() => {
      const c = getCompetition(db, req.params.id),
        entry = integer(req.params.entry, 1);
      assert(organizer(db, user, c), "Organizer access required.", 403);
      assert(
        c.kind === "league" && c.state === "active",
        "Withdrawals are available during an active league.",
        409,
      );
      const entrant = db
        .prepare(
          "SELECT withdrawn FROM entrants WHERE id=? AND competition_id=?",
        )
        .get(entry, c.id);
      assert(
        entrant && !entrant.withdrawn,
        "This seat is already withdrawn.",
        409,
      );
      const fixtures = db
        .prepare(
          "SELECT f.*,m.id match_id,m.forfeit FROM fixtures f LEFT JOIN matches m ON m.fixture_id=f.id AND m.status<>'voided' WHERE f.competition_id=? AND (f.a=? OR f.b=?)",
        )
        .all(c.id, entry, entry);
      const choices = req.body?.fixtures || {};
      for (const f of fixtures.filter((f) => f.status === "ready")) {
        const action = choices[String(f.id)];
        assert(
          ["hold", "forfeit", "no_contest"].includes(action),
          "Choose how to handle every unplayed fixture.",
          400,
        );
        const opponent = f.a === entry ? f.b : f.a;
        if (action === "forfeit") {
          forfeit(db, f.id, opponent, user);
          db.prepare(
            "INSERT OR REPLACE INTO withdrawal_awards(fixture_id,created) VALUES(?,?)",
          ).run(f.id, Date.now());
        } else if (action === "no_contest") {
          db.prepare(
            "UPDATE fixtures SET status='completed',no_contest=1,winner=NULL,loser=NULL WHERE id=?",
          ).run(f.id);
        }
      }
      db.prepare("UPDATE entrants SET withdrawn=1 WHERE id=?").run(entry);
      for (const f of fixtures.filter(
        (f) =>
          f.status === "completed" &&
          f.forfeit &&
          f.match_id &&
          db
            .prepare("SELECT 1 FROM withdrawal_awards WHERE fixture_id=?")
            .get(f.id),
      )) {
        const opponent = f.a === entry ? f.b : f.a;
        const opponentWithdrawn = db
          .prepare("SELECT withdrawn FROM entrants WHERE id=?")
          .get(opponent)?.withdrawn;
        if (!opponentWithdrawn) continue;
        db.prepare(
          "UPDATE matches SET fixture_id=NULL,status='voided',revision=revision+1 WHERE id=?",
        ).run(f.match_id);
        db.prepare(
          "UPDATE fixtures SET status='completed',no_contest=1,winner=NULL,loser=NULL WHERE id=?",
        ).run(f.id);
        db.prepare("DELETE FROM withdrawal_awards WHERE fixture_id=?").run(
          f.id,
        );
        audit(db, user, "fixture.withdrawal-no-contest", f.id, { entry });
      }
      audit(db, user, "competition.withdraw", c.id, { entry });
      progress(db, getCompetition(db, c.id));
      return { ok: true };
    });
  });
  app.post("/api/competitions/:id/entries/:entry/replace", async (req) => {
    const user = participant(req);
    return tx(() => {
      replacePlayer(
        db,
        getCompetition(db, req.params.id),
        integer(req.params.entry, 1),
        integer(req.body.outgoing, 1),
        integer(req.body.incoming, 1),
        user,
        req.body.keep,
        req.body.effective,
      );
      return { ok: true };
    });
  });
  app.delete("/api/competitions/:id/entries/:entry", async (req) => {
    const u = participant(req);
    return tx(() => {
      const c = getCompetition(db, req.params.id),
        e = entries(db, c.id).find((x) => x.id === Number(req.params.entry));
      assert(e, "Entry not found.", 404);
      assert(
        organizer(db, u, c) || e.players.some((p) => p.id === u.player_id),
        "Not your entry.",
        403,
      );
      assert(
        ["registration", "closed"].includes(c.state),
        "The draw is fixed. Declare a forfeit for a withdrawal.",
        409,
      );
      db.prepare("DELETE FROM entrants WHERE id=?").run(e.id);
      return { ok: true };
    });
  });
  app.post("/api/competitions/:id/pair", async (req) => {
    const u = signed(req);
    return tx(() => {
      const c = getCompetition(db, req.params.id);
      assert(organizer(db, u, c), "Organizer access required.", 403);
      assert(
        c.format === "doubles" && ["registration", "closed"].includes(c.state),
        "Pairing is locked.",
      );
      const all = entries(db, c.id),
        a = all.find((x) => x.id === Number(req.body.a)),
        b = all.find((x) => x.id === Number(req.body.b));
      assert(
        a &&
          b &&
          a.id !== b.id &&
          a.players.length === 1 &&
          b.players.length === 1,
        "Choose two unpaired entries.",
      );
      db.prepare("UPDATE entrant_players SET entry_id=? WHERE entry_id=?").run(
        a.id,
        b.id,
      );
      db.prepare("DELETE FROM entrants WHERE id=?").run(b.id);
      return { ok: true };
    });
  });
  app.post("/api/competitions/:id/seeds", async (req) => {
    const u = signed(req);
    return tx(() => {
      const c = getCompetition(db, req.params.id);
      assert(
        organizer(db, u, c) && ["registration", "closed"].includes(c.state),
        "Seeding is locked or not permitted.",
        403,
      );
      const es = entries(db, c.id);
      assert(
        Array.isArray(req.body.seeds) && req.body.seeds.length === es.length,
        "Set every seed.",
      );
      const ids = new Set();
      for (const s of req.body.seeds) {
        assert(
          es.some((e) => e.id === Number(s.id)) && !ids.has(Number(s.id)),
          "Invalid entry.",
        );
        ids.add(Number(s.id));
        db.prepare("UPDATE entrants SET seed=? WHERE id=?").run(
          integer(s.seed, 1, 10000),
          s.id,
        );
      }
      return { ok: true };
    });
  });
  app.post("/api/competitions/:id/close", async (req) => {
    const u = signed(req),
      c = getCompetition(db, req.params.id);
    assert(organizer(db, u, c), "Organizer access required.", 403);
    assert(c.state === "registration", "Registration is already closed.");
    db.prepare("UPDATE competitions SET state='closed' WHERE id=?").run(c.id);
    return { ok: true };
  });
  app.post("/api/competitions/:id/draw", async (req) => {
    const u = signed(req);
    return tx(() => {
      const c = getCompetition(db, req.params.id);
      draw(db, c, u);
      return serializeCompetition(db, getCompetition(db, c.id));
    });
  });
  app.delete("/api/competitions/:id", async (req) => {
    const u = signed(req);
    return tx(() =>
      deleteCompetition(db, getCompetition(db, req.params.id), u, req.body),
    );
  });
  app.post("/api/competitions/:id/qualify", async (req) => {
    const u = signed(req);
    return tx(() => {
      const c = getCompetition(db, req.params.id);
      assert(
        admin(db, u, c.game),
        "An admin must resolve qualification ties.",
        403,
      );
      assert(
        fixtureList(db, c.id)
          .filter((f) => ["league", "group"].includes(f.stage))
          .every((f) => f.status === "completed"),
        "Finish preliminary matches first.",
      );
      const pool = String(req.body.pool || "");
      const serialized = serializeCompetition(db, c);
      const pending = serialized.qualificationPending.find(
        (item) => item.pool === pool,
      );
      assert(pending, "There is no unresolved qualifying boundary tie.");
      assert(
        !serialized.fixtures.some(
          (f) => !["league", "group", "tiebreak"].includes(f.stage),
        ),
        "Qualification has already advanced.",
      );
      const chosen = (req.body.entries || []).map(Number);
      assert(
        chosen.length === pending.count &&
          new Set(chosen).size === pending.count &&
          pending.fixed.every((id) => chosen.includes(id)) &&
          chosen.every(
            (id) => pending.fixed.includes(id) || pending.allowed.includes(id),
          ),
        "Only the tied qualifying places may be changed; select the required number of distinct qualifiers.",
      );
      const reason = textValue(req.body.reason, 1000);
      db.prepare(
        "INSERT OR REPLACE INTO qualifications(competition_id,pool,entries,reason,actor,created) VALUES(?,?,?,?,?,?)",
      ).run(c.id, pool, JSON.stringify(chosen), reason, u.id, Date.now());
      audit(db, u, "competition.qualify", c.id, { pool, chosen, reason });
      progress(db, c);
      return { ok: true };
    });
  });
  app.post("/api/competitions/:id/tiebreak", async (req) => {
    const u = signed(req);
    return tx(() => {
      const c = getCompetition(db, req.params.id);
      assert(organizer(db, u, c), "Organizer access required.", 403);
      assert(
        c.settings.tieResolution === "match",
        "This competition uses admin resolution.",
      );
      assert(
        fixtureList(db, c.id)
          .filter((f) => ["league", "group"].includes(f.stage))
          .every((f) => f.status === "completed"),
        "Finish preliminary matches first.",
      );
      const pool = String(req.body.pool || ""),
        rows = standings(db, c, pool),
        count = qualificationCount(c);
      assert(rows[count]?.tiedWithPrevious, "No qualifying boundary tie.");
      let start = count - 1;
      while (start > 0 && rows[start].tiedWithPrevious) start--;
      let end = count;
      while (rows[end + 1]?.tiedWithPrevious) end++;
      const fs = fixtureList(db, c.id);
      assert(
        fs
          .filter((f) => ["league", "group"].includes(f.stage))
          .every((f) => f.status === "completed"),
        "Finish the preliminary matches first.",
      );
      assert(
        !fs.some((f) => ["knockout", "semifinal", "final"].includes(f.stage)),
        "Qualification has already advanced.",
      );
      assert(
        !fs.some(
          (f) =>
            f.stage === "tiebreak" &&
            f.pool === pool &&
            f.status !== "completed",
        ),
        "Finish the current additional round first.",
      );
      const tied = rows.slice(start, end + 1).map((r) => r.entry),
        ids = [];
      for (let a = 0; a < tied.length; a++)
        for (let b = a + 1; b < tied.length; b++) {
          const id = Number(
            db
              .prepare(
                "INSERT INTO fixtures(competition_id,stage,pool,round,label,a,b,status) VALUES(?,'tiebreak',?,999,'Qualification tiebreak',?,?,'ready')",
              )
              .run(c.id, pool, tied[a], tied[b]).lastInsertRowid,
          );
          ids.push(id);
          for (const f of fs.filter((x) =>
            ["league", "group", "tiebreak"].includes(x.stage),
          ))
            db.prepare("INSERT OR IGNORE INTO dependencies VALUES(?,?)").run(
              f.id,
              id,
            );
        }
      (c.settings.tieRounds ??= []).push({
        fixtures: ids,
        pool,
        count,
        guaranteed: rows.slice(0, start).map((r) => r.entry),
      });
      db.prepare("UPDATE competitions SET settings=? WHERE id=?").run(
        JSON.stringify(c.settings),
        c.id,
      );
      return { ids };
    });
  });

  app.post("/api/competitions/:id/schedule-rounds", async (req) => {
    const user = signed(req);
    return tx(() => {
      const c = getCompetition(db, req.params.id);
      assert(organizer(db, user, c), "Organizer access required.", 403);
      const start = Number(req.body.start),
        interval = Number(req.body.intervalDays);
      assert(
        Number.isSafeInteger(start) && start > Date.now() - 86400000,
        "Choose a valid start date.",
      );
      assert(
        Number.isInteger(interval) && interval >= 1 && interval <= 30,
        "Choose 1–30 days between rounds.",
      );
      const rounds = db
        .prepare(
          "SELECT DISTINCT stage,round FROM fixtures WHERE competition_id=? AND status IN('ready','waiting') ORDER BY round,stage",
        )
        .all(c.id);
      const update = db.prepare(
        "UPDATE fixtures SET scheduled=? WHERE id=? AND scheduled IS NULL",
      );
      let assigned = 0;
      for (const [index, round] of rounds.entries()) {
        const at = start + index * interval * 86400000;
        const fixtures = db
          .prepare(
            "SELECT id FROM fixtures WHERE competition_id=? AND stage=? AND round=? AND status IN('ready','waiting') AND scheduled IS NULL",
          )
          .all(c.id, round.stage, round.round);
        for (const fixture of fixtures)
          assigned += update.run(at, fixture.id).changes;
      }
      audit(db, user, "competition.schedule", c.id, {
        assigned,
        start,
        intervalDays: interval,
      });
      return { assigned };
    });
  });
  app.patch("/api/fixtures/:id/schedule", async (req) => {
    const u = signed(req),
      f = db
        .prepare("SELECT * FROM fixtures WHERE id=?")
        .get(integer(req.params.id, 1));
    assert(f, "Fixture not found.", 404);
    const c = getCompetition(db, f.competition_id);
    assert(organizer(db, u, c), "Organizer access required.", 403);
    assert(
      ["ready", "waiting"].includes(f.status) || f.no_contest,
      "This fixture is already completed.",
    );
    const time = req.body.scheduled ? Number(req.body.scheduled) : null;
    assert(time === null || Number.isFinite(time), "Invalid scheduled time.");
    db.prepare("UPDATE fixtures SET scheduled=? WHERE id=?").run(time, f.id);
    return { ok: true };
  });
  app.post("/api/fixtures/:id/forfeit", async (req) =>
    tx(() => forfeit(db, req.params.id, req.body.winner, signed(req))),
  );
  app.post("/api/fixtures/:id/no-contest", async (req) => {
    const user = signed(req);
    return tx(() => {
      const fixture = db
        .prepare("SELECT * FROM fixtures WHERE id=?")
        .get(integer(req.params.id, 1));
      assert(fixture && fixture.status === "ready", "Choose a ready fixture.");
      const competition = getCompetition(db, fixture.competition_id);
      assert(
        organizer(db, user, competition),
        "Only the organizer or an admin can declare a no contest.",
        403,
      );
      assert(
        !db
          .prepare(
            "SELECT 1 FROM matches WHERE fixture_id=? AND status<>'voided'",
          )
          .get(fixture.id),
        "This fixture already has a result.",
        409,
      );
      const knockout = !["league", "group", "tiebreak"].includes(fixture.stage);
      const replacement = req.body?.replacement
        ? integer(req.body.replacement, 1)
        : null;
      if (replacement) {
        assert(
          knockout && replacement !== fixture.a && replacement !== fixture.b,
          "Choose another entrant.",
        );
        assert(
          db
            .prepare(
              "SELECT 1 FROM entrants WHERE id=? AND competition_id=? AND withdrawn=0",
            )
            .get(replacement, competition.id),
          "Choose an entrant in this competition.",
        );
        assert(
          !db
            .prepare(
              "SELECT 1 FROM fixtures WHERE competition_id=? AND id<>? AND status IN ('ready','waiting') AND (a=? OR b=?)",
            )
            .get(competition.id, fixture.id, replacement, replacement),
          "This entrant already has an upcoming fixture.",
        );
      }
      db.prepare(
        "UPDATE fixtures SET status='completed', no_contest=1, winner=?, loser=NULL WHERE id=?",
      ).run(replacement, fixture.id);
      lockBracketPredictions(db, fixture);
      audit(db, user, "fixture.no-contest", fixture.id, { replacement });
      progress(db, competition);
      return { ok: true };
    });
  });
  app.get("/api/recent-results", async (req) => ({
    rows: db
      .prepare(
        "SELECT * FROM matches WHERE status='accepted' ORDER BY accepted DESC,id DESC LIMIT 5",
      )
      .all()
      .map((match) => serializeMatch(db, match, req.user)),
  }));
  app.get("/api/matches", async (req) => {
    const g = req.query.game || "eafc27";
    game(g);
    const { limit, offset } = page(req.query),
      conditions = ["m.game=?", "m.status<>'voided'"],
      values = [g];
    if (req.query.player) {
      conditions.push(
        "EXISTS(SELECT 1 FROM match_players WHERE match_id=m.id AND player_id=?)",
      );
      values.push(integer(req.query.player, 1));
    }
    if (req.query.format) {
      conditions.push("m.format=?");
      values.push(req.query.format);
    }
    if (["submitted", "accepted"].includes(req.query.status)) {
      conditions.push("m.status=?");
      values.push(req.query.status);
    }
    if (req.query.status === "elo") {
      conditions.push(
        "m.status='accepted' AND m.elo_enabled=1 AND m.elo_checked IS NULL AND m.forfeit=0",
      );
    }
    if (req.query.q) {
      conditions.push(
        "EXISTS(SELECT 1 FROM match_players mp JOIN players p ON p.id=mp.player_id WHERE mp.match_id=m.id AND p.name LIKE ?)",
      );
      values.push(`%${String(req.query.q).slice(0, 100)}%`);
    }
    const where = conditions.join(" AND ");
    return {
      total: db
        .prepare(`SELECT COUNT(*) n FROM matches m WHERE ${where}`)
        .get(...values).n,
      rows: db
        .prepare(
          `SELECT m.* FROM matches m WHERE ${where} ORDER BY COALESCE(m.played_at,m.submitted) DESC,m.id DESC LIMIT ? OFFSET ?`,
        )
        .all(...values, limit, offset)
        .map((m) => serializeMatch(db, m, req.user)),
      limit,
      offset,
    };
  });
  app.get("/api/matches/:id", async (req) => {
    const match = getMatch(db, req.params.id);
    const result = serializeMatch(db, match, req.user);
    return { ...result, context: matchContext(db, match, result.participants) };
  });
  app.post("/api/games/:game/preview", async (req) =>
    preview(db, req.params.game, req.body, signed(req)),
  );
  app.post("/api/games/:game/matches", async (req) =>
    tx(() => submit(db, req.params.game, req.body, participant(req))),
  );
  app.post("/api/matches/:id/accept", async (req) =>
    tx(() => accept(db, req.params.id, participant(req), req.body.revision)),
  );
  app.post("/api/matches/:id/elo", async (req) =>
    tx(() => checkoff(db, req.params.id, signed(req), req.body.revision)),
  );
  app.post("/api/games/:game/elo-checkoff", async (req) => {
    const user = gameAdmin(req, req.params.game);
    game(req.params.game);
    return tx(() => {
      const rows = db
        .prepare(
          "SELECT id,revision,format FROM matches WHERE game=? AND status='accepted' AND elo_enabled=1 AND elo_checked IS NULL AND forfeit=0 ORDER BY COALESCE(played_at,submitted),id",
        )
        .all(req.params.game);
      for (const row of rows)
        checkoff(db, row.id, user, row.revision, { deferRebuild: true });
      for (const format of new Set(rows.map((row) => row.format)))
        rebuild(db, req.params.game, format);
      return { checked: rows.length };
    });
  });
  app.patch("/api/matches/:id/elo-enabled", async (req) =>
    tx(() => setEloEnabled(db, req.params.id, req.body, participant(req))),
  );
  app.patch("/api/matches/:id", async (req) =>
    tx(() => edit(db, req.params.id, req.body, participant(req))),
  );
  app.delete("/api/matches/:id", async (req) =>
    tx(() => edit(db, req.params.id, req.body, signed(req), true)),
  );
  app.post("/api/games/:game/recalculate", async (req) => {
    const u = gameAdmin(req, req.params.game);
    tx(() => {
      for (const f of ["singles", "doubles"]) rebuild(db, req.params.game, f);
      audit(db, u, "elo.rebuild", req.params.game);
    });
    return { ok: true };
  });
  app.get("/api/games/:game/rankings", async (req) => {
    const g = req.params.game;
    game(g);
    const f = req.query.format || "singles",
      { limit, offset } = page(req.query);
    const total = db
      .prepare("SELECT COUNT(*) n FROM ratings WHERE game=? AND format=?")
      .get(g, f).n;
    const rows = db
      .prepare(
        "SELECT r.*,p.name,p.photo,p.profile,a.handle FROM ratings r JOIN players p ON p.id=r.player_id LEFT JOIN accounts a ON a.player_id=p.id WHERE game=? AND format=? ORDER BY elo DESC,player_id LIMIT ? OFFSET ?",
      )
      .all(g, f, limit, offset)
      .map((r, i) => ({
        ...ratedRating(db, r),
        profile: json(r.profile),
        rank: offset + i + 1,
        ...db
          .prepare(
            "SELECT SUM(CASE WHEN m.winner=mp.side THEN 1 ELSE 0 END) w,SUM(CASE WHEN m.winner IS NULL THEN 1 ELSE 0 END) d,SUM(CASE WHEN m.winner IS NOT NULL AND m.winner<>mp.side THEN 1 ELSE 0 END) l FROM match_players mp JOIN matches m ON m.id=mp.match_id WHERE mp.player_id=? AND m.game=? AND m.format=? AND m.status='accepted'",
          )
          .get(r.player_id, g, f),
      }));
    return { total, rows, limit, offset };
  });
  app.get("/api/games/:game/summary", async (req) => {
    const g = req.params.game;
    game(g);
    const stats = db
      .prepare(
        "SELECT COUNT(*) matches,SUM(status='accepted') accepted,SUM(status='submitted') pending,SUM(status='accepted' AND elo_enabled=1 AND elo_checked IS NULL AND forfeit=0) elo_pending FROM matches WHERE game=? AND status<>'voided'",
      )
      .get(g);
    const players = db
      .prepare(
        "SELECT COUNT(DISTINCT mp.player_id) n FROM match_players mp JOIN matches m ON m.id=mp.match_id WHERE m.game=? AND m.status<>'voided'",
      )
      .get(g).n;
    const leader =
      db
        .prepare(
          "SELECT r.*,p.name FROM ratings r JOIN players p ON p.id=r.player_id WHERE r.game=? AND r.format='singles' ORDER BY r.elo DESC LIMIT 1",
        )
        .get(g) || null;
    return { ...stats, players, leader: ratedRating(db, leader) };
  });
  app.get("/api/notifications", async (req) => {
    const u = signed(req),
      { limit, offset } = page(req.query);
    return {
      rows: db
        .prepare(
          "SELECT * FROM notifications WHERE account_id=? ORDER BY id DESC LIMIT ? OFFSET ?",
        )
        .all(u.id, limit, offset),
      unread: db
        .prepare(
          "SELECT COUNT(*) n FROM notifications WHERE account_id=? AND seen=0",
        )
        .get(u.id).n,
    };
  });
  app.post("/api/notifications/read", async (req) => {
    const u = signed(req);
    if (req.body.id)
      db.prepare(
        "UPDATE notifications SET seen=1 WHERE id=? AND account_id=?",
      ).run(req.body.id, u.id);
    else
      db.prepare("UPDATE notifications SET seen=1 WHERE account_id=?").run(
        u.id,
      );
    return { ok: true };
  });
  app.get("/api/admin/people", async (req) => {
    const u = signed(req);
    assert(
      u.site_admin ||
        db.prepare("SELECT 1 FROM game_admins WHERE account_id=?").get(u.id),
      "Admin access required.",
      403,
    );
    const result = playerRows(req.query);
    result.rows = result.rows.map((p) => ({
      ...p,
      site_admin: !!db
        .prepare("SELECT site_admin FROM accounts WHERE player_id=?")
        .get(p.id)?.site_admin,
      admin_of: p.account_id
        ? db
            .prepare("SELECT game FROM game_admins WHERE account_id=?")
            .all(p.account_id)
            .map((x) => x.game)
        : [],
    }));
    return result;
  });
  function administeredPlayer(req) {
    const user = signed(req);
    assert(
      user.site_admin ||
        db.prepare("SELECT 1 FROM game_admins WHERE account_id=?").get(user.id),
      "Admin access required.",
      403,
    );
    const id = integer(req.params.id, 1);
    const player = db.prepare("SELECT profile FROM players WHERE id=?").get(id);
    assert(
      player && !json(player.profile).merged_into,
      "Player not found.",
      404,
    );
    return { id, user };
  }
  app.patch("/api/admin/players/:id/profile", async (req) => {
    const user = site(req);
    const id = integer(req.params.id, 1);
    return tx(() => {
      const player = db.prepare("SELECT * FROM players WHERE id=?").get(id);
      assert(
        player && !json(player.profile).merged_into,
        "Player not found.",
        404,
      );
      const body = req.body || {},
        profile = json(player.profile);
      if (body.name !== undefined)
        db.prepare("UPDATE players SET name=? WHERE id=?").run(
          textValue(body.name, 80),
          id,
        );
      for (const key of ["favoriteTeam", "tag", "mains"]) {
        if (key in body) profile[key] = String(body[key] || "").slice(0, 160);
      }
      if (body.nationalities !== undefined) {
        profile.nationalities = nationalitiesValue(
          body.nationalities,
          profileNationalities(profile),
        );
        profile.nationality = profile.nationalities[0] || "";
      }
      db.prepare("UPDATE players SET profile=? WHERE id=?").run(
        JSON.stringify(profile),
        id,
      );
      audit(db, user, "player.profile", id, {});
      return { ok: true };
    });
  });
  app.post("/api/admin/players/:id/photo", async (req) => {
    const { id, user } = administeredPlayer(req);
    const result = await savePlayerPhoto(req, id);
    audit(db, user, "player.photo", id, { removed: false });
    return result;
  });
  app.delete("/api/admin/players/:id/photo", async (req) => {
    const { id, user } = administeredPlayer(req);
    const previous = db
      .prepare("SELECT photo FROM players WHERE id=?")
      .get(id)?.photo;
    db.prepare("UPDATE players SET photo=NULL WHERE id=?").run(id);
    if (previous?.startsWith("/uploads/") && !previous.includes(".."))
      await import("node:fs/promises").then((fs) =>
        fs
          .unlink(join(uploads, previous.slice("/uploads/".length)))
          .catch(() => {}),
      );
    audit(db, user, "player.photo", id, { removed: true });
    return { photo: null };
  });
  app.post("/api/admin/links", async (req) =>
    tx(() =>
      issueLink(db, req.body.kind, integer(req.body.target, 1), signed(req)),
    ),
  );
  app.post("/api/admin/roles", async (req) => {
    const u = site(req),
      b = req.body;
    game(b.game);
    assert(
      db
        .prepare("SELECT 1 FROM accounts WHERE id=?")
        .get(integer(b.account, 1)),
      "Account not found.",
    );
    if (b.enabled)
      db.prepare("INSERT OR IGNORE INTO game_admins VALUES(?,?)").run(
        b.account,
        b.game,
      );
    else
      db.prepare("DELETE FROM game_admins WHERE account_id=? AND game=?").run(
        b.account,
        b.game,
      );
    audit(db, u, "role.update", b.account, {
      game: b.game,
      enabled: !!b.enabled,
    });
    return { ok: true };
  });
  app.get("/api/admin/requests", async (req) => {
    site(req);
    return db
      .prepare(
        "SELECT r.*,p.name,a.handle FROM requests r JOIN accounts a ON a.id=r.account_id JOIN players p ON p.id=a.player_id WHERE r.state='pending' ORDER BY r.id LIMIT 100",
      )
      .all()
      .map((r) => ({ ...r, payload: json(r.payload) }));
  });
  app.post("/api/admin/requests/:id", async (req) => {
    const u = site(req);
    return tx(() => {
      const r = db
        .prepare("SELECT * FROM requests WHERE id=? AND state='pending'")
        .get(integer(req.params.id, 1));
      assert(r, "Request not found.", 404);
      const p = json(r.payload);
      if (req.body.approve) {
        if (r.kind === "handle")
          db.prepare("UPDATE accounts SET handle=? WHERE id=?").run(
            p.handle,
            r.account_id,
          );
        else if (r.kind === "participation")
          db.prepare("UPDATE accounts SET approved=1 WHERE id=?").run(
            r.account_id,
          );
        else mergePlayer(db, p.source, p.target, u);
      }
      db.prepare("UPDATE requests SET state=? WHERE id=?").run(
        req.body.approve ? "approved" : "rejected",
        r.id,
      );
      audit(db, u, "request.resolve", r.id, { approved: !!req.body.approve });
      return { ok: true };
    });
  });
  app.get("/api/admin/audit", async (req) => {
    site(req);
    const { limit, offset } = page(req.query);
    return db
      .prepare(
        "SELECT id,actor,action,subject,detail,created FROM audit ORDER BY id DESC LIMIT ? OFFSET ?",
      )
      .all(limit, offset);
  });
  app.get("/api/admin/export", async (req) => {
    site(req);
    return {
      exported: new Date().toISOString(),
      games: db.prepare("SELECT * FROM games").all(),
      teams: db.prepare("SELECT * FROM teams").all(),
      catalog_images: db.prepare("SELECT * FROM catalog_images").all(),
      team_badges: db.prepare("SELECT * FROM team_badges").all(),
      team_badge_links: db.prepare("SELECT * FROM team_badge_links").all(),
      entrants: db.prepare("SELECT * FROM entrants").all(),
      entrant_players: db.prepare("SELECT * FROM entrant_players").all(),
      qualifications: db.prepare("SELECT * FROM qualifications").all(),
      players: db.prepare("SELECT * FROM players").all(),
      competitions: db.prepare("SELECT * FROM competitions").all(),
      fixtures: db.prepare("SELECT * FROM fixtures").all(),
      matches: db.prepare("SELECT * FROM matches").all(),
      match_players: db.prepare("SELECT * FROM match_players").all(),
      ratings: db.prepare("SELECT * FROM ratings").all(),
      ledger: db.prepare("SELECT * FROM ledger").all(),
    };
  });
  await app.register(staticPlugin, {
    root: join(root, "static"),
    prefix: "/",
    index: ["index.html"],
    cacheControl: true,
    maxAge: 0,
  });
  await app.register(staticPlugin, {
    root: uploads,
    prefix: "/uploads/",
    decorateReply: false,
    setHeaders: (reply) => {
      reply.header("Content-Type", "image/webp");
      reply.header("Cache-Control", "public,max-age=86400");
    },
  });
  app.addHook("onClose", async () => {
    if (!options.db) db.close();
  });
  await app.ready();
  return app;
}
