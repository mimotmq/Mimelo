import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  readdirSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import sharp from "sharp";
import JSZip from "jszip";
import { createApp } from "../server/app.js";
import { register, passwordHash } from "../server/auth.js";
import { parseMapping } from "../browser-helper/mapping.js";
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.MIMELO_PLAYWRIGHT_MODULE || "@playwright/test",
);

async function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), "mimelo-catalog-"));
  const options = {
    database: join(dir, "book.sqlite"),
    uploads: join(dir, "uploads"),
  };
  let app = await createApp(options);
  t.after(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const pw = await passwordHash("CatalogPassword!");
  const users = [0, 1, 2, 3].map((i) =>
    register(
      app.db,
      { name: "Catalog Player " + i, handle: "catalog" + i },
      pw,
      null,
      i === 0,
    ),
  );
  const headers = [];
  for (const u of users.slice(0, 2)) {
    const login = await app.inject({
      method: "POST",
      url: "/api/login",
      headers: { "x-mimelo-request": "1" },
      payload: { identity: u.handle, password: "CatalogPassword!" },
    });
    assert.equal(login.statusCode, 200, login.body);
    headers.push({
      cookie: login.cookies.map((c) => c.name + "=" + c.value).join("; "),
      "x-mimelo-request": "1",
      "x-csrf-token": login.json().csrf,
    });
  }
  async function call(method, url, payload, status = 200, user = 0) {
    const r = await app.inject({
      method,
      url,
      headers: headers[user],
      ...(payload ? { payload } : {}),
    });
    assert.equal(r.statusCode, status, r.body);
    return r.json();
  }
  const png = await sharp({
    create: { width: 320, height: 180, channels: 4, background: "#0088aa80" },
  })
    .png()
    .toBuffer();
  async function upload(url, buffer = png, status = 200, user = 0) {
    const boundary = "catalog-test-boundary";
    const r = await app.inject({
      method: "POST",
      url,
      headers: {
        ...headers[user],
        "content-type": "multipart/form-data; boundary=" + boundary,
      },
      payload: Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="image.png"\r\nContent-Type: image/png\r\n\r\n`,
        ),
        buffer,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]),
    });
    assert.equal(r.statusCode, status, r.body);
    return r.json();
  }
  for (const game of ["eafc26", "eafc27"])
    for (const code of ["AAA", "BBB"])
      await call("POST", `/api/teams/${game}`, {
        code,
        name: "Team " + code,
        overall: 80,
      });
  const teams = (await call("GET", "/api/teams/eafc27")).rows;
  const fc = await call("POST", "/api/games/eafc27/matches", {
    format: "singles",
    sides: [[users[0].player_id], [users[1].player_id]],
    score: { a: 2, b: 1, teamA: teams[0].id, teamB: teams[1].id },
  });
  const smash = await call("POST", "/api/games/smash/matches", {
    format: "doubles",
    sides: [
      [users[1].player_id, users[0].player_id],
      [users[2].player_id, users[3].player_id],
    ],
    score: {
      bestOf: 3,
      games: [
        {
          a: 6,
          b: 2,
          stage: "Battlefield",
          fighters: ["Mario", "Link", "Kirby", "Fox"],
        },
        {
          a: 6,
          b: 3,
          stage: "Final Destination",
          fighters: ["Pikachu", "Mario", "Kirby", "Fox"],
        },
      ],
    },
  });
  return {
    get app() {
      return app;
    },
    users,
    headers,
    png,
    uploads: options.uploads,
    call,
    upload,
    fc,
    smash,
    async restart() {
      await app.close();
      app = await createApp(options);
    },
  };
}

async function badgeZip(mapping, files = {}) {
  const zip = new JSZip();
  zip.file("mapping.csv", mapping);
  for (const [name, data] of Object.entries(files)) zip.file(name, data);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

test("bulk crests preview without writes, preserve uploads, reuse women's crests, and share across editions", async (t) => {
  const h = await setup(t);
  const manual = await h.upload("/api/games/eafc27/images/team/AAA");
  for (const slug of ["eafc26", "eafc27"])
    for (const [code, gender] of [
      ["AAAW", "women"],
      ["BBBW", "women"],
    ])
      await h.call("POST", "/api/teams/" + slug, { code, name: code, gender });
  const original = h.app.db
    .prepare("SELECT COUNT(*) n FROM team_badges")
    .get().n;
  const zip = await badgeZip(
    `code,name,gender,file,badge_id
AAA,Club A,men,manual.png,
AAAW,Club A Women,women,manual.png,
BBB,Club B,men,new.png,
BBBW,Club B Women,women,new.png,
UNKNOWN,Unknown,men,new.png,
`,
    { "new.png": h.png },
  );
  const base = "/api/games/eafc27/badge-import/";
  await h.upload(base + "preview", zip, 403, 1);
  const p = await h.upload(base + "preview", zip);
  assert.deepEqual([p.ready, p.existing, p.issues], [3, 1, 1]);
  assert.equal(p.rows[1].use_badge, 1);
  assert.equal(
    h.app.db.prepare("SELECT COUNT(*) n FROM team_badges").get().n,
    original,
  );
  assert.equal(readdirSync(join(h.uploads, "catalog")).length, 1);
  await h.upload(base + "apply", zip, 409);
  const result = await h.upload(base + "apply?preview=" + p.preview, zip);
  assert.equal(result.imported, 3);
  assert.equal(
    h.app.db.prepare("SELECT COUNT(*) n FROM team_badges").get().n,
    original + 1,
  );
  const links = h.app.db
    .prepare("SELECT * FROM team_badge_links ORDER BY code")
    .all();
  assert.equal(links[0].badge_id, links[1].badge_id);
  assert.equal(links[2].badge_id, links[3].badge_id);
  assert.notEqual(links[0].badge_id, links[2].badge_id);
  for (const slug of ["eafc26", "eafc27"]) {
    const catalog = await h.call("GET", `/api/games/${slug}/images?kind=team`);
    assert.equal(
      catalog.rows.find((r) => r.code === "AAA").image,
      manual.image,
    );
    assert.equal(
      catalog.rows.find((r) => r.code === "AAAW").image,
      manual.image,
    );
    assert.equal(
      catalog.rows.find((r) => r.code === "BBB").image,
      catalog.rows.find((r) => r.code === "BBBW").image,
    );
  }
  const repeat = await h.upload(base + "preview", zip);
  assert.deepEqual([repeat.ready, repeat.existing, repeat.issues], [0, 4, 1]);
  assert.equal(
    (await h.upload(base + "apply?preview=" + repeat.preview, zip)).imported,
    0,
  );
  await h.restart();
  assert.equal(
    (await h.call("GET", "/api/games/eafc26/images?kind=team&q=AAAW")).rows[0]
      .image,
    manual.image,
  );
});

test("bulk badge import validates archives and stale previews, and supports explicit saved badge links", async (t) => {
  const h = await setup(t),
    base = "/api/games/eafc27/badge-import/";
  await h.upload(base + "preview", Buffer.from("not a zip"), 400);
  const noManifest = await new JSZip().generateAsync({ type: "nodebuffer" });
  await h.upload(base + "preview", noManifest, 400);
  const traversal = new JSZip()
    .file("mapping.csv", "code,file\nAAA,a.png\n")
    .file("../a.png", h.png);
  await h.upload(
    base + "preview",
    await traversal.generateAsync({ type: "nodebuffer" }),
    400,
  );
  await h.upload(base + "preview", await badgeZip("name\nAAA\n"), 400);
  await h.upload(
    base + "preview",
    await badgeZip("code,file\nAAA,big.png\n", {
      "big.png": Buffer.alloc(5 * 1024 * 1024 + 1),
    }),
    413,
  );
  await h.upload(
    base + "preview",
    await badgeZip("code,file\n" + "x".repeat(1024 * 1024)),
    413,
  );
  const issues = await h.upload(
    base + "preview",
    await badgeZip(
      "code,gender,file\nAAA,men,a.png\nAAA,men,b.png\nBBB,women,b.png\n",
      { "a.png": h.png },
    ),
  );
  assert.deepEqual([issues.ready, issues.issues], [0, 3]);
  assert.match(issues.rows[0].message, /Duplicate/);
  assert.match(issues.rows[2].message, /Gender/);
  const invalid = await h.upload(
    base + "preview",
    await badgeZip("code,file\nAAA,bad.png\nBBB,missing.png\n", {
      "bad.png": "not png",
    }),
  );
  assert.equal(invalid.issues, 2);
  const zip = await badgeZip("code,file\nAAA,a.png\n", { "a.png": h.png });
  const preview = await h.upload(base + "preview", zip);
  await h.upload("/api/games/eafc26/images/team/AAA");
  await h.upload(base + "apply?preview=" + preview.preview, zip, 409);
  const badge = (await h.call("GET", "/api/team-badges")).rows[0];
  const reuseZip = await badgeZip(
    `code,gender,badge_id\nBBB,men,${badge.id}\n`,
  );
  const reuse = await h.upload(base + "preview", reuseZip);
  assert.equal(reuse.ready, 1);
  await h.upload(base + "apply?preview=" + reuse.preview, reuseZip);
  assert.equal(
    h.app.db.prepare("SELECT COUNT(*) n FROM team_badges").get().n,
    1,
  );
  const template = await h.app.inject({
    url: base + "template",
    headers: h.headers[0],
  });
  assert.equal(template.statusCode, 200);
  assert.match(
    template.body,
    /"code","name","gender","sofifa_id","url","file","badge_id"/,
  );
  const helper = await h.app.inject({
    url: base + "helper",
    headers: h.headers[0],
  });
  assert.equal(helper.statusCode, 200);
  const helperZip = await JSZip.loadAsync(helper.rawPayload);
  assert(helperZip.file("jszip.min.js"));
  const manifest = JSON.parse(
    await helperZip.file("manifest.json").async("string"),
  );
  assert.deepEqual(manifest.host_permissions, [
    "https://sofifa.com/*",
    "https://cdn.sofifa.net/*",
  ]);
  assert.equal(
    (await h.app.inject({ url: base + "template", headers: h.headers[1] }))
      .statusCode,
    403,
  );
});

test("admins preview and apply a bulk crest ZIP on mobile", async (t) => {
  const h = await setup(t);
  await h.app.listen({ host: "127.0.0.1", port: 0 });
  const base = "http://127.0.0.1:" + h.app.server.address().port;
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await context.addCookies([
    { name: "sid", value: h.headers[0].cookie.slice(4), url: base },
  ]);
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/admin.html");
  await page.waitForFunction(() => document.body.dataset.ready === "true");
  await page.locator('[data-action="game-admin"][data-game="eafc27"]').click();
  await page
    .getByRole("button", { name: "Manage images", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Bulk import crests", exact: true })
    .click();
  const zip = await badgeZip("code,name,gender,file\nBBB,Club B,men,b.png\n", {
    "b.png": h.png,
  });
  await page.locator("#badge-zip").setInputFiles({
    name: "crests.zip",
    mimeType: "application/zip",
    buffer: zip,
  });
  await page.getByRole("button", { name: "Preview ZIP", exact: true }).click();
  await page.waitForFunction(() =>
    document.querySelector("#bulk-message")?.textContent.includes("1 ready"),
  );
  assert.equal(
    h.app.db.prepare("SELECT COUNT(*) n FROM team_badges").get().n,
    0,
  );
  await page.locator("#bulk-preview img").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const img = document.querySelector("#bulk-preview img");
    return img?.complete && img.naturalWidth > 0;
  });
  assert.equal(
    await page
      .locator("#bulk-preview img")
      .evaluate((img) => img.complete && img.naturalWidth > 0),
    true,
  );
  mkdirSync("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/bulk-crests-mobile.png" });
  assert.equal(
    await page
      .locator("dialog")
      .last()
      .evaluate((d) => d.scrollWidth <= d.clientWidth + 1),
    true,
    await page
      .locator("dialog")
      .last()
      .evaluate((d) =>
        JSON.stringify({
          width: d.clientWidth,
          scroll: d.scrollWidth,
          overflow: [...d.querySelectorAll("*")]
            .filter(
              (e) =>
                e.getBoundingClientRect().right >
                d.getBoundingClientRect().right,
            )
            .map((e) => ({
              tag: e.tagName,
              text: e.textContent.slice(0, 80),
              width: e.getBoundingClientRect().width,
            })),
        }),
      ),
  );
  await page
    .getByRole("button", { name: "Apply 1 ready crests", exact: true })
    .click();
  await page.waitForFunction(() =>
    document
      .querySelector("#bulk-message")
      ?.textContent.includes("1 crests applied"),
  );
  assert.equal(
    h.app.db.prepare("SELECT COUNT(*) n FROM team_badges").get().n,
    1,
  );
  assert.deepEqual(errors, []);
});

test("browser helper confirms suggestions, packages shared and local crests, and stops after a block", async (t) => {
  const h = await setup(t);
  const response = await h.app.inject({
    url: "/api/games/eafc27/badge-import/helper",
    headers: h.headers[0],
  });
  const archive = await JSZip.loadAsync(response.rawPayload),
    folder = mkdtempSync(join(tmpdir(), "mimelo-extension-"));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const extension = join(folder, "extension");
  mkdirSync(extension);
  for (const entry of Object.values(archive.files))
    writeFileSync(join(extension, entry.name), await entry.async("nodebuffer"));
  const context = await chromium.launchPersistentContext(
    join(folder, "profile"),
    {
      channel: "chromium",
      args: [
        "--disable-extensions-except=" + extension,
        "--load-extension=" + extension,
      ],
      viewport: { width: 1200, height: 900 },
    },
  );
  t.after(() => context.close());
  const worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent("serviceworker"));
  const extensionId = new URL(worker.url()).host;
  const requests = [];
  await context.route("https://cdn.sofifa.net/**", (route) => {
    requests.push(route.request().url());
    return route.fulfill(
      route.request().url().includes("/15/")
        ? { status: 403, contentType: "text/html", body: "Blocked" }
        : { contentType: "image/png", body: h.png },
    );
  });
  await context.route("https://sofifa.com/teams", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<table><tr><td><a href="/team/1">Club E</a><img alt="Club E" src="https://cdn.sofifa.net/meta/team/14/240.png"></td></tr></table>',
    }),
  );
  const sourcePage = await context.newPage();
  await sourcePage.goto("https://sofifa.com/teams");
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/helper.html`);
  const mapping =
    "code,name,gender,sofifa_id,url,file,badge_id\nAAA,Club É,men,,,,\nBBB,Club Women,women,14,,,\nCCC,Blocked,men,15,,,\nDDD,Later,men,16,,,\nEEE,Local,men,,,local.png,\nFFF,Saved,men,,,,42\n";
  await page.locator("#mapping").setInputFiles({
    name: "mapping.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(mapping),
  });
  await page.waitForFunction(
    () => document.querySelector("#teams")?.children.length === 6,
  );
  await page
    .getByRole("button", { name: "Read open SoFIFA pages", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm suggested crest", exact: true })
    .click();
  await page
    .locator("#local")
    .setInputFiles({ name: "local.png", mimeType: "image/png", buffer: h.png });
  requests.length = 0;
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download crest ZIP", exact: true })
    .click();
  const download = await pending;
  const zip = await JSZip.loadAsync(readFileSync(await download.path()));
  const rows = parseMapping(await zip.file("mapping.csv").async("string"));
  assert.equal(rows[0].file, rows[1].file);
  assert(zip.file(rows[0].file));
  assert(zip.file("local.png"));
  assert.equal(rows[2].file, "");
  assert.equal(rows[3].file, "");
  assert.equal(rows[5].badge_id, "42");
  assert.equal(requests.length, 2);
  assert.equal(
    requests.some((url) => url.includes("/16/")),
    false,
  );
});

test("catalog uploads validate permissions, persist associations, and enrich historical matches", async (t) => {
  const h = await setup(t);
  const teamPath = "/api/games/eafc27/images/team/AAA";
  await h.upload(teamPath, h.png, 403, 1);
  await h.upload("/api/games/smash/images/fighter/999", h.png, 404);
  await h.upload("/api/games/tennis/images/team/AAA", h.png, 400);
  await h.upload(teamPath, Buffer.from("not an image"), 400);
  await h.upload(teamPath, Buffer.alloc(5 * 1024 * 1024 + 1), 413);
  const badge = await h.upload(teamPath);
  const fighter = await h.upload("/api/games/smash/images/fighter/1");
  const stage = await h.upload("/api/games/smash/images/stage/battlefield");
  const image = await h.app.inject(badge.image);
  assert.equal(image.headers["content-type"], "image/webp");
  const iconMeta = await sharp(image.rawPayload).metadata();
  assert.equal(iconMeta.width, 128);
  assert.equal(iconMeta.height, 128);
  assert.equal(iconMeta.hasAlpha, true);
  const pixels = await sharp(image.rawPayload).ensureAlpha().raw().toBuffer();
  assert.equal(
    pixels[3],
    0,
    "transparent padding must not be flattened onto a color",
  );
  const stagePixels = await sharp((await h.app.inject(stage.image)).rawPayload)
    .ensureAlpha()
    .raw()
    .toBuffer();
  assert(
    stagePixels[3] > 0 && stagePixels[3] < 255,
    "stage transparency is preserved",
  );
  const stageMeta = await sharp(
    (await h.app.inject(stage.image)).rawPayload,
  ).metadata();
  assert.equal(stageMeta.width / stageMeta.height, 16 / 9);
  const rows = await h.call("GET", "/api/games/eafc27/images?kind=team&q=AAA");
  assert.equal(rows.total, 1);
  assert.equal(rows.rows[0].image, badge.image);
  assert.equal(
    (await h.call("GET", "/api/games/eafc26/images?kind=team&q=AAA")).rows[0]
      .image,
    badge.image,
  );
  await h.call("POST", "/api/teams/eafc27", {
    code: "AAA",
    name: "Renamed team",
    overall: 85,
  });
  let match = await h.call("GET", "/api/matches/" + h.fc.id);
  assert.equal(match.teams[0].image, badge.image);
  assert.equal(match.revision, h.fc.revision);
  match = await h.call("GET", "/api/matches/" + h.smash.id);
  assert.equal(match.smash_games[0].fighters[0].id, 1);
  assert.equal(
    match.smash_games[0].fighters[0].player_id,
    h.users[1].player_id,
  );
  assert.equal(match.smash_games[0].fighters[0].image, fighter.image);
  assert.equal(match.smash_games[1].fighters[1].image, fighter.image);
  assert.equal(match.smash_games[0].stage.image, stage.image);
  assert.equal(
    match.smash_games[1].stage.image,
    "/assets/smash/stages/final-destination.webp",
  );
  const replacement = await h.upload(teamPath);
  assert.notEqual(replacement.image, badge.image);
  await h.restart();
  assert.equal(
    (await h.call("GET", "/api/matches/" + h.fc.id)).teams[0].image,
    replacement.image,
  );
  await h.call("DELETE", teamPath, {}, 403, 1);
  await h.call("DELETE", teamPath, {});
  assert.equal(
    (await h.call("GET", "/api/matches/" + h.fc.id)).teams[0].image,
    null,
  );
});

test("badges can be reused across codes and genders without uploading again", async (t) => {
  const h = await setup(t);
  const image = await h.upload("/api/games/eafc27/images/team/AAA");
  const library = await h.call("GET", "/api/team-badges");
  assert.equal(library.total, 1);
  const badge_id = library.rows[0].id;
  const catalog = async (game, code) =>
    (await h.call("GET", `/api/games/${game}/images?kind=team&q=${code}`))
      .rows[0];
  assert.equal((await catalog("eafc26", "AAA")).image, image.image);
  // Different genders are independent until explicitly linked to the same badge.
  await h.call("POST", "/api/teams/eafc26", {
    code: "AAA",
    name: "Team AAA Women",
    overall: 80,
    gender: "women",
  });
  assert.equal((await catalog("eafc26", "AAA")).image, null);
  await h.call(
    "PATCH",
    "/api/games/eafc26/images/team/AAA",
    { badge_id },
    403,
    1,
  );
  await h.call(
    "PATCH",
    "/api/games/eafc26/images/team/AAA",
    { badge_id: 9999 },
    404,
  );
  await h.call("PATCH", "/api/games/eafc26/images/team/AAA", { badge_id });
  await h.call("PATCH", "/api/games/eafc27/images/team/BBB", { badge_id });
  assert.equal((await catalog("eafc26", "AAA")).image, image.image);
  assert.equal((await catalog("eafc26", "BBB")).image, image.image);
  assert.equal((await h.call("GET", "/api/team-badges")).total, 1);
  const match = await h.call("GET", "/api/matches/" + h.fc.id);
  assert.deepEqual(
    match.teams.map((t) => t.image),
    [image.image, image.image],
  );
  // Uploading a replacement reassigns this code/gender, not other variants.
  const replacement = await h.upload("/api/games/eafc26/images/team/BBB");
  assert.equal((await catalog("eafc27", "BBB")).image, replacement.image);
  assert.equal((await catalog("eafc26", "AAA")).image, image.image);
  await h.call("DELETE", "/api/games/eafc27/images/team/BBB", {});
  assert.equal((await catalog("eafc26", "BBB")).image, null);
  assert.equal((await catalog("eafc27", "AAA")).image, image.image);
  await h.restart();
  assert.equal((await catalog("eafc26", "AAA")).image, image.image);
  assert.equal((await h.call("GET", "/api/team-badges")).total, 2);
});

test("legacy edition badges migrate into a reusable library without losing alternatives", async (t) => {
  const h = await setup(t);
  await h.call("POST", "/api/teams/eafc26", {
    code: "BBB",
    name: "Team BBB Women",
    overall: 80,
    gender: "women",
  });
  h.app.db.prepare("DELETE FROM migrations WHERE version=2").run();
  const insert = h.app.db.prepare(
    "INSERT INTO catalog_images(game,kind,key,image,updated) VALUES(?,'team',?,?,?)",
  );
  insert.run("eafc26", "AAA", "/uploads/old.webp", 10);
  insert.run("eafc27", "AAA", "/uploads/new.webp", 20);
  insert.run("eafc26", "BBB", "/uploads/women.webp", 10);
  insert.run("eafc27", "BBB", "/uploads/men.webp", 20);
  await h.restart();
  const catalog = async (game, code) =>
    (await h.call("GET", `/api/games/${game}/images?kind=team&q=${code}`))
      .rows[0];
  assert.equal((await catalog("eafc26", "AAA")).image, "/uploads/new.webp");
  assert.equal((await catalog("eafc27", "AAA")).image, "/uploads/new.webp");
  assert.equal((await catalog("eafc26", "BBB")).image, "/uploads/women.webp");
  assert.equal((await catalog("eafc27", "BBB")).image, "/uploads/men.webp");
  assert.equal((await h.call("GET", "/api/team-badges")).total, 4);
  await h.call("DELETE", "/api/games/eafc26/images/team/AAA", {});
  await h.restart();
  assert.equal((await catalog("eafc27", "AAA")).image, null);
  assert.equal((await h.call("GET", "/api/team-badges")).total, 4);
});

test("admins manage match images and players see badges, per-game stock icons, and stage photos", async (t) => {
  const h = await setup(t);
  await h.app.listen({ host: "127.0.0.1", port: 0 });
  const base = "http://127.0.0.1:" + h.app.server.address().port;
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext();
  await context.addCookies([
    { name: "sid", value: h.headers[0].cookie.slice(4), url: base },
  ]);
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  async function visit(path) {
    await page.goto(base + path);
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    assert.equal(await page.locator("#load-error").count(), 0);
  }
  async function manage(game) {
    await visit("/admin.html");
    await page
      .locator('[data-action="game-admin"][data-game="' + game + '"]')
      .click();
    await page
      .getByRole("button", { name: "Manage images", exact: true })
      .click();
    await page.locator(".catalog-image-row").first().waitFor();
  }
  async function uploadFirst() {
    await page.locator("[data-upload]").first().setInputFiles({
      name: "icon.png",
      mimeType: "image/png",
      buffer: h.png,
    });
    await page.waitForFunction(() =>
      document
        .querySelector("#image-message")
        ?.textContent.includes("image saved"),
    );
    await page.locator(".catalog-image-row img").first().waitFor();
  }
  await manage("eafc27");
  await uploadFirst();
  await page.getByRole("button", { name: "Unlink badge", exact: true }).click();
  await page.waitForFunction(() =>
    document
      .querySelector("#image-message")
      ?.textContent.includes("image removed"),
  );
  await page.locator(".catalog-image-row img").waitFor({ state: "detached" });
  await uploadFirst();
  await manage("eafc26");
  assert.equal(await page.locator(".catalog-image-row img").count(), 1);
  await page.locator('[data-action="reuse-badge"]').nth(1).click();
  await page.locator("#badge-library [data-badge]").first().click();
  await page.locator("#badge-library").waitFor({ state: "detached" });
  assert.equal(await page.locator(".catalog-image-row img").count(), 2);
  await manage("smash");
  await uploadFirst();
  await page.locator("#field-image-kind").selectOption("stage");
  await page.waitForFunction(
    () =>
      document.querySelector(".catalog-image-row code")?.textContent ===
      "battlefield",
  );
  await uploadFirst();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await visit("/game.html?game=eafc27&view=matches");
    assert.equal(
      await page.locator("#matches-body .match-team-label img").count(),
      2,
    );
    assert.equal(
      await page.locator("#matches-body .match-team-label").first().innerText(),
      "",
    );
    assert.deepEqual(
      await page
        .locator("#matches-body .fc-scoreline")
        .first()
        .evaluate((el) => [...el.children].map((child) => child.className)),
      [
        "fc-player",
        "match-team-label",
        "score",
        "match-team-label",
        "fc-player",
      ],
    );
    await visit("/game.html?game=smash&view=matches");
    assert.equal(
      await page.locator("#matches-body .match-fighter-icon img").count(),
      8,
    );
    const labels = await page
      .locator('#matches-body .match-fighter-icon:has(img[src^="/uploads/"])')
      .evaluateAll((items) =>
        items.map((item) => item.getAttribute("aria-label")),
      );
    assert.deepEqual(labels, [
      "Catalog Player 1: Mario",
      "Catalog Player 0: Mario",
    ]);
    await page
      .locator('#matches-body [data-match="' + h.smash.id + '"]')
      .click();
    await page.locator(".smash-game-detail").first().waitFor();
    assert.equal(
      await page.locator(".smash-game-detail img.catalog-stage-photo").count(),
      2,
    );
    await page.waitForFunction(() =>
      [...document.querySelectorAll("dialog[open] img")].every(
        (img) => img.complete && img.naturalWidth > 0,
      ),
    );
    assert(
      await page
        .locator("dialog[open] img.catalog-stage-photo")
        .first()
        .evaluate(
          (img) => getComputedStyle(img).backgroundColor === "rgba(0, 0, 0, 0)",
        ),
    );
    assert(
      await page
        .locator("dialog[open] img.catalog-stock-icon")
        .first()
        .evaluate(
          (img) => getComputedStyle(img).backgroundColor === "rgba(0, 0, 0, 0)",
        ),
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    assert(
      await page
        .locator("dialog[open]")
        .evaluate((d) => d.scrollWidth <= d.clientWidth + 1),
    );
    await page.screenshot({
      path: `artifacts/catalog-match-${width}.png`,
      fullPage: true,
    });
    await manage("smash");
    await page.locator("#field-image-kind").selectOption("stage");
    await page.waitForFunction(
      () =>
        document.querySelector(".catalog-image-row code")?.textContent ===
        "battlefield",
    );
    assert(
      await page
        .locator("dialog[open]")
        .last()
        .evaluate((d) => d.scrollWidth <= d.clientWidth + 1),
    );
    await page.screenshot({
      path: `artifacts/catalog-admin-${width}.png`,
      fullPage: true,
    });
  }
  assert.deepEqual(errors, []);
});
