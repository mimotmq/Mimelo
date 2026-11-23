import { lowerIsBetter } from "../static/js/standings-stats.js";
export const orderedCriteria = (criteria) =>
  criteria.includes("points") ? criteria : ["points", ...criteria];
function compareStat(a, b, key) {
  return lowerIsBetter(key) ? a[key] - b[key] : b[key] - a[key];
}
export function rankTable(rows, fixtures, criteria, football, random = null) {
  const by = new Map(rows.map((r) => [r.entry, r]));
  for (const row of rows) {
    row.points = football ? row.w * 3 + row.d : row.w;
    row.pct = row.played
      ? (row.w + (row.d + (row.nc || 0)) / 2) / row.played
      : 0;
    row.difference = row.for - row.against;
    row.sets_difference = row.difference;
    row.head_to_head = 0;
  }
  const order = orderedCriteria(criteria);
  const beforeH2H = order.slice(0, order.indexOf("head_to_head"));
  for (const f of order.includes("head_to_head") ? fixtures : []) {
    if (f.no_contest) continue;
    const a = by.get(f.a),
      b = by.get(f.b);
    if (!a || !b || beforeH2H.some((key) => a[key] !== b[key])) continue;
    if (f.winner === a.entry) a.head_to_head += football ? 3 : 1;
    else if (f.winner === b.entry) b.head_to_head += football ? 3 : 1;
    else if (football) {
      a.head_to_head++;
      b.head_to_head++;
    }
  }
  const compare = (a, b) => {
    for (const key of order)
      if (a[key] !== b[key]) return compareStat(a, b, key);
    return 0;
  };
  // Resolve otherwise identical projected rows without favouring an entry ID.
  const lots = random ? new Map(rows.map((r) => [r.entry, random()])) : null;
  rows.sort(
    (a, b) =>
      compare(a, b) ||
      (lots ? lots.get(a.entry) - lots.get(b.entry) : a.entry - b.entry),
  );
  return rows.map((r, i) => ({
    ...r,
    position: i + 1,
    tiedWithPrevious: i > 0 && compare(rows[i - 1], r) === 0,
  }));
}

