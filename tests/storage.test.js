import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import sharp from "sharp";
import { createApp } from "../server/app.js";
import { passwordHash, register } from "../server/auth.js";

test("uploaded PNG profile photos are served as decodable WebP images", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "mimelo-photo-"));
  const app = await createApp({ database: ":memory:", uploads: dir });
  t.after(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });
  register(
    app.db,
    { handle: "photoplayer", name: "Photo Player" },
    await passwordHash("PhotoPassword!"),
  );
  const login = await app.inject({
    method: "POST",
    url: "/api/login",
    headers: { "x-mimelo-request": "1" },
    payload: { identity: "photoplayer", password: "PhotoPassword!" },
  });
  assert.equal(login.statusCode, 200, login.body);
  const png = await sharp({
    create: { width: 32, height: 32, channels: 4, background: "#ff6600" },
  })
    .png()
    .toBuffer();
  const boundary = "mimelo-photo-boundary";
  const upload = await app.inject({
    method: "POST",
    url: "/api/me/photo",
    headers: {
      cookie: login.cookies.map((c) => c.name + "=" + c.value).join("; "),
      "x-mimelo-request": "1",
      "x-csrf-token": login.json().csrf,
      "content-type": "multipart/form-data; boundary=" + boundary,
    },
    payload: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="profile.png"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      png,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  });
  assert.equal(upload.statusCode, 200, upload.body);
  const { photo } = upload.json();
  assert.equal(app.db.prepare("SELECT photo FROM players").get().photo, photo);
  const image = await app.inject(photo);
  assert.equal(image.statusCode, 200, image.body);
  assert.equal(image.headers["content-type"], "image/webp");
  assert.equal(image.headers["cache-control"], "public,max-age=86400");
  assert.deepEqual(
    image.rawPayload,
    readFileSync(join(dir, photo.split("/").pop())),
  );
  const decoded = await sharp(image.rawPayload)
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(decoded.info.width, 512);
  assert.equal(decoded.info.height, 512);
});

