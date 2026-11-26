import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
import { register, passwordHash } from "../server/auth.js";
async function setup(t) {
  const app = await createApp({ database: ":memory:" });
  t.after(() => app.close());
  const hash = await passwordHash("ContextTestPassword!");
  const users = Array.from({ length: 5 }, (_, i) =>
    register(
      app.db,
      { name: "Context Player " + i, handle: "contextplayer" + i },
      hash,
      null,
      i === 0,
    ),
  );
  const login = await app.inject({
    method: "POST",
    url: "/api/login",
    headers: { "x-mimelo-request": "1" },
    payload: { identity: users[0].handle, password: "ContextTestPassword!" },
  });
  const headers = {
    cookie: login.cookies.map((c) => c.name + "=" + c.value).join("; "),
    "x-mimelo-request": "1",
    "x-csrf-token": login.json().csrf,
  };
  async function call(method, url, payload) {
    const r = await app.inject({
      method,
      url,
      headers,
      ...(payload === undefined ? {} : { payload }),
    });
    assert.equal(r.statusCode, 200, r.body);
    return r.json();
  }
  async function result(
    a,
    b,
    score = { bestOf: 1, games: [{ a: 6, b: 2 }] },
    game = "tennis",
    rated = true,
  ) {
    const m = await call("POST", `/api/games/${game}/matches`, {
      format: "singles",
      sides: [[users[a].player_id], [users[b].player_id]],
      score,
    });
    await call("POST", `/api/matches/${m.id}/accept`, { revision: 1 });
    if (rated) await call("POST", `/api/matches/${m.id}/elo`, { revision: 1 });
    return m;
  }
  return { app, users, call, result, headers };
}
test("match context uses pre-match ratings, form and h2h without current or later results", async (t) => {
  const { call, result } = await setup(t);
  const first = await result(1, 2),
    second = await result(2, 1),
    third = await result(1, 3);
  const target = await result(1, 2);
  const context = (await call("GET", `/api/matches/${target.id}`)).context;
  assert.deepEqual(context.h2h, { meetings: 2, a: 1, draws: 0, b: 1 });
  assert.deepEqual(
    context.sides[0].form.map((r) => r.id),
    [first.id, second.id, third.id],
  );
  assert.deepEqual(
    context.sides[0].form.map((r) => r.result),
    ["W", "L", "W"],
  );
  assert.equal(context.sides[0].ratings[0].rated_matches, 3);
  assert.equal(context.sides[1].ratings[0].rated_matches, 2);
  assert(
    context.odds.outcomes.every(
      (o) => Number.isFinite(o.decimal) && o.decimal >= 1,
    ),
  );
  assert(
    Math.abs(
      context.odds.outcomes.reduce((sum, o) => sum + o.probability, 0) - 1,
    ) < 1e-12,
  );
  await result(2, 1);
  await result(1, 2, { bestOf: 1, target: 11, games: [{ a: 11, b: 3 }] }, "tt");
  assert.deepEqual(
    (await call("GET", `/api/matches/${target.id}`)).context,
    context,
  );
});
test("form is capped at five results and doubles history follows the exact pair", async (t) => {
  const { users, call, result } = await setup(t);
  const previous = [];
  for (let i = 0; i < 7; i++) previous.push(await result(1, 2));
  const target = await result(1, 2);
  const context = (await call("GET", `/api/matches/${target.id}`)).context;
  assert.deepEqual(
    context.sides[0].form.map((r) => r.id),
    previous.slice(-5).map((m) => m.id),
  );
  assert.equal(context.h2h.meetings, 7);
  async function doubles(sides) {
    const m = await call("POST", "/api/games/tennis/matches", {
      format: "doubles",
      sides: sides.map((side) => side.map((i) => users[i].player_id)),
      score: { bestOf: 1, games: [{ a: 6, b: 3 }] },
    });
    await call("POST", `/api/matches/${m.id}/accept`, { revision: 1 });
    return m;
  }
  await doubles([
    [1, 3],
    [2, 4],
  ]);
  const changed = await doubles([
    [1, 4],
    [2, 3],
  ]);
  const pair = (await call("GET", `/api/matches/${changed.id}`)).context;
  assert.equal(pair.h2h.meetings, 0);
  assert.deepEqual(pair.sides[0].form, []);
});
test("football odds include draws learned from earlier games, starting at twenty percent", async (t) => {
  const { call, result } = await setup(t);
  for (const [code, name] of [
    ["CTXA", "Context A"],
    ["CTXB", "Context B"],
  ])
    await call("POST", "/api/teams/eafc27", { code, name, overall: 80 });
  const teams = (await call("GET", "/api/teams/eafc27")).rows;
  const score = { a: 1, b: 1, teamA: teams[0].id, teamB: teams[1].id };
  const first = await result(1, 2, score, "eafc27");
  const baseline = (await call("GET", `/api/matches/${first.id}`)).context.odds;
  assert.equal(baseline.draw_history, 0);
  assert.equal(baseline.draw_rate, 0.2);
  assert(Math.abs(baseline.outcomes[1].probability - 0.2) < 1e-12);
  await result(1, 2, score, "eafc27");
  const target = await result(1, 2, { ...score, a: 2 }, "eafc27", false);
  const odds = (await call("GET", `/api/matches/${target.id}`)).context.odds;
  assert.equal(odds.draw_history, 2);
  assert.equal(odds.draw_rate, 1 / 3);
  assert(
    Math.abs(odds.outcomes.reduce((sum, o) => sum + o.probability, 0) - 1) <
      1e-12,
  );
  await result(1, 2, score, "eafc27");
  assert.deepEqual(
    (await call("GET", `/api/matches/${target.id}`)).context.odds,
    odds,
  );
});
test("tournament context shows standings before the result, with all entrants still present", async (t) => {
  const { users, call } = await setup(t);
  const c = await call("POST", "/api/competitions", {
    game: "tennis",
    name: "Context League",
    kind: "league",
    entries: users.slice(1).map((u) => [u.player_id]),
    settings: { bestOf: 1 },
  });
  const drawn = await call("POST", `/api/competitions/${c.id}/draw`, {});
  const fixtures = drawn.fixtures.filter((f) => f.status === "ready");
  async function submit(f) {
    const m = await call("POST", "/api/games/tennis/matches", {
      fixture: f.id,
      score: { games: [{ a: 6, b: 2 }] },
    });
    await call("POST", `/api/matches/${m.id}/accept`, { revision: 1 });
    return m;
  }
  await submit(fixtures[0]);
  const target = await submit(fixtures[1]);
  const context = (await call("GET", `/api/matches/${target.id}`)).context;
  assert.equal(context.competition.id, c.id);
  assert.equal(context.competition.standings[0].rows.length, 4);
  assert.equal(
    context.competition.standings[0].rows.reduce((n, r) => n + r.played, 0),
    2,
  );
  assert.equal(
    context.competition.standings[0].rows.reduce((n, r) => n + r.w, 0),
    1,
  );
  await submit(fixtures[2]);
  assert.deepEqual(
    (await call("GET", `/api/matches/${target.id}`)).context.competition,
    context.competition,
  );
});

