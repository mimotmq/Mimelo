import test from "node:test";
import assert from "node:assert/strict";
import {
  conferenceSchedule,
  validateConferences,
  conferenceBracketSeeds,
} from "../server/conferences.js";
import { rankTable, qualificationPlan } from "../server/competition-table.js";
import { playpassOrder, statText } from "../static/js/standings-stats.js";

const ids = Array.from({ length: 32 }, (_, i) => i + 1);
const layout = {
  conferences: ["AFC", "NFC"].map((name, c) => ({
    name,
    divisions: ["North", "South", "East", "West"].map((name, d) => ({
      name,
      entries: ids.slice(16 * c + 4 * d, 16 * c + 4 * d + 4),
    })),
  })),
  wildcards: 3,
  games: { division: 6, conference: 6, cross: 5 },
  crossovers: [{ a: 1, b: 17, round: 1 }],
};
test("32 entrants get exact conference schedule quotas, conflict-free rounds and reserved crossover fixtures", () => {
  validateConferences(layout, ids);
  const fixtures = conferenceSchedule(layout);
  assert.equal(fixtures.length, 272);
  assert(fixtures.some((f) => f.a === 1 && f.b === 17 && f.round === 1));
  for (const id of ids) {
    const mine = fixtures.filter((f) => f.a === id || f.b === id);
    assert.deepEqual(
      ["Division", "Conference", "Interconference"].map(
        (k) => mine.filter((f) => f.category === k).length,
      ),
      [6, 6, 5],
    );
    assert.equal(new Set(mine.map((f) => f.round)).size, 17);
  }
  assert.throws(
    () =>
      conferenceSchedule({
        ...layout,
        games: { division: 1, conference: 1, cross: 0 },
      }),
    /exceed/,
  );
  const odd = structuredClone(layout);
  odd.conferences[0].divisions[0].entries.pop();
  assert.throws(() => conferenceSchedule(odd), /cannot be paired/);
});
test("division winners qualify ahead of conference wild cards and the halves meet only in the final", () => {
  const rows = ids.map((entry, i) => ({
    entry,
    position: i + 1,
    tiedWithPrevious: false,
  }));
  const c = { kind: "league", settings: { conferenceLayout: layout } };
  const plan = qualificationPlan(c, { "": rows });
  assert.deepEqual(plan.conferenceSeeds, [
    [1, 5, 9, 13, 2, 3, 4],
    [17, 21, 25, 29, 18, 19, 20],
  ]);
  let physical = [1, 2];
  while (physical.length < 16) {
    const size = physical.length * 2;
    physical = physical.flatMap((n) => [n, size + 1 - n]);
  }
  const seeds = conferenceBracketSeeds(plan.conferenceSeeds);
  const split = physical.map((i) => seeds[i - 1]);
  assert(split.slice(0, 8).every((id) => id == null || id <= 16));
  assert(split.slice(8).every((id) => id == null || id > 16));
  assert.deepEqual(
    [split[0], split[1], split[8], split[9]],
    [1, null, 17, null],
  );
  const tied = rows.map((r) => ({ ...r, tiedWithPrevious: r.entry === 2 }));
  assert(
    qualificationPlan(c, { "": tied }).pending.some(
      (p) => p.pool === "@division-0-0",
    ),
  );
});
test("Playpass compares displayed rally points, computes standings-only half credit and rewards fewer scores conceded", () => {
  const row = (entry, w, l, nc, pf, pa) => ({
    entry,
    played: w + l + nc,
    w,
    l,
    d: 0,
    nc,
    for: 0,
    against: 0,
    points_for: pf,
    points_against: pa,
    points_difference: pf - pa,
  });
  const ranks = rankTable(
    [
      row(1, 1, 8, 0, 259, 360),
      row(2, 1, 7, 1, 192, 347),
      row(3, 1, 7, 1, 201, 337),
      row(4, 6, 3, 0, 334, 227),
    ],
    [],
    playpassOrder,
    false,
  );
  assert.deepEqual(
    ranks.map((r) => r.entry),
    [4, 3, 2, 1],
  );
  assert.equal(statText(ranks[1], "pct"), "0.167");
  assert.equal(statText(ranks[0], "points_difference"), "+107");
  assert.equal(
    rankTable(
      [row(1, 3, 1, 0, 20, 9), row(2, 3, 1, 0, 22, 6)],
      [],
      ["points_against"],
      false,
    )[0].entry,
    2,
  );
});

