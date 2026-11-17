import { assert, integer, json, organizer, audit, notify } from "./db.js";
import { randomInt } from "node:crypto";
import { catalogImage } from "./catalog-images.js";
export function getCompetition(db, id) {
  const c = db.prepare("SELECT * FROM competitions WHERE id=?").get(Number(id));
  assert(c, "Competition not found.", 404);
  return { ...c, settings: json(c.settings) };
}
export function entries(db, id) {
  return db
    .prepare("SELECT * FROM entrants WHERE competition_id=? ORDER BY seed,id")
    .all(id)
    .map((e) => ({
      ...e,
      players: db
        .prepare(
          "SELECT p.id,p.name,p.photo FROM entrant_players ep JOIN players p ON p.id=ep.player_id WHERE ep.entry_id=? ORDER BY p.id",
        )
        .all(e.id),
    }));
}
export function fixtureList(db, id) {
  const game = db
    .prepare("SELECT game FROM competitions WHERE id=?")
    .get(id)?.game;
  return db
    .prepare(
      "SELECT f.*,m.id AS match_id,m.a_score,m.b_score,m.score,m.forfeit,m.status AS result_status FROM fixtures f LEFT JOIN matches m ON m.fixture_id=f.id AND m.status<>'voided' WHERE f.competition_id=? ORDER BY f.id",
    )
    .all(id)
    .map((f) => {
      const score = f.score ? json(f.score) : null;
      return {
        ...f,
        score,
        teams: [score?.teamA, score?.teamB].map((id) => {
          if (!id) return null;
          const team = db
            .prepare("SELECT id,name,code FROM teams WHERE id=?")
            .get(id);
          return team
            ? { ...team, image: catalogImage(db, game, "team", team.code) }
            : null;
        }),
      };
    });
}
export function settings(body, kind, format) {
  const s = {
    legs: Number(body.legs) || 1,
    elimination: body.elimination || "single",
    groupCount: Number(body.groupCount) || 2,
    advance: Number(body.advance) || 2,
    playoffs: !!body.playoffs,
    playoffCount: Number(body.playoffCount) || 4,
    seeding: body.seeding || "elo",
    tieBreaks: body.tieBreaks || ["head_to_head", "difference", "for"],
    tieResolution: body.tieResolution || "admin",
    bestOf: Number(body.bestOf) || 3,
    target: Number(body.target) || 11,
    matchTiebreak: !!body.matchTiebreak,
  };
  assert(
    [1, 2].includes(s.legs) && ["single", "double"].includes(s.elimination),
    "Invalid competition format.",
  );
  assert(
    ["elo", "random", "manual", "preseeded"].includes(s.seeding),
    "Invalid seeding method.",
  );
  integer(s.groupCount, 1, 64);
  integer(s.advance, 1, 128);
  integer(s.playoffCount, 2, 256);
  assert(
    Array.isArray(s.tieBreaks) &&
      s.tieBreaks.length <= 5 &&
      s.tieBreaks.every((x) =>
        [
          "head_to_head",
          "difference",
          "for",
          "sets_difference",
          "points_difference",
        ].includes(x),
      ) &&
      new Set(s.tieBreaks).size === s.tieBreaks.length,
    "Choose unique tiebreak criteria.",
  );
  assert(
    ["admin", "match"].includes(s.tieResolution),
    "Invalid qualification tie resolution.",
  );
  const lengths =
    kind === "tt"
      ? [1, 3, 5, 7]
      : kind === "tennis" && format === "doubles"
        ? [1, 3]
        : [1, 3, 5];
  assert(lengths.includes(s.bestOf), "Unsupported best-of length.");
  assert([11, 21].includes(s.target), "Choose games to 11 or 21.");
  return s;
}
export function addEntry(db, c, ids, seed) {
  assert(
    ["registration", "closed"].includes(c.state),
    "The draw has already started.",
  );
  assert(
    Array.isArray(ids) &&
      ids.length > 0 &&
      ids.length <= (c.format === "doubles" ? 2 : 1),
    "Invalid entry.",
  );
  ids = ids.map((x) => integer(x, 1));
  assert(
    new Set(ids).size === ids.length,
    "A player cannot partner with themselves.",
  );
  for (const id of ids) {
    assert(
      db.prepare("SELECT 1 FROM players WHERE id=?").get(id),
      "Player not found.",
    );
    assert(
      !db
        .prepare(
          "SELECT 1 FROM entrant_players WHERE competition_id=? AND player_id=?",
        )
        .get(c.id, id),
      "This player is already entered.",
    );
  }
  const entry = Number(
    db
      .prepare("INSERT INTO entrants(competition_id,seed) VALUES(?,?)")
      .run(c.id, seed == null ? null : integer(seed, 1, 10000)).lastInsertRowid,
  );
  for (const id of ids)
    db.prepare("INSERT INTO entrant_players VALUES(?,?,?)").run(
      entry,
      c.id,
      id,
    );
  return entry;
}
function fixture(db, c, stage, pool, round, label, a, b, conditional = 0) {
  const ref = (x) =>
    typeof x === "object" && x !== null ? JSON.stringify(x) : null;
  const id = Number(
    db
      .prepare(
        "INSERT INTO fixtures(competition_id,stage,pool,round,label,a,b,source_a,source_b,conditional) VALUES(?,?,?,?,?,?,?,?,?,?)",
      )
      .run(
        c.id,
        stage,
        pool,
        round,
        label,
        ref(a) ? null : (a ?? null),
        ref(b) ? null : (b ?? null),
        ref(a),
        ref(b),
        conditional,
      ).lastInsertRowid,
  );
  for (const x of [a, b])
    if (x && typeof x === "object")
      db.prepare("INSERT OR IGNORE INTO dependencies VALUES(?,?)").run(
        x.fixture,
        id,
      );
  return id;
}
const win = (id) => ({ fixture: id, outcome: "winner" }),
  lose = (id) => ({ fixture: id, outcome: "loser" });
