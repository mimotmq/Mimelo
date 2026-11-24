import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
import { register, passwordHash } from "../server/auth.js";
import { validateScore } from "../server/scoring.js";

test("adjusted table tennis scores preserve the umpire and require a reason", () => {
  const input = {
    bestOf: 3,
    target: 21,
    games: [
      { a: 10, b: 21 },
      { a: 9, b: 16 },
    ],
    umpire: "Jordan",
    scoreAdjustment: "Five-point penalty against side 2",
  };
  const result = validateScore("tt", "singles", input);
  assert.equal(result.score.games[1].b, 16);
  assert.equal(result.score.umpire, "Jordan");
  assert.equal(result.score.scoreAdjustment, input.scoreAdjustment);
  assert.throws(() =>
    validateScore("tt", "singles", { ...input, scoreAdjustment: "" }),
  );
});

test("site admins edit profiles, check all Elo, and record no-contest league fixtures", async (t) => {
  const app = await createApp({ database: ":memory:" });
  t.after(() => app.close());
  const password = "ManagementTestPassword!";
  const hash = await passwordHash(password);
  const admin = register(
    app.db,
    { name: "Admin", handle: "manageadmin" },
    hash,
    null,
    true,
  );
  const other = register(
    app.db,
    { name: "Player", handle: "manageplayer" },
    hash,
  );
  async function session(user) {
    const response = await app.inject({
      method: "POST",
      url: "/api/login",
      headers: { "x-mimelo-request": "1" },
      payload: { identity: user.handle, password },
    });
    return {
      "x-mimelo-request": "1",
      "x-csrf-token": response.json().csrf,
      cookie: response.cookies.map((c) => `${c.name}=${c.value}`).join("; "),
    };
  }
  const ah = await session(admin),
    ph = await session(other);
  async function call(headers, method, path, payload, status = 200) {
    const result = await app.inject({
      method,
      url: "/api/" + path,
      headers,
      ...(payload === undefined ? {} : { payload }),
    });
    assert.equal(result.statusCode, status, result.body);
    return result.json();
  }
  await call(
    ph,
    "PATCH",
    `admin/players/${other.player_id}/profile`,
    { name: "Forbidden" },
    403,
  );
  await call(ah, "PATCH", `admin/players/${other.player_id}/profile`, {
    name: "Renamed",
    nationalities: ["Canada"],
    tag: "tag",
  });
  const player = await call(ah, "GET", `players/${other.player_id}`);
  assert.equal(player.name, "Renamed");
  assert.deepEqual(player.profile.nationalities, ["Canada"]);
  const league = await call(ah, "POST", "competitions", {
    game: "tt",
    name: "League",
    kind: "league",
    entries: [[admin.player_id], [other.player_id]],
    settings: { bestOf: 3, target: 21 },
  });
  const draw = await call(ah, "POST", `competitions/${league.id}/draw`, {});
  const fixture = draw.fixtures.find((f) => f.status === "ready");
  await call(ph, "POST", `fixtures/${fixture.id}/no-contest`, {}, 403);
  await call(ah, "POST", `fixtures/${fixture.id}/no-contest`, {});
  const updated = await call(ah, "GET", `competitions/${league.id}`);
  assert.equal(updated.fixtures[0].no_contest, 1);
  assert.equal(updated.fixtures[0].status, "completed");
  assert.ok(updated.standings[""].every((row) => row.played === 0));
  assert.equal(
    (await call(ah, "POST", "games/tt/elo-checkoff", {})).checked,
    0,
  );
});

