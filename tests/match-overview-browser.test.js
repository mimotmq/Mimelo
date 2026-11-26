import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { createApp } from "../server/app.js";
import { americanOdds } from "../static/js/match-overview.js";
import { register, passwordHash } from "../server/auth.js";
test("American odds convert estimated probabilities to signed stake/profit amounts", () => {
  assert.equal(americanOdds(0.5), "+100");
  assert.equal(americanOdds(0.4), "+150");
  assert.equal(americanOdds(0.2), "+400");
  assert.equal(americanOdds(2 / 3), "−200");
  assert.equal(americanOdds(0.75), "−300");
});
test("clicking a result opens a large historical overview with form, h2h, odds and tournament tables", async (t) => {
  const app = await createApp({ database: ":memory:" });
  const hash = await passwordHash("MatchOverviewPassword!");
  const users = [
    "Alex Morgan",
    "Bashar Fakhreddin",
    "Jordan Smith",
    "Taylor Lee",
  ].map((name, i) =>
    register(
      app.db,
      { name, handle: "matchoverview" + i },
      hash,
      null,
      i === 0,
    ),
  );
  await app.listen({ host: "127.0.0.1", port: 0 });
  const base = "http://127.0.0.1:" + app.server.address().port;
  const browser = await chromium.launch();
  t.after(async () => {
    await browser.close();
    await app.close();
  });
  const context = await browser.newContext({ timezoneId: "America/New_York" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const login = await context.request.post(base + "/api/login", {
    headers: { "x-mimelo-request": "1" },
    data: { identity: users[0].handle, password: "MatchOverviewPassword!" },
  });
  const headers = {
    "x-mimelo-request": "1",
    "x-csrf-token": (await login.json()).csrf,
  };
  async function call(path, data, method = "POST") {
    const r = await context.request.fetch(base + "/api/" + path, {
      method,
      headers,
      ...(data === undefined ? {} : { data }),
    });
    assert.equal(r.status(), 200, await r.text());
    return r.json();
  }
  await call(
    "me",
    { profile: { nationalities: ["Lebanon", "United States"] } },
    "PATCH",
  );
  app.db
    .prepare("UPDATE players SET profile=? WHERE id=?")
    .run(JSON.stringify({ nationalities: ["Syria"] }), users[1].player_id);
  async function result(game, score, fixture) {
    const m = await call(`games/${game}/matches`, {
      sides: [[users[0].player_id], [users[1].player_id]],
      format: "singles",
      score,
      ...(fixture ? { fixture } : {}),
    });
    await call(`matches/${m.id}/accept`, { revision: 1 });
    await call(`matches/${m.id}/elo`, { revision: 1 });
    return m;
  }
  for (let i = 0; i < 6; i++)
    await result("tennis", {
      bestOf: 1,
      games: [{ a: i % 2 ? 2 : 6, b: i % 2 ? 6 : 2 }],
    });
  const friendly = await result("tennis", {
    bestOf: 1,
    games: [{ a: 6, b: 3 }],
  });
  for (const [code, name] of [
    ["OVRA", "Overview A"],
    ["OVRB", "Overview B"],
  ])
    await call("teams/eafc27", { code, name, overall: 80 });
  const teams = (await call("teams/eafc27", undefined, "GET")).rows;
  const football = await result("eafc27", {
    a: 3,
    b: 1,
    teamA: teams[0].id,
    teamB: teams[1].id,
  });
  const league = await call("competitions", {
    game: "tennis",
    name: "Overview League 2026/27",
    kind: "league",
    entries: users.map((u) => [u.player_id]),
    settings: { bestOf: 1 },
  });
  const drawn = await call(`competitions/${league.id}/draw`, {});
  const ready = drawn.fixtures.filter((f) => f.status === "ready");
  await result("tennis", { games: [{ a: 6, b: 2 }] }, ready[0].id);
  const tournament = await result(
    "tennis",
    { games: [{ a: 6, b: 4 }] },
    ready[1].id,
  );
  async function visit(game) {
    await page.goto(base + `/game.html?game=${game}&view=matches`);
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    await page.evaluate(() => document.fonts.ready);
  }
  async function open(id) {
    await page.locator(`#matches-body [data-match="${id}"]`).click();
    const dialog = page.locator(".match-overview-dialog[open]");
    await dialog.waitFor();
    return dialog;
  }
  mkdirSync("artifacts", { recursive: true });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await visit("tennis");
    assert.equal(
      await page
        .locator("#matches-body button")
        .filter({ hasText: "Open" })
        .count(),
      0,
    );
    let dialog = await open(friendly.id);
    assert.equal(await dialog.locator(".match-form-result").count(), 10);
    assert.equal(await dialog.locator(".match-odds-outcome").count(), 2);
    assert.match(await dialog.innerText(), /6 previous meetings/);
    assert.equal(await dialog.locator(".match-standings-table").count(), 0);
    assert(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      "Friendly overview fits its dialog",
    );
    if (width === 1440 || width === 390)
      await dialog.screenshot({
        path: `artifacts/match-overview-friendly-${width}.png`,
      });
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    dialog = await open(tournament.id);
    assert.equal(
      await dialog.locator(".match-standings-table tbody tr").count(),
      4,
    );
    assert.equal(await dialog.locator(".match-form-result").count(), 0);
    assert.match(await dialog.innerText(), /Standings before this match/);
    assert.match(await dialog.innerText(), /Overview League 2026\/27/);
    assert(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
    if (width === 1440 || width === 390)
      await dialog.screenshot({
        path: `artifacts/match-overview-tournament-${width}.png`,
      });
    await page.keyboard.press("Escape");
    await visit("eafc27");
    const mini = page.locator(`#matches-body [data-match="${football.id}"]`);
    assert.equal(await mini.locator(".fc-player .avatar").count(), 2);
    assert.equal(await mini.locator(".fc-player .avatar").first().isVisible(), width > 700);
    dialog = await open(football.id);
    assert.equal(await dialog.locator(".match-overview-identities .avatar").count(), 2);
    assert.equal(
      await dialog.locator(".match-overview-side:last-child .match-overview-person").evaluate((el) => getComputedStyle(el).flexDirection),
      "row-reverse",
    );
    assert.equal(await dialog.locator(".match-odds-outcome").count(), 3);
    const oddsY = await dialog
      .locator(".match-odds-outcome > b")
      .evaluateAll((elements) =>
        elements.map((el) => el.getBoundingClientRect().y),
      );
    assert(
      Math.max(...oddsY) - Math.min(...oddsY) < 1,
      "Odds amounts stay aligned across wrapped names",
    );
    assert.match(await dialog.locator(".match-odds-grid").innerText(), /Draw/);
    assert.deepEqual(
      await dialog.locator(".match-odds-outcome > b").allTextContents(),
      ["+150", "+400", "+150"],
    );
    await dialog.locator(".match-odds-explainer summary").click();
    assert.match(
      await dialog.locator(".match-odds-explainer").innerText(),
      /−200 means stake \$200 for \$100 profit/,
    );
    assert(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      "Football overview fits its dialog",
    );
    if (width === 1440 || width === 390)
      await dialog.screenshot({
        path: `artifacts/match-overview-football-${width}.png`,
      });
    await page.keyboard.press("Escape");
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
  }
  // Optional timing stays blank, round-trips local time, and can be cleared.
  await page.goto(base + "/game.html?game=tennis&view=record");
  await page.waitForFunction(() => document.body.dataset.ready === "true");
  assert.equal(await page.locator("#r-played-date").inputValue(), "");
  assert.equal(await page.locator("#r-start-time").inputValue(), "");
  assert.equal(await page.locator("#r-duration").inputValue(), "");
  for (let side = 0; side < 2; side++) {
    const selector = `#field-p${side}0`;
    const player = await call(
      "players/" + users[side].player_id,
      undefined,
      "GET",
    );
    await page.locator(selector + "-search").fill(player.name);
    await page
      .locator(selector + "-search-results")
      .getByRole("option")
      .filter({ hasText: player.name })
      .click();
  }
  await page.locator("#field-bestOf").selectOption("1");
  await page.locator("#field-score0a").fill("6");
  await page.locator("#field-score0b").fill("2");
  await page.locator("#r-played-date").fill("2026-01-02");
  await page.locator("#r-start-time").fill("14:35");
  assert.equal(await page.getByLabel("Court surface").inputValue(), "Hardcourt");
  await page.getByLabel("Court surface").selectOption("Clay");
  await page.locator("#r-duration").fill("90");
  await page
    .locator(".record-timing")
    .screenshot({ path: "artifacts/match-time-entry-320.png" });
  await page.locator("#record-form button[type=submit]").click();
  await page.waitForURL(/match=/);
  let timingDialog = page.locator(".match-overview-dialog[open]");
  await timingDialog.waitFor();
  assert.match(await timingDialog.innerText(), /Clay/);
  assert.match(await timingDialog.innerText(), /90 minutes played/);
  assert.match(
    await timingDialog.locator(".match-overview-meta time").innerText(),
    /^Played/,
  );
  const timedMatch = app.db
    .prepare("SELECT * FROM matches ORDER BY id DESC LIMIT 1")
    .get();
  assert.equal(timedMatch.played_at, Date.parse("2026-01-02T19:35:00Z"));
  assert.equal(timedMatch.duration_minutes, 90);
  await timingDialog.getByRole("button", { name: "Correct result" }).click();
  await page.waitForURL(/edit=/);
  await page.waitForFunction(() => document.body.dataset.ready === "true");
  assert.equal(await page.locator("#r-played-date").inputValue(), "2026-01-02");
  assert.equal(await page.locator("#r-start-time").inputValue(), "14:35");
  assert.equal(await page.locator("#r-duration").inputValue(), "90");
  await page.locator("#r-played-date").fill("");
  await page.locator("#r-start-time").fill("");
  assert.equal(await page.getByLabel("Court surface").inputValue(), "Clay");
  await page.getByLabel("Court surface").selectOption("Grass");
  await page.locator("#r-duration").fill("");
  await page.locator("#record-form button[type=submit]").click();
  await page.waitForURL(/match=/);
  timingDialog = page.locator(".match-overview-dialog[open]");
  await timingDialog.waitFor();
  assert.match(
    await timingDialog.locator(".match-overview-meta time").innerText(),
    /^Entered/,
  );
  const cleared = app.db
    .prepare("SELECT * FROM matches WHERE id=?")
    .get(timedMatch.id);
  assert.equal(JSON.parse(cleared.score).surface, "Grass");
  assert.equal(cleared.played_at, null);
  assert.equal(cleared.duration_minutes, null);
  assert.equal(cleared.submitted, timedMatch.submitted);
  assert.deepEqual(errors, []);
});
