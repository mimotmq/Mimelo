import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import sharp from "sharp";
import { createApp } from "../server/app.js";
import { register, passwordHash } from "../server/auth.js";
import { locked } from "../server/competitions.js";
import {
  bracketLayout,
  fixtureScoreText,
  sourceRef,
} from "../static/js/competition-bracket.js";
const require = createRequire(import.meta.url),
  { chromium } = require("@playwright/test");

async function setup(
  t,
  {
    count = 5,
    elimination = "single",
    format = "singles",
    game = "eafc26",
    bestOf = 1,
    target,
  } = {},
) {
  const uploads = mkdtempSync(join(tmpdir(), "mimelo-bracket-"));
  const app = await createApp({ database: ":memory:", uploads });
  t.after(async () => {
    await app.close();
    rmSync(uploads, { recursive: true, force: true });
  });
  const pw = await passwordHash("BracketPassword!");
  const names = [
    "Alex Rivera",
    "Jordan Morgan",
    "Sam Anderson",
    "Taylor Ibrahim",
    "Christopher Montgomery-Wellington",
    "Casey Lee",
    "Riley Santos",
    "Jamie Silva",
  ];
  const users = Array.from(
    { length: format === "doubles" ? count * 2 : count },
    (_, i) =>
      register(
        app.db,
        {
          name: names[i % names.length] + (i >= 8 ? " II" : ""),
          handle: "bracket" + i,
        },
        pw,
        null,
        i === 0,
      ),
  );
  const login = await app.inject({
    method: "POST",
    url: "/api/login",
    headers: { "x-mimelo-request": "1" },
    payload: { identity: users[0].handle, password: "BracketPassword!" },
  });
  assert.equal(login.statusCode, 200);
  const headers = {
    "x-mimelo-request": "1",
    "x-csrf-token": login.json().csrf,
    cookie: login.cookies.map((c) => `${c.name}=${c.value}`).join("; "),
  };
  async function call(method, url, payload) {
    const r = await app.inject({
      method,
      url,
      headers,
      ...(payload ? { payload } : {}),
    });
    assert.equal(r.statusCode, 200, r.body);
    return r.json();
  }
  const image = await sharp({
    create: { width: 64, height: 64, channels: 4, background: "#277761" },
  })
    .webp()
    .toBuffer();
  writeFileSync(join(uploads, "profile.webp"), image);
  app.db
    .prepare("UPDATE players SET photo='/uploads/profile.webp' WHERE id=?")
    .run(users[0].player_id);
  const teams = [];
  if (game.startsWith("eafc")) {
    for (const [code, name] of [
      ["MUN", "Manchester United"],
      ["RMA", "Real Madrid"],
    ]) {
      await call("POST", `/api/teams/${game}`, { code, name, overall: 85 });
      app.db
        .prepare("INSERT INTO team_badges(name,image,updated) VALUES(?,?,?)")
        .run(name, "/uploads/" + code + ".webp", Date.now());
      const badge = app.db
        .prepare("SELECT id FROM team_badges WHERE name=?")
        .get(name);
      app.db
        .prepare("INSERT INTO team_badge_links VALUES(?,?,?)")
        .run(code, "men", badge.id);
      writeFileSync(join(uploads, code + ".webp"), image);
    }
    teams.push(...(await call("GET", `/api/teams/${game}`)).rows);
  }
  const entries =
    format === "doubles"
      ? Array.from({ length: count }, (_, i) => [
          users[i * 2].player_id,
          users[i * 2 + 1].player_id,
        ])
      : users.map((u) => [u.player_id]);
  const comp = await call("POST", "/api/competitions", {
    game,
    name: "The Weekend Cup",
    kind: "knockout",
    format,
    entries,
    settings: { elimination, seeding: "preseeded", bestOf, target },
  });
  await call("POST", `/api/competitions/${comp.id}/draw`, {});
  const state = () => call("GET", `/api/competitions/${comp.id}`);
  async function record(fixture, score) {
    const match = await call("POST", `/api/games/${game}/matches`, {
      fixture: fixture.id,
      score: score || { a: 2, b: 1, teamA: teams[0].id, teamB: teams[1].id },
    });
    await call("POST", `/api/matches/${match.id}/accept`, { revision: 1 });
    return match;
  }
  return { app, call, state, record, teams, users, headers, comp, game };
}

