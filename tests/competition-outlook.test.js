import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
import { register, passwordHash } from "../server/auth.js";
async function setup(t, n = 8) {
  const app = await createApp({ database: ":memory:" });
  t.after(() => app.close());
  const hash = await passwordHash("OutlookFixture!");
  const admin = register(
    app.db,
    { name: "Outlook Admin", handle: "outlookadmin" },
    hash,
    null,
    true,
  );
  const ids = [admin.player_id];
  for (let i = 1; i < n; i++)
    ids.push(
      Number(
        app.db
          .prepare("INSERT INTO players(name,created) VALUES(?,?)")
          .run("Outlook " + i, Date.now()).lastInsertRowid,
      ),
    );
  const login = await app.inject({
    method: "POST",
    url: "/api/login",
    headers: { "x-mimelo-request": "1" },
    payload: { identity: "outlookadmin", password: "OutlookFixture!" },
  });
  const headers = {
    "x-mimelo-request": "1",
    "x-csrf-token": login.json().csrf,
    cookie: login.cookies.map((c) => c.name + "=" + c.value).join("; "),
  };
  async function call(method, url, payload, status = 200) {
    const r = await app.inject({
      method,
      url: "/api/" + url,
      headers,
      ...(payload === undefined ? {} : { payload }),
    });
    assert.equal(r.statusCode, status, r.body);
    return r.json();
  }
  await call("POST", "teams/eafc27", {
    name: "Club A",
    code: "CLA",
    overall: 80,
  });
  await call("POST", "teams/eafc27", {
    name: "Club B",
    code: "CLB",
    overall: 80,
  });
  const teams = (await call("GET", "teams/eafc27")).rows;
  async function create(
    settings,
    kind = "groups",
    game = "eafc27",
    people = ids,
  ) {
    const c = await call("POST", "competitions", {
      game,
      name: "Outlook Cup",
      kind,
      entries: people.map((id) => [id]),
      settings: { bestOf: 1, ...settings },
    });
    return call("POST", `competitions/${c.id}/draw`, {});
  }
  async function record(c, f, a = 1, b = 0) {
    const score =
      c.game === "eafc27"
        ? { a, b, teamA: teams[0].id, teamB: teams[1].id }
        : { games: [{ a: a > b ? 11 : 2, b: b > a ? 11 : 2 }], target: 11 };
    const m = await call("POST", `games/${c.game}/matches`, {
      fixture: f.id,
      score,
    });
    await call("POST", `matches/${m.id}/accept`, { revision: 1 });
    return m;
  }
  return { app, ids, call, create, record };
}

test("48-team group format advances 24 automatic and eight best third-place teams without group rematches", async (t) => {
  const { call, create, record } = await setup(t, 48);
  let c = await create({
    groupCount: 12,
    advance: 2,
    extraCount: 8,
    extraPlace: 3,
    tieBreaks: ["difference", "for"],
    extraTieBreaks: ["difference", "for"],
  });
  assert.equal(c.fixtures.length, 72);
  const initial = await call("GET", `competitions/${c.id}/projection`);
  assert.equal(initial.rows.length, 48);
  assert(initial.rows.every((r) => r.status === "contending"));
  assert(
    Math.abs(initial.rows.reduce((sum, r) => sum + r.title, 0) - 1) < 1e-8,
  );
  for (const f of c.fixtures) {
    const margin = f.pool.charCodeAt(0) - 64;
    await record(c, f, f.a < f.b ? margin : 0, f.b < f.a ? margin : 0);
  }
  c = await call("GET", `competitions/${c.id}`);
  const ko = c.fixtures.filter((f) => !["group", "tiebreak"].includes(f.stage));
  assert.equal(ko.length, 31);
  const selected = new Set(ko.flatMap((f) => [f.a, f.b]).filter(Boolean));
  assert.equal(selected.size, 32);
  const tables = Object.values(c.standings),
    direct = tables.flatMap((rows) => rows.slice(0, 2).map((r) => r.entry)),
    extra = c.extraStandings.slice(0, 8).map((r) => r.entry);
  assert.deepEqual(
    [...selected].sort((a, b) => a - b),
    [...direct, ...extra].sort((a, b) => a - b),
  );
  const pools = new Map(
    Object.entries(c.standings).flatMap(([pool, rows]) =>
      rows.map((r) => [r.entry, pool]),
    ),
  );
  for (const f of ko.filter((f) => f.a && f.b))
    assert.notEqual(pools.get(f.a), pools.get(f.b));
  const projection = await call("GET", `competitions/${c.id}/projection`);
  assert.equal(projection.rows.filter((r) => r.qualification === 1).length, 32);
  assert.equal(
    projection.rows.filter((r) => r.status === "eliminated").length,
    16,
  );
  assert.equal(projection.rows.filter((r) => r.group_winner).length, 12);
});