test("league organizer configures a conference season, chooses table columns and advances each conference to a shared final", async (t) => {
  const { createApp } = await import("../server/app.js");
  const { register, passwordHash } = await import("../server/auth.js");
  const app = await createApp({ database: ":memory:" });
  t.after(() => app.close());
  const password = "ConferenceFixtureOnly!",
    hash = await passwordHash(password);
  const users = Array.from({ length: 8 }, (_, i) =>
    register(
      app.db,
      { name: "Entrant " + i, handle: "conf" + i },
      hash,
      null,
      i === 0,
    ),
  );
  const session = await app.inject({
    method: "POST",
    url: "/api/login",
    headers: { "x-mimelo-request": "1" },
    payload: { identity: "conf0", password },
  });
  const headers = {
    "x-mimelo-request": "1",
    "x-csrf-token": session.json().csrf,
    cookie: session.cookies.map((c) => c.name + "=" + c.value).join("; "),
  };
  async function call(method, path, payload, expect = 200) {
    const r = await app.inject({
      method,
      url: "/api/" + path,
      headers,
      payload,
    });
    assert.equal(r.statusCode, expect, r.body);
    return r.json();
  }
  const c = await call("POST", "competitions", {
    name: "Conference Cup",
    game: "eafc27",
    kind: "league",
    entries: users.map((u) => [u.player_id]),
  });
  const path = "competitions/" + c.id;
  const entries = c.entries.map((e) => e.id);
  const layout = {
    conferences: ["East", "West"].map((name, i) => ({
      name,
      divisions: ["North", "South"].map((name, j) => ({
        name,
        entries: entries.slice(i * 4 + j * 2, i * 4 + j * 2 + 2),
      })),
    })),
    wildcards: 1,
    games: { division: 1, conference: 2, cross: 1 },
    crossovers: [{ a: entries[0], b: entries[4], round: 1 }],
  };
  await call("PATCH", path + "/conferences", { layout });
  await call("PATCH", path + "/table", {
    tableColumns: ["for", "against", "difference"],
  });
  let season = await call("POST", path + "/draw", {});
  assert.equal(season.fixtures.length, 16);
  assert.deepEqual(season.settings.tableColumns, [
    "for",
    "against",
    "difference",
  ]);
  await call("PATCH", path + "/conferences", { layout }, 409);
  const outlook = await call("GET", path + "/projection");
  assert.equal(outlook.rows.length, 8);
  assert(Math.abs(outlook.rows.reduce((n, r) => n + r.title, 0) - 1) < 1e-6);
  for (const f of season.fixtures)
    await call("POST", "fixtures/" + f.id + "/forfeit", {
      winner: Math.min(f.a, f.b),
    });
  season = await call("GET", path);
  for (let n = 0; n < 8 && season.qualificationPending.length; n++) {
    const p = season.qualificationPending[0];
    await call("POST", path + "/qualify", {
      pool: p.pool,
      entries: [...p.fixed, ...p.allowed].slice(0, p.count),
      reason: "Historical seed order",
    });
    season = await call("GET", path);
  }
  assert(season.fixtures.some((f) => f.stage === "final"));
  while (season.state !== "completed") {
    const f = season.fixtures.find((f) => f.status === "ready");
    assert(f);
    const conference = (id) => (entries.indexOf(id) < 4 ? 0 : 1);
    if (f.stage === "final") assert.notEqual(conference(f.a), conference(f.b));
    else assert.equal(conference(f.a), conference(f.b));
    await call("POST", "fixtures/" + f.id + "/forfeit", {
      winner: Math.min(f.a, f.b),
    });
    season = await call("GET", path);
  }
  assert.equal(season.champion, entries[0]);
});