test("played times order historical context and rating replay; omitted times retain the entry date", async (t) => {
  const { app, users, call, result, headers } = await setup(t);
  const enteredFirst = await result(1, 2);
  assert.equal(enteredFirst.played_at, null);
  assert.equal(enteredFirst.duration_minutes, null);
  const day = 86400000,
    now = Date.now();
  async function timed(played_at, duration_minutes) {
    const match = await call("POST", "/api/games/tennis/matches", {
      sides: [[users[1].player_id], [users[2].player_id]],
      score: { bestOf: 1, games: [{ a: 6, b: 2 }] },
      played_at,
      duration_minutes,
    });
    await call("POST", `/api/matches/${match.id}/accept`, { revision: 1 });
    await call("POST", `/api/matches/${match.id}/elo`, { revision: 1 });
    return match;
  }
  const early = await timed(now - 2 * day, 45);
  const middle = await timed(now - day, null);
  const detail = await call("GET", `/api/matches/${middle.id}`);
  assert.equal(detail.context.as_of, middle.played_at);
  assert.deepEqual(
    detail.context.sides[0].form.map((m) => m.id),
    [early.id],
  );
  assert.equal(detail.context.h2h.meetings, 1);
  const ledger = (id) =>
    app.db
      .prepare("SELECT * FROM ledger WHERE match_id=? AND player_id=?")
      .get(id, users[1].player_id);
  assert.equal(ledger(early.id).before, 1000);
  assert.equal(ledger(middle.id).before, ledger(early.id).after);
  assert.equal(ledger(enteredFirst.id).before, ledger(middle.id).after);
  const list = await call("GET", "/api/matches?game=tennis");
  assert.deepEqual(
    list.rows.map((m) => m.id),
    [enteredFirst.id, middle.id, early.id],
  );
  const corrected = await call("PATCH", `/api/matches/${early.id}`, {
    revision: 1,
    played_at: null,
    duration_minutes: null,
  });
  assert.equal(corrected.submitted, early.submitted);
  assert.equal(corrected.played_at, null);
  assert.equal(corrected.duration_minutes, null);
  assert.equal(corrected.revision, 2);
  const revision = JSON.parse(
    app.db
      .prepare("SELECT payload FROM revisions WHERE match_id=? AND revision=1")
      .get(early.id).payload,
  );
  assert.equal(revision.played_at, early.played_at);
  assert.equal(revision.duration_minutes, 45);
  const before = app.db.prepare("SELECT COUNT(*) n FROM matches").get().n;
  for (const fields of [
    { played_at: now + day },
    { played_at: "yesterday" },
    { played_at: -1 },
    { duration_minutes: 0 },
    { duration_minutes: 1.5 },
    { duration_minutes: "45" },
  ]) {
    const response = await app.inject({
      method: "POST",
      url: "/api/games/tennis/matches",
      headers,
      payload: {
        sides: [[users[1].player_id], [users[2].player_id]],
        score: { bestOf: 1, games: [{ a: 6, b: 2 }] },
        ...fields,
      },
    });
    assert.equal(response.statusCode, 400, response.body);
  }
  assert.equal(
    app.db.prepare("SELECT COUNT(*) n FROM matches").get().n,
    before,
  );
});


