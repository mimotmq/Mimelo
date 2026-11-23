import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { createApp } from "../server/app.js";
import { register, passwordHash } from "../server/auth.js";
import { validateScore } from "../server/scoring.js";

test("pickleball validates standard game targets, deuce and completed matches", () => {
  const score = (target, a, b) => ({ bestOf: 1, target, games: [{ a, b }] });
  for (const target of [11, 15, 21]) {
    for (const [a, b] of [
      [target, 0],
      [target, target - 2],
      [target + 1, target - 1],
      [target + 10, target + 8],
    ]) {
      assert.equal(
        validateScore("pickleball", "singles", score(target, a, b)).winner,
        0,
      );
      assert.equal(
        validateScore("pickleball", "doubles", score(target, b, a)).winner,
        1,
      );
    }
    for (const [a, b] of [
      [target, target - 1],
      [target - 1, 0],
      [target + 1, target - 2],
      [target, target],
      [-1, target],
      [target + 0.5, 0],
    ])
      assert.throws(() =>
        validateScore("pickleball", "singles", score(target, a, b)),
      );
  }
  for (const bestOf of [3, 5]) {
    const games = Array.from({ length: Math.ceil(bestOf / 2) }, () => ({
      a: 11,
      b: 7,
    }));
    assert.equal(
      validateScore("pickleball", "doubles", { bestOf, target: 11, games }).a,
      Math.ceil(bestOf / 2),
    );
    assert.throws(() =>
      validateScore("pickleball", "doubles", { bestOf, target: 15, games }),
    );
    assert.throws(() =>
      validateScore("pickleball", "doubles", {
        bestOf,
        target: 11,
        games: games.slice(1),
      }),
    );
    assert.throws(() =>
      validateScore("pickleball", "doubles", {
        bestOf,
        target: 11,
        games: [...games, { a: 0, b: 11 }],
      }),
    );
  }
  for (const target of [7, 10, 12])
    assert.throws(() =>
      validateScore("pickleball", "singles", score(target, target, 0)),
    );
});