test("cross-group ties pause progression, reject unrelated choices, and accept an audited admin decision", async (t) => {
  const { app, call, create, record } = await setup(t, 6);
  let c = await create({
    groupCount: 2,
    advance: 1,
    extraCount: 1,
    extraPlace: 2,
    tieBreaks: ["difference", "for"],
  });
  for (const f of c.fixtures)
    await record(c, f, f.a < f.b ? 1 : 0, f.b < f.a ? 1 : 0);
  c = await call("GET", `competitions/${c.id}`);
  assert.equal(c.fixtures.length, 6);
  assert.equal(c.qualificationPending.length, 1);
  const pending = c.qualificationPending[0];
  assert.equal(pending.pool, "@extra");
  assert.equal(pending.allowed.length, 2);
  await call(
    "POST",
    `competitions/${c.id}/qualify`,
    { pool: "@extra", entries: [c.standings.A[0].entry], reason: "Wrong rank" },
    400,
  );
  await call("POST", `competitions/${c.id}/qualify`, {
    pool: "@extra",
    entries: [pending.allowed[1]],
    reason: "Agreed fair-play decision",
  });
  c = await call("GET", `competitions/${c.id}`);
  assert(c.fixtures.some((f) => f.stage === "final"));
  assert.deepEqual(c.qualifications["@extra"], [pending.allowed[1]]);
  assert.equal(
    app.db
      .prepare(
        "SELECT COUNT(*) n FROM audit WHERE action='competition.qualify'",
      )
      .get().n,
    1,
  );
  const p = await call("GET", `competitions/${c.id}/projection`);
  assert.equal(
    p.rows.find((r) => r.entry === pending.allowed[1]).qualification,
    1,
  );
});

test("mathematical labels prove secured places before the last group result and do not use sampled probabilities as proof", async (t) => {
  const { call, create, record } = await setup(t, 4);
  let c = await create({
    groupCount: 1,
    advance: 2,
    tieBreaks: ["head_to_head", "difference", "for"],
  });
  const ids = c.standings.A.map((r) => r.entry).sort((a, b) => a - b),
    [a, b, x, y] = ids;
  for (const f of c.fixtures) {
    if ([f.a, f.b].includes(a))
      await record(c, f, f.a === a ? 1 : 0, f.b === a ? 1 : 0);
    else if ([f.a, f.b].includes(b))
      await record(c, f, f.a === b ? 1 : 0, f.b === b ? 1 : 0);
  }
  const projection = await call("GET", `competitions/${c.id}/projection`),
    by = new Map(projection.rows.map((r) => [r.entry, r]));
  assert.equal(by.get(a).status, "qualified");
  assert.equal(by.get(a).group_winner, true);
  assert.equal(by.get(b).status, "qualified");
  assert.equal(by.get(a).qualification, 1);
  for (const id of [x, y]) {
    assert.equal(by.get(id).status, "eliminated");
    assert.equal(by.get(id).title, 0);
    assert.equal(by.get(id).qualification, 0);
  }
  c = await call("GET", `competitions/${c.id}`);
  assert.equal(c.fixtures.filter((f) => f.status === "completed").length, 5);
});

test("knockout projections respect byes, completed eliminations, double elimination, and deterministic current Elo", async (t) => {
  const { app, ids, call, create, record } = await setup(t, 4);
  let c = await create({ elimination: "double" }, "knockout");
  const initial = await call("GET", `competitions/${c.id}/projection`),
    again = await call("GET", `competitions/${c.id}/projection`);
  assert.deepEqual(initial, again);
  await call("PATCH", `fixtures/${c.fixtures[0].id}/schedule`, {
    scheduled: Date.now() + 86400000,
  });
  assert.deepEqual(
    await call("GET", `competitions/${c.id}/projection`),
    initial,
    "Scheduling does not change the underlying chances",
  );

  const f = c.fixtures.find((f) => f.status === "ready");
  await record(c, f, 1, 0);
  let p = await call("GET", `competitions/${c.id}/projection`);
  assert.notEqual(p.rows.find((r) => r.entry === f.b).status, "eliminated");
  const entry = c.entries.find((e) => e.players[0].id === ids[0]).id;
  app.db
    .prepare(
      "INSERT INTO ratings(game,format,player_id,elo,peak) VALUES(?,?,?,?,?)",
    )
    .run("eafc27", "singles", ids[0], 2000, 2000);
  p = await call("GET", `competitions/${c.id}/projection`);
  assert(p.rows.find((r) => r.entry === entry).title > 0.75);
  const single = await create({ elimination: "single" }, "knockout");
  const sf = single.fixtures.find((f) => f.status === "ready");
  await record(single, sf, 1, 0);
  p = await call("GET", `competitions/${single.id}/projection`);
  assert.equal(p.rows.find((r) => r.entry === sf.b).status, "eliminated");
  assert.equal(p.rows.find((r) => r.entry === sf.b).title, 0);
});