export function boundary(rows, count, pool, decisions = {}) {
  let start = count - 1,
    end = count;
  if (!rows[count]?.tiedWithPrevious)
    return { selected: rows.slice(0, count).map((r) => r.entry) };
  while (start > 0 && rows[start].tiedWithPrevious) start--;
  while (rows[end + 1]?.tiedWithPrevious) end++;
  const fixed = rows.slice(0, start).map((r) => r.entry),
    allowed = rows.slice(start, end + 1).map((r) => r.entry);
  const chosen = decisions[pool];
  if (
    chosen?.length === count &&
    new Set(chosen).size === count &&
    fixed.every((id) => chosen.includes(id)) &&
    chosen.every((id) => fixed.includes(id) || allowed.includes(id))
  )
    return { selected: chosen };
  return { selected: [], pending: { pool, count, fixed, allowed, rows } };
}
export function crossGroupTable(tables, settings, random = null) {
  const compare = (a, b) => {
    for (const key of ["points", ...settings.extraTieBreaks])
      if (a[key] !== b[key]) return compareStat(a, b, key);
    return 0;
  };
  const rows = [...tables],
    lots = random ? new Map(rows.map((r) => [r.entry, random()])) : null;
  rows.sort(
    (a, b) =>
      compare(a, b) ||
      (lots ? lots.get(a.entry) - lots.get(b.entry) : a.entry - b.entry),
  );
  return rows.map((r, i) => ({
    ...r,
    group_position: r.position,
    position: i + 1,
    tiedWithPrevious: i > 0 && compare(rows[i - 1], r) === 0,
  }));
}
function conferencePlan(c, rows, decisions) {
  const pending = [],
    seeds = [];
  // Keep the ordering the standings engine computed, rebuilding ties after subsetting.
  const subset = (ids) => {
    const chosen = rows.filter((row) => ids.includes(row.entry));
    return chosen.map((r, i) => ({
      ...r,
      position: i + 1,
      tiedWithPrevious:
        i > 0 &&
        r.tiedWithPrevious &&
        rows
          .slice(rows.indexOf(chosen[i - 1]) + 1, rows.indexOf(r) + 1)
          .every((x) => x.tiedWithPrevious),
    }));
  };
  function choose(ids, count, key, label) {
    const ranked = subset(ids);
    const decision = boundary(ranked, count, key, decisions);
    if (decision.pending) pending.push({ ...decision.pending, label });
    return decision.selected;
  }
  for (const [i, conf] of c.settings.conferenceLayout.conferences.entries()) {
    const winners = conf.divisions.flatMap((div, j) =>
      choose(
        div.entries,
        1,
        `@division-${i}-${j}`,
        conf.name + " · " + div.name + " winner",
      ),
    );
    const ids = conf.divisions.flatMap((div) => div.entries);
    const wildcardCount = c.settings.conferenceLayout.wildcards;
    const extras =
      wildcardCount && winners.length === conf.divisions.length
        ? choose(
            ids.filter((id) => !winners.includes(id)),
            wildcardCount,
            `@wildcards-${i}`,
            conf.name + " wild cards",
          )
        : [];
    seeds.push([...subset(winners), ...subset(extras)].map((r) => r.entry));
  }
  return {
    direct: seeds.flat(),
    extra: [],
    extraTable: [],
    pending,
    selected: seeds.flat(),
    conferenceSeeds: seeds,
  };
}
export function qualificationPlan(c, tables, decisions = {}) {
  if (c.kind === "league" && c.settings.conferenceLayout && tables[""]?.length)
    return conferencePlan(c, tables[""], decisions);
  const direct = [],
    pending = [],
    candidates = [];
  const count =
    c.kind === "groups"
      ? c.settings.advance
      : c.settings.playoffs
        ? c.settings.playoffCount
        : 1;
  for (const [pool, rows] of Object.entries(tables)) {
    const selection = boundary(rows, count, pool, decisions);
    if (selection.pending) pending.push(selection.pending);
    direct.push(
      ...selection.selected.map((entry) => ({
        entry,
        pool,
        position: rows.find((r) => r.entry === entry).position,
      })),
    );
    if (c.kind !== "groups" || !c.settings.extraCount || selection.pending)
      continue;
    const at = c.settings.extraPlace - 1;
    if (!rows[at]) continue;
    let start = at,
      end = at;
    while (start > 0 && rows[start].tiedWithPrevious) start--;
    while (rows[end + 1]?.tiedWithPrevious) end++;
    const allowed = rows
      .slice(start, end + 1)
      .filter((r) => !selection.selected.includes(r.entry));
    const key = "@place:" + pool,
      chosen = decisions[key];
    let candidate =
      allowed.length === 1
        ? allowed[0]
        : chosen?.length === 1
          ? allowed.find((r) => r.entry === chosen[0])
          : null;
    if (!candidate)
      pending.push({
        pool: key,
        label: `Group ${pool}: ${c.settings.extraPlace}th-place candidate`,
        count: 1,
        fixed: [],
        allowed: allowed.map((r) => r.entry),
        rows: allowed,
      });
    else
      candidates.push({ ...candidate, pool, position: c.settings.extraPlace });
  }
  const extraTable = crossGroupTable(candidates, {
    extraTieBreaks: c.settings.extraTieBreaks || ["difference", "for"],
  });
  let extra = [];
  if (c.kind === "groups" && c.settings.extraCount && !pending.length) {
    const selection = boundary(
      extraTable,
      c.settings.extraCount,
      "@extra",
      decisions,
    );
    if (selection.pending)
      pending.push({
        ...selection.pending,
        label: "Best-placed qualifiers across groups",
      });
    extra = selection.selected;
  }
  direct.sort(
    (a, b) => a.position - b.position || a.pool.localeCompare(b.pool),
  );
  return {
    direct: direct.map((r) => r.entry),
    extra,
    extraTable,
    pending,
    selected: [...direct.map((r) => r.entry), ...extra],
  };
}
