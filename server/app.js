import Fastify from "fastify";
import cookie from "@fastify/cookie";
import staticPlugin from "@fastify/static";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import { resolve, join } from "node:path";
import { mkdirSync } from "node:fs";
import sharp from "sharp";
import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
import { ratedRating, ratingProgress } from "./ratings.js";
import { registerCatalogImages } from "./catalog-images.js";
import { registerBadgeImport } from "./badge-import.js";
import { deleteCompetition } from "./competition-deletion.js";
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
        return register(db, b, hashed, id);
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
            old[k] = String(b.profile[k] || "").slice(
              0,
              k === "bio" ? 500 : 160,
            );
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
  app.post("/api/me/photo", async (req) => {
    const u = signed(req),
      file = await req.file();
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
    db.prepare("UPDATE players SET photo=? WHERE id=?").run(
      "/uploads/" + name,
      u.player_id,
    );
    return { photo: "/uploads/" + name };
  });
  app.delete("/api/me/photo", async (req) => {
    const u = signed(req);
    db.prepare("UPDATE players SET photo=NULL WHERE id=?").run(u.player_id);
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
  function playerRows(q = {}) {
    const { limit, offset } = page(q),
      search = `%${String(q.q || "").slice(0, 80)}%`;
    const where =
      "WHERE json_extract(p.profile,'$.merged_into') IS NULL AND (p.name LIKE ? OR a.handle LIKE ?)";
    const total = db
      .prepare(
        `SELECT COUNT(*) n FROM players p LEFT JOIN accounts a ON a.player_id=p.id ${where}`,
      )
      .get(search, search).n;
    return {
      total,
      limit,
      offset,
      rows: db
        .prepare(
          `SELECT p.*,a.handle,a.id AS account_id FROM players p LEFT JOIN accounts a ON a.player_id=p.id ${where} ORDER BY p.name,p.id LIMIT ? OFFSET ?`,
        )
        .all(search, search, limit, offset)
        .map((p) => ({
          ...p,
          profile: json(p.profile),
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
          "SELECT t.* FROM matches m JOIN match_players mp ON mp.match_id=m.id JOIN teams t ON t.id=CASE WHEN mp.side=0 THEN json_extract(m.score,'$.teamA') ELSE json_extract(m.score,'$.teamB') END WHERE mp.player_id=? AND m.game=? AND m.status<>'voided' ORDER BY m.submitted DESC,m.id DESC LIMIT 1",
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
        "SELECT l.*,m.submitted FROM ledger l JOIN matches m ON m.id=l.match_id WHERE l.player_id=? AND m.game=? AND m.format=? ORDER BY m.submitted DESC,m.id DESC LIMIT 200",
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
      ratings: db
        .prepare("SELECT * FROM ratings WHERE player_id=?")
        .all(id)
        .map((r) => ratedRating(db, r)),
      history: db
        .prepare(
          "SELECT l.*,m.game,m.format,m.submitted FROM ledger l JOIN matches m ON m.id=l.match_id WHERE l.player_id=? ORDER BY m.submitted DESC,m.id DESC LIMIT 200",
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
              "SELECT COUNT(*) n FROM fixtures WHERE competition_id=? AND status<>'cancelled'",
            )
            .get(c.id).n,
        })),
      limit,
      offset,
    };
  });
  app.post("/api/competitions", async (req) => {
    const u = signed(req),
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
  app.get("/api/competitions/:id", async (req) => {
    const c = getCompetition(db, req.params.id);
    return {
      ...serializeCompetition(db, c),
      canManage: organizer(db, req.user, c),
      canAdmin: admin(db, req.user, c.game),
    };
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
  app.post("/api/competitions/:id/entries", async (req) => {
    const u = signed(req);
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
  app.delete("/api/competitions/:id/entries/:entry", async (req) => {
    const u = signed(req);
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
      const pool = String(req.body.pool || ""),
        rows = standings(db, c, pool),
        count = qualificationCount(c);
      assert(
        rows.length > count && rows[count].tiedWithPrevious,
        "There is no unresolved qualifying boundary tie.",
      );
      assert(
        !fixtureList(db, c.id).some(
          (f) => !["league", "group", "tiebreak"].includes(f.stage),
        ),
        "Qualification has already advanced.",
      );
      const chosen = (req.body.entries || []).map(Number);
      assert(
        chosen.length === count &&
          new Set(chosen).size === count &&
          chosen.every((id) => rows.some((r) => r.entry === id)),
        "Select the required number of distinct qualifiers.",
      );
      let start = count - 1;
      while (start > 0 && rows[start].tiedWithPrevious) start--;
      let end = count;
      while (rows[end + 1]?.tiedWithPrevious) end++;
      const fixed = rows.slice(0, start).map((r) => r.entry),
        allowed = rows.slice(start, end + 1).map((r) => r.entry);
      assert(
        fixed.every((id) => chosen.includes(id)) &&
          chosen.every((id) => fixed.includes(id) || allowed.includes(id)),
        "Only the tied qualifying places may be changed.",
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

  app.patch("/api/fixtures/:id/schedule", async (req) => {
    const u = signed(req),
      f = db
        .prepare("SELECT * FROM fixtures WHERE id=?")
        .get(integer(req.params.id, 1));
    assert(f, "Fixture not found.", 404);
    const c = getCompetition(db, f.competition_id);
    assert(organizer(db, u, c), "Organizer access required.", 403);
    assert(
      ["ready", "waiting"].includes(f.status),
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
          `SELECT m.* FROM matches m WHERE ${where} ORDER BY m.submitted DESC,m.id DESC LIMIT ? OFFSET ?`,
        )
        .all(...values, limit, offset)
        .map((m) => serializeMatch(db, m, req.user)),
      limit,
      offset,
    };
  });
  app.get("/api/matches/:id", async (req) =>
    serializeMatch(db, getMatch(db, req.params.id), req.user),
  );
  app.post("/api/games/:game/preview", async (req) =>
    preview(db, req.params.game, req.body, signed(req)),
  );
  app.post("/api/games/:game/matches", async (req) =>
    tx(() => submit(db, req.params.game, req.body, signed(req))),
  );
  app.post("/api/matches/:id/accept", async (req) =>
    tx(() => accept(db, req.params.id, signed(req), req.body.revision)),
  );
  app.post("/api/matches/:id/elo", async (req) =>
    tx(() => checkoff(db, req.params.id, signed(req), req.body.revision)),
  );
  app.patch("/api/matches/:id/elo-enabled", async (req) =>
    tx(() => setEloEnabled(db, req.params.id, req.body, signed(req))),
  );
  app.patch("/api/matches/:id", async (req) =>
    tx(() => edit(db, req.params.id, req.body, signed(req))),
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
        "SELECT r.*,p.name,p.photo,a.handle FROM ratings r JOIN players p ON p.id=r.player_id LEFT JOIN accounts a ON a.player_id=p.id WHERE game=? AND format=? ORDER BY elo DESC,player_id LIMIT ? OFFSET ?",
      )
      .all(g, f, limit, offset)
      .map((r, i) => ({
        ...ratedRating(db, r),
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