test("knockout no contest can create a bye or advance an eligible replacement", async (t) => {
  const app = await createApp({ database: ":memory:" });
  t.after(() => app.close());
  const password = "KnockoutTestPassword!";
  const hash = await passwordHash(password);
  const admin = register(
    app.db,
    { name: "Admin", handle: "knockadmin" },
    hash,
    null,
    true,
  );
  const ids = [admin.player_id];
  for (let i = 0; i < 3; i++)
    ids.push(
      Number(
        app.db
          .prepare("INSERT INTO players(name,created) VALUES(?,?)")
          .run(`Player ${i}`, Date.now()).lastInsertRowid,
      ),
    );
  const login = await app.inject({
    method: "POST",
    url: "/api/login",
    headers: { "x-mimelo-request": "1" },
    payload: { identity: "knockadmin", password },
  });
  const headers = {
    "x-mimelo-request": "1",
    "x-csrf-token": login.json().csrf,
    cookie: login.cookies.map((c) => `${c.name}=${c.value}`).join("; "),
  };
  async function call(method, url, payload) {
    const response = await app.inject({
      method,
      url: "/api/" + url,
      headers,
      ...(payload === undefined ? {} : { payload }),
    });
    assert.equal(response.statusCode, 200, response.body);
    return response.json();
  }
  const competition = await call("POST", "competitions", {
    game: "tt",
    name: "Cup",
    kind: "knockout",
    entries: ids.map((id) => [id]),
    settings: { bestOf: 1, target: 11 },
  });
  const draw = await call("POST", `competitions/${competition.id}/draw`, {});
  const first = draw.fixtures.find((f) => f.status === "ready");
  await call("POST", `fixtures/${first.id}/no-contest`, {});
  const updated = await call("GET", `competitions/${competition.id}`);
  assert.equal(updated.fixtures.find((f) => f.id === first.id).no_contest, 1);
  const other = updated.fixtures.find((f) => f.status === "ready");
  const match = await call("POST", "games/tt/matches", {
    fixture: other.id,
    score: { games: [{ a: 11, b: 5 }] },
  });
  await call("POST", `matches/${match.id}/accept`, { revision: 1 });
  const done = await call("GET", `competitions/${competition.id}`);
  assert.ok(done.fixtures.some((f) => f.status === "bye"));
  assert.equal((await call("POST", "games/tt/elo-checkoff", {})).checked, 1);
  assert.equal((await call("POST", "games/tt/elo-checkoff", {})).checked, 0);
});

test("an eliminated entrant can replace a no-contest knockout pair", async (t) => {
  const app = await createApp({ database: ":memory:" });
  t.after(() => app.close());
  const password = "ReplacementPassword!";
  const admin = register(
    app.db,
    { name: "Admin", handle: "replaceadmin" },
    await passwordHash(password),
    null,
    true,
  );
  const ids = [admin.player_id];
  for (let i = 0; i < 3; i++)
    ids.push(
      Number(
        app.db
          .prepare("INSERT INTO players(name,created) VALUES(?,?)")
          .run(`Player ${i}`, Date.now()).lastInsertRowid,
      ),
    );
  const login = await app.inject({
    method: "POST",
    url: "/api/login",
    headers: { "x-mimelo-request": "1" },
    payload: { identity: "replaceadmin", password },
  });
  const headers = {
    "x-mimelo-request": "1",
    "x-csrf-token": login.json().csrf,
    cookie: login.cookies.map((c) => `${c.name}=${c.value}`).join("; "),
  };
  async function call(method, url, payload) {
    const r = await app.inject({
      method,
      url: "/api/" + url,
      headers,
      ...(payload === undefined ? {} : { payload }),
    });
    assert.equal(r.statusCode, 200, r.body);
    return r.json();
  }
  const c = await call("POST", "competitions", {
    game: "tt",
    name: "Replacement cup",
    kind: "knockout",
    entries: ids.map((id) => [id]),
    settings: { bestOf: 1, target: 11 },
  });
  const drawn = await call("POST", `competitions/${c.id}/draw`, {});
  const [one, two] = drawn.fixtures.filter((f) => f.status === "ready");
  const result = await call("POST", "games/tt/matches", {
    fixture: one.id,
    score: { games: [{ a: 11, b: 4 }] },
  });
  await call("POST", `matches/${result.id}/accept`, { revision: 1 });
  const replacement = one.b;
  await call("POST", `fixtures/${two.id}/no-contest`, { replacement });
  const updated = await call("GET", `competitions/${c.id}`);
  const final = updated.fixtures.find((f) => f.round === 2);
  assert.equal(
    updated.fixtures.find((f) => f.id === two.id).winner,
    replacement,
  );
  assert.ok([final.a, final.b].includes(replacement));
  assert.equal(final.status, "ready");
});