function bracket(db, c, ids) {
  let size = 2;
  while (size < ids.length) size *= 2;
  let positions = [1, 2];
  for (let n = 4; n <= size; n *= 2)
    positions = positions.flatMap((x) => [x, n + 1 - x]);
  let round = 1,
    prev = [],
    winners = [];
  for (let i = 0; i < size; i += 2)
    prev.push(
      fixture(
        db,
        c,
        size === 2 ? "final" : size === 4 ? "semifinal" : "knockout",
        "W",
        round,
        `W${round}.${i / 2 + 1}`,
        ids[positions[i] - 1] || null,
        ids[positions[i + 1] - 1] || null,
      ),
    );
  winners.push(prev);
  while (prev.length > 1) {
    round++;
    const next = [];
    for (let i = 0; i < prev.length; i += 2)
      next.push(
        fixture(
          db,
          c,
          prev.length === 2
            ? "final"
            : prev.length === 4
              ? "semifinal"
              : "knockout",
          "W",
          round,
          `W${round}.${i / 2 + 1}`,
          win(prev[i]),
          win(prev[i + 1]),
        ),
      );
    prev = next;
    winners.push(prev);
  }
  if (c.settings.elimination === "double") {
    let lower = [];
    let lr = 1;
    if (size === 2) lower = [lose(winners[0][0])];
    else {
      for (let i = 0; i < winners[0].length; i += 2)
        lower.push(
          win(
            fixture(
              db,
              c,
              "knockout",
              "L",
              lr,
              `L${lr}.${i / 2 + 1}`,
              lose(winners[0][i]),
              lose(winners[0][i + 1]),
            ),
          ),
        );
      for (let r = 1; r < winners.length; r++) {
        lr++;
        lower = lower.map((x, i) =>
          win(
            fixture(
              db,
              c,
              "knockout",
              "L",
              lr,
              `L${lr}.${i + 1}`,
              x,
              lose(winners[r][winners[r].length - 1 - i]),
            ),
          ),
        );
        if (r < winners.length - 1) {
          lr++;
          const reduced = [];
          for (let i = 0; i < lower.length; i += 2)
            reduced.push(
              win(
                fixture(
                  db,
                  c,
                  "knockout",
                  "L",
                  lr,
                  `L${lr}.${i / 2 + 1}`,
                  lower[i],
                  lower[i + 1],
                ),
              ),
            );
          lower = reduced;
        }
      }
    }
    const grand = fixture(
      db,
      c,
      "final",
      "G",
      lr + 1,
      "Grand final",
      win(prev[0]),
      lower[0],
    );
    fixture(
      db,
      c,
      "final",
      "G",
      lr + 2,
      "Grand final reset",
      win(grand),
      lose(grand),
      1,
    );
  }
}
function league(db, c, ids, pool = "") {
  let list = [...ids];
  if (list.length % 2) list.push(null);
  const base = [...list];
  for (let leg = 0; leg < c.settings.legs; leg++) {
    list = [...base];
    for (let r = 0; r < list.length - 1; r++) {
      for (let i = 0; i < list.length / 2; i++) {
        let a = list[i],
          b = list[list.length - 1 - i];
        if (leg % 2) [a, b] = [b, a];
        if (a && b)
          fixture(
            db,
            c,
            pool ? "group" : "league",
            pool,
            r + 1 + leg * (list.length - 1),
            `Round ${r + 1 + leg * (list.length - 1)}`,
            a,
            b,
          );
      }
      list = [list[0], list.at(-1), ...list.slice(1, -1)];
    }
  }
}
export function draw(db, c, user) {
  assert(
    organizer(db, user, c),
    "Only the organizer or an admin can generate this draw.",
    403,
  );
  assert(
    ["registration", "closed"].includes(c.state),
    "The draw has already been generated.",
  );
  if (c.enrollment !== "selected" && c.state === "registration")
    assert(
      Date.now() >= (c.deadline || Infinity),
      "Close registration before generating the draw.",
    );
  let es = entries(db, c.id).filter((e) => !e.withdrawn);
  assert(
    es.length >= 2 && es.length <= 256,
    "Choose between 2 and 256 entries.",
  );
  assert(
    es.every((e) => e.players.length === (c.format === "doubles" ? 2 : 1)),
    "Pair all doubles entries before generating the draw.",
  );
  if (c.settings.seeding === "elo")
    es.sort((a, b) => {
      const rating = (e) =>
        e.players.reduce(
          (sum, p) =>
            sum +
            (db
              .prepare(
                "SELECT elo FROM ratings WHERE game=? AND format=? AND player_id=?",
              )
              .get(c.game, c.format, p.id)?.elo ?? 1000),
          0,
        ) / e.players.length;
      return rating(b) - rating(a) || a.id - b.id;
    });
  if (c.settings.seeding === "random")
    for (let i = es.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [es[i], es[j]] = [es[j], es[i]];
    }
  if (c.settings.seeding === "preseeded")
    assert(
      es.every((e) => e.seed > 0) &&
        new Set(es.map((e) => e.seed)).size === es.length,
      "Assign a unique positive seed to every entry.",
    );
  es.forEach((e, i) =>
    db.prepare("UPDATE entrants SET seed=? WHERE id=?").run(i + 1, e.id),
  );
  const ids = es.map((e) => e.id);
  if (c.kind === "league") league(db, c, ids);
  else if (c.kind === "groups") {
    assert(
      c.settings.groupCount * 2 <= ids.length,
      "Every group needs at least two entries.",
    );
    assert(
      c.settings.advance < Math.floor(ids.length / c.settings.groupCount) + 1,
      "Too many qualifiers per group.",
    );
    const buckets = Array.from({ length: c.settings.groupCount }, () => []);
    ids.forEach((id, i) => {
      const row = Math.floor(i / buckets.length),
        col = i % buckets.length;
      buckets[row % 2 ? buckets.length - 1 - col : col].push(id);
    });
    buckets.forEach((ids, i) =>
      league(db, c, ids, String.fromCharCode(65 + i)),
    );
  } else bracket(db, c, ids);
  db.prepare("UPDATE competitions SET state='active' WHERE id=?").run(c.id);
  audit(db, user, "competition.draw", c.id);
  notify(
    db,
    c.game,
    es.flatMap((e) => e.players.map((p) => p.id)),
    "competition",
    c.name + " draw is ready",
    `/competition.html?game=${c.game}&id=${c.id}`,
  );
  progress(db, c);
}
export const qualificationCount = (c) =>
  c.kind === "groups"
    ? c.settings.advance
    : c.settings.playoffs
      ? c.settings.playoffCount
      : 1;
