import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { assert, fail, page, audit } from "./db.js";

export const smashCatalog = JSON.parse(
  readFileSync(new URL("../static/catalogs/smash.json", import.meta.url)),
);
const allFighters = [
  ...smashCatalog.fighters,
  ...(smashCatalog.legacyFighters || []),
];
const smashEntries = (kind) =>
  kind === "fighter" ? allFighters : smashCatalog.stages;
const withSmashImage = (db, kind, entry) => {
  const customImage = catalogImage(db, "smash", kind, entry.id);
  return {
    ...entry,
    image: customImage || entry.image || null,
    custom_image: !!customImage,
  };
};

export function catalogImage(db, game, kind, key) {
  if (kind === "team") {
    const team = db
      .prepare("SELECT code,gender FROM teams WHERE game=? AND code=?")
      .get(game, String(key));
    return team ? teamBadge(db, team)?.image || null : null;
  }
  return (
    db
      .prepare(
        "SELECT image FROM catalog_images WHERE game=? AND kind=? AND key=?",
      )
      .get(game, kind, String(key))?.image || null
  );
}

function teamBadge(db, team) {
  return db
    .prepare(
      `SELECT b.id AS badge_id,b.image FROM team_badge_links l
    JOIN team_badges b ON b.id=l.badge_id WHERE l.code=? AND l.gender=?`,
    )
    .get(team.code, team.gender);
}

function linkBadge(db, team, id) {
  db.prepare(
    `INSERT INTO team_badge_links(code,gender,badge_id) VALUES(?,?,?)
    ON CONFLICT(code,gender) DO UPDATE SET badge_id=excluded.badge_id`,
  ).run(team.code, team.gender, id);
}

// Old match scores store names. Resolve those to the same stable catalog IDs
// used by uploads without rewriting historical score or approval records.
export function smashMedia(db, score) {
  const resolve = (kind, value) => {
    const entry = smashEntries(kind).find(
      (item) => item.name === value || String(item.id) === String(value),
    );
    return entry
      ? withSmashImage(db, kind, entry)
      : { name: String(value || "Unknown"), image: null };
  };
  return (score.games || []).map((game) => ({
    stage: resolve("stage", game.stage),
    fighters: (game.fighters || []).map((name, i) => ({
      ...resolve("fighter", name),
      player_id: score.fighterPlayers?.[i],
    })),
  }));
}