test("new signups are spectators until a site admin approves participation", async (t) => {
  const app = await createApp({ database: ":memory:" });
  t.after(() => app.close());
  const password = "SpectatorTestPassword!";
  register(
    app.db,
    { name: "Admin", handle: "spectatoradmin" },
    await passwordHash(password),
    null,
    true,
  );
  async function request(method, url, headers, payload) {
    return app.inject({
      method,
      url: "/api/" + url,
      headers: { "x-mimelo-request": "1", ...headers },
      ...(payload === undefined ? {} : { payload }),
    });
  }
  const signup = await request(
    "POST",
    "signup",
    {},
    { name: "New player", handle: "spectatornew", password },
  );
  assert.equal(signup.statusCode, 200, signup.body);
  assert.equal(signup.json().user.approved, false);
  const spectator = {
    "x-csrf-token": signup.json().csrf,
    cookie: signup.cookies.map((c) => `${c.name}=${c.value}`).join("; "),
  };
  const blocked = await request("POST", "games/tt/matches", spectator, {});
  assert.equal(blocked.statusCode, 403);
  const login = await request(
    "POST",
    "login",
    {},
    { identity: "spectatoradmin", password },
  );
  const admin = {
    "x-csrf-token": login.json().csrf,
    cookie: login.cookies.map((c) => `${c.name}=${c.value}`).join("; "),
  };
  const requests = (await request("GET", "admin/requests", admin)).json();
  assert.equal(requests[0].kind, "participation");
  assert.equal(
    (
      await request("POST", `admin/requests/${requests[0].id}`, admin, {
        approve: true,
      })
    ).statusCode,
    200,
  );
  const me = (await request("GET", "me", spectator)).json();
  assert.equal(me.user.approved, true);
});

test("a league seat keeps its record across a midseason replacement", async (t) => {
  const app = await createApp({ database: ":memory:" });
  t.after(() => app.close());
  const db = app.db;
  const owner = register(
    db,
    { name: "Organizer", handle: "ltowner" },
    await passwordHash("TournamentSeatPassword!"),
    null,
    true,
  );
  const ids = ["Bannon", "Ali", "Lidl", "Trav"].map((name) =>
    Number(
      db.prepare("INSERT INTO players(name,created) VALUES(?,1)").run(name)
        .lastInsertRowid,
    ),
  );
  const [outgoing, incoming, opponent, other] = ids;
  const {
    getCompetition,
    addEntry,
    draw,
    replacePlayer,
    fixtureList,
    fixturePlayers,
    settings,
    standings,
  } = await import("../server/competitions.js");
  const rules = {
    ...settings({ bestOf: 3, target: 21 }, "tt", "singles"),
    weights: { league: 1 },
  };
  db.prepare(
    "INSERT INTO competitions(game,owner,name,kind,format,enrollment,settings,created) VALUES('tt',?,'Lunch League','league','singles','selected',?,1)",
  ).run(owner.id, JSON.stringify(rules));
  let c = getCompetition(db, 1);
  const entry = addEntry(db, c, [outgoing], 1);
  addEntry(db, c, [opponent], 2);
  addEntry(db, c, [other], 3);
  draw(db, c, owner);
  c = getCompetition(db, 1);
  const fixtures = fixtureList(db, 1).filter((f) => [f.a, f.b].includes(entry));
  const { forfeit } = await import("../server/matches.js");
  forfeit(db, fixtures[0].id, entry, owner);
  const replace = (actor, from, to) =>
    db.transaction(() => replacePlayer(db, c, entry, from, to, actor))();
  assert.throws(() => replace(null, outgoing, incoming), /Organizer/);
  assert.throws(() => replace(owner, outgoing, opponent), /already entered/);
  replace({ ...owner, site_admin: 0 }, outgoing, incoming);
  assert.throws(() => replace(owner, outgoing, incoming), /already left/);
  assert.deepEqual(fixturePlayers(db, fixtures[0].id, entry), [
    { player_id: outgoing },
  ]);
  assert.deepEqual(fixturePlayers(db, fixtures[1].id, entry), [
    { player_id: incoming },
  ]);
  const row = standings(db, c).find((r) => r.entry === entry);
  assert.equal(row.w, 1);
  assert.equal(row.players[0].id, incoming);
  assert.equal(row.seatHistory[0].outgoing, "Bannon");
  assert.equal(row.seatHistory[0].incoming, "Ali");
  const historical = standings(db, c, "", null, {
    id: 1,
    submitted: row.seatHistory[0].time - 1,
  }).find((r) => r.entry === entry);
  assert.equal(historical.players[0].id, outgoing);
  assert.deepEqual(historical.seatHistory, []);
  const fixture = fixtures[1];
  const login = await app.inject({
    method: "POST",
    url: "/api/login",
    headers: { "x-mimelo-request": "1" },
    payload: { identity: "ltowner", password: "TournamentSeatPassword!" },
  });
  const headers = {
    "x-mimelo-request": "1",
    "x-csrf-token": login.json().csrf,
    cookie: login.cookies.map((c) => c.name + "=" + c.value).join("; "),
  };
  const response = await app.inject({
    method: "POST",
    url: "/api/fixtures/" + fixture.id + "/substitute",
    headers,
    payload: { entry, outgoing: incoming, incoming: outgoing },
  });
  assert.equal(response.statusCode, 200, response.body);
  const { submit, accept, checkoff } = await import("../server/matches.js");
  const played_at = Date.now();
  const points = fixture.a === entry ? { a: 21, b: 9 } : { a: 9, b: 21 };
  const m = submit(
    db,
    "tt",
    { fixture: fixture.id, played_at, score: { games: [points, points] } },
    owner,
  );
  accept(db, m.id, owner, 1);
  checkoff(db, m.id, owner, 1);
  const current = standings(db, c).find((r) => r.entry === entry);
  assert.equal(current.w, 2);
  assert.equal(current.players[0].id, incoming);
  const sub = current.seatHistory.find((h) => h.type === "substitute");
  assert.deepEqual(
    [sub.outgoing, sub.incoming, sub.time],
    ["Ali", "Bannon", played_at],
  );
  assert.ok(
    db
      .prepare("SELECT 1 FROM ledger WHERE match_id=? AND player_id=?")
      .get(m.id, outgoing),
  );
  assert.equal(
    db
      .prepare("SELECT 1 FROM ledger WHERE match_id=? AND player_id=?")
      .get(m.id, incoming),
    undefined,
  );
});

