import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
import { register, passwordHash } from "../server/auth.js";
import { upgradeRatings } from "../server/matches.js";
import { validateScore, ratingK } from "../server/scoring.js";
async function harness(t) {
  const app = await createApp({ database: ":memory:" });
  t.after(() => app.close());
  const pw = await passwordHash("TestPassword!");
  const users = [];
  for (let i = 0; i < 8; i++)
    users.push(
      register(
        app.db,
        { name: "Player " + i, handle: "player" + i },
        pw,
        null,
        i === 0,
      ),
    );
  const sessions = new Map();
  for (const u of users) {
    const r = await app.inject({
      method: "POST",
      url: "/api/login",
      headers: { "x-mimelo-request": "1" },
      payload: { identity: u.handle, password: "TestPassword!" },
    });
    assert.equal(r.statusCode, 200, r.body);
    sessions.set(u.id, {
      cookie: r.cookies.map((c) => c.name + "=" + c.value).join("; "),
      "x-csrf-token": r.json().csrf,
      "x-mimelo-request": "1",
    });
  }
  async function call(u, method, url, payload, status = 200) {
    const r = await app.inject({
      method,
      url,
      headers: u ? sessions.get(u.id) : {},
      ...(payload ? { payload } : {}),
    });
    assert.equal(r.statusCode, status, r.body);
    return r.json();
  }
  return { app, db: app.db, users, call };
}
const tennis = (a, b, extra = {}) => ({
  format: "singles",
  sides: [[a.player_id], [b.player_id]],
  score: { bestOf: 1, games: [{ a: 6, b: 2 }] },
  ...extra,
});
test("mutual acceptance, separate Elo checkoff, replay, revision checks and isolation", async (t) => {
  const { call, users, db } = await harness(t);
  const [admin, a, b, c] = users;
  const m = await call(a, "POST", "/api/games/tennis/matches", tennis(a, b));
  assert.equal(m.status, "submitted");
  await call(c, "POST", `/api/matches/${m.id}/accept`, { revision: 1 }, 403);
  const accepted = await call(b, "POST", `/api/matches/${m.id}/accept`, {
    revision: 1,
  });
  assert.equal(accepted.status, "accepted");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM ratings").get().n, 0);
  await call(a, "POST", `/api/matches/${m.id}/elo`, { revision: 1 }, 403);
  const later = await call(
    a,
    "POST",
    "/api/games/tennis/matches",
    tennis(a, c),
  );
  await call(admin, "POST", `/api/matches/${later.id}/accept`, { revision: 1 });
  await call(admin, "POST", `/api/matches/${later.id}/elo`, { revision: 1 });
  await call(admin, "POST", `/api/matches/${m.id}/elo`, { revision: 1 });
  const before = db
    .prepare("SELECT * FROM ledger ORDER BY match_id,player_id")
    .all();
  await call(admin, "POST", "/api/games/tennis/recalculate", {});
  assert.deepEqual(
    db.prepare("SELECT * FROM ledger ORDER BY match_id,player_id").all(),
    before,
  );
  await call(admin, "PATCH", `/api/matches/${m.id}`, {
    revision: 1,
    score: { bestOf: 1, games: [{ a: 1, b: 6 }] },
  });
  await call(b, "POST", `/api/matches/${m.id}/accept`, { revision: 1 }, 409);
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM ledger WHERE match_id=?").get(m.id).n,
    0,
  );
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) n FROM ratings WHERE format='doubles' OR game<>'tennis'",
      )
      .get().n,
    0,
  );
});
test("FC overalls required for Elo; shootout win remains Elo draw", async (t) => {
  const { call, users } = await harness(t);
  const [admin, a, b] = users;
  await call(admin, "POST", "/api/teams/eafc27", {
    code: "XI",
    name: "Team XI",
    overall: 95,
  });
  await call(admin, "POST", "/api/teams/eafc27", {
    code: "CLUB",
    name: "Club",
  });
  const teams = (await call(null, "GET", "/api/teams/eafc27")).rows;
  const xi = teams.find((t) => t.code === "XI"),
    club = teams.find((t) => t.code === "CLUB");
  const m = await call(a, "POST", "/api/games/eafc27/matches", {
    sides: [[a.player_id], [b.player_id]],
    score: { a: 2, b: 2, pens: [4, 5], teamA: xi.id, teamB: club.id },
  });
  assert.equal(m.outcome, 0.5);
  assert.equal(m.winner, 1);
  await call(b, "POST", `/api/matches/${m.id}/accept`, { revision: 1 });
  await call(admin, "POST", `/api/matches/${m.id}/elo`, { revision: 1 }, 409);
  await call(admin, "POST", "/api/teams/eafc27", {
    code: "CLUB",
    name: "Club",
    overall: 80,
  });
  const rated = await call(admin, "POST", `/api/matches/${m.id}/elo`, {
    revision: 1,
  });
  assert(rated.ledger.find((x) => x.player_id === a.player_id).delta < 0);
  assert.equal(
    (await call(null, "GET", "/api/games/eafc26/rankings")).total,
    0,
  );
});
test("doubles one representative each, organizer acceptance, forfeits and dependency lock", async (t) => {
  const { call, users, db } = await harness(t);
  const [admin, a, b, c, d] = users;
  const m = await call(a, "POST", "/api/games/tennis/matches", {
    format: "doubles",
    sides: [
      [a.player_id, b.player_id],
      [c.player_id, d.player_id],
    ],
    score: { bestOf: 1, games: [{ a: 6, b: 3 }] },
  });
  assert.equal(
    (await call(d, "POST", `/api/matches/${m.id}/accept`, { revision: 1 }))
      .status,
    "accepted",
  );
  const rated = await call(admin, "POST", `/api/matches/${m.id}/elo`, {
    revision: 1,
  });
  assert.equal(rated.ledger.length, 4);
  assert.equal(rated.ledger[0].delta, rated.ledger[1].delta);
  const comp = await call(a, "POST", "/api/competitions", {
    game: "tennis",
    name: "Cup",
    kind: "knockout",
    entries: [a, b, c, d].map((u) => [u.player_id]),
    settings: { bestOf: 1 },
  });
  let drawn = await call(a, "POST", `/api/competitions/${comp.id}/draw`, {});
  const first = drawn.fixtures.filter((f) => f.status === "ready");
  const fixtures = [];
  for (const f of first) {
    const r = await call(admin, "POST", "/api/games/tennis/matches", {
      fixture: f.id,
      score: { games: [{ a: 6, b: 2 }] },
    });
    await call(a, "POST", `/api/matches/${r.id}/accept`, { revision: 1 });
    fixtures.push(r);
  }
  drawn = await call(null, "GET", `/api/competitions/${comp.id}`);
  const final = drawn.fixtures.find((f) => f.status === "ready");
  await call(admin, "POST", "/api/games/tennis/matches", {
    fixture: final.id,
    score: { games: [{ a: 6, b: 4 }] },
  });
  await call(
    admin,
    "PATCH",
    `/api/matches/${fixtures[0].id}`,
    { revision: 1, score: { games: [{ a: 1, b: 6 }] } },
    409,
  );
  await call(admin, "PATCH", `/api/matches/${fixtures[0].id}/elo-enabled`, {
    revision: 1,
    enabled: false,
  });
  const excluded = await call(null, "GET", `/api/matches/${fixtures[0].id}`);
  assert.equal(excluded.status, "accepted");
  assert.equal(excluded.elo_enabled, 0);
  assert.equal(excluded.locked, true);
  const comp2 = await call(a, "POST", "/api/competitions", {
    game: "tennis",
    name: "Forfeit cup",
    kind: "knockout",
    entries: [a, b].map((u) => [u.player_id]),
    settings: { bestOf: 1 },
  });
  const fs = (await call(a, "POST", `/api/competitions/${comp2.id}/draw`, {}))
    .fixtures;
  const r = await call(a, "POST", `/api/fixtures/${fs[0].id}/forfeit`, {
    winner: fs[0].a,
  });
  assert.equal(r.elo_enabled, 0);
  assert.equal(
    db.prepare("SELECT state FROM competitions WHERE id=?").get(comp2.id).state,
    "completed",
  );
});
test("double elimination handles byes and reset; groups qualify after acceptance", async (t) => {
  const { call, users } = await harness(t);
  const [admin, a] = users;
  for (const count of [2, 3, 5, 8]) {
    const c = await call(a, "POST", "/api/competitions", {
      game: "tt",
      name: "Double " + count,
      kind: "knockout",
      entries: users.slice(0, count).map((u) => [u.player_id]),
      settings: { elimination: "double", bestOf: 1 },
    });
    await call(a, "POST", `/api/competitions/${c.id}/draw`, {});
    let rounds = 0;
    for (; rounds < 40; rounds++) {
      const state = await call(null, "GET", `/api/competitions/${c.id}`);
      if (state.state === "completed") break;
      const f = state.fixtures.find((f) => f.status === "ready");
      assert(f, "Double bracket stalled: " + JSON.stringify(state.fixtures));
      const r = await call(admin, "POST", "/api/games/tt/matches", {
        fixture: f.id,
        score: {
          games: [
            {
              a: f.label === "Grand final" ? 2 : 11,
              b: f.label === "Grand final" ? 11 : 2,
            },
          ],
        },
      });
      await call(a, "POST", `/api/matches/${r.id}/accept`, { revision: 1 });
    }
    assert(rounds < 40);
  }
  const c = await call(a, "POST", "/api/competitions", {
    game: "tt",
    name: "Groups",
    kind: "groups",
    entries: users.slice(0, 4).map((u) => [u.player_id]),
    settings: { groupCount: 2, advance: 1, bestOf: 1 },
  });
  await call(a, "POST", `/api/competitions/${c.id}/draw`, {});
  let state = await call(null, "GET", `/api/competitions/${c.id}`);
  for (const f of state.fixtures) {
    const m = await call(admin, "POST", "/api/games/tt/matches", {
      fixture: f.id,
      score: { games: [{ a: 11, b: 2 }] },
    });
    await call(a, "POST", `/api/matches/${m.id}/accept`, { revision: 1 });
  }
  state = await call(null, "GET", `/api/competitions/${c.id}`);
  assert(
    state.fixtures.some((f) => f.stage === "final" && f.status === "ready"),
  );
});
test("sport validation and margin distinctions", () => {
  assert.throws(() =>
    validateScore("tennis", "singles", {
      bestOf: 1,
      games: [{ a: 7, b: 6, tb: [7, 3] }],
    }),
  );
  assert.equal(
    validateScore("tennis", "singles", {
      bestOf: 1,
      games: [{ a: 7, b: 6, tb: [10, 8] }],
    }).winner,
    0,
  );
  assert.equal(
    validateScore("tennis", "doubles", {
      bestOf: 3,
      matchTiebreak: true,
      games: [
        { a: 6, b: 2 },
        { a: 3, b: 6 },
        { a: 12, b: 10 },
      ],
    }).winner,
    0,
  );
  assert.throws(() =>
    validateScore("tt", "singles", {
      bestOf: 1,
      target: 21,
      games: [{ a: 21, b: 20 }],
    }),
  );
  const g = {
    a: 2,
    b: 2,
    fighters: ["Mario", "Luigi"],
    stage: "Battlefield",
    suddenDeath: true,
    winner: 1,
  };
  assert.equal(
    validateScore("smash", "singles", { bestOf: 1, games: [g] }).winner,
    1,
  );
  assert.throws(() =>
    validateScore("smash", "doubles", {
      bestOf: 1,
      games: [
        {
          a: 6,
          b: 2,
          fighters: ["A", "B", "C", "D"],
          stage: "Battlefield",
          jv: true,
        },
      ],
    }),
  );
  assert(
    validateScore("fc", "singles", { a: 9, b: 0, teamA: 1, teamB: 2 }).margin >
      validateScore("fc", "singles", { a: 3, b: 2, teamA: 1, teamB: 2 }).margin,
  );
});

