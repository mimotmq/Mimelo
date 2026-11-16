import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
import { passwordHash, register } from "../server/auth.js";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.MIMELO_PLAYWRIGHT_MODULE || "@playwright/test",
);
test("template screens and live workflows at desktop and mobile widths", async (t) => {
  const app = await createApp({ database: ":memory:" });
  t.after(() => app.close());
  await app.listen({ port: 0, host: "127.0.0.1" });
  const base = "http://127.0.0.1:" + app.server.address().port;
  const pw = await passwordHash("BrowserPassword!");
  const admin = register(
      app.db,
      { name: "Test Admin", handle: "testadmin" },
      pw,
      null,
      true,
    ),
    other = register(app.db, { name: "Test Opponent", handle: "opponent" }, pw);
  const browser = await chromium.launch({ headless: true });
  t.after(async () => {
    await browser.close();
  });
  const ctx = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await ctx.newPage(),
    errors = [],
    failed = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.log("Browser error:", e.message);
  });
  page.on("response", (r) => {
    if (r.status() >= 500) failed.push(r.url());
    if (r.status() === 429) console.log("Rate limited", r.url());
  });
  page.on("dialog", (d) => d.accept());
  mkdirSync("artifacts", { recursive: true });
  async function ready() {
    await page.waitForFunction(() => document.body.dataset.ready === "true");
  }
  async function visit(path) {
    await page.goto(base + path);
    await ready();
    assert.equal(
      await page.locator("#load-error").count(),
      0,
      await page.locator("body").textContent(),
    );
  }
  async function noOverflow() {
    const ok = await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    );
    if (!ok) {
      await page.screenshot({ path: "artifacts/overflow.png", fullPage: true });
      console.log(
        await page.evaluate(() => ({
          width: innerWidth,
          scroll: document.documentElement.scrollWidth,
          items: [...document.querySelectorAll("body *")]
            .filter(
              (e) =>
                e.getBoundingClientRect().right > innerWidth + 1 &&
                e.getBoundingClientRect().width > 0,
            )
            .slice(0, 12)
            .map((e) => ({
              tag: e.tagName,
              cls: e.className,
              width: e.getBoundingClientRect().width,
              right: e.getBoundingClientRect().right,
            })),
        })),
      );
    }
    assert(ok, "Overflow " + page.url());
  }
  await visit("/login.html");
  assert.equal(await page.locator(".auth-visual").count(), 1);
  await page.screenshot({
    path: "artifacts/login-desktop.png",
    fullPage: true,
  });
  await page.locator("#login-email").fill("testadmin");
  await page.locator("#login-password").fill("BrowserPassword!");
  await page.locator("#login-form button[type=submit]").click();
  await page.waitForURL(base + "/");
  await ready();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of [
      "/",
      "/players.html",
      "/account.html",
      "/admin.html",
      "/player.html?player=" + admin.player_id + "&game=tennis",
    ]) {
      await visit(path);
      await noOverflow();
    }
    for (const game of ["eafc27", "eafc26", "tennis", "tt", "smash"]) {
      await visit("/game.html?game=" + game);
      await noOverflow();
      await page.screenshot({
        path: `artifacts/${game}-${width}.png`,
        fullPage: true,
      });
      for (const view of [
        "matches",
        "rankings",
        "competitions",
        "record",
        "review",
      ]) {
        await page.locator(`.sidebar [data-view="${view}"]`).click();
        await noOverflow();
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await visit("/game.html?game=tennis&view=record");
  await page.locator("#field-p00").selectOption(String(admin.player_id));
  await page.locator("#field-p10").selectOption(String(other.player_id));
  await page.locator("#field-bestOf").selectOption("1");
  await page.locator("#field-score0a").fill("6");
  await page.locator("#field-score0b").fill("2");
  await page.locator("#record-form button[type=submit]").click();
  await page.waitForURL(/match=/);
  await ready();
  await page.locator("dialog[open] [data-action=accept]").click();
  await page.locator("dialog[open]").waitFor({ state: "detached" });
  assert.equal(app.db.prepare("SELECT COUNT(*) n FROM ratings").get().n, 0);
  const m = app.db.prepare("SELECT * FROM matches").get();
  await page.locator(`[data-match="${m.id}"]`).first().click();
  await page.locator("dialog[open] [data-action=elo]").click();
  await page.locator("dialog[open]").waitFor({ state: "detached" });
  assert.equal(app.db.prepare("SELECT COUNT(*) n FROM ratings").get().n, 2);
  await visit("/game.html?game=tennis&view=competitions");
  await page.locator("#comp-new").click();
  await page.locator("#comp-name").fill("Browser Cup");
  await page.locator("input[name=comp-format][value=knockout]").check();
  await page.locator("#comp-next").click();
  await page.locator("#comp-players input").first().check();
  await page.locator("#comp-players input").nth(1).check();
  await page.locator("#comp-create").click();
  await page.waitForURL(/competition.html/);
  await ready();
  await page.locator("[data-action=draw]").click();
  await page.locator("#ct-fixtures").click();
  await page.locator("#fixtures-body a").first().waitFor();
  await noOverflow();
  await page.screenshot({
    path: "artifacts/competition-desktop.png",
    fullPage: true,
  });
  await visit("/account.html");
  await page.locator("#acct-name").fill("Renamed Admin");
  await page.locator("#profile-form button[type=submit]").click();
  await page.locator("#toast").filter({ hasText: "Profile saved" }).waitFor();
  assert.equal(
    app.db.prepare("SELECT name FROM players WHERE id=?").get(admin.player_id)
      .name,
    "Renamed Admin",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
});

test("public browsing, optional-email signup and all sport recording forms", async (t) => {
  const app = await createApp({ database: ":memory:" });
  t.after(() => app.close());
  await app.listen({ port: 0, host: "127.0.0.1" });
  const base = "http://127.0.0.1:" + app.server.address().port;
  const pw = await passwordHash("BrowserPassword!"),
    users = [];
  for (let i = 0; i < 4; i++)
    users.push(
      register(
        app.db,
        { name: "Browser Player " + i, handle: "sportplayer" + i },
        pw,
        null,
        i === 0,
      ),
    );
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({
      viewport: { width: 390, height: 1000 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const ready = () =>
    page.waitForFunction(() => document.body.dataset.ready === "true");
  const visit = async (path) => {
    await page.goto(base + path);
    await ready();
    assert.equal(await page.locator("#load-error").count(), 0);
  };
  for (const path of [
    "/",
    "/players.html",
    "/game.html?game=smash",
    "/player.html?game=tennis&player=" + users[1].player_id,
  ])
    await visit(path);
  await visit("/login.html");
  await page.locator("#lt-register").click();
  await page.locator("#reg-name").fill("Public Signup");
  await page.locator("#reg-handle").fill("publicsignup");
  await page.locator("#reg-password").fill("PublicPassword!");
  await page.locator("#register-form button[type=submit]").click();
  await page.waitForURL(base + "/");
  await ready();
  assert.equal(
    app.db
      .prepare("SELECT email FROM accounts WHERE handle=?")
      .get("publicsignup").email,
    null,
  );
  await page.evaluate(() => APP.api("logout", {}));
  await visit("/login.html");
  await page.locator("#login-email").fill("sportplayer0");
  await page.locator("#login-password").fill("BrowserPassword!");
  await page.locator("#login-form button[type=submit]").click();
  await page.waitForURL(base + "/");
  await ready();
  await page.evaluate(async () => {
    await APP.api("teams/eafc27", {
      code: "ALP",
      name: "Alpha Club",
      overall: 85,
      gender: "Men",
      league: "Premier League",
      nation: "England",
    });
    await APP.api("teams/eafc27", {
      code: "BET",
      name: "Beta Club",
      overall: 87,
    });
    await APP.api("teams/eafc27", {
      code: "WOM",
      name: "Women's Club",
      overall: 84,
      gender: "Women",
    });
  });
  await visit("/game.html?game=eafc27&view=record");
  await page.locator("#r-p1").selectOption(String(users[0].player_id));
  await page.locator("#r-p2").selectOption(String(users[1].player_id));
  for (const side of [1, 2]) {
    await page.locator("#team-btn" + side).click();
    // Opening fetches the catalog before showing the dialog.
    await page.locator("#team-dialog").waitFor({ state: "visible" });
    assert.equal(await page.locator("#team-results [data-team]").count(), 2);
    assert.equal(
      await page
        .locator("#team-results [data-team]")
        .first()
        .evaluate((el) => getComputedStyle(el).display),
      "flex",
      "Team cards use the designed layout",
    );
    await page
      .locator("#team-results [data-team]")
      .nth(side - 1)
      .click();
    assert.equal(
      await page.locator('#team-results [aria-pressed="true"]').count(),
      1,
    );
    await page.locator("#team-apply").click();
  }
  await page.locator("#team-btn1").click();
  await page.locator("#team-dialog").waitFor({ state: "visible" });
  assert.match(
    await page.locator('#team-results [aria-pressed="true"]').innerText(),
    /Alpha Club/,
  );
  await page.locator('#team-gender [data-gender="women"]').click();
  await page.waitForFunction(() =>
    document
      .querySelector("#team-results")
      .textContent.includes("Women's Club"),
  );
  assert.equal(
    await page
      .locator('#team-gender [data-gender="women"]')
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(await page.locator("#team-results [data-team]").count(), 1);
  await page.locator("#team-search").fill("no such club");
  await page.locator("#team-results .team-empty").waitFor();
  await page.locator("#team-dialog .dialog-close").click();
  await page.locator("#team-btn1").click();
  await page.locator("#team-dialog").waitFor({ state: "visible" });
  assert.equal(await page.locator("#team-search").inputValue(), "");
  assert.match(
    await page.locator('#team-results [aria-pressed="true"]').innerText(),
    /Alpha Club/,
  );
  await page.locator("#team-dialog .dialog-close").click();
  await page.locator("#r-s1").fill("3");
  await page.locator("#r-s2").fill("2");
  await page.waitForFunction(() =>
    document.querySelector("#sum-elo-note").textContent.includes("Estimate"),
  );
  await page.locator("#record-form button[type=submit]").click();
  await page.waitForURL(/match=/);
  await ready();
  assert.equal(
    app.db.prepare("SELECT a_score FROM matches WHERE game='eafc27'").get()
      .a_score,
    3,
  );
  await visit("/game.html?game=tt&view=record");
  await page.locator("#field-p10").selectOption(String(users[1].player_id));
  await page.locator("#field-bestOf").selectOption("1");
  await page.locator("#field-target").selectOption("21");
  await page.locator("#field-score0a").fill("23");
  await page.locator("#field-score0b").fill("21");
  await page.locator("#record-form button[type=submit]").click();
  await page.waitForURL(/match=/);
  await ready();
  assert.equal(
    JSON.parse(
      app.db.prepare("SELECT score FROM matches WHERE game='tt'").get().score,
    ).target,
    21,
  );
  await visit("/game.html?game=smash&view=record");
  await page.locator("#field-record-format").selectOption("doubles");
  await page.locator("#field-p01").waitFor();
  for (let side = 0; side < 2; side++)
    for (let i = 0; i < 2; i++)
      await page
        .locator(`#field-p${side}${i}`)
        .selectOption(String(users[side * 2 + i].player_id));
  await page.locator("#field-bestOf").selectOption("1");
  await page.locator("#field-score0a").fill("6");
  await page.locator("#field-score0b").fill("4");
  for (let i = 0; i < 4; i++)
    await page.locator("#field-fighter0-" + i).selectOption({ index: i + 1 });
  await page.locator("#field-stage0").selectOption({ index: 1 });
  assert.equal(await page.locator("#jv0").count(), 0);
  await page.locator("#record-form button[type=submit]").click();
  await page.waitForURL(/match=/);
  await ready();
  assert.equal(
    app.db.prepare("SELECT format FROM matches WHERE game='smash'").get()
      .format,
    "doubles",
  );
  assert.equal(await page.locator("dialog[open] .smash-scoreboard").count(), 1);
  await page.screenshot({
    path: "artifacts/smash-result-mobile.png",
    fullPage: true,
  });
  await page.route("**/api/me", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Temporarily unavailable" }),
    }),
  );
  await page.goto(base + "/");
  await page.locator("#load-error").waitFor();
  assert.equal(
    await page.locator(".home-players,.result-line,.auth-board").count(),
    0,
  );
  assert.deepEqual(errors, []);
});