test("withdrawal awards become no contests if both seats withdraw, while ordinary forfeits stay intact", async (t) => {
  const app = await createApp({ database: ":memory:" });
  t.after(() => app.close());
  const password = "WithdrawalManagementPassword!";
  const owner = register(
    app.db,
    { name: "Organizer", handle: "withdrawalorganizer" },
    await passwordHash(password),
    null,
    true,
  );
  const players = ["A", "B", "C", "D"].map((name) =>
    Number(
      app.db.prepare("INSERT INTO players(name,created) VALUES(?,1)").run(name)
        .lastInsertRowid,
    ),
  );
  const login = await app.inject({
    method: "POST",
    url: "/api/login",
    headers: { "x-mimelo-request": "1" },
    payload: { identity: owner.handle, password },
  });
  const headers = {
    "x-mimelo-request": "1",
    "x-csrf-token": login.json().csrf,
    cookie: login.cookies.map((c) => `${c.name}=${c.value}`).join("; "),
  };
  async function call(method, path, payload) {
    const result = await app.inject({
      method,
      url: "/api/" + path,
      headers,
      ...(payload === undefined ? {} : { payload }),
    });
    assert.equal(result.statusCode, 200, result.body);
    return result.json();
  }
  const competition = await call("POST", "competitions", {
    game: "tt",
    kind: "league",
    format: "singles",
    name: "Withdrawals",
    entries: players.map((player) => [player]),
    settings: { bestOf: 3, target: 21 },
  });
  const draw = await call("POST", `competitions/${competition.id}/draw`, {});
  const [a, b, c, d] = draw.entries.map((entry) => entry.id);
  const ab = draw.fixtures.find(
    (f) => [f.a, f.b].includes(a) && [f.a, f.b].includes(b),
  );
  const cd = draw.fixtures.find(
    (f) => [f.a, f.b].includes(c) && [f.a, f.b].includes(d),
  );
  const pending = (entry, overrides = {}) =>
    Object.fromEntries(
      draw.fixtures
        .filter((f) => f.status === "ready" && [f.a, f.b].includes(entry))
        .map((f) => [String(f.id), overrides[f.id] || "hold"]),
    );
  const reported = cd.a === c ? { a: 21, b: 11 } : { a: 11, b: 21 };
  const result = await call("POST", `fixtures/${cd.id}/forfeit`, {
    winner: c,
    games: [reported, reported],
    note: "Reported forfeit",
    played_at: 1733851800000,
  });
  assert.equal(result.forfeit, 1);
  assert.equal(result.elo_enabled, 0);
  await call("POST", `competitions/${competition.id}/entries/${c}/withdraw`, {
    fixtures: pending(c),
  });
  await call("POST", `competitions/${competition.id}/entries/${d}/withdraw`, {
    fixtures: pending(d),
  });
  let state = await call("GET", `competitions/${competition.id}`);
  assert.equal(state.fixtures.find((f) => f.id === cd.id).no_contest, 0);
  const forfeitingWinner = state.standings[""].find((row) => row.entry === c);
  assert.equal(forfeitingWinner.points_for, 42);
  assert.equal(forfeitingWinner.points_against, 22);
  await call("POST", `competitions/${competition.id}/entries/${a}/withdraw`, {
    fixtures: pending(a, { [ab.id]: "forfeit" }),
  });
  await call("POST", `competitions/${competition.id}/entries/${b}/withdraw`, {
    fixtures: pending(b),
  });
  state = await call("GET", `competitions/${competition.id}`);
  assert.equal(state.fixtures.find((f) => f.id === ab.id).no_contest, 1);
  assert.equal(
    app.db.prepare("SELECT COUNT(*) count FROM ledger").get().count,
    0,
  );
});