test("fill-in claims preserve history, merge review and account permissions", async (t) => {
  const { app, call, users, db } = await harness(t);
  const [admin, a, b, gameAdmin] = users;
  await call(admin, "POST", "/api/admin/roles", {
    account: gameAdmin.id,
    game: "tennis",
    enabled: true,
  });
  await call(gameAdmin, "PATCH", "/api/games/tt/weights", { friendly: 1 }, 403);
  await call(
    gameAdmin,
    "POST",
    "/api/admin/links",
    { kind: "reset", target: a.id },
    403,
  );
  const fill = await call(gameAdmin, "POST", "/api/players", {
    name: "Unclaimed Player",
  });
  const raw = new URL(fill.url, "http://test").searchParams.get("claim");
  const match = await call(
    admin,
    "POST",
    "/api/games/tennis/matches",
    tennis({ player_id: fill.id }, b),
  );
  await call(admin, "POST", `/api/matches/${match.id}/accept`, { revision: 1 });
  await call(admin, "POST", `/api/matches/${match.id}/elo`, { revision: 1 });
  const signup = await app.inject({
    method: "POST",
    url: "/api/signup",
    headers: { "x-mimelo-request": "1" },
    payload: {
      claim: raw,
      name: "Claimed Player",
      handle: "claimed",
      password: "NewPassword!",
    },
  });
  assert.equal(signup.statusCode, 200, signup.body);
  assert.equal(signup.json().user.player_id, fill.id);
  assert(
    db.prepare("SELECT elo FROM ratings WHERE player_id=?").get(fill.id).elo >
      1000,
  );
  assert.equal(
    (
      await app.inject({
        method: "GET",
        url: "/api/link?kind=claim&token=" + raw,
      })
    ).statusCode,
    410,
  );
  const fill2 = await call(admin, "POST", "/api/players", {
    name: "Second Fill",
  });
  await call(a, "POST", "/api/claim", {
    token: new URL(fill2.url, "http://test").searchParams.get("claim"),
  });
  const req = (await call(admin, "GET", "/api/admin/requests")).find(
    (r) => r.kind === "merge",
  );
  await call(admin, "POST", "/api/admin/requests/" + req.id, { approve: true });
  assert.equal(
    (await call(null, "GET", "/api/players/" + fill2.id)).merged_into,
    a.player_id,
  );
  await call(
    admin,
    "POST",
    "/api/admin/links",
    { kind: "claim", target: fill2.id },
    409,
  );
  await call(a, "POST", "/api/me/handle-request", { handle: "newhandle" });
  const request = (await call(admin, "GET", "/api/admin/requests")).find(
    (r) => r.kind === "handle",
  );
  await call(
    gameAdmin,
    "POST",
    "/api/admin/requests/" + request.id,
    { approve: true },
    403,
  );
  await call(admin, "POST", "/api/admin/requests/" + request.id, {
    approve: true,
  });
  assert.equal(
    db.prepare("SELECT handle FROM accounts WHERE id=?").get(a.id).handle,
    "newhandle",
  );
  const reset = await call(admin, "POST", "/api/admin/links", {
    kind: "reset",
    target: a.id,
  });
  const resetToken = new URL(reset.url, "http://test").searchParams.get(
    "reset",
  );
  const resetResponse = await app.inject({
    method: "POST",
    url: "/api/reset-password",
    headers: { "x-mimelo-request": "1" },
    payload: { token: resetToken, password: "ChangedPassword!" },
  });
  assert.equal(resetResponse.statusCode, 200, resetResponse.body);
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM sessions WHERE account_id=?").get(a.id)
      .n,
    0,
  );
  await call(null, "POST", "/api/games/tennis/matches", tennis(a, b), 403);
  const csrf = await app.inject({
    method: "PATCH",
    url: "/api/me",
    headers: {
      cookie: signup.cookies.map((c) => c.name + "=" + c.value).join("; "),
      "x-mimelo-request": "1",
    },
    payload: { name: "Hijacked" },
  });
  assert.equal(csrf.statusCode, 403);
  const publicPlayer = await call(null, "GET", "/api/players/" + fill.id);
  assert(!("email" in publicPlayer) && !("password" in publicPlayer));
  await call(null, "GET", "/api/players?offset=0.5", undefined, 400);
});

