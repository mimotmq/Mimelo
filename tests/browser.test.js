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
async function choosePlayer(page, selector, id) {
  const player = await page.evaluate((id) => APP.api("players/" + id), id);
  const search = page.locator(selector + "-search");
  await search.fill(player.name);
  await page
    .locator(selector + "-search-results")
    .getByRole("option")
    .filter({ hasText: player.name })
    .click();
  assert.equal(await page.locator(selector).inputValue(), String(id));
}
async function openNavigation(page) {
  if (
    (await page.locator(".app-body").getAttribute("data-nav-open")) === "true"
  )
    return;
  const menu = page.locator(".navigation-menu");
  // These flows test the destination screens. Keep setup stable under CI load;
  // actual pointer/touch behavior is exercised by navigation.test.js.
  if (await menu.isVisible()) {
    await menu.focus();
    await page.keyboard.press("Enter");
  } else await page.locator(".navigation-edge").focus();
  try {
    await page.waitForFunction(
      () => document.querySelector(".app-body").dataset.navOpen === "true",
    );
  } catch (error) {
    const state = await page.evaluate(() => ({
      url: location.href,
      viewport: [innerWidth, innerHeight],
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      touchNavigation: matchMedia("(max-width: 1024px), (hover: none)").matches,
      navigation: { ...document.querySelector(".app-body").dataset },
      menuVisible: !!document.querySelector(".navigation-menu").getClientRects()
        .length,
      menuExpanded: document
        .querySelector(".navigation-menu")
        .getAttribute("aria-expanded"),
      sidebarHidden: document
        .querySelector(".sidebar")
        .getAttribute("aria-hidden"),
      activeElement: document.activeElement.className,
    }));
    error.message += "\nNavigation state: " + JSON.stringify(state);
    throw error;
  }
}

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
    assert.equal(
      await page.locator(".demo-note,.sample-tag").count(),
      0,
      "Template notices never remain in the live UI.",
    );
    assert(
      !/demo only|static mockup|sample account|sample data/i.test(
        await page.locator("body").innerText(),
      ),
      "Live screens do not claim to be a demo.",
    );
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
        await openNavigation(page);
        await page.locator(`.sidebar [data-view="${view}"]`).click();
        assert.equal(
          await page.locator(".app-body").getAttribute("data-nav-open"),
          "false",
        );
        await noOverflow();
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await visit("/game.html?game=tennis&view=record");
  await choosePlayer(page, "#field-p00", admin.player_id);
  await choosePlayer(page, "#field-p10", other.player_id);
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
  await visit("/player.html?game=tennis&player=" + admin.player_id);
  assert.match(await page.locator("[data-player-elo]").innerText(), /\?$/);
  assert.equal(
    await page.locator(".player-elo .label").textContent(),
    "Provisional · 1 of 8 rated matches",
  );
  assert.equal(await page.locator("#match-count").innerText(), "1 match");
  await visit("/game.html?game=tennis&view=rankings");
  assert.match(await page.locator("#elo-body .num").first().innerText(), /\?$/);
  assert.equal(
    await page.evaluate(() =>
      UI.elo({ elo: 1200, provisional: false }).endsWith("?"),
    ),
    false,
  );

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
  await page.locator("#fixture-groups summary").first().click();
  const knockoutFixture = page
    .locator("#fixture-groups a.fixture-match")
    .first();
  await knockoutFixture.waitFor();
  await knockoutFixture.click();
  await ready();
  await page.locator("#field-score0a").fill("6");
  await page.locator("#field-score0b").fill("0");
  await page.locator("#field-score1a").fill("6");
  await page.locator("#field-score1b").fill("0");
  await page.locator("#record-form button[type=submit]").click();
  await page.waitForURL(/competition\.html.*view=bracket/);
  await ready();
  assert.equal(new URL(page.url()).searchParams.get("view"), "bracket");
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
  await choosePlayer(page, "#r-p1", users[0].player_id);
  assert.equal(await page.locator("#r-p2").isVisible(), false);
  await page.locator("#r-p2-search").fill("Nobody matches this name");
  await page
    .locator("#r-p2-search-results")
    .getByText("No matches found. Try another name.")
    .waitFor();
  assert.equal(await page.locator("#r-p2").inputValue(), "");
  assert.equal(
    await page.locator("#r-p2-search").evaluate((el) => el.validity.valid),
    false,
  );
  await page.locator("#r-p2-search").fill("sportplayer1");
  await page.locator("#r-p2-search-results [role=option]").waitFor();
  await page.locator("#r-p2-search").press("ArrowDown");
  await page.locator("#r-p2-search").press("Enter");
  assert.equal(
    await page.locator("#r-p2").inputValue(),
    String(users[1].player_id),
  );
  assert.equal(
    await page.locator("#r-p2-search").getAttribute("aria-expanded"),
    "false",
  );
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
  await page.locator("#r-s1").fill("6");
  await page.locator("#r-s2").fill("1");
  assert.equal(
    await page.locator("#record-fc-score").innerText(),
    "Browser Player 0\nALP\n6 - 1\nBET\nBrowser Player 1",
  );
  await page.screenshot({
    path: "artifacts/fc-record-mobile.png",
    fullPage: true,
  });
  await openNavigation(page);
  assert.equal(
    await page.locator(".navigation-menu").getAttribute("aria-expanded"),
    "true",
  );
  await page.keyboard.press("Escape");
  assert.equal(
    await page.locator(".navigation-menu").getAttribute("aria-expanded"),
    "false",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  assert.equal(
    await page.locator(".navigation-menu").getAttribute("aria-expanded"),
    "false",
  );
  await page.screenshot({
    path: "artifacts/fc-record-desktop.png",
    fullPage: true,
  });
  await page.waitForFunction(() =>
    document.querySelector("#sum-elo-note").textContent.includes("Estimate"),
  );
  await page.locator("#record-form button[type=submit]").click();
  await page.waitForURL(/match=/);
  await ready();
  assert.equal(
    app.db.prepare("SELECT a_score FROM matches WHERE game='eafc27'").get()
      .a_score,
    6,
  );
  const scoreline = page.locator("dialog[open] .fc-scoreline");
  assert.equal(await scoreline.locator(".score").innerText(), "6 - 1");
  assert.equal(
    (await page.locator("dialog[open]").innerText()).match(/6 - 1/g)?.length,
    1,
  );
  assert.deepEqual(await scoreline.locator(":scope > *").allTextContents(), [
    "Browser Player 0",
    "ALP",
    "6 - 1",
    "BET",
    "Browser Player 1",
  ]);
  await page.locator('dialog[open] [data-action="edit"]').click();
  await page.waitForURL(/edit=/);
  await ready();
  assert.equal(
    await page.locator("#r-p2-search").inputValue(),
    "Browser Player 1",
  );
  assert.equal(await page.locator("#r-p2-search").isDisabled(), true);
  await page.setViewportSize({ width: 390, height: 1000 });
  await visit("/game.html?game=tt&view=record");
  await choosePlayer(page, "#field-p10", users[1].player_id);
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
  await page.locator("#field-p01-search").waitFor();
  for (let side = 0; side < 2; side++)
    for (let i = 0; i < 2; i++)
      await choosePlayer(
        page,
        `#field-p${side}${i}`,
        users[side * 2 + i].player_id,
      );
  await page.locator("#field-bestOf").selectOption("1");
  await page.locator("#field-score0a").fill("6");
  await page.locator("#field-score0b").fill("4");
  for (let i = 0; i < 4; i++) {
    await page.locator(`[data-game="0"][data-pick="fighter${i}"]`).click();
    await page.locator(".smash-roster-tile").nth(i).click();
  }
  await page.locator('[data-game="0"][data-pick="stage"]').click();
  await page.getByRole("button", { name: "Battlefield", exact: true }).click();
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

test("long EAFC names stay readable in mobile match cards and dialogs", async (t) => {
  const app = await createApp({ database: ":memory:" });
  t.after(() => app.close());
  await app.listen({ port: 0, host: "127.0.0.1" });
  const base = "http://127.0.0.1:" + app.server.address().port;
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const match = {
    id: 99,
    format: "singles",
    context: {
      kind: "fc",
      competition: null,
      sides: [0, 1].map((side) => ({
        side,
        elo: 1000,
        provisional: true,
        form: [],
      })),
      h2h: { meetings: 0, a: 0, draws: 0, b: 0 },
      odds: {
        provisional: true,
        draw_history: 0,
        outcomes: [
          { side: 0, probability: 0.4, decimal: 2.5 },
          { side: null, probability: 0.2, decimal: 5 },
          { side: 1, probability: 0.4, decimal: 2.5 },
        ],
      },
    },
    game: "eafc27",
    submitted: Date.now(),
    status: "accepted",
    a_score: 6,
    b_score: 1,
    score: { a: 6, b: 1 },
    participants: [
      { id: 1, side: 0, name: "Bashar Fakhreddin" },
      { id: 2, side: 1, name: "Mimo" },
    ],
    teams: [
      { name: "Hull City", code: "HUL" },
      { name: "Aston Villa", code: "AVL" },
    ],
    elo_enabled: true,
    elo_checked: true,
    ledger: [],
    permissions: {},
  };
  await page.route("**/api/matches**", (route) =>
    route.fulfill({
      json: new URL(route.request().url()).pathname.endsWith("/99")
        ? match
        : { rows: [match], total: 1, limit: 50, offset: 0 },
    }),
  );
  for (const width of [320, 390, 640, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + "/game.html?game=eafc27&view=matches");
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    const row = page.locator("#matches-body tr");
    assert.equal(await row.locator(".score").innerText(), "6 - 1");
    if (width <= 640) {
      assert(
        await row.evaluate((el) => el.getBoundingClientRect().height < 330),
        "A name must not turn a match into a tall column of letters",
      );
      assert(
        await page
          .locator("#matches-body")
          .evaluate(
            (el) =>
              el.closest(".table-wrap").scrollWidth <=
              el.closest(".table-wrap").clientWidth + 1,
          ),
        "Match cards must fit without horizontal scrolling",
      );
    }
    const checkName = async (scope) => {
      const name = scope.locator(".fc-player").first();
      assert.equal(await name.innerText(), "Bashar Fakhreddin");
      assert(
        await name.evaluate(
          (el) =>
            el.clientHeight <= parseFloat(getComputedStyle(el).lineHeight) * 3,
        ),
        "Full names should fit in at most three lines",
      );
    };
    await checkName(row);
    await row.locator("[data-match]").click();
    const dialog = page.locator("dialog[open]");
    await checkName(dialog);
    assert(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
    await page.screenshot({
      path: `artifacts/long-name-match-${width}.png`,
      fullPage: true,
    });
    await dialog.locator(".dialog-close").click();
  }
});

test("game banners adapt to the view and dark mode shares neutral surfaces", async (t) => {
  const app = await createApp({ database: ":memory:" });
  t.after(() => app.close());
  await app.listen({ port: 0, host: "127.0.0.1" });
  const base = "http://127.0.0.1:" + app.server.address().port;
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let darkSurfaces;
  for (const colorScheme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const game of [
        "eafc27",
        "eafc26",
        "smash",
        "tennis",
        "tt",
        "pickleball",
      ]) {
        await page.goto(base + "/game.html?game=" + game);
        await page.waitForFunction(
          () => document.body.dataset.ready === "true",
        );
        assert.equal(await page.locator("#load-error").count(), 0);
        const banner = page.locator(".game-identity"),
          logo = banner.locator("img");
        assert.equal(await banner.getAttribute("data-size"), "large");
        await logo.evaluate((img) => img.decode());
        const largeHeight = await banner.evaluate(
          (el) => el.getBoundingClientRect().height,
        );
        assert(
          width <= 700
            ? largeHeight >= 100 && largeHeight < 150
            : largeHeight >= 150,
        );
        assert(
          await logo.evaluate(
            (img) =>
              img.naturalWidth > 0 &&
              getComputedStyle(img).objectFit === "contain",
          ),
        );
        assert.equal(
          await page
            .locator(".logo-plate")
            .first()
            .evaluate((el) => getComputedStyle(el).backgroundColor),
          "rgba(0, 0, 0, 0)",
        );
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        );
        if (colorScheme === "dark") {
          const surfaces = await page.evaluate(() => {
            const style = getComputedStyle(document.body);
            return ["--bg", "--surface", "--surface-2", "--line", "--ink"].map(
              (key) => style.getPropertyValue(key).trim(),
            );
          });
          darkSurfaces ||= surfaces;
          assert.deepEqual(
            surfaces,
            darkSurfaces,
            "Only accents should vary by game in dark mode",
          );
        }
        await page.screenshot({
          path: `artifacts/banner-${game}-${colorScheme}-${width}.png`,
          fullPage: true,
        });
        await openNavigation(page);
        await page.locator('.sidebar [data-view="matches"]').click();
        assert.equal(await banner.getAttribute("data-size"), "compact");
        await page.waitForFunction(
          (height) =>
            document.querySelector(".game-identity").getBoundingClientRect()
              .height < height,
          largeHeight,
        );
        assert(
          (await banner.evaluate((el) => el.getBoundingClientRect().height)) <
            largeHeight,
          `${game} ${colorScheme} ${width}: compact header must shrink from ${largeHeight}px`,
        );
        assert.equal(await page.locator(".game-identity").count(), 1);
        await page.screenshot({
          path: `artifacts/header-${game}-${colorScheme}-${width}.png`,
        });
      }
    }
  }
  assert.deepEqual(errors, []);
});
