import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { createApp } from "../server/app.js";
import { register, passwordHash } from "../server/auth.js";

test("homepage shows the five latest acceptances across games and pauses its news ticker", async (t) => {
  const app = await createApp({ database: ":memory:" });
  t.after(() => app.close());
  const pw = await passwordHash("HomeResultsPassword!");
  const users = [0, 1].map((i) =>
    register(
      app.db,
      { name: "Home Player " + i, handle: "hometester" + i },
      pw,
      null,
      i === 0,
    ),
  );
  const login = await app.inject({
    method: "POST",
    url: "/api/login",
    headers: { "x-mimelo-request": "1" },
    payload: { identity: users[0].handle, password: "HomeResultsPassword!" },
  });
  const headers = {
    "x-mimelo-request": "1",
    "x-csrf-token": login.json().csrf,
    cookie: login.cookies.map((c) => c.name + "=" + c.value).join("; "),
  };
  async function call(method, url, payload) {
    const response = await app.inject({
      method,
      url,
      headers,
      ...(payload ? { payload } : {}),
    });
    assert.equal(response.statusCode, 200, response.body);
    return response.json();
  }
  assert.deepEqual((await call("GET", "/api/recent-results")).rows, []);
  await app.listen({ port: 0, host: "127.0.0.1" });
  const base = "http://127.0.0.1:" + app.server.address().port;
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base);
  await page.waitForFunction(() => document.body.dataset.ready === "true");
  assert.match(
    await page.locator(".recent-results-empty").innerText(),
    /No accepted results/,
  );
  for (const game of ["eafc27", "eafc26"])
    for (const [code, name] of [
      ["AAA", "Alpha"],
      ["BBB", "Beta"],
    ])
      await call("POST", "/api/teams/" + game, { code, name, overall: 80 });
  async function result(game, accepted = true) {
    let score;
    if (game.startsWith("eafc")) {
      const teams = (await call("GET", "/api/teams/" + game)).rows;
      score = { a: 2, b: 1, teamA: teams[0].id, teamB: teams[1].id };
    } else
      score = {
        bestOf: 1,
        ...(game === "tt" ? { target: 11 } : {}),
        games: [
          {
            a: game === "smash" ? 3 : game === "tennis" ? 6 : 11,
            b: 1,
            ...(game === "smash"
              ? { fighters: ["Mario", "Link"], stage: "Battlefield" }
              : {}),
          },
        ],
      };
    const match = await call("POST", "/api/games/" + game + "/matches", {
      format: "singles",
      sides: users.map((u) => [u.player_id]),
      score,
    });
    if (accepted)
      await call("POST", `/api/matches/${match.id}/accept`, { revision: 1 });
    return match;
  }
  const older = await result("tennis");
  const latest = [];
  for (const game of ["eafc27", "eafc26", "smash", "tennis", "tt"])
    latest.push(await result(game));
  const submitted = await result("smash", false);
  const voided = await result("tt");
  await call("DELETE", `/api/matches/${voided.id}`, { revision: 1 });
  const now = Date.now();
  // Acceptance order deliberately differs from submission order, including a tie.
  app.db
    .prepare("UPDATE matches SET accepted=?,submitted=? WHERE id=?")
    .run(now - 10000, now + 10000, older.id);
  latest.forEach((match, i) =>
    app.db
      .prepare("UPDATE matches SET accepted=?,submitted=? WHERE id=?")
      .run(now - (i < 2 ? 0 : i * 1000), now - (5 - i) * 2000, match.id),
  );
  const expected = [latest[1], latest[0], ...latest.slice(2)].map((m) => m.id);
  const feed = (await call("GET", "/api/recent-results")).rows;
  assert.deepEqual(
    feed.map((m) => m.id),
    expected,
  );
  assert.equal(new Set(feed.map((m) => m.game)).size, 5);
  assert(
    feed.every(
      (m) =>
        m.status === "accepted" &&
        ![older.id, submitted.id, voided.id].includes(m.id),
    ),
  );
  // The existing game-scoped match API keeps its normal behavior.
  assert(
    (await call("GET", "/api/matches?game=tt&status=accepted")).rows.every(
      (m) => m.game === "tt",
    ),
  );
  mkdirSync("artifacts", { recursive: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(base);
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    assert.equal(await page.locator(".recent-result").count(), 5);
    assert.deepEqual(
      await page
        .locator(".recent-result")
        .evaluateAll((rows) => rows.map((row) => Number(row.dataset.match))),
      expected,
    );
    assert.equal(
      new Set(
        await page
          .locator(".recent-result")
          .evaluateAll((rows) => rows.map((row) => row.dataset.game)),
      ).size,
      5,
    );
    const viewport = page.locator(".recent-results-viewport"),
      panel = page.locator(".recent-results-panel");
    await panel.scrollIntoViewIfNeeded();
    await page.mouse.move(1, 1);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      path: `artifacts/home-results-${width}.png`,
      fullPage: true,
    });
    await panel.screenshot({
      path: `artifacts/home-results-panel-${width}.png`,
    });
    if (width === 1440) {
      await page.waitForFunction(
        () => document.querySelector(".recent-results-viewport").scrollTop > 10,
        undefined,
        { timeout: 10000 },
      );
      await panel.hover();
      // Cancel any in-progress smooth scroll before checking future advances.
      await viewport.evaluate((el) =>
        el.scrollTo({ top: el.scrollTop, behavior: "instant" }),
      );
      const paused = await viewport.evaluate((el) => el.scrollTop);
      await page.waitForTimeout(4800);
      assert.equal(
        await viewport.evaluate((el) => el.scrollTop),
        paused,
        "Hover pauses automatic scrolling.",
      );
      await page.mouse.move(1, 1);
      await viewport.focus();
      const focused = await viewport.evaluate((el) => el.scrollTop);
      await page.waitForTimeout(4800);
      assert.equal(
        await viewport.evaluate((el) => el.scrollTop),
        focused,
        "Keyboard focus pauses automatic scrolling.",
      );
      await page
        .getByRole("button", { name: "Pause automatic scrolling" })
        .click();
      assert.equal(
        await page
          .getByRole("button", { name: "Resume automatic scrolling" })
          .count(),
        1,
      );
    }
    const firstLink = page.locator(".recent-result a").first();
    await firstLink.click();
    await page.waitForURL(/game=eafc26.*match=/);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(base);
  await page.waitForFunction(() => document.body.dataset.ready === "true");
  await page.locator(".recent-results-panel").scrollIntoViewIfNeeded();
  assert.equal(await page.locator(".recent-results-pause").isVisible(), false);
  await page.mouse.move(1, 1);
  await page.waitForTimeout(4800);
  assert.equal(
    await page
      .locator(".recent-results-viewport")
      .evaluate((el) => el.scrollTop),
    0,
  );
  assert.deepEqual(errors, []);
});