test("competition fixtures include current photos, club crests, and exact extra-time / penalty scores", async (t) => {
  const h = await setup(t);
  const c = await h.state(),
    ready = c.fixtures.find((f) => f.status === "ready");
  await h.record(ready, {
    a: 2,
    b: 2,
    aet: true,
    pens: [5, 4],
    teamA: h.teams[0].id,
    teamB: h.teams[1].id,
  });
  const after = await h.state(),
    result = after.fixtures.find((f) => f.id === ready.id);
  assert.equal(
    after.entries
      .flatMap((e) => e.players)
      .find((p) => p.id === h.users[0].player_id).photo,
    "/uploads/profile.webp",
  );
  assert.deepEqual(result.score.pens, [5, 4]);
  assert.equal(result.teams[0].image, "/uploads/MUN.webp");
  assert.equal(result.teams[1].code, "RMA");
  assert.equal(fixtureScoreText(result), "2(5)–(4)2 a.e.t.");
  assert(
    after.fixtures
      .filter((f) => !f.match_id)
      .every((f) => f.teams.every((team) => team === null)),
    "Future rounds must not inherit teams used earlier",
  );
  const mirrored = bracketLayout(after.fixtures, {
    mirrored: true,
    cardWidth: 220,
  });
  assert.equal(mirrored.nodes.length, 7);
  assert.equal(mirrored.edges.length, 6);
  assert.equal(mirrored.nodes.filter((n) => n.right).length, 3);
  for (const edge of mirrored.edges) {
    const target = after.fixtures.find((f) => f.id === edge.target);
    assert(
      [
        sourceRef(target.source_a)?.fixture,
        sourceRef(target.source_b)?.fixture,
      ].includes(edge.source),
    );
  }
  const linear = bracketLayout(after.fixtures);
  assert.equal(
    new Set(linear.nodes.filter((n) => n.round === 0).map((n) => n.x)).size,
    1,
  );
});