test("open registration, fixed pairs, weights, preview, void and resubmission", async (t) => {
  const { call, users, db } = await harness(t);
  const [admin, a, b, c, d] = users;
  await call(
    a,
    "POST",
    "/api/competitions",
    {
      game: "tennis",
      kind: "knockout",
      format: "doubles",
      name: "Open",
      enrollment: "open",
    },
    400,
  );
  const comp = await call(a, "POST", "/api/competitions", {
    game: "tennis",
    kind: "knockout",
    format: "doubles",
    name: "Open doubles",
    enrollment: "open",
    deadline: Date.now() + 60000,
    settings: { bestOf: 1 },
  });
  await call(a, "POST", `/api/competitions/${comp.id}/draw`, {}, 400);
  await call(a, "POST", `/api/competitions/${comp.id}/entries`, {
    players: [a.player_id, b.player_id],
  });
  await call(c, "POST", `/api/competitions/${comp.id}/entries`, {
    players: [c.player_id, d.player_id],
  });
  await call(a, "POST", `/api/competitions/${comp.id}/close`, {});
  await call(
    b,
    "POST",
    `/api/competitions/${comp.id}/entries`,
    { players: [b.player_id] },
    403,
  );
  const drawn = await call(a, "POST", `/api/competitions/${comp.id}/draw`, {});
  await call(
    a,
    "PATCH",
    `/api/competitions/${comp.id}`,
    { settings: { bestOf: 3 } },
    409,
  );
  await call(
    a,
    "POST",
    `/api/competitions/${comp.id}/pair`,
    { a: drawn.entries[0].id, b: drawn.entries[1].id },
    400,
  );
  await call(admin, "PATCH", "/api/games/tennis/weights", { final: 2 });
  assert.equal(
    (await call(null, "GET", `/api/competitions/${comp.id}`)).settings.weights
      .final,
    1.2,
  );
  const body = {
    fixture: drawn.fixtures[0].id,
    score: { games: [{ a: 6, b: 2 }] },
  };
  const preview = await call(a, "POST", "/api/games/tennis/preview", body);
  assert.equal(preview.sides[0][0].delta, preview.sides[0][1].delta);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM matches").get().n, 0);
  const m = await call(a, "POST", "/api/games/tennis/matches", body);
  await call(admin, "DELETE", "/api/matches/" + m.id, { revision: 1 });
  const replacement = await call(a, "POST", "/api/games/tennis/matches", body);
  assert.notEqual(replacement.id, m.id);
  assert(
    db
      .prepare("SELECT COUNT(*) n FROM notifications WHERE kind='competition'")
      .get().n > 0,
  );
});