test("extra qualifier settings enforce real ranks and permit unequal groups with raw points", async (t) => {
  const { call, ids, create } = await setup(t, 7);
  await call(
    "POST",
    "competitions",
    {
      game: "eafc27",
      name: "Bad",
      kind: "groups",
      entries: ids.map((id) => [id]),
      settings: { groupCount: 2, advance: 2, extraCount: 3, extraPlace: 3 },
    },
    400,
  );
  await call(
    "POST",
    "competitions",
    {
      game: "eafc27",
      name: "Bad",
      kind: "groups",
      settings: { groupCount: 2, advance: 2, extraCount: 1, extraPlace: 2 },
    },
    400,
  );
  await call(
    "POST",
    "competitions",
    {
      game: "eafc27",
      name: "Bad",
      kind: "groups",
      settings: { extraTieBreaks: ["head_to_head"] },
    },
    400,
  );
  const c = await create({
    groupCount: 2,
    advance: 1,
    extraCount: 1,
    extraPlace: 2,
  });
  assert.deepEqual(
    Object.values(c.standings)
      .map((rows) => rows.length)
      .sort(),
    [3, 4],
  );
});

test("head-to-head and bounded score difference can secure a place even when rivals can match the points total", async (t) => {
  const { call, create, record } = await setup(t, 4);
  const c = await create({
    groupCount: 1,
    advance: 2,
    tieBreaks: ["head_to_head", "difference", "for"],
  });
  const [a, b, x, y] = c.entries.map((e) => e.id).sort((a, b) => a - b);
  for (const f of c.fixtures) {
    let winner = null,
      margin = 1;
    if ([f.a, f.b].includes(a)) {
      winner = [f.a, f.b].includes(y) ? y : a;
      margin = winner === a ? 90 : 1;
    } else if ([f.a, f.b].includes(x) && [f.a, f.b].includes(y)) winner = x;
    if (winner)
      await record(
        c,
        f,
        f.a === winner ? margin : 0,
        f.b === winner ? margin : 0,
      );
  }
  const projection = await call("GET", `competitions/${c.id}/projection`);
  assert.equal(projection.rows.find((r) => r.entry === a).status, "qualified");
  const current = await call("GET", `competitions/${c.id}`);
  assert.equal(
    current.fixtures.filter((f) => f.status !== "completed").length,
    2,
  );
});

test("an unresolved finishing-place tie cannot silently select a cross-group candidate", async (t) => {
  const { call, create, record } = await setup(t, 6);
  let c = await create({
    groupCount: 2,
    advance: 1,
    extraCount: 1,
    extraPlace: 2,
    tieBreaks: ["difference", "for"],
  });
  const winners = new Set(
    Object.values(c.standings).map((rows) =>
      Math.min(...rows.map((r) => r.entry)),
    ),
  );
  for (const f of c.fixtures) {
    const winner = winners.has(f.a) ? f.a : winners.has(f.b) ? f.b : null;
    await record(c, f, winner === f.a ? 1 : 0, winner === f.b ? 1 : 0);
  }
  c = await call("GET", `competitions/${c.id}`);
  assert.deepEqual(
    c.qualificationPending.map((p) => p.pool),
    ["@place:A", "@place:B"],
  );
  for (const pending of c.qualificationPending)
    await call("POST", `competitions/${c.id}/qualify`, {
      pool: pending.pool,
      entries: [pending.allowed[0]],
      reason: "Agreed fair play",
    });
  c = await call("GET", `competitions/${c.id}`);
  assert.equal(c.qualificationPending[0].pool, "@extra");
  assert.equal(c.fixtures.length, 6);
});

test("scheduled tiebreak rounds affect forecasts while preserving the original group table", async (t) => {
  const { app, ids, call, create, record } = await setup(t, 3);
  let c = await create({
    groupCount: 1,
    advance: 1,
    tieResolution: "match",
    tieBreaks: ["difference", "for"],
  });
  const [a, b, x] = c.entries.map((e) => e.id).sort((a, b) => a - b);
  for (const f of c.fixtures) {
    const winner =
      [f.a, f.b].includes(a) && [f.a, f.b].includes(b)
        ? a
        : [f.a, f.b].includes(b) && [f.a, f.b].includes(x)
          ? b
          : x;
    await record(c, f, f.a === winner ? 1 : 0, f.b === winner ? 1 : 0);
  }
  await call("POST", `competitions/${c.id}/tiebreak`, { pool: "A" });
  app.db
    .prepare(
      "INSERT INTO ratings(game,format,player_id,elo,peak) VALUES(?,?,?,?,?)",
    )
    .run("eafc27", "singles", ids[0], 2000, 2000);
  const projection = await call("GET", `competitions/${c.id}/projection`);
  assert(projection.rows.find((r) => r.entry === a).qualification > 0.8);
  c = await call("GET", `competitions/${c.id}`);
  assert(c.standings.A.every((r) => r.points === 3));
  assert.equal(c.fixtures.filter((f) => f.stage === "tiebreak").length, 3);
});