export function registerCatalogImages(app, { db, uploads, game, gameAdmin }) {
  app.get("/api/catalogs/smash", async () => ({
    ...smashCatalog,
    fighters: smashCatalog.fighters.map((entry) =>
      withSmashImage(db, "fighter", entry),
    ),
    legacyFighters: (smashCatalog.legacyFighters || []).map((entry) =>
      withSmashImage(db, "fighter", entry),
    ),
    stages: smashCatalog.stages.map((entry) =>
      withSmashImage(db, "stage", entry),
    ),
  }));
  app.get("/api/team-badges", async (req) => {
    const { limit, offset } = page(req.query);
    const q = `%${String(req.query.q || "").trim()}%`;
    return {
      rows: db
        .prepare(
          "SELECT * FROM team_badges WHERE name LIKE ? ORDER BY name,id LIMIT ? OFFSET ?",
        )
        .all(q, limit, offset),
      total: db
        .prepare("SELECT COUNT(*) n FROM team_badges WHERE name LIKE ?")
        .get(q).n,
      limit,
      offset,
    };
  });
  function validateKind(slug, kind) {
    const g = game(slug);
    assert(
      (g.kind === "fc" && kind === "team") ||
        (g.kind === "smash" && ["fighter", "stage"].includes(kind)),
      "Choose a team badge, Smash character icon, or Smash stage photo for this game.",
    );
  }
  function entry(slug, kind, key) {
    validateKind(slug, kind);
    const item =
      kind === "team"
        ? db
            .prepare("SELECT * FROM teams WHERE game=? AND code=?")
            .get(slug, key)
        : smashEntries(kind).find((item) => String(item.id) === key);
    assert(item, "Catalog entry not found.", 404);
    return item;
  }
  app.get("/api/games/:game/images", async (req) => {
    const slug = req.params.game,
      kind = req.query.kind;
    validateKind(slug, kind);
    const { limit, offset } = page(req.query),
      q = String(req.query.q || "").trim();
    let rows, total;
    if (kind === "team") {
      const where = "game=? AND (name LIKE ? OR code LIKE ?)";
      const args = [slug, `%${q}%`, `%${q}%`];
      total = db
        .prepare("SELECT COUNT(*) n FROM teams WHERE " + where)
        .get(...args).n;
      rows = db
        .prepare(
          "SELECT id,code,name,gender FROM teams WHERE " +
            where +
            " ORDER BY name,id LIMIT ? OFFSET ?",
        )
        .all(...args, limit, offset);
    } else {
      const all = smashEntries(kind).filter((item) =>
        [item.name, item.code, String(item.id), String(item.num || "")].some(
          (v) => v.toLowerCase().includes(q.toLowerCase()),
        ),
      );
      total = all.length;
      rows = all.slice(offset, offset + limit);
    }
    return {
      rows: rows.map((item) => {
        const key = String(kind === "team" ? item.code : item.id);
        return kind === "team"
          ? {
              ...item,
              key,
              badge_id: null,
              image: null,
              ...teamBadge(db, item),
            }
          : { ...withSmashImage(db, kind, item), key };
      }),
      total,
      limit,
      offset,
    };
  });
  app.post("/api/games/:game/images/:kind/:key", async (req) => {
    const { game: slug, kind, key } = req.params;
    const user = gameAdmin(req, slug);
    const item = entry(slug, kind, key);
    const file = await req.file();
    assert(file, "Choose an image.");
    const buffer = await file.toBuffer();
    const name = randomUUID() + ".webp";
    const folder = join(uploads, "catalog");
    mkdirSync(folder, { recursive: true });
    try {
      const input = sharp(buffer, { limitInputPixels: 25000000 });
      const metadata = await input.metadata();
      assert(
        ["png", "jpeg", "webp"].includes(metadata.format),
        "Unsupported image.",
      );
      await input
        .rotate()
        .resize(
          kind === "stage"
            ? {
                width: 1280,
                height: 720,
                fit: "inside",
                withoutEnlargement: true,
              }
            : {
                width: 128,
                height: 128,
                fit: "contain",
                background: "#00000000",
              },
        )
        .webp({ quality: 90 })
        .toFile(join(folder, name));
    } catch {
      fail("Choose a valid PNG, JPEG, or WebP image under 5 MB.");
    }
    const image = "/uploads/catalog/" + name;
    db.transaction(() => {
      if (kind === "team") {
        assert(
          entry(slug, kind, key).gender === item.gender,
          "Team category changed. Reload and try again.",
          409,
        );
        const badge = db
          .prepare("INSERT INTO team_badges(name,image,updated) VALUES(?,?,?)")
          .run(item.name + " · " + item.gender, image, Date.now());
        linkBadge(db, item, Number(badge.lastInsertRowid));
      } else {
        db.prepare(
          "INSERT INTO catalog_images(game,kind,key,image,updated) VALUES(?,?,?,?,?) ON CONFLICT(game,kind,key) DO UPDATE SET image=excluded.image,updated=excluded.updated",
        ).run(slug, kind, key, image, Date.now());
      }
      audit(db, user, "catalog.image.upload", slug, {
        kind,
        key,
        gender: item.gender,
        image,
      });
    })();
    return { key, image };
  });
  app.patch("/api/games/:game/images/team/:key", async (req) => {
    const { game: slug, key } = req.params;
    const user = gameAdmin(req, slug),
      item = entry(slug, "team", key);
    assert(
      Number.isSafeInteger(req.body.badge_id),
      "Choose an existing badge.",
    );
    const badge = db
      .prepare("SELECT * FROM team_badges WHERE id=?")
      .get(req.body.badge_id);
    assert(badge, "Badge not found.", 404);
    db.transaction(() => {
      linkBadge(db, item, badge.id);
      audit(db, user, "catalog.badge.link", slug, {
        key,
        gender: item.gender,
        badge_id: badge.id,
      });
    })();
    return { key, badge_id: badge.id, image: badge.image };
  });
  app.delete("/api/games/:game/images/:kind/:key", async (req) => {
    const { game: slug, kind, key } = req.params;
    const user = gameAdmin(req, slug);
    const item = entry(slug, kind, key);
    db.transaction(() => {
      if (kind === "team") {
        db.prepare(
          "DELETE FROM team_badge_links WHERE code=? AND gender=?",
        ).run(item.code, item.gender);
      } else {
        db.prepare(
          "DELETE FROM catalog_images WHERE game=? AND kind=? AND key=?",
        ).run(slug, kind, key);
      }
      audit(db, user, "catalog.image.remove", slug, {
        kind,
        key,
        gender: item.gender,
      });
    })();
    return { ok: true };
  });
}
