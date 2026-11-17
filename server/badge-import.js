import { readFileSync, mkdirSync } from "node:fs";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import JSZip from "jszip";
import { parse } from "csv-parse/sync";
import sharp from "sharp";
import { assert, audit } from "./db.js";

const require = createRequire(import.meta.url);
const MB = 1024 * 1024;
const columns = [
  "code",
  "name",
  "gender",
  "sofifa_id",
  "url",
  "file",
  "badge_id",
];
const csv = (rows) =>
  [columns, ...rows.map((r) => columns.map((c) => r[c] ?? ""))]
    .map((row) =>
      row.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(","),
    )
    .join("\r\n") + "\r\n";

// ZIP entries are read into bounded buffers, never extracted to supplied paths.
function bytes(entry, max) {
  return new Promise((resolve, reject) => {
    const chunks = [],
      stream = entry.nodeStream();
    let size = 0;
    stream.on("data", (chunk) => {
      size += chunk.length;
      if (size > max) {
        const error = new Error("A ZIP entry is too large.");
        error.statusCode = 413;
        reject(error);
        stream.destroy();
      } else chunks.push(chunk);
    });
    stream.once("error", reject);
    stream.once("end", () => resolve(Buffer.concat(chunks)));
  }).catch((error) => {
    error.statusCode ||= 400;
    throw error;
  });
}
function safePath(path) {
  return (
    path &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    !path.split("/").some((p) => p === ".." || p === "." || p.includes(":"))
  );
}
async function readArchive(data) {
  let zip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    assert(
      false,
      "Choose a readable ZIP containing mapping.csv and crest images.",
    );
  }
  const entries = Object.values(zip.files);
  assert(
    entries.length <= 2500,
    "A badge ZIP can contain at most 2,500 entries.",
  );
  for (const entry of entries)
    assert(
      safePath(entry.unsafeOriginalName || entry.name),
      "ZIP paths must stay inside the archive.",
    );
  const manifest = zip.file("mapping.csv");
  assert(manifest, "The ZIP must contain mapping.csv at its top level.");
  let rows;
  try {
    rows = parse(await bytes(manifest, MB), {
      columns: (headers) => {
        const names = headers.map((h) => h.trim().toLowerCase());
        assert(
          new Set(names).size === names.length,
          "Mapping column names must be unique.",
        );
        return names;
      },
      bom: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (e) {
    if (e.statusCode) throw e;
    assert(
      false,
      "Could not read mapping.csv. Use code,name,gender,sofifa_id,url,file,badge_id headers.",
    );
  }
  assert(
    rows.length > 0 && rows.length <= 10000,
    "Map between 1 and 10,000 teams.",
  );
  assert(Object.hasOwn(rows[0], "code"), "mapping.csv needs a code column.");
  const images = new Map();
  let total = 0;
  for (const row of rows) {
    row.code = String(row.code || "").trim();
    row.gender = String(row.gender || "men").trim();
    row.file = String(row.file || "").trim();
    row.badge_id = String(row.badge_id || "").trim();
    if (!row.file || images.has(row.file)) continue;
    const entry = safePath(row.file) && zip.file(row.file);
    if (!entry) {
      images.set(row.file, { error: "Image file missing from ZIP" });
      continue;
    }
    const buffer = await bytes(entry, 5 * MB);
    total += buffer.length;
    assert(
      total <= 100 * MB,
      "Expanded crest files must total at most 100 MB.",
      413,
    );
    try {
      const image = sharp(buffer, { limitInputPixels: 25000000 });
      const meta = await image.metadata();
      assert(
        ["png", "jpeg", "webp"].includes(meta.format),
        "Unsupported image",
      );
      const normalized = await image
        .rotate()
        .resize({
          width: 128,
          height: 128,
          fit: "contain",
          background: "#00000000",
        })
        .webp({ quality: 90 })
        .toBuffer();
      images.set(row.file, { buffer: normalized });
    } catch {
      images.set(row.file, { error: "Invalid PNG, JPEG, or WebP image" });
    }
  }
  return { rows, images };
}

function planImport(db, slug, archive) {
  const seen = new Map();
  for (const row of archive.rows)
    seen.set(row.code, (seen.get(row.code) || 0) + 1);
  const groups = new Map();
  const rows = archive.rows.map((row) => {
    const team = db
      .prepare("SELECT * FROM teams WHERE game=? AND code=?")
      .get(slug, row.code);
    const existing =
      team &&
      db
        .prepare(
          "SELECT badge_id FROM team_badge_links WHERE code=? AND gender=?",
        )
        .get(team.code, team.gender)?.badge_id;
    const out = {
      code: row.code,
      name: team?.name || String(row.name || ""),
      gender: row.gender,
      file: row.file,
      badge_id: existing || null,
      status: "issue",
      message: "",
      updated: team?.updated,
    };
    if (seen.get(row.code) > 1) out.message = "Duplicate team code in mapping";
    else if (!team) out.message = "Team code not found in this edition";
    else if (team.gender !== row.gender)
      out.message = "Gender does not match the team catalog";
    else if (
      row.badge_id &&
      (!/^\d+$/.test(row.badge_id) ||
        !Number.isSafeInteger(Number(row.badge_id)) ||
        !db
          .prepare("SELECT id FROM team_badges WHERE id=?")
          .get(Number(row.badge_id)))
    )
      out.message = "Saved badge ID not found";
    else {
      out.source = row.badge_id
        ? "badge:" + Number(row.badge_id)
        : row.file
          ? "file:" + row.file
          : "";
      out.status = existing ? "existing" : "pending";
      out.message = existing ? "Keep existing badge" : "";
      if (out.source) {
        if (!groups.has(out.source)) groups.set(out.source, []);
        groups.get(out.source).push(out);
      } else if (!existing) {
        out.status = "issue";
        out.message = "No image file or saved badge ID supplied";
      }
    }
    return out;
  });
  for (const [source, targets] of groups) {
    const saved = source.startsWith("badge:")
      ? [Number(source.slice(6))]
      : [
          ...new Set(
            targets
              .filter((r) => r.status === "existing")
              .map((r) => r.badge_id),
          ),
        ];
    for (const row of targets.filter((r) => r.status === "pending")) {
      if (saved.length > 1) {
        row.status = "issue";
        row.message =
          "Mapped teams have different saved crests; specify a badge_id";
      } else if (saved.length === 1) {
        row.status = "ready";
        row.use_badge = saved[0];
        row.message = "Reuse saved badge";
        row.image = db
          .prepare("SELECT image FROM team_badges WHERE id=?")
          .get(saved[0]).image;
      } else {
        const image = archive.images.get(row.file);
        if (!image || image.error) {
          row.status = "issue";
          row.message = image?.error || "Image file missing from ZIP";
        } else {
          row.status = "ready";
          row.message = "Add crest from " + row.file;
          row.image =
            "data:image/webp;base64," + image.buffer.toString("base64");
        }
      }
    }
  }
  return rows;
}
function fingerprint(data, rows) {
  return createHash("sha256")
    .update(data)
    .update(JSON.stringify(rows))
    .digest("hex");
}
function summary(rows) {
  return {
    ready: rows.filter((r) => r.status === "ready").length,
    existing: rows.filter((r) => r.status === "existing").length,
    issues: rows.filter((r) => r.status === "issue").length,
  };
}

export async function crestHelperZip() {
  const zip = new JSZip();
  for (const name of [
    "manifest.json",
    "background.js",
    "helper.html",
    "helper.js",
    "helper.css",
    "mapping.js",
    "README.txt",
  ])
    zip.file(
      name,
      readFileSync(new URL("../browser-helper/" + name, import.meta.url)),
    );
  zip.file(
    "jszip.min.js",
    readFileSync(require.resolve("jszip/dist/jszip.min.js")),
  );
  zip.file(
    "JSZIP-LICENSE.txt",
    readFileSync(require.resolve("jszip/LICENSE.markdown")),
  );
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

export function registerBadgeImport(app, { db, uploads, game, gameAdmin }) {
  function authorize(req) {
    const user = gameAdmin(req, req.params.game);
    assert(
      game(req.params.game).kind === "fc",
      "Badge imports are for EA FC teams.",
    );
    return user;
  }
  app.get("/api/games/:game/badge-import/template", async (req, reply) => {
    authorize(req);
    const rows = db
      .prepare(
        `SELECT t.code,t.name,t.gender,l.badge_id FROM teams t
      LEFT JOIN team_badge_links l ON l.code=t.code AND l.gender=t.gender
      WHERE t.game=? ORDER BY t.name,t.code`,
      )
      .all(req.params.game);
    return reply
      .header(
        "Content-Disposition",
        'attachment; filename="mimelo-team-mapping.csv"',
      )
      .type("text/csv; charset=utf-8")
      .send(csv(rows));
  });
  app.get("/api/games/:game/badge-import/helper", async (req, reply) => {
    authorize(req);
    return reply
      .header(
        "Content-Disposition",
        'attachment; filename="mimelo-crest-helper.zip"',
      )
      .type("application/zip")
      .send(await crestHelperZip());
  });
  for (const action of ["preview", "apply"]) {
    app.post("/api/games/:game/badge-import/" + action, async (req) => {
      const user = authorize(req),
        slug = req.params.game;
      const file = await req.file({ limits: { fileSize: 25 * MB, files: 1 } });
      assert(file, "Choose a crest ZIP.");
      const data = await file.toBuffer();
      const archive = await readArchive(data),
        rows = planImport(db, slug, archive);
      const preview = fingerprint(data, rows);
      if (action === "preview") return { rows, ...summary(rows), preview };
      assert(
        req.query.preview === preview,
        "The catalog or ZIP changed. Preview the import again.",
        409,
      );
      const folder = join(uploads, "catalog"),
        paths = [];
      const saved = new Map();
      mkdirSync(folder, { recursive: true });
      try {
        for (const row of rows.filter(
          (r) => r.status === "ready" && !r.use_badge,
        )) {
          if (saved.has(row.source)) continue;
          const name = randomUUID() + ".webp",
            path = join(folder, name);
          paths.push(path);
          await writeFile(path, archive.images.get(row.file).buffer, {
            flag: "wx",
          });
          saved.set(row.source, "/uploads/catalog/" + name);
        }
        db.transaction(() => {
          assert(
            fingerprint(data, planImport(db, slug, archive)) === preview,
            "The team catalog changed. Preview the import again.",
            409,
          );
          const ids = new Map();
          for (const row of rows.filter((r) => r.status === "ready")) {
            let id = row.use_badge || ids.get(row.source);
            if (!id) {
              id = Number(
                db
                  .prepare(
                    "INSERT INTO team_badges(name,image,updated) VALUES(?,?,?)",
                  )
                  .run(
                    row.name + " · imported",
                    saved.get(row.source),
                    Date.now(),
                  ).lastInsertRowid,
              );
              ids.set(row.source, id);
            }
            db.prepare(
              "INSERT INTO team_badge_links(code,gender,badge_id) VALUES(?,?,?)",
            ).run(row.code, row.gender, id);
          }
          audit(db, user, "catalog.badges.import", slug, summary(rows));
        }).immediate();
      } catch (e) {
        await Promise.allSettled(paths.map((path) => unlink(path)));
        throw e;
      }
      return {
        imported: summary(rows).ready,
        existing: summary(rows).existing,
        issues: summary(rows).issues,
      };
    });
  }
}