test("three-way qualification resolves through an additional round without changing group records", async (t) => {
  const { call, users } = await harness(t);
  const [admin, a, b, c] = users;
  const comp = await call(a, "POST", "/api/competitions", {
    game: "tt",
    name: "Three-way tie",
    kind: "league",
    entries: [a, b, c].map((u) => [u.player_id]),
    settings: {
      bestOf: 1,
      playoffs: true,
      playoffCount: 2,
      tieBreaks: [],
      tieResolution: "match",
    },
  });
  const drawn = await call(a, "POST", `/api/competitions/${comp.id}/draw`, {}),
    ids = drawn.entries.map((e) => e.id);
  for (const f of drawn.fixtures) {
    const ia = ids.indexOf(f.a),
      ib = ids.indexOf(f.b),
      winner = (ia + 1) % 3 === ib ? 0 : 1;
    const m = await call(admin, "POST", "/api/games/tt/matches", {
      fixture: f.id,
      score: {
        games: [{ a: winner === 0 ? 11 : 2, b: winner === 0 ? 2 : 11 }],
      },
    });
    await call(a, "POST", "/api/matches/" + m.id + "/accept", { revision: 1 });
  }
  let state = await call(null, "GET", "/api/competitions/" + comp.id);
  assert(state.standings[""][2].tiedWithPrevious);
  assert(!state.fixtures.some((f) => f.stage === "final"));
  const tie = await call(a, "POST", `/api/competitions/${comp.id}/tiebreak`, {
    pool: "",
  });
  assert.equal(tie.ids.length, 3);
  state = await call(null, "GET", "/api/competitions/" + comp.id);
  for (const f of state.fixtures.filter((f) => f.stage === "tiebreak")) {
    const m = await call(admin, "POST", "/api/games/tt/matches", {
      fixture: f.id,
      score: { games: [{ a: 11, b: 2 }] },
    });
    await call(a, "POST", "/api/matches/" + m.id + "/accept", { revision: 1 });
  }
  state = await call(null, "GET", "/api/competitions/" + comp.id);
  assert(
    state.fixtures.some((f) => f.stage === "final" && f.status === "ready"),
  );
  assert(state.standings[""].every((r) => r.played === 2 && r.w === 1));
});