test("pickleball records, ratings, competitions and mobile score entry work in singles and doubles", async (t) => {
  const app = await createApp({ database: ":memory:" });
  t.after(() => app.close());
  const password = "PickleballPassword!";
  const hash = await passwordHash(password);
  const users = [
    "Alexandria Montgomery-Wellington",
    "Christopher van der Meer",
    "Morgan Patel",
    "Jamie Chen",
  ].map((name, i) => ({
    ...register(app.db, { name, handle: "pickle" + i }, hash, null, i === 0),
    name,
  }));
  const login = await app.inject({
    method: "POST",
    url: "/api/login",
    headers: { "x-mimelo-request": "1" },
    payload: { identity: "pickle0", password },
  });
  const headers = {
    "x-mimelo-request": "1",
    "x-csrf-token": login.json().csrf,
    cookie: login.cookies.map((c) => c.name + "=" + c.value).join("; "),
  };
  async function call(method, url, payload, status = 200) {
    const response = await app.inject({
      method,
      url,
      headers,
      ...(payload ? { payload } : {}),
    });
    assert.equal(response.statusCode, status, response.body);
    return response.json();
  }
  assert(
    (await call("GET", "/api/games")).some((g) => g.slug === "pickleball"),
  );
  const sides = [
    [users[0].player_id, users[2].player_id],
    [users[1].player_id, users[3].player_id],
  ];
  const match = await call("POST", "/api/games/pickleball/matches", {
    format: "doubles",
    sides,
    score: {
      bestOf: 3,
      target: 11,
      games: [
        { a: 11, b: 9 },
        { a: 8, b: 11 },
        { a: 13, b: 11 },
      ],
    },
  });
  await call("POST", `/api/matches/${match.id}/accept`, { revision: 1 });
  await call("POST", `/api/matches/${match.id}/elo`, { revision: 1 });
  const doubles = await call(
    "GET",
    "/api/games/pickleball/rankings?format=doubles",
  );
  assert.equal(doubles.total, 4);
  assert.equal(
    (await call("GET", "/api/games/pickleball/rankings?format=singles")).total,
    0,
  );
  const singles = await call("POST", "/api/games/pickleball/matches", {
    format: "singles",
    sides: sides.map((s) => [s[0]]),
    score: { bestOf: 1, target: 15, games: [{ a: 17, b: 15 }] },
  });
  await call("POST", `/api/matches/${singles.id}/accept`, { revision: 1 });
  await call("POST", `/api/matches/${singles.id}/elo`, { revision: 1 });
  assert.equal(
    (await call("GET", "/api/games/pickleball/rankings?format=singles")).total,
    2,
  );
  assert.deepEqual(
    (await call("GET", "/api/games/pickleball/rankings?format=doubles")).rows,
    doubles.rows,
  );
  await call(
    "POST",
    "/api/games/pickleball/matches",
    {
      format: "doubles",
      sides: [[users[0].player_id], [users[1].player_id]],
      score: { bestOf: 1, target: 11, games: [{ a: 11, b: 5 }] },
    },
    400,
  );
  await call(
    "POST",
    "/api/competitions",
    {
      game: "pickleball",
      name: "Invalid rules",
      kind: "knockout",
      settings: { bestOf: 3, target: 15 },
    },
    400,
  );
  const competition = await call("POST", "/api/competitions", {
    game: "pickleball",
    name: "Pickleball Doubles Cup",
    kind: "knockout",
    format: "doubles",
    entries: sides,
    settings: { bestOf: 1, target: 21 },
  });
  await call("POST", `/api/competitions/${competition.id}/draw`, {});
  const drawn = await call("GET", `/api/competitions/${competition.id}`);
  const fixture = drawn.fixtures.find((f) => f.status === "ready");
  const final = await call("POST", "/api/games/pickleball/matches", {
    fixture: fixture.id,
    score: { bestOf: 3, target: 11, games: [{ a: 22, b: 20 }] },
  });
  assert.equal(
    final.score.target,
    21,
    "Fixture rules override submitted targets.",
  );
  await call("POST", `/api/matches/${final.id}/accept`, { revision: 1 });
  assert.equal(
    (await call("GET", `/api/competitions/${competition.id}`)).state,
    "completed",
  );

  await app.listen({ port: 0, host: "127.0.0.1" });
  const base = "http://127.0.0.1:" + app.server.address().port;
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  async function visit(path) {
    await page.goto(base + path);
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    assert.equal(
      await page.locator("#load-error").count(),
      0,
      await page.locator("body").innerText(),
    );
  }
  async function fits() {
    const overflow = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      elements: [...document.querySelectorAll("main *")]
        .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
        .slice(0, 8)
        .map((e) => ({ tag: e.tagName, id: e.id, className: e.className })),
    }));
    assert(
      overflow.scroll <= overflow.width + 1,
      page.url() + " " + JSON.stringify(overflow),
    );
  }
  await visit("/");
  assert.equal(await page.locator(".game-badge.live").count(), 0);
  assert.equal(await page.locator(".game-card").count(), 6);
  assert.equal(
    await page.locator('.game-card[data-tone="pickleball"]').count(),
    1,
  );
  await page.locator('.game-card[data-tone="pickleball"]').click();
  await page.waitForFunction(() => document.body.dataset.ready === "true");
  assert.equal(
    await page.locator("body").getAttribute("data-game"),
    "pickleball",
  );
  await page.request.post(base + "/api/login", {
    headers: { "x-mimelo-request": "1" },
    data: { identity: "pickle0", password },
  });
  mkdirSync("artifacts", { recursive: true });
  for (const width of [320, 390, 700, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await visit("/game.html?game=pickleball");
    await fits();
    if (width <= 700) {
      const stats = await page
        .locator(".stat-card")
        .evaluateAll((cards) =>
          cards.map((c) => c.getBoundingClientRect().top),
        );
      assert.equal(stats[0], stats[1]);
      assert(stats[2] > stats[0]);
      await page.locator('.game-mobile-nav [data-view="rankings"]').click();
    } else {
      assert.equal(await page.locator(".game-mobile-nav").isVisible(), false);
      await page.locator('.sidebar [data-view="rankings"]').click();
    }
    await page.locator(".game-ranking-row").first().waitFor();
    await page.locator("#field-ranking-format").selectOption("doubles");
    await page.waitForFunction(
      () => document.querySelectorAll(".game-ranking-row").length === 4,
    );
    await fits();
    if (width <= 700)
      assert(
        await page
          .locator("#panel-elo .table-wrap")
          .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
      );
    if (width === 390)
      await page.screenshot({
        path: "artifacts/pickleball-rankings-mobile.png",
        fullPage: true,
      });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await visit("/game.html?game=pickleball&view=rankings");
  await page.locator('.game-mobile-nav [data-view="matches"]').click();
  await page.locator(".match-record").first().waitFor();
  assert.match(page.url(), /game=pickleball&view=matches/);
  await page.locator('#match-filters [data-status="accepted"]').click();
  await page.waitForFunction(
    () => document.querySelectorAll("#matches-body .match-record").length === 3,
  );
  await page.locator("#match-search").fill("Nobody matches this");
  await page.waitForFunction(() =>
    document
      .querySelector("#matches-body")
      .textContent.includes("No matching results"),
  );
  await page.goBack();
  await page
    .locator('[data-view-panel="rankings"]')
    .waitFor({ state: "visible" });
  assert.equal(
    await page.locator('.game-mobile-nav [aria-current="page"]').textContent(),
    "Rankings",
  );
  await visit("/game.html?game=pickleball&view=competitions");
  await page.locator("#comp-new").click();
  await page.locator("#field-competition-format").selectOption("doubles");
  await page.locator("#field-competition-target").selectOption("21");
  assert.equal(await page.locator("#field-competition-best").inputValue(), "1");
  await page.keyboard.press("Escape");
  await visit("/game.html?game=pickleball&view=record");
  assert.equal(await page.locator("#field-bestOf").inputValue(), "3");
  await page.locator("#field-target").selectOption("15");
  assert.equal(await page.locator("#field-bestOf").inputValue(), "1");
  assert.equal(await page.locator("[data-game-row]").count(), 1);
  await page.locator("#field-bestOf").selectOption("3");
  assert.equal(await page.locator("#field-target").inputValue(), "11");
  await page.locator("#field-record-format").selectOption("doubles");
  await page.locator("#field-p11-search").waitFor();
  for (const [key, user] of [
    ["p01", users[2]],
    ["p10", users[1]],
    ["p11", users[3]],
  ]) {
    await page.locator(`#field-${key}-search`).fill(user.name);
    await page
      .locator(`#field-${key}-search-results [role="option"]`)
      .filter({ hasText: user.name })
      .click();
  }
  for (const [i, a, b] of [
    [0, 11, 10],
    [1, 11, 7],
  ]) {
    await page.locator(`#field-score${i}a`).fill(String(a));
    await page.locator(`#field-score${i}b`).fill(String(b));
  }
  await page.locator('#record-form button[type="submit"]').click();
  await page.waitForFunction(() =>
    document.querySelector("#record-error").textContent.includes("won by two"),
  );
  await page.locator("#field-score0a").fill("12");
  await page.waitForFunction(
    () => document.querySelector("#sum-score").textContent === "2–0",
  );
  await fits();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "artifacts/pickleball-record-mobile.png",
    fullPage: true,
  });
  await page.locator('#record-form button[type="submit"]').click();
  await page.waitForURL(/match=/);
  await page.locator("dialog[open]").waitFor();
  await fits();
  await page.screenshot({
    path: "artifacts/pickleball-result-mobile.png",
    fullPage: true,
  });
  const recorded = app.db
    .prepare("SELECT * FROM matches ORDER BY id DESC LIMIT 1")
    .get();
  assert.equal(recorded.game, "pickleball");
  assert.equal(recorded.format, "doubles");
  assert.equal(JSON.parse(recorded.score).games[0].a, 12);
  assert.deepEqual(errors, []);
});
