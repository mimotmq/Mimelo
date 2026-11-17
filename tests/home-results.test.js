import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { createApp } from "../server/app.js";
import { register, passwordHash } from "../server/auth.js";

test("homepage loops overview scorecards with club crests, per-game fighters, watermarks and accessible pauses", async (t) => {
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
  await page.route("**/test-crest/*.svg", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 56"><path fill="${route.request().url().includes("AAA") ? "#f5c747" : "#63c6e8"}" d="M4 4h40v30L24 52 4 34z"/></svg>`,
    }),
  );
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
  for (const code of ["AAA", "BBB"]) {
    const badge = app.db
      .prepare("INSERT INTO team_badges(name,image,updated) VALUES(?,?,?)")
      .run(code, "/test-crest/" + code + ".svg", Date.now());
    app.db
      .prepare(
        "INSERT INTO team_badge_links(code,gender,badge_id) VALUES(?,?,?)",
      )
      .run(code, "men", badge.lastInsertRowid);
  }
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
    if (game === "smash") {
      score.bestOf = 3;
      score.games.push(
        { a: 1, b: 3, fighters: ["Luigi", "Samus"], stage: "Battlefield" },
        { a: 3, b: 2, fighters: ["Kirby", "Fox"], stage: "Battlefield" },
      );
    }
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
    assert.equal(
      await page
        .locator(".recent-results-list:not([aria-hidden]) > .recent-result")
        .count(),
      5,
    );
    assert.deepEqual(
      await page
        .locator(".recent-results-list:not([aria-hidden]) > .recent-result")
        .evaluateAll((rows) => rows.map((row) => Number(row.dataset.match))),
      expected,
    );
    assert.equal(
      new Set(
        await page
          .locator(".recent-results-list:not([aria-hidden]) > .recent-result")
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
    // Screenshots may scroll this full-width strip beneath the current pointer.
    // Keep the pointer in its heading so hover does not pause the score viewport.
    await panel.scrollIntoViewIfNeeded();
    await page.locator(".recent-results-heading h2").hover();
    const track = page.locator(".recent-results-track");
    const position = () =>
      track.evaluate(
        (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41,
      );
    await page.waitForFunction(() =>
      document
        .querySelector(".recent-results-panel")
        .classList.contains("is-scrolling-results"),
    );
    const moving = await position();
    await page.waitForTimeout(500);
    assert(
      (await position()) < moving - 8,
      "Results move continuously from right to left on desktop and mobile.",
    );
    const originals = page.locator(".recent-results-list:not([aria-hidden])");
    assert.equal(
      await panel.evaluate((el) => getComputedStyle(el).borderRadius),
      "0px",
      "The outer strip has square corners.",
    );
    assert.equal(
      await originals
        .locator(".recent-result")
        .first()
        .evaluate((el) => getComputedStyle(el).borderRadius),
      "0px",
      "Score segments are rectangular.",
    );
    assert(
      await viewport.evaluate(
        (el) => Math.abs(el.clientWidth - innerWidth) <= 1,
      ),
      "The broadcast strip uses the page width.",
    );
    assert.equal(
      await page.locator(".recent-result-logo").count(),
      0,
      "No standalone game logo beside scores.",
    );
    assert.equal(
      await originals.locator(".recent-result-watermark").count(),
      5,
    );
    assert(
      await originals
        .locator(".recent-result-watermark")
        .first()
        .evaluate(
          (el) =>
            el.alt === "" &&
            el.parentElement.classList.contains("recent-result-score") &&
            getComputedStyle(el).position === "absolute" &&
            getComputedStyle(el).zIndex === "-1" &&
            Number(getComputedStyle(el).opacity) < 0.15 &&
            Number(getComputedStyle(el).opacity) >= 0.1,
        ),
    );
    assert(
      !/\b(Singles|Doubles)\b/.test(await page.locator("body").innerText()),
    );
    const football = originals.locator('[data-game="eafc26"]');
    assert.equal(
      await football.locator(".fc-scoreline .catalog-stock-icon").count(),
      2,
    );
    assert.equal(
      await football.locator(".fc-scoreline .score").innerText(),
      "2 - 1",
    );
    assert.match(
      await football
        .locator(".match-team-label")
        .first()
        .getAttribute("aria-label"),
      /Alpha|Beta/,
    );
    const smash = originals.locator('[data-game="smash"]');
    assert.equal(
      await smash.locator(".match-fighter-icon").count(),
      6,
      "Show both fighters in every game.",
    );
    assert.deepEqual(
      await smash
        .locator(".match-fighter-icon")
        .evaluateAll((icons) =>
          icons.map((el) => el.getAttribute("aria-label")),
        ),
      [
        "Home Player 0: Mario",
        "Home Player 0: Luigi",
        "Home Player 0: Kirby",
        "Home Player 1: Link",
        "Home Player 1: Samus",
        "Home Player 1: Fox",
      ],
    );
    assert.deepEqual(
      await smash
        .locator(".tennis-score-row:not(.tennis-score-head) .tennis-score-cell")
        .allTextContents(),
      ["3", "1", "3", "1", "3", "2"],
    );
    assert.deepEqual(
      await smash.locator(".tennis-score-total").allTextContents(),
      ["2", "1"],
    );
    assert.notEqual(
      await football.evaluate((el) => getComputedStyle(el).backgroundImage),
      await smash.evaluate((el) => getComputedStyle(el).backgroundImage),
      "Games use different background hues.",
    );
    assert(
      await page
        .locator(".recent-results-copy")
        .first()
        .evaluate(
          (el) =>
            el.getAttribute("aria-hidden") === "true" &&
            [...el.querySelectorAll("a")].every((a) => a.tabIndex === -1),
        ),
    );
    await viewport.hover();
    const hovered = await position();
    await page.waitForTimeout(400);
    assert.equal(await position(), hovered, "Hover pauses the crawl in place.");
    await page
      .getByRole("button", { name: "Pause automatic scrolling" })
      .click();
    await page.mouse.move(1, 1);
    const paused = await position();
    await page.waitForTimeout(400);
    assert.equal(
      await position(),
      paused,
      "Explicit pause stays paused after the pointer leaves.",
    );
    await page
      .getByRole("button", { name: "Resume automatic scrolling" })
      .click();
    const resumed = await position();
    await page.waitForTimeout(500);
    assert(
      (await position()) < resumed - 8,
      "Resume works while the control still has focus.",
    );
    // Seek across the loop seam; the repeated copy takes exactly the place
    // of the original without a blank strip or backwards sweep.
    const seam = await track.evaluate((el) => {
      const animation = el.getAnimations()[0];
      animation.pause();
      const duration = animation.effect.getTiming().duration;
      animation.currentTime = duration - 1;
      const before = el.children[1].getBoundingClientRect().left;
      animation.currentTime = duration + 1;
      const after = el.children[0].getBoundingClientRect().left;
      animation.play();
      return Math.abs(before - after);
    });
    assert(seam < 1, "Loop is seamless.");
    await viewport.focus();
    assert.equal(
      await track.evaluate((el) => getComputedStyle(el).animationName),
      "none",
    );
    await page
      .locator(".recent-results-list:not([aria-hidden]) a")
      .last()
      .focus();
    assert(
      await viewport.evaluate((el) => el.scrollLeft > 0),
      "Keyboard users can reach results beyond the viewport.",
    );
    await page
      .getByRole("button", { name: "Pause automatic scrolling" })
      .focus();
    await page.waitForFunction(
      () =>
        !document
          .querySelector(".recent-results-panel")
          .classList.contains("is-browsing-results"),
    );
    assert.equal(
      await viewport.evaluate((el) => el.scrollLeft),
      0,
      "Leaving keyboard browsing resets the manual scroll before the crawl resumes.",
    );
    const firstLink = page
      .locator(".recent-results-list:not([aria-hidden]) a")
      .first();
    await viewport.hover();
    await firstLink.click();
    await page.waitForURL(/game=eafc26.*match=/);
  }
  // Two results must still fill a wide strip all the way through the loop.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route("**/api/recent-results", (route) =>
    route.fulfill({ json: { rows: feed.slice(0, 2) } }),
  );
  await page.goto(base);
  await page.waitForFunction(() => document.body.dataset.ready === "true");
  await page.locator(".recent-results-panel").scrollIntoViewIfNeeded();
  await page.mouse.move(1, 1);
  assert.equal(
    await page
      .locator(".recent-results-list:not([aria-hidden]) > .recent-result")
      .count(),
    2,
  );
  assert(
    await page.locator(".recent-results-track").evaluate((el) => {
      const animation = el.getAnimations()[0];
      animation.pause();
      animation.currentTime = animation.effect.getTiming().duration - 50;
      return (
        el.lastElementChild.getBoundingClientRect().right >=
        el.parentElement.getBoundingClientRect().right
      );
    }),
    "Repeated results cover the viewport even just before wrapping.",
  );
  await page.locator(".recent-results-copy a").first().click();
  await page.waitForURL(/game=eafc26.*match=/);
  await page.unroute("**/api/recent-results");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(base);
  await page.waitForFunction(() => document.body.dataset.ready === "true");
  await page.locator(".recent-results-panel").scrollIntoViewIfNeeded();
  assert.equal(await page.locator(".recent-results-pause").isVisible(), false);
  await page.mouse.move(1, 1);
  await page.waitForTimeout(400);
  assert.equal(
    await page
      .locator(".recent-results-viewport")
      .evaluate((el) => el.scrollLeft),
    0,
  );
  assert.equal(
    await page
      .locator(".recent-results-track")
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  assert.deepEqual(errors, []);
});