test("stage best-of overrides flow to fixtures and score validation", async (t) => {
  const app = await createApp({ database: ":memory:" });
  t.after(() => app.close());
  const password = "StageBestOfPassword!";
  const admin = register(
    app.db,
    { name: "Admin", handle: "stagebestofadmin" },
    await passwordHash(password),
    null,
    true,
  );
  const players = Array.from({ length: 8 }, (_, index) =>
    Number(
      app.db
        .prepare("INSERT INTO players(name,created) VALUES(?,1)")
        .run("Stage Player " + index).lastInsertRowid,
    ),
  );
  const login = await app.inject({
    method: "POST",
    url: "/api/login",
    headers: { "x-mimelo-request": "1" },
    payload: { identity: admin.handle, password },
  });
  const headers = {
    "x-mimelo-request": "1",
    "x-csrf-token": login.json().csrf,
    cookie: login.cookies.map((c) => `${c.name}=${c.value}`).join("; "),
  };
  async function call(method, path, payload, expected = 200) {
    const result = await app.inject({
      method,
      url: "/api/" + path,
      headers,
      ...(payload === undefined ? {} : { payload }),
    });
    assert.equal(result.statusCode, expected, result.body);
    return result.json();
  }
  const competition = await call("POST", "competitions", {
    game: "tt",
    kind: "knockout",
    name: "Best-of test",
    entries: players.map((id) => [id]),
    settings: {
      bestOf: 3,
      target: 21,
      bestOfByStage: {
        knockout: 3,
        knockoutRound1: 5,
        semifinal: 7,
        final: 1,
      },
    },
  });
  const draw = await call("POST", `competitions/${competition.id}/draw`, {});
  const firstRound = draw.fixtures.find((f) => f.stage === "knockout");
  const semifinal = draw.fixtures.find((f) => f.stage === "semifinal");
  const final = draw.fixtures.find((f) => f.stage === "final");
  assert.equal(firstRound.bestOf, 5);
  assert.equal(semifinal.bestOf, 7);
  assert.equal(final.bestOf, 1);
  await call(
    "POST",
    "games/tt/matches",
    {
      fixture: firstRound.id,
      score: {
        games: [
          { a: 21, b: 2 },
          { a: 21, b: 5 },
        ],
      },
    },
    400,
  );
  const result = await call("POST", "games/tt/matches", {
    fixture: firstRound.id,
    score: {
      games: [
        { a: 21, b: 2 },
        { a: 21, b: 5 },
        { a: 21, b: 6 },
      ],
    },
  });
  assert.equal(result.score.bestOf, 5);
});