test("overlapping late results recalculate Elo and historical context in the shared order", async (t) => {
  const { app, users, call } = await setup(t);
  const base = Date.now() - 86400000;
  async function submit(start, duration) {
    const m = await call("POST", "/api/games/tennis/matches", {
      sides: [[users[1].player_id], [users[2].player_id]],
      score: { bestOf: 1, games: [{ a: 6, b: 2 }] },
      played_at: base + start * 60000, duration_minutes: duration,
    });
    await call("POST", `/api/matches/${m.id}/accept`, { revision: 1 });
    await call("POST", `/api/matches/${m.id}/elo`, { revision: 1 });
    return m;
  }
  const long = await submit(0, 90);
  const unknown = await submit(30, null);
  const short = await submit(20, 20);
  const chronological = [short.id, long.id, unknown.id];
  const list = await call("GET", `/api/matches?game=tennis&player=${users[1].player_id}`);
  assert.deepEqual(list.rows.map((m) => m.id), [...chronological].reverse());
  const home = await call("GET", "/api/recent-results");
  assert.deepEqual(home.rows.map((m) => m.id), [...chronological].reverse());
  const ledger = (id) => app.db.prepare("SELECT * FROM ledger WHERE match_id=? AND player_id=?").get(id, users[1].player_id);
  assert.equal(ledger(short.id).before, 1000);
  assert.equal(ledger(long.id).before, ledger(short.id).after);
  assert.equal(ledger(unknown.id).before, ledger(long.id).after);
  const context = (await call("GET", `/api/matches/${long.id}`)).context;
  assert.equal(context.h2h.meetings, 1);
  assert.deepEqual(context.sides[0].form.map((m) => m.id), [short.id]);
  assert.equal(context.sides[0].ratings[0].elo, ledger(short.id).after);
  assert.equal(context.sides[0].ratings[0].rated_matches, 1);
});


test("a late match in another game can connect overlapping periods and recalculate Elo", async (t) => {
  const { app, users, call } = await setup(t);
  const base = Date.now() - 86400000;
  async function tennis(start, duration) {
    const m = await call("POST", "/api/games/tennis/matches", {
      sides: [[users[1].player_id], [users[2].player_id]],
      score: { bestOf: 1, games: [{ a: 6, b: 2 }] },
      played_at: base + start * 60000, duration_minutes: duration,
    });
    await call("POST", `/api/matches/${m.id}/accept`, { revision: 1 });
    await call("POST", `/api/matches/${m.id}/elo`, { revision: 1 });
    return m;
  }
  const long = await tennis(0, 20);
  const short = await tennis(40, 10);
  const before = (id) => app.db.prepare("SELECT before FROM ledger WHERE match_id=? AND player_id=?").get(id, users[1].player_id).before;
  assert.equal(before(long.id), 1000);
  await call("POST", "/api/games/tt/matches", {
    sides: [[users[1].player_id], [users[2].player_id]],
    score: { bestOf: 1, target: 11, games: [{ a: 11, b: 3 }] },
    played_at: base + 10 * 60000, duration_minutes: 35,
  });
  assert.equal(before(short.id), 1000);
  assert.notEqual(before(long.id), 1000);
});
