import {
  rankTable,
  crossGroupTable,
  qualificationPlan,
} from "./competition-table.js";

const preliminary = (f) => ["league", "group"].includes(f.stage);
const knockout = (f) => !["league", "group", "tiebreak"].includes(f.stage);
const terminal = (f) => ["completed", "bye", "cancelled"].includes(f.status);
const cloneRows = (rows) => rows.map((r) => ({ ...r }));
const effectiveExtra = (c) =>
  c.kind === "groups" ? c.settings.extraCount || 0 : 0;
function randomSource(seed) {
  let value = 2166136261;
  for (const ch of seed) value = Math.imul(value ^ ch.charCodeAt(0), 16777619);
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function chances(a, b, ratings, football, drawRate) {
  const x = Math.max(
    -25,
    Math.min(
      25,
      (((ratings[a] ?? 1000) - (ratings[b] ?? 1000)) * Math.LN10) / 400,
    ),
  );
  const w = Math.exp(x / 2),
    l = Math.exp(-x / 2),
    d = football ? (2 * drawRate) / (1 - drawRate) : 0,
    total = w + l + d;
  return [w / total, d / total, l / total];
}
function addResult(rows, f, football) {
  const by = (rows._by ||= new Map(rows.map((r) => [r.entry, r])));
  const a = by.get(f.a),
    b = by.get(f.b);
  if (!a || !b) return;
  a.played++;
  b.played++;
  if (f.winner === a.entry) {
    a.w++;
    b.l++;
  } else if (f.winner === b.entry) {
    b.w++;
    a.l++;
  } else {
    a.d++;
    b.d++;
  }
  a.for += f.a_score;
  b.against += f.a_score;
  b.for += f.b_score;
  a.against += f.b_score;
  a.points_difference += f.points_difference || 0;
  b.points_difference -= f.points_difference || 0;
}
function sampleFixture(f, ratings, football, drawRate, random, c) {
  if (!f.a || !f.b)
    return { ...f, winner: f.a || f.b, loser: null, status: "bye" };
  const [win, draw] = chances(f.a, f.b, ratings, football, drawRate),
    r = random();
  let winner = r < win ? f.a : r < win + draw ? null : f.b;
  if (knockout(f) && !winner) winner = random() < win / (1 - draw) ? f.a : f.b;
  const margin = football
    ? 1 + Math.floor(-Math.log(Math.max(0.001, random())))
    : 1 + Math.floor(random() * Math.ceil(c.settings.bestOf / 2));
  const losing = football
    ? Math.floor(random() * 3)
    : Math.floor(random() * Math.ceil(c.settings.bestOf / 2));
  const winning = football
    ? Math.min(99, losing + margin)
    : Math.ceil(c.settings.bestOf / 2);
  return {
    ...f,
    status: "completed",
    winner,
    loser: winner === f.a ? f.b : winner === f.b ? f.a : null,
    a_score: !winner ? losing : winner === f.a ? winning : losing,
    b_score: !winner ? losing : winner === f.b ? winning : losing,
    points_difference:
      (winner === f.a ? 1 : -1) * (1 + Math.floor(random() * 15)),
  };
}
function hypotheticalBracket(ids, tables, c) {
  let size = 2,
    positions = [1, 2];
  while (size < ids.length) size *= 2;
  for (let n = 4; n <= size; n *= 2)
    positions = positions.flatMap((x) => [x, n + 1 - x]);
  // Same deterministic first-round group protection as the saved bracket.
  const groups = new Map(
    Object.entries(tables).flatMap(([pool, rows]) =>
      rows.map((r) => [r.entry, pool]),
    ),
  );
  let right = positions.filter((_, i) => i % 2).map((p) => ids[p - 1] || null);
  if (c.kind === "groups" && Object.keys(tables).length > 1) {
    const left = positions
        .filter((_, i) => !(i % 2))
        .map((p) => ids[p - 1] || null),
      assigned = new Map();
    function assign(i, seen) {
      for (const j of right
        .map((_, j) => j)
        .sort((a, b) => Math.abs(a - i) - Math.abs(b - i))) {
        if (
          seen.has(j) ||
          (left[i] && right[j] && groups.get(left[i]) === groups.get(right[j]))
        )
          continue;
        seen.add(j);
        if (!assigned.has(j) || assign(assigned.get(j), seen)) {
          assigned.set(j, i);
          return true;
        }
      }
      return false;
    }
    if (left.every((_, i) => assign(i, new Set()))) {
      const next = [];
      for (const [j, i] of assigned) next[i] = right[j];
      right = next;
    }
  }
  const fs = [],
    winners = [];
  let id = -1,
    previous = [];
  for (let i = 0; i < size; i += 2) {
    const f = {
      id: id--,
      stage: size === 2 ? "final" : "knockout",
      pool: "W",
      a: ids[positions[i] - 1] || null,
      b: right[i / 2],
      status: "ready",
    };
    fs.push(f);
    previous.push(f.id);
  }
  winners.push(previous);
  while (previous.length > 1) {
    const next = [];
    for (let i = 0; i < previous.length; i += 2) {
      const f = {
        id: id--,
        stage: previous.length === 2 ? "final" : "knockout",
        pool: "W",
        source_a: JSON.stringify({ fixture: previous[i], outcome: "winner" }),
        source_b: JSON.stringify({
          fixture: previous[i + 1],
          outcome: "winner",
        }),
        status: "waiting",
      };
      fs.push(f);
      next.push(f.id);
    }
    previous = next;
    winners.push(previous);
  }
  if (c.settings.elimination === "double") {
    const ref = (fixture, outcome = "winner") =>
      JSON.stringify({ fixture, outcome });
    const make = (a, b, pool = "L", conditional = 0) => {
      const f = {
        id: id--,
        stage: "knockout",
        pool,
        source_a: a,
        source_b: b,
        status: "waiting",
        conditional,
      };
      fs.push(f);
      return ref(f.id);
    };
    let lower = [];
    if (size === 2) lower = [ref(winners[0][0], "loser")];
    else {
      for (let i = 0; i < winners[0].length; i += 2)
        lower.push(
          make(ref(winners[0][i], "loser"), ref(winners[0][i + 1], "loser")),
        );
      for (let r = 1; r < winners.length; r++) {
        const drops = winners[r].map((f) => ref(f, "loser")).reverse();
        lower = lower.map((a, i) => make(a, drops[i]));
        if (r < winners.length - 1) {
          const next = [];
          for (let i = 0; i < lower.length; i += 2)
            next.push(make(lower[i], lower[i + 1]));
          lower = next;
        }
      }
    }
    const grand = make(ref(previous[0]), lower[0], "G");
    const grandId = JSON.parse(grand).fixture;
    make(grand, ref(grandId, "loser"), "G", 1);
  }
  return fs;
}
function simulate(c, ratings, football, drawRate, random) {
  const tables = Object.fromEntries(
    Object.entries(c.standings).map(([pool, rows]) => [pool, cloneRows(rows)]),
  );
  const prelim = c.fixtures.filter(preliminary),
    outcomes = prelim.filter(terminal);
  for (const f of prelim.filter((f) => !terminal(f))) {
    const sampled = sampleFixture(f, ratings, football, drawRate, random, c);
    addResult(tables[f.pool], sampled, football);
    outcomes.push(sampled);
  }
  for (const [pool, rows] of Object.entries(tables))
    tables[pool] = rankTable(
      rows,
      outcomes.filter((f) => f.pool === pool),
      c.settings.tieBreaks,
      football,
      random,
    );
  let selected = [];
  if (c.kind !== "knockout") {
    // Simulated equal rows use fair lots; actual qualification remains pending.
    const loose = Object.fromEntries(
      Object.entries(tables).map(([pool, rows]) => [
        pool,
        rows.map((r) => ({ ...r, tiedWithPrevious: false })),
      ]),
    );
    const simulatedDecisions = { ...(c.qualifications || {}) };
    if (prelim.every(terminal))
      for (const [pool, round] of new Map(
        (c.settings.tieRounds || []).map((round) => [round.pool, round]),
      )) {
        if (simulatedDecisions[pool]) continue;
        const games = c.fixtures.filter((f) => round.fixtures.includes(f.id));
        const ids = [
          ...new Set(games.flatMap((f) => [f.a, f.b]).filter(Boolean)),
        ];
        const rows = ids.map((entry) => ({
          entry,
          played: 0,
          w: 0,
          d: 0,
          l: 0,
          for: 0,
          against: 0,
          points_difference: 0,
        }));
        const results = games.map((f) =>
          terminal(f)
            ? f
            : sampleFixture(f, ratings, football, drawRate, random, c),
        );
        for (const f of results) addResult(rows, f, football);
        const ranked = rankTable(
          rows,
          results,
          c.settings.tieBreaks,
          football,
          random,
        );
        simulatedDecisions[pool] = [
          ...round.guaranteed,
          ...ranked
            .slice(0, round.count - round.guaranteed.length)
            .map((r) => r.entry),
        ];
      }
    if (prelim.every(terminal))
      for (const [pool, rows] of Object.entries(loose)) {
        const chosen = simulatedDecisions[pool];
        if (chosen)
          rows.sort(
            (a, b) =>
              Number(chosen.includes(b.entry)) -
                Number(chosen.includes(a.entry)) || a.position - b.position,
          );
        const extra = c.qualifications?.["@place:" + pool]?.[0];
        if (extra) {
          const i = rows.findIndex((r) => r.entry === extra),
            at = c.settings.extraPlace - 1;
          if (i >= 0) [rows[i], rows[at]] = [rows[at], rows[i]];
        }
        rows.forEach((r, i) => (r.position = i + 1));
      }
    const plan = qualificationPlan(c, loose, simulatedDecisions);
    selected = plan.direct;
    if (effectiveExtra(c)) {
      const cross = crossGroupTable(
        plan.extraTable,
        { extraTieBreaks: c.settings.extraTieBreaks || ["difference", "for"] },
        random,
      );
      selected = [
        ...plan.direct,
        ...cross.slice(0, c.settings.extraCount).map((r) => r.entry),
      ];
      const fixed = c.qualifications?.["@extra"];
      if (fixed) selected = [...plan.direct, ...fixed];
    }
  }
  if (c.kind === "league" && !c.settings.playoffs)
    return { champion: c.champion || selected[0], selected: [], next: [] };
  let fs = c.fixtures.filter(knockout);
  if (!fs.length) fs = hypotheticalBracket(selected, tables, c);
  const resolved = new Map(),
    first = new Set(),
    next = [];
  let champion = null;
  for (let pass = 0; pass < 32; pass++) {
    let changed = false;
    for (const original of fs) {
      if (resolved.has(original.id)) continue;
      const f = { ...original };
      let ready = true;
      for (const side of ["a", "b"])
        if (f["source_" + side]) {
          const source = JSON.parse(f["source_" + side]),
            parent = resolved.get(source.fixture);
          if (!parent) {
            ready = false;
            break;
          }
          f[side] = parent[source.outcome];
        }
      if (!ready) continue;
      if (f.conditional) {
        const parent = resolved.get(JSON.parse(f.source_a).fixture);
        if (parent.winner !== parent.b) {
          resolved.set(f.id, { ...f, status: "cancelled" });
          changed = true;
          continue;
        }
      }
      const sample = terminal(f)
        ? f
        : sampleFixture(f, ratings, football, drawRate, random, c);
      if (!terminal(f))
        for (const entry of [sample.a, sample.b].filter(Boolean))
          if (!first.has(entry)) {
            first.add(entry);
            if (sample.winner === entry) next.push(entry);
          }
      resolved.set(f.id, sample);
      changed = true;
      if (sample.status !== "cancelled") champion = sample.winner;
    }
    if (!changed) break;
  }
  return { champion: c.champion || champion, selected, next };
}
function proofGroup(c, rows, fixtures, football) {
  const remaining = fixtures.filter((f) => !terminal(f)),
    completed = fixtures.filter(terminal),
    n = rows.length;
  const limits = new Map(
    rows.map((r) => [
      r.entry,
      {
        min: n,
        max: 1,
        minPoints: Infinity,
        maxPoints: -Infinity,
        extraMin: Infinity,
        extraMax: -Infinity,
      },
    ]),
  );
  if (remaining.length > 8) {
    for (const r of rows) {
      const count = remaining.filter(
        (f) => f.a === r.entry || f.b === r.entry,
      ).length;
      const min = r.points,
        max = min + count * (football ? 3 : 1);
      const above = rows.filter(
        (o) => o.entry !== r.entry && o.points > max,
      ).length;
      const below = rows.filter(
        (o) =>
          o.entry !== r.entry &&
          o.points +
            remaining.filter((f) => f.a === o.entry || f.b === o.entry).length *
              (football ? 3 : 1) <
            min,
      ).length;
      limits.set(r.entry, {
        min: 1 + above,
        max: n - below,
        minPoints: min,
        maxPoints: max,
        extraMin: min,
        extraMax: max,
      });
    }
    return limits;
  }
  const projected = cloneRows(rows),
    all = [...completed];
  const bounds = new Map(
    rows.map((r) => [
      r.entry,
      {
        difference: [r.difference, r.difference],
        for: [r.for, r.for],
        sets_difference: [r.sets_difference, r.sets_difference],
        points_difference: [r.points_difference, r.points_difference],
      },
    ]),
  );
  function compare(a, b) {
    if (a.points !== b.points) return a.points > b.points ? 1 : -1;
    for (const key of c.settings.tieBreaks) {
      const x =
          key === "head_to_head"
            ? [a.head_to_head, a.head_to_head]
            : bounds.get(a.entry)[key],
        y =
          key === "head_to_head"
            ? [b.head_to_head, b.head_to_head]
            : bounds.get(b.entry)[key];
      if (x[0] > y[1]) return 1;
      if (x[1] < y[0]) return -1;
      if (x[0] !== x[1] || y[0] !== y[1] || x[0] !== y[0]) return 0;
    }
    return 0;
  }
  function visit(i) {
    if (i === remaining.length) {
      const ranked = rankTable(
        cloneRows(projected),
        all,
        c.settings.tieBreaks,
        football,
      );
      for (const r of ranked) {
        const min =
            1 +
            ranked.filter((o) => o.entry !== r.entry && compare(o, r) > 0)
              .length,
          max =
            n -
            ranked.filter((o) => o.entry !== r.entry && compare(r, o) > 0)
              .length,
          l = limits.get(r.entry);
        l.min = Math.min(l.min, min);
        l.max = Math.max(l.max, max);
        l.minPoints = Math.min(l.minPoints, r.points);
        l.maxPoints = Math.max(l.maxPoints, r.points);
        if (min <= c.settings.extraPlace && max >= c.settings.extraPlace) {
          l.extraMin = Math.min(l.extraMin, r.points);
          l.extraMax = Math.max(l.extraMax, r.points);
        }
      }
      return;
    }
    const f = remaining[i],
      a = projected.find((r) => r.entry === f.a),
      b = projected.find((r) => r.entry === f.b);
    for (const winner of football ? [f.a, null, f.b] : [f.a, f.b]) {
      const saved = [{ ...a }, { ...b }],
        savedBounds = [
          structuredClone(bounds.get(a.entry)),
          structuredClone(bounds.get(b.entry)),
        ];
      if (winner === a.entry) {
        a.w++;
        b.l++;
      } else if (winner === b.entry) {
        b.w++;
        a.l++;
      } else {
        a.d++;
        b.d++;
      }
      const max = football ? 99 : Math.ceil(c.settings.bestOf / 2);
      for (const row of [a, b]) {
        const bound = bounds.get(row.entry),
          sign = winner == null ? 0 : winner === row.entry ? 1 : -1;
        for (const key of ["difference", "sets_difference"]) {
          bound[key][0] += sign < 0 ? -max : 0;
          bound[key][1] += sign > 0 ? max : 0;
        }
        // Forfeits can award the win without a score margin or scores for.
        bound.for[1] += football ? 99 : max;
        bound.points_difference[0] -= 1000000000;
        bound.points_difference[1] += 1000000000;
      }
      all.push({ ...f, winner });
      visit(i + 1);
      all.pop();
      Object.assign(a, saved[0]);
      Object.assign(b, saved[1]);
      bounds.set(a.entry, savedBounds[0]);
      bounds.set(b.entry, savedBounds[1]);
    }
  }
  visit(0);
  return limits;
}
export function competitionForecast(
  c,
  { ratings = {}, football = false, drawRate = 0.2, iterations = 2000 } = {},
) {
  const active = c.entries.filter((e) => !e.withdrawn),
    rows = active.map((e) => ({
      entry: e.id,
      title: 0,
      qualification: 0,
      next_round: 0,
      status: "contending",
      group_winner: false,
    }));
  if (!c.fixtures.length)
    return {
      available: false,
      rows: [],
      reason: "Chances appear after the draw is generated.",
    };
  const totalSteps = Math.max(1, c.fixtures.length + active.length * 2);
  iterations = Math.min(
    iterations,
    Math.max(100, Math.floor(500000 / totalSteps)),
  );
  const random = randomSource(
    JSON.stringify([
      c.id,
      c.settings,
      c.fixtures.map((f) => [
        f.id,
        f.a,
        f.b,
        f.stage,
        f.pool,
        f.source_a,
        f.source_b,
        f.status,
        f.winner,
        f.loser,
        f.a_score,
        f.b_score,
        f.conditional,
      ]),
      c.qualifications,
      ratings,
    ]),
  );
  const counts = new Map(rows.map((r) => [r.entry, r]));
  for (let i = 0; i < iterations; i++) {
    const simulation = simulate(c, ratings, football, drawRate, random);
    if (counts.has(simulation.champion))
      counts.get(simulation.champion).title++;
    for (const id of simulation.selected)
      if (counts.has(id)) counts.get(id).qualification++;
    for (const id of simulation.next)
      if (counts.has(id)) counts.get(id).next_round++;
  }
  const proofs = new Map(),
    poolFor = new Map();
  for (const [pool, table] of Object.entries(c.standings)) {
    const groupProof = proofGroup(
      c,
      table,
      c.fixtures.filter((f) => preliminary(f) && f.pool === pool),
      football,
    );
    for (const [id, proof] of groupProof) {
      proofs.set(id, proof);
      poolFor.set(id, pool);
    }
  }
  const hasNext = c.kind === "groups" || c.settings.playoffs;
  const threshold =
    c.kind === "groups"
      ? c.settings.advance
      : c.settings.playoffs
        ? c.settings.playoffCount
        : 1;
  const plan = qualificationPlan(c, c.standings, c.qualifications || {}),
    hasBracket = c.fixtures.some(knockout);
  const prelimDone = c.fixtures.filter(preliminary).every(terminal),
    qualified = new Set(plan.selected);
  for (const row of rows) {
    row.title /= iterations;
    row.qualification = hasNext ? row.qualification / iterations : null;
    row.next_round = c.kind === "knockout" ? row.next_round / iterations : null;
    const proof = proofs.get(row.entry);
    if (proof) {
      row.group_winner = c.kind === "groups" && proof.max === 1;
      let through = proof.max <= threshold,
        out = proof.min > threshold;
      if (effectiveExtra(c) && out) {
        const place = c.settings.extraPlace,
          eligible = proof.min <= place && proof.max >= place;
        if (!eligible) out = true;
        else {
          const otherPools = Object.entries(c.standings).filter(
            ([pool]) => pool !== poolFor.get(row.entry),
          );
          const maxOthers = otherPools.map(([, rs]) =>
            Math.max(...rs.map((r) => proofs.get(r.entry).extraMax)),
          );
          const minOthers = otherPools.map(([, rs]) =>
            Math.min(
              ...rs
                .filter(
                  (r) =>
                    proofs.get(r.entry).min <= place &&
                    proofs.get(r.entry).max >= place,
                )
                .map((r) => proofs.get(r.entry).extraMin),
            ),
          );
          const guaranteedAhead = minOthers.filter(
            (min) => min > proof.extraMax,
          ).length;
          const possiblyAhead = maxOthers.filter(
            (max) => max >= proof.extraMin,
          ).length;
          out = guaranteedAhead >= c.settings.extraCount;
          through =
            proof.min === place &&
            proof.max === place &&
            possiblyAhead < c.settings.extraCount;
        }
      } else if (effectiveExtra(c) && !through) {
        // An entrant can still alternate between a direct and extra berth.
        out = false;
      }
      if (prelimDone && !plan.pending.length) {
        through = qualified.has(row.entry);
        out = !through;
      }
      if (through) {
        row.status = hasNext ? "qualified" : "champion";
        if (!hasNext) row.title = 1;
        if (hasNext) row.qualification = 1;
      }
      if (out) {
        row.status = "eliminated";
        row.title = 0;
        if (hasNext) row.qualification = 0;
      }
    }
    const reentry = Math.max(
      0,
      ...c.fixtures
        .filter((f) => knockout(f) && f.no_contest && f.winner === row.entry)
        .map((f) => f.id),
    );
    const noContestElimination = c.fixtures.some(
      (f) =>
        knockout(f) &&
        f.no_contest &&
        f.id > reentry &&
        [f.a, f.b].includes(row.entry),
    );
    const losses = c.fixtures.filter(
      (f) =>
        knockout(f) &&
        f.status === "completed" &&
        f.id > reentry &&
        f.loser === row.entry,
    ).length;
    if (
      (c.kind === "knockout" || hasBracket) &&
      (noContestElimination ||
        losses >= (c.settings.elimination === "double" ? 2 : 1))
    ) {
      row.status = "eliminated";
      row.title = 0;
      row.next_round = c.kind === "knockout" ? 0 : row.next_round;
    }
    if (hasBracket && hasNext) {
      row.qualification = qualified.has(row.entry) ? 1 : 0;
      if (!qualified.has(row.entry)) {
        row.status = "eliminated";
        row.title = 0;
      }
    }
    if (c.champion) {
      row.status = c.champion === row.entry ? "champion" : "eliminated";
      row.title = c.champion === row.entry ? 1 : 0;
      row.next_round = null;
    }
  }
  // Sampling sums to one; eliminating impossible outcomes must not create drift.
  const sum = rows.reduce((n, r) => n + r.title, 0);
  if (sum > 0) for (const row of rows) row.title /= sum;
  return {
    available: true,
    iterations,
    model: "Current Elo, simulated remaining results and configured tiebreaks",
    qualification_label: hasNext
      ? "Reach knockout"
      : c.kind === "knockout"
        ? "Win next match"
        : null,
    rows,
  };
}