export function standings(db, c, pool = "", onlyFixtures = null) {
  const fs = db
    .prepare(
      "SELECT f.*,m.score,m.a_score,m.b_score,m.forfeit FROM fixtures f LEFT JOIN matches m ON m.fixture_id=f.id WHERE f.competition_id=? AND f.pool=? AND f.stage IN('league','group','tiebreak')",
    )
    .all(c.id, pool)
    .filter((f) =>
      onlyFixtures ? onlyFixtures.includes(f.id) : f.stage !== "tiebreak",
    );
  const ids = new Set(fs.flatMap((f) => [f.a, f.b]).filter(Boolean));
  const rows = [...ids].map((id) => ({
    entry: id,
    players: entries(db, c.id).find((e) => e.id === id)?.players || [],
    played: 0,
    w: 0,
    d: 0,
    l: 0,
    for: 0,
    against: 0,
    sets_difference: 0,
    points_difference: 0,
    head_to_head: 0,
    points: 0,
  }));
  const by = new Map(rows.map((r) => [r.entry, r]));
  const completed = fs.filter((f) => f.status === "completed");
  for (const f of completed) {
    const a = by.get(f.a),
      b = by.get(f.b);
    if (!a || !b) continue;
    a.played++;
    b.played++;
    if (f.winner === f.a) {
      a.w++;
      b.l++;
    } else if (f.winner === f.b) {
      b.w++;
      a.l++;
    } else {
      a.d++;
      b.d++;
    }
    a.for += f.a_score || 0;
    a.against += f.b_score || 0;
    b.for += f.b_score || 0;
    b.against += f.a_score || 0;
    const score = json(f.score);
    let diff = (score.games || []).reduce((sum, g) => sum + g.a - g.b, 0);
    a.points_difference += diff;
    b.points_difference -= diff;
  }
  const fc =
    db.prepare("SELECT kind FROM games WHERE slug=?").get(c.game).kind === "fc";
  for (const r of rows) {
    r.points = fc ? r.w * 3 + r.d : r.w;
    r.difference = r.for - r.against;
    r.sets_difference = r.difference;
  }
  for (const r of rows)
    for (const f of completed) {
      const opp = f.a === r.entry ? f.b : f.b === r.entry ? f.a : null;
      if (opp && by.get(opp).points === r.points)
        r.head_to_head +=
          f.winner === r.entry ? (fc ? 3 : 1) : !f.winner && fc ? 1 : 0;
    }
  const criteria = ["points", ...c.settings.tieBreaks];
  const compare = (a, b) => {
    for (const k of criteria) {
      if (a[k] !== b[k]) return b[k] - a[k];
    }
    return 0;
  };
  rows.sort((a, b) => compare(a, b) || a.entry - b.entry);
  return rows.map((r, i) => ({
    ...r,
    position: i + 1,
    tiedWithPrevious: i > 0 && compare(rows[i - 1], r) === 0,
  }));
}
export function progress(db, c) {
  const latest = new Map((c.settings.tieRounds || []).map((r) => [r.pool, r]));
  for (const [pool, r] of latest) {
    const fs = r.fixtures.map((id) =>
      db.prepare("SELECT * FROM fixtures WHERE id=?").get(id),
    );
    if (fs.every((f) => f?.status === "completed")) {
      const rows = standings(db, c, pool, r.fixtures),
        places = r.count - r.guaranteed.length;
      if (rows.length >= places && !rows[places]?.tiedWithPrevious) {
        const chosen = [
          ...r.guaranteed,
          ...rows.slice(0, places).map((x) => x.entry),
        ];
        db.prepare(
          "INSERT OR IGNORE INTO qualifications(competition_id,pool,entries,reason,actor,created) VALUES(?,?,?,?,?,?)",
        ).run(
          c.id,
          pool,
          JSON.stringify(chosen),
          "Additional qualification round",
          c.owner,
          Date.now(),
        );
      }
    }
  }

  // Resolve a directed fixture graph; each pass can only move waiting nodes forward.
  for (let pass = 0; pass < 30; pass++) {
    let changed = false;
    for (const f of db
      .prepare(
        "SELECT * FROM fixtures WHERE competition_id=? AND status='waiting' ORDER BY id",
      )
      .all(c.id)) {
      const resolve = (value, source) => {
        if (!source) return { ready: true, value };
        const ref = json(source);
        const p = db
          .prepare("SELECT * FROM fixtures WHERE id=?")
          .get(ref.fixture);
        return {
          ready: ["completed", "bye", "cancelled"].includes(p.status),
          value: p[ref.outcome],
          parent: p,
        };
      };
      const a = resolve(f.a, f.source_a),
        b = resolve(f.b, f.source_b);
      if (!a.ready || !b.ready) continue;
      if (f.conditional && a.parent?.winner !== a.parent?.b) {
        db.prepare("UPDATE fixtures SET status='cancelled' WHERE id=?").run(
          f.id,
        );
        changed = true;
        continue;
      }
      const bye = !a.value || !b.value;
      db.prepare(
        "UPDATE fixtures SET a=?,b=?,status=?,winner=? WHERE id=?",
      ).run(
        a.value || null,
        b.value || null,
        bye ? "bye" : "ready",
        bye ? a.value || b.value || null : null,
        f.id,
      );
      changed = true;
    }
    if (!changed) break;
  }
  const fs = db
    .prepare("SELECT * FROM fixtures WHERE competition_id=? ORDER BY id")
    .all(c.id);
  const prelim = fs.filter((f) => ["league", "group"].includes(f.stage));
  const knockout = fs.filter(
    (f) => !["league", "group", "tiebreak"].includes(f.stage),
  );
  if (
    prelim.length &&
    prelim.every((f) => f.status === "completed") &&
    !knockout.length &&
    (c.kind === "groups" || c.settings.playoffs)
  ) {
    const pools = [...new Set(prelim.map((f) => f.pool))];
    const qualified = [];
    let pending = false;
    for (const pool of pools) {
      const rows = standings(db, c, pool),
        count = qualificationCount(c);
      assert(count <= rows.length, "Qualifier count exceeds entries.");
      let selected = rows.slice(0, count).map((r) => r.entry);
      if (rows[count]?.tiedWithPrevious) {
        const decision = db
          .prepare(
            "SELECT entries FROM qualifications WHERE competition_id=? AND pool=?",
          )
          .get(c.id, pool);
        if (decision) selected = json(decision.entries, []);
        else pending = true;
      }
      qualified.push(...selected);
    }
    if (!pending) {
      const before = Math.max(...fs.map((f) => f.id));
      bracket(db, c, qualified);
      const children = db
        .prepare("SELECT id FROM fixtures WHERE competition_id=? AND id>?")
        .all(c.id, before);
      for (const p of fs.filter((f) =>
        ["league", "group", "tiebreak"].includes(f.stage),
      ))
        for (const child of children)
          db.prepare("INSERT OR IGNORE INTO dependencies VALUES(?,?)").run(
            p.id,
            child.id,
          );
      return progress(db, c);
    }
  }
  const all = db
    .prepare("SELECT * FROM fixtures WHERE competition_id=?")
    .all(c.id);
  if (
    all.length &&
    all.every((f) => ["completed", "bye", "cancelled"].includes(f.status))
  ) {
    if (c.kind === "league" && !c.settings.playoffs) {
      const rows = standings(db, c),
        decision = db
          .prepare(
            "SELECT entries FROM qualifications WHERE competition_id=? AND pool=?",
          )
          .get(c.id, "");
      if (!rows[1]?.tiedWithPrevious || decision)
        db.prepare(
          "UPDATE competitions SET state='completed',champion=? WHERE id=?",
        ).run(
          decision ? json(decision.entries, [])[0] : rows[0]?.entry || null,
          c.id,
        );
    } else if (
      all.some((f) => !["league", "group", "tiebreak"].includes(f.stage))
    ) {
      const final = all
        .filter(
          (f) =>
            f.status !== "cancelled" &&
            !["league", "group", "tiebreak"].includes(f.stage),
        )
        .at(-1);
      db.prepare(
        "UPDATE competitions SET state='completed',champion=? WHERE id=?",
      ).run(final.winner, c.id);
    }
  }
}
export function locked(db, fixtureId) {
  if (!fixtureId) return false;
  return !!db
    .prepare(
      `WITH RECURSIVE descendants(id) AS (SELECT child FROM dependencies WHERE parent=? UNION SELECT d.child FROM dependencies d JOIN descendants s ON d.parent=s.id) SELECT 1 FROM matches WHERE fixture_id IN(SELECT id FROM descendants) AND status<>'voided' LIMIT 1`,
    )
    .get(fixtureId);
}
export function serializeCompetition(db, c) {
  const es = entries(db, c.id),
    fs = fixtureList(db, c.id);
  const pools = [
    ...new Set(
      fs
        .filter((f) => ["league", "group"].includes(f.stage))
        .map((f) => f.pool),
    ),
  ];
  return {
    ...c,
    entries: es,
    fixtures: fs,
    standings: Object.fromEntries(
      pools.map((pool) => [pool, standings(db, c, pool)]),
    ),
    players: es.reduce((n, e) => n + e.players.length, 0),
  };
}