test("provisional ratings count only rated matches and replay across the eighth-match boundary", async (t) => {
  const { call, users, db } = await harness(t);
  const [admin, a, b] = users;
  const record = () =>
    call(null, "GET", `/api/players/${a.player_id}/record?game=tennis`);
  assert.equal((await record()).rated_matches, 0);
  const matches = [];
  for (let i = 0; i < 8; i++) {
    const m = await call(a, "POST", "/api/games/tennis/matches", tennis(a, b));
    matches.push(m);
    await call(admin, "POST", `/api/matches/${m.id}/accept`, { revision: 1 });
    assert.equal(
      (await record()).rated_matches,
      i,
      "Acceptance alone cannot establish a rating",
    );
    const rated = await call(admin, "POST", `/api/matches/${m.id}/elo`, {
      revision: 1,
    });
    const progress = await record();
    assert.equal(progress.rated_matches, i + 1);
    assert.equal(progress.provisional, i < 7);
    assert.equal(progress.provisional_matches, 8);
    const line = rated.ledger.find((l) => l.player_id === a.player_id);
    assert.equal(line.provisional, i < 7);
    assert.equal(line.provisional_before, true);
    assert.notEqual(
      line.before,
      line.after,
      "Provisional matches still change Elo",
    );
  }
  const ranks = await call(null, "GET", "/api/games/tennis/rankings");
  assert.equal(
    ranks.rows.find((r) => r.player_id === a.player_id).provisional,
    false,
  );
  const profile = await call(null, "GET", `/api/players/${a.player_id}`);
  assert.equal(profile.ratings[0].rated_matches, 8);
  const leader = (await call(null, "GET", "/api/games/tennis/summary")).leader;
  assert.equal(leader.provisional, false);
  assert.equal(
    (
      await call(
        null,
        "GET",
        `/api/players/${a.player_id}/record?game=tennis&format=doubles`,
      )
    ).rated_matches,
    0,
  );
  assert.equal(
    (await call(null, "GET", `/api/players/${a.player_id}/record?game=tt`))
      .rated_matches,
    0,
  );
  const off = await call(
    a,
    "POST",
    "/api/games/tennis/matches",
    tennis(a, b, { elo_enabled: false }),
  );
  await call(admin, "POST", `/api/matches/${off.id}/accept`, { revision: 1 });
  assert.equal((await record()).rated_matches, 8);
  await call(admin, "DELETE", `/api/matches/${matches[0].id}`, { revision: 1 });
  assert.equal((await record()).rated_matches, 7);
  assert.equal((await record()).provisional, true);
  const before = db
    .prepare("SELECT * FROM ledger ORDER BY match_id,player_id")
    .all();
  await call(admin, "POST", "/api/games/tennis/recalculate", {});
  assert.deepEqual(
    db.prepare("SELECT * FROM ledger ORDER BY match_id,player_id").all(),
    before,
  );
  const last = await call(null, "GET", `/api/matches/${matches[7].id}`);
  assert(last.ledger.every((l) => l.provisional && l.rated_matches === 7));
});