test("tournament banners are resized, compressed and replaced media is removed", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "mimelo-tournament-media-"));
  const app = await createApp({ database: ":memory:", uploads: dir });
  t.after(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const owner = register(
    app.db,
    { handle: "bannerowner", name: "Banner Owner" },
    await passwordHash("BannerPassword!"),
    null,
    true,
  );
  app.db
    .prepare(
      "INSERT INTO competitions(game,owner,name,kind,format,enrollment,settings,created) VALUES('tt',?,'Banner Cup','league','singles','selected','{}',1)",
    )
    .run(owner.id);
  const login = await app.inject({
    method: "POST",
    url: "/api/login",
    headers: { "x-mimelo-request": "1" },
    payload: { identity: owner.handle, password: "BannerPassword!" },
  });
  const headers = {
    cookie: login.cookies.map((c) => c.name + "=" + c.value).join("; "),
    "x-mimelo-request": "1",
    "x-csrf-token": login.json().csrf,
  };
  const png = await sharp({
    create: { width: 3200, height: 1000, channels: 3, background: "#15718b" },
  })
    .png()
    .toBuffer();
  async function upload(bytes) {
    const boundary = "mimelo-banner-boundary";
    return app.inject({
      method: "POST",
      url: "/api/competitions/1/media/banner",
      headers: {
        ...headers,
        "content-type": "multipart/form-data; boundary=" + boundary,
      },
      payload: Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="banner.png"\r\nContent-Type: image/png\r\n\r\n`,
        ),
        bytes,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]),
    });
  }
  const first = await upload(png);
  assert.equal(first.statusCode, 200, first.body);
  const firstPath = join(dir, first.json().banner.split("/").pop());
  const firstImage = await app.inject(first.json().banner);
  assert.equal(firstImage.headers["content-type"], "image/webp");
  assert.ok(firstImage.rawPayload.length < png.length);
  const metadata = await sharp(firstImage.rawPayload).metadata();
  assert.ok(metadata.width <= 1800);
  assert.ok(metadata.height <= 520);
  const second = await upload(png);
  assert.equal(second.statusCode, 200, second.body);
  assert.equal(existsSync(firstPath), false);
  const emptyDescription = await app.inject({
    method: "PATCH",
    url: "/api/competitions/1",
    headers,
    payload: { description: "" },
  });
  assert.equal(emptyDescription.statusCode, 200, emptyDescription.body);
  assert.equal(
    app.db.prepare("SELECT description FROM competitions").get().description,
    "",
  );
  const secondPath = join(dir, second.json().banner.split("/").pop());
  const removed = await app.inject({
    method: "DELETE",
    url: "/api/competitions/1/media/banner",
    headers,
  });
  assert.equal(removed.statusCode, 200, removed.body);
  assert.equal(existsSync(secondPath), false);
  assert.equal(
    app.db.prepare("SELECT banner FROM competitions").get().banner,
    null,
  );
});

test("fresh persistent book, atomic CSV/XLSX imports, restart and online backup", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "mimelo-storage-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const database = join(dir, "book.sqlite");
  let app = await createApp({ database, uploads: join(dir, "photos") });
  t.after(async () => {
    if (app) await app.close();
  });
  for (const table of [
    "players",
    "accounts",
    "teams",
    "competitions",
    "matches",
    "ratings",
  ])
    assert.equal(app.db.prepare("SELECT COUNT(*) n FROM " + table).get().n, 0);
  assert.equal(app.db.prepare("SELECT COUNT(*) n FROM games").get().n, 6);
  register(
    app.db,
    { handle: "storageadmin", name: "Storage Admin" },
    await passwordHash("StoragePassword!"),
    null,
    true,
  );
  const login = await app.inject({
    method: "POST",
    url: "/api/login",
    headers: { "x-mimelo-request": "1" },
    payload: { identity: "storageadmin", password: "StoragePassword!" },
  });
  assert.equal(login.statusCode, 200);
  const headers = {
    cookie: login.cookies.map((c) => c.name + "=" + c.value).join("; "),
    "x-mimelo-request": "1",
    "x-csrf-token": login.json().csrf,
  };
  async function upload(filename, data, status = 200) {
    const boundary = "mimelo-test-boundary",
      body = Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
        ),
        Buffer.from(data),
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);
    const res = await app.inject({
      method: "POST",
      url: "/api/teams/eafc27/import",
      headers: {
        ...headers,
        "content-type": "multipart/form-data; boundary=" + boundary,
      },
      payload: body,
    });
    assert.equal(res.statusCode, status, res.body);
    return res.json();
  }
  await upload(
    "teams.csv",
    "code,name,overall,nation,league,gender\nA,Alpha,82,England,League,Men\nB,Beta,,France,League,women\n",
  );
  assert.equal(app.db.prepare("SELECT COUNT(*) n FROM teams").get().n, 2);
  await upload(
    "bad.csv",
    "code,name,overall\nC,Gamma,88\nD,Invalid,500\n",
    400,
  );
  assert.equal(app.db.prepare("SELECT COUNT(*) n FROM teams").get().n, 2);
  const wb = new ExcelJS.Workbook(),
    sheet = wb.addWorksheet("Teams");
  sheet.addRows([
    ["code", "name", "overall", "nation", "league", "gender"],
    ["B", "Beta", 86, "France", "League", "women"],
    ["C", "Gamma", { formula: "80+9", result: 89 }, "USA", "Other", "men"],
  ]);
  await upload("teams.xlsx", await wb.xlsx.writeBuffer());
  await upload("invalid.xlsx", "not a spreadsheet", 400);
  const filtered = await app.inject(
    "/api/teams/eafc27?gender=women&nation=France",
  );
  assert.equal(filtered.json().total, 1);
  assert.equal(filtered.json().rows[0].overall, 86);
  const men = (await app.inject("/api/teams/eafc27?gender=men")).json();
  assert.equal(men.total, 2, "Category filters include capitalized imports");
  assert.deepEqual(
    men.rows.map((team) => team.code),
    ["A", "C"],
  );
  assert.equal((await app.inject("/api/teams/eafc26")).json().total, 0);
  const csrf = await app.inject({
    method: "PATCH",
    url: "/api/me",
    headers: { ...headers, origin: "https://untrusted.example" },
    payload: { name: "Not allowed" },
  });
  assert.equal(csrf.statusCode, 403);
  await app.db.backup(join(dir, "backup.sqlite"));
  await app.close();
  app = null;
  app = await createApp({ database, uploads: join(dir, "photos") });
  assert.equal(app.db.prepare("SELECT COUNT(*) n FROM teams").get().n, 3);
  assert.equal(
    (await app.inject({ url: "/api/me", headers })).json().user.handle,
    "storageadmin",
  );
  const backup = await createApp({
    database: join(dir, "backup.sqlite"),
    uploads: join(dir, "backup-photos"),
  });
  assert.equal(backup.db.prepare("SELECT COUNT(*) n FROM teams").get().n, 3);
  await backup.close();
});