test("connected tournament cards mirror on desktop, swipe by round on mobile, and open exact results", async (t) => {
  const h = await setup(t);
  let c = await h.state();
  await h.record(
    c.fixtures.find((f) => f.status === "ready"),
    {
      a: 2,
      b: 2,
      aet: true,
      pens: [5, 4],
      teamA: h.teams[0].id,
      teamB: h.teams[1].id,
    },
  );
  c = await h.state();
  for (const f of c.fixtures.filter(
    (f) => f.stage === "semifinal" && f.status === "ready",
  ))
    await h.record(f);
  await h.app.listen({ host: "127.0.0.1", port: 0 });
  const base = "http://127.0.0.1:" + h.app.server.address().port;
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({
      viewport: { width: 1600, height: 1000 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/competition.html?game=${h.game}&id=${h.comp.id}`);
  await page.waitForFunction(() => document.body.dataset.ready === "true");
  await page.locator('[data-layout="mirrored"] .bt-match').first().waitFor();
  assert.equal(await page.locator("#cp-bracket").isVisible(), true);
  assert.equal(
    await page
      .locator(".competition-entrants-compact details")
      .getAttribute("open"),
    null,
  );
  assert.equal(await page.locator(".bt-match").count(), 7);
  assert.equal(await page.locator(".bt-connections path").count(), 6);
  assert.equal(await page.locator(".bt-match.bt-bye").count(), 3);
  assert.equal(await page.locator(".bt-unresolved.bt-winner").count(), 0);
  assert.equal(await page.locator(".bt-penalty").count(), 2);
  assert.equal(await page.locator(".bt-shootout").innerText(), "2(5)–(4)2");
  assert.match(await page.locator("#bracket-wrap").innerText(), /a\.e\.t\./);
  await page.locator("#cp-bracket").scrollIntoViewIfNeeded();
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".bt-team img")].every(
      (i) => i.complete && i.naturalWidth,
    ),
  );
  const identityOrder = await page
    .locator(".bt-right")
    .last()
    .evaluate((card) => {
      const photo = card.querySelector(".bt-avatars").getBoundingClientRect(),
        team = card.querySelector(".bt-team").getBoundingClientRect();
      return photo.left > team.right;
    });
  assert.equal(identityOrder, true);
  mkdirSync("artifacts", { recursive: true });
  await page
    .locator("#cp-bracket")
    .screenshot({ path: "artifacts/bracket-desktop.png" });
  await page
    .locator(".bt-penalty")
    .first()
    .locator("xpath=ancestor::button")
    .click();
  await page.locator("dialog .match-score-detail").waitFor();
  assert.match(
    await page.locator("dialog .match-score-detail").innerText(),
    /Penalties/,
  );
  assert.equal(
    await page.locator("dialog .fc-shootout").innerText(),
    "2(5)–(4)2",
  );
  await page.locator("dialog[open] .dialog-close").click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-layout="linear"] .bt-match').first().waitFor();
  const firstRound = await page
    .locator(".bt-match")
    .evaluateAll((cards) => cards.slice(0, 4).map((card) => card.offsetLeft));
  assert.equal(new Set(firstRound).size, 1);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.locator("#cp-bracket").scrollIntoViewIfNeeded();
  await page
    .locator("#cp-bracket")
    .screenshot({ path: "artifacts/bracket-mobile.png" });
  await page.getByRole("button", { name: "Final", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector(".bt-viewport").scrollLeft > 400,
  );
  assert.equal(
    await page
      .locator(".bt-round-nav")
      .evaluate((n) => getComputedStyle(n).display !== "none"),
    true,
  );
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('[data-layout="mirrored"] .bt-match').first().waitFor();
  await page
    .locator("#cp-bracket")
    .screenshot({ path: "artifacts/bracket-dark.png" });
  assert.deepEqual(errors, []);
});

test("double elimination and doubles retain each lane, player pair, and conditional reset", async (t) => {
  const h = await setup(t, {
    count: 4,
    elimination: "double",
    format: "doubles",
    game: "tennis",
  });
  const c = await h.state();
  assert(c.entries.every((e) => e.players.length === 2));
  for (const pool of ["W", "L", "G"]) {
    const fs = c.fixtures.filter((f) => f.pool === pool),
      layout = bracketLayout(fs, { pool });
    assert(layout.nodes.length > 0);
    for (const edge of layout.edges)
      assert(fs.some((f) => f.id === edge.source));
  }
  assert(c.fixtures.some((f) => f.conditional));
});

test("swiping a large mobile draw brings the chosen round's matches into view", async (t) => {
  const h = await setup(t, { count: 16 });
  await h.app.listen({ host: "127.0.0.1", port: 0 });
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await page.goto(
    `http://127.0.0.1:${h.app.server.address().port}/competition.html?game=eafc26&id=${h.comp.id}`,
  );
  await page.locator(".bt-match").first().waitFor();
  assert.equal(await page.locator('[data-match-round="0"]').count(), 8);
  assert.equal(await page.locator(".bt-unresolved.bt-winner").count(), 0);
  const viewport = page.locator(".bt-viewport");
  await viewport.evaluate((v) => {
    v.scrollLeft = v.scrollWidth;
  });
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-bracket-round="3"]')
        ?.getAttribute("aria-current") === "step",
  );
  assert.equal(
    await page.locator('[data-match-round="3"]').evaluate((m) => {
      const match = m.getBoundingClientRect(),
        area = m.closest(".bt-viewport").getBoundingClientRect();
      return (
        match.top >= area.top &&
        match.bottom <= area.bottom &&
        match.left >= area.left &&
        match.right <= area.right
      );
    }),
    true,
  );
  const top = await viewport.evaluate((v) => v.scrollTop);
  await viewport.evaluate((v) => {
    v.scrollTop -= 30;
  });
  await page.waitForTimeout(220);
  assert.equal(
    await viewport.evaluate((v) => v.scrollTop),
    top - 30,
    "Vertical panning must remain under the user's control",
  );
});