test("adaptive K tapers logarithmically from 124 to 24 by rated match 45", () => {
  assert.equal(ratingK(0), 124);
  assert.equal(ratingK(44), 24);
  assert.equal(ratingK(1000), 24);
  for (let n = 1; n <= 44; n++) assert(ratingK(n) < ratingK(n - 1));
  assert(ratingK(0) - ratingK(1) > ratingK(29) - ratingK(30));
});

test("preview and replay use the mean participant K, with isolation and an atomic policy upgrade", async (t) => {
  const { call, users, db } = await harness(t);
  const [admin, a, b, c, d] = users;
  const saveRated = async (body) => {
    const prediction = await call(
      admin,
      "POST",
      "/api/games/tennis/preview",
      body,
    );
    const m = await call(admin, "POST", "/api/games/tennis/matches", body);
    await call(admin, "POST", `/api/matches/${m.id}/accept`, { revision: 1 });
    const rated = await call(admin, "POST", `/api/matches/${m.id}/elo`, {
      revision: 1,
    });
    for (const side of prediction.sides)
      for (const p of side) {
        assert.equal(
          rated.ledger.find((l) => l.player_id === p.id).delta,
          p.delta,
        );
      }
    return { prediction, rated };
  };
  for (let n = 0; n < 44; n++) {
    const { prediction } = await saveRated(tennis(a, b));
    assert.equal(prediction.k, ratingK(n));
    assert.equal(prediction.sides[0][0].rated_matches, n);
  }
  const mature = await call(
    admin,
    "POST",
    "/api/games/tennis/preview",
    tennis(a, b),
  );
  assert.equal(mature.k, 24);
  const mixed = await saveRated(tennis(a, c));
  assert.equal(mixed.prediction.k, 74);
  assert.equal(mixed.prediction.sides[0][0].k, 24);
  assert.equal(mixed.prediction.sides[1][0].k, 124);
  assert.equal(
    mixed.prediction.sides[0][0].delta,
    -mixed.prediction.sides[1][0].delta,
  );
  const pairs = {
    format: "doubles",
    sides: [
      [a.player_id, b.player_id],
      [c.player_id, d.player_id],
    ],
    score: { bestOf: 1, games: [{ a: 6, b: 2 }] },
  };
  const freshPairs = await saveRated(pairs);
  assert.equal(
    freshPairs.prediction.k,
    124,
    "Singles experience must not affect doubles K",
  );
  assert(freshPairs.rated.ledger.every((l) => l.rated_matches === 1));
  const experiencedPair = {
    ...pairs,
    sides: [
      [a.player_id, b.player_id],
      [users[5].player_id, users[6].player_id],
    ],
  };
  await saveRated(experiencedPair);
  await saveRated(experiencedPair);
  const mixedPairs = await saveRated(pairs);
  assert(
    Math.abs(mixedPairs.prediction.k - (ratingK(3) + ratingK(1)) / 2) < 1e-10,
    "Doubles K must average all four participants",
  );
  const first = (await call(null, "GET", "/api/matches/1")).ledger;
  assert(first.every((l) => l.k_before === 124 && l.provisional));
  const expected = db
    .prepare("SELECT * FROM ledger ORDER BY match_id,player_id")
    .all();
  db.prepare("DELETE FROM migrations WHERE version=3").run();
  db.prepare("UPDATE ledger SET delta=0,after=before").run();
  upgradeRatings(db);
  assert.deepEqual(
    db.prepare("SELECT * FROM ledger ORDER BY match_id,player_id").all(),
    expected,
  );
  upgradeRatings(db);
  assert.deepEqual(
    db.prepare("SELECT * FROM ledger ORDER BY match_id,player_id").all(),
    expected,
  );
});