test("double bracket views, round navigation, byes, and scoreless forfeits", async (t) => {
  const h = await setup(t, {
    count: 6,
    elimination: "double",
    game: "tt",
    bestOf: 3,
    target: 21,
  });
  const draw = await h.state();
  const bye = draw.fixtures.find((f) => f.pool === "W" && f.status === "bye");
  const ready = draw.fixtures.find(
    (f) => f.pool === "W" && f.status === "ready",
  );
  await h.app.listen({ host: "127.0.0.1", port: 0 });
  const base = `http://127.0.0.1:${h.app.server.address().port}`;
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.request.post(base + "/api/login", {
    headers: { "x-mimelo-request": "1" },
    data: { identity: h.users[0].handle, password: "BracketPassword!" },
  });
  await page.goto(
    `${base}/competition.html?game=tt&id=${h.comp.id}&view=fixtures`,
  );
  const byeGroup = page
    .locator(".fixture-day")
    .filter({ hasText: "Winners round 1" });
  await byeGroup.locator("summary").click();
  const byeCard = byeGroup
    .locator(".fixture-card")
    .filter({ hasText: bye.label });
  assert.match(await byeCard.innerText(), /Bye[\s\S]*advances/);
  assert.equal(await byeCard.locator("a,button").count(), 0);
  await page.getByRole("tab", { name: "Bracket" }).click();
  assert.equal(
    await page.getByRole("tab", { name: "Table", exact: true }).count(),
    0,
  );
  const winners = page.locator('[data-bracket-pool="W"]');
  const losers = page.locator('[data-bracket-pool="L"]');
  const grand = draw.fixtures.find((f) => f.label === "Grand final");
  const reset = draw.fixtures.find((f) => f.conditional);
  const finals = page.locator(`[data-bracket-fixture="${grand.id}"]`);
  await page.getByRole("button", { name: "Losers only" }).click();
  assert.equal(await losers.isVisible(), true);
  assert.equal(await winners.isVisible(), false);
  assert.equal(await finals.isVisible(), false);
  await page.getByRole("button", { name: "Winners only" }).click();
  assert.equal(await winners.isVisible(), true);
  assert.equal(await losers.isVisible(), false);
  const finalRound = winners.getByRole("button", {
    name: "Final",
    exact: true,
  });
  await finalRound.click();
  assert.equal(await finalRound.getAttribute("aria-current"), "step");
  const hasInnerScroll = (v) =>
    v.scrollWidth > v.clientWidth || v.scrollHeight > v.clientHeight;
  assert.equal(
    await winners.locator(".bt-viewport").evaluate(hasInnerScroll),
    false,
  );
  await page.getByRole("button", { name: "Full bracket" }).click();
  assert.equal(await finals.isVisible(), true);
  const feeders = [
    sourceRef(grand.source_a).fixture,
    sourceRef(grand.source_b).fixture,
  ];
  for (const id of feeders)
    assert.equal(
      await page
        .locator(
          `[data-layout="connected"] svg path[data-source="${id}"][data-target="${grand.id}"]`,
        )
        .count(),
      1,
    );
  assert.equal(
    await page.locator(`[data-bracket-fixture="${reset.id}"]`).count(),
    1,
  );
  await page.locator(`[data-bracket-forfeit="${ready.id}"]`).click();
  const dialog = page.getByRole("dialog", { name: "Declare forfeit" });
  await dialog.locator('[name="winner"]').selectOption(String(ready.b));
  await dialog.getByRole("button", { name: "Save" }).click();
  const card = page.locator(`[data-bracket-fixture="${ready.id}"]`);
  await card.getByText("Forfeit", { exact: true }).waitFor();
  assert.equal(await card.getAttribute("data-result-id"), null);
  const updated = await h.state();
  const result = updated.fixtures.find((f) => f.id === ready.id);
  assert.equal(result.match_id, null);
  assert.equal(result.winner, ready.b);
  assert.equal(result.loser, ready.a);
  assert.equal(result.status, "completed");
  const next = updated.fixtures.find((f) =>
    ["a", "b"].some(
      (side) =>
        sourceRef(f["source_" + side])?.fixture === ready.id &&
        sourceRef(f["source_" + side]).outcome === "winner",
    ),
  );
  assert.ok([next.a, next.b].includes(ready.b));
  await page
    .locator("#cp-bracket")
    .screenshot({ path: "/tmp/mimelo-bracket-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.getByRole("button", { name: "Winners only" }).click();
  await finalRound.click();
  assert.equal(await finalRound.getAttribute("aria-current"), "step");
  assert.equal(
    await winners.locator('[data-round-target][data-match-round="2"]').count(),
    1,
  );
  assert.equal(
    await winners.locator(".bt-viewport").evaluate(hasInnerScroll),
    false,
  );
  await page
    .locator("#cp-bracket")
    .screenshot({ path: "/tmp/mimelo-bracket-desktop.png" });
  await h.call("POST", `/api/fixtures/${next.id}/forfeit`, { winner: ready.b });
  assert.equal(locked(h.app.db, ready.id), true);
  for (
    let state = await h.state();
    state.fixtures.find((f) => f.id === grand.id).status !== "ready";
    state = await h.state()
  ) {
    const f = state.fixtures.find((item) => item.status === "ready");
    assert.ok(f, "The tournament should reach the grand final");
    await h.call("POST", `/api/fixtures/${f.id}/forfeit`, { winner: f.a });
  }
  const readyGrandFinal = (await h.state()).fixtures.find(
    (f) => f.id === grand.id,
  );
  await h.record(readyGrandFinal, {
    games: [
      { a: 21, b: 12 },
      { a: 12, b: 21 },
      { a: 21, b: 9 },
    ],
  });
  await page.goto(
    `${base}/competition.html?game=tt&id=${h.comp.id}&view=table`,
  );
  await finals.waitFor();
  assert.equal(
    await page
      .getByRole("tab", { name: "Bracket" })
      .getAttribute("aria-selected"),
    "true",
  );
  assert.equal(
    await page.locator(`[data-bracket-fixture="${reset.id}"]`).count(),
    0,
  );
  assert.deepEqual(
    await finals.locator(".bt-series-games > span").allTextContents(),
    ["21–12", "12–21", "21–9"],
  );
  assert.equal(await finals.locator(".bt-series-total").innerText(), "2–1");
  await page.locator("#cp-bracket").screenshot({
    path: "/tmp/mimelo-connected-bracket.png",
    style: ".app-header, .skip-link { visibility: hidden !important; }",
  });
});

test("racket-sport bracket cards include nationality flags beside names and photos, including doubles", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const [game, format] of [
    ["tennis", "singles"],
    ["tt", "singles"],
    ["pickleball", "doubles"],
  ]) {
    const h = await setup(t, { count: 4, game, format });
    for (const user of h.users)
      h.app.db
        .prepare("UPDATE players SET profile=? WHERE id=?")
        .run(
          JSON.stringify({ nationalities: ["Lebanon", "United States"] }),
          user.player_id,
        );
    const state = await h.state();
    assert(
      state.entries.every((e) =>
        e.players.every((p) => p.nationalities.length === 2),
      ),
    );
    await h.app.listen({ host: "127.0.0.1", port: 0 });
    const base = "http://127.0.0.1:" + h.app.server.address().port;
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${base}/competition.html?game=${game}&id=${h.comp.id}`);
      await page.waitForFunction(() => document.body.dataset.ready === "true");
      const people = page.locator("#bracket-wrap .bt-racket-person");
      assert.equal(await people.count(), format === "doubles" ? 8 : 4);
      assert.equal(
        await people.locator("img.country-flag").count(),
        format === "doubles" ? 16 : 8,
      );
      assert.equal(
        await people.locator("img[alt=Lebanon]").count(),
        format === "doubles" ? 8 : 4,
      );
      assert(
        (await page.locator("#bracket-wrap .bt-avatars img").count()) >= 1,
      );
      assert(
        await people.evaluateAll((els) =>
          els.every((el) => {
            const row = el.closest(".bt-side").getBoundingClientRect(),
              flags = el
                .querySelector(".nationality-flags")
                .getBoundingClientRect();
            return flags.left >= row.left - 1 && flags.right <= row.right + 1;
          }),
        ),
        "Flags stay within the card at every width",
      );
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      if (width !== 320)
        await page
          .locator("#cp-bracket")
          .screenshot({ path: `artifacts/${game}-bracket-flags-${width}.png` });
    }
  }
  assert.deepEqual(errors, []);
});

test("spectators can save a double elimination prediction until the draw starts", async (t) => {
  const h = await setup(t, { count: 6, elimination: "double", game: "tt" });
  const draw = await h.state();
  const initial = draw.fixtures.find(
    (f) => f.pool === "W" && f.status === "ready",
  );
  const endpoint = `/api/competitions/${h.comp.id}/predictions`;
  const viewer = h.users.at(-1);
  const viewerName = h.app.db
    .prepare("SELECT name FROM players WHERE id=?")
    .get(viewer.player_id).name;
  h.app.db
    .prepare("UPDATE accounts SET approved=0 WHERE player_id=?")
    .run(viewer.player_id);
  await h.app.listen({ host: "127.0.0.1", port: 0 });
  const base = `http://127.0.0.1:${h.app.server.address().port}`;
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const session = await page.request.post(base + "/api/login", {
    headers: { "x-mimelo-request": "1" },
    data: { identity: viewer.handle, password: "BracketPassword!" },
  });
  assert.equal(session.status(), 200);
  const url = `${base}/competition.html?game=tt&id=${h.comp.id}&view=predictions`;
  await page.goto(url);
  const save = page.getByRole("button", { name: "Save bracket" });
  await save.waitFor();
  assert.equal(await save.isDisabled(), true);
  const choice = (id) => page.locator(`[data-prediction-fixture="${id}"]`);
  await choice(initial.id).first().check();
  const requiredReset = () =>
    page
      .locator(".prediction-match")
      .filter({
        has: page.getByText("Final reset", { exact: true }),
      })
      .locator("input");
  const grandFinal = draw.fixtures.find((f) => f.label === "Grand final");
  for (const f of draw.fixtures) {
    if (f.id === initial.id || f.conditional || !(await choice(f.id).count()))
      continue;
    // Picking the lower-bracket finalist forces a reset.
    await choice(f.id)
      .nth(f.id === grandFinal.id ? 1 : 0)
      .check();
  }
  assert.equal(await requiredReset().count(), 2);
  assert.equal(await save.isDisabled(), true);
  await requiredReset().first().check();
  await save.click();
  await page.getByText("Bracket saved.", { exact: true }).waitFor();
  const own = await (await page.request.get(base + endpoint)).json();
  assert.equal(own.mine[initial.id], initial.a);
  const publicState = await h.call("GET", endpoint);
  assert.equal(publicState.mine, null);
  assert.deepEqual(publicState.leaderboard, []);
  const capture = (size) =>
    page.locator("#cp-predictions").screenshot({
      path: `/tmp/mimelo-predictions-${size}.png`,
      style: ".app-header, .skip-link { visibility: hidden !important; }",
    });
  await capture("desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  assert.equal(await choice(initial.id).first().isChecked(), true);
  await capture("mobile");

  await h.call("PATCH", `/api/fixtures/${initial.id}/schedule`, {
    scheduled: Date.now() - 5000,
  });
  assert.equal((await h.call("GET", endpoint)).open, false);
  await h.call("PATCH", `/api/fixtures/${initial.id}/schedule`, {
    scheduled: null,
  });
  await h.call("POST", `/api/fixtures/${initial.id}/forfeit`, {
    winner: initial.a,
  });
  const closed = await h.call("GET", endpoint);
  assert.equal(closed.open, false);
  assert.deepEqual(closed.leaderboard, [
    { name: viewerName, mine: false, points: 1, rank: 1 },
  ]);
  const late = await page.request.put(base + endpoint, {
    headers: {
      "x-mimelo-request": "1",
      "x-csrf-token": (await session.json()).csrf,
    },
    data: { picks: own.mine },
  });
  assert.equal(late.status(), 409);
  await page.reload();
  await page.getByRole("heading", { name: "Leaderboard" }).waitFor();
  assert.equal(await save.count(), 0);
});
