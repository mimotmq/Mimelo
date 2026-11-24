import { assert, integer } from "./db.js";

export function validateConferences(layout, entryIds) {
  assert(
    layout &&
      Array.isArray(layout.conferences) &&
      layout.conferences.length === 2,
    "Choose two conferences.",
  );
  const used = new Set(),
    conferenceNames = new Set();
  const validName = (s) =>
    typeof s === "string" && s.trim().length > 0 && s.length <= 50;
  assert(
    Number.isInteger(layout.wildcards),
    "Enter a whole number of wild cards.",
  );
  const wildcards = integer(layout.wildcards, 0, 64);
  for (const conference of layout.conferences) {
    assert(
      validName(conference.name) &&
        !conferenceNames.has(conference.name.trim()),
      "Give each conference a distinct name.",
    );
    conferenceNames.add(conference.name.trim());
    assert(
      Array.isArray(conference.divisions) &&
        conference.divisions.length > 0 &&
        conference.divisions.length <= 32,
      "Assign at least one division to each conference.",
    );
    const names = new Set();
    let count = 0;
    for (const division of conference.divisions) {
      assert(
        validName(division.name) && !names.has(division.name.trim()),
        "Division names must be unique within a conference.",
      );
      names.add(division.name.trim());
      assert(
        Array.isArray(division.entries) && division.entries.length >= 2,
        "Assign at least two entrants per division.",
      );
      for (const id of division.entries) {
        assert(
          entryIds.includes(id) && !used.has(id),
          "Assign each current entrant to exactly one division.",
        );
        used.add(id);
        count++;
      }
    }
    assert(
      count >= conference.divisions.length + wildcards,
      "Too many wild cards for a conference.",
    );
  }
  assert(used.size === entryIds.length, "Assign every entrant to a division.");
  if (layout.playoffSeeds !== undefined) {
    const count = layout.conferences.reduce(
      (sum, conf) => sum + conf.divisions.length + wildcards,
      0,
    );
    assert(
      Array.isArray(layout.playoffSeeds) &&
        layout.playoffSeeds.length === count &&
        new Set(layout.playoffSeeds).size === count &&
        layout.playoffSeeds.every((id) => used.has(id)),
      "Assign one distinct entrant to each playoff seed.",
    );
  }
  assert(
    Array.isArray(layout.crossovers) && layout.crossovers.length <= 2048,
    "Invalid crossover schedule.",
  );
  const already = new Set(),
    membership = new Map();
  for (const conf of layout.conferences)
    for (const d of conf.divisions)
      for (const id of d.entries) membership.set(id, d);
  for (const f of layout.crossovers) {
    assert(
      used.has(f.a) &&
        used.has(f.b) &&
        membership.get(f.a) !== membership.get(f.b),
      "Choose crossover opponents from different divisions.",
    );
    assert(Number.isInteger(f.round), "Enter a whole round number.");
    integer(f.round, 1, 999);
    for (const id of [f.a, f.b]) {
      const key = f.round + "/" + id;
      assert(
        !already.has(key),
        "An entrant has two fixtures in the same crossover round.",
      );
      already.add(key);
    }
  }
}

// Interleave conference seeds into the existing mirrored, single-elimination draw.
export function conferenceBracketSeeds(seeds) {
  let slots = 1;
  while (slots < Math.max(...seeds.map((ids) => ids.length))) slots *= 2;
  const positions = (n) => {
    let order = [1];
    while (order.length < n) {
      const size = order.length * 2;
      order = order.flatMap((i) => [i, size + 1 - i]);
    }
    return order;
  };
  const physical = seeds.flatMap((ids) =>
    positions(slots).map((i) => ids[i - 1] ?? null),
  );
  const result = Array(slots * 2);
  positions(slots * 2).forEach((seed, i) => (result[seed - 1] = physical[i]));
  return result;
}

// Fill each entrant's exact quotas. Pair the two groups with the most remaining
// games so a division can never strand all its opponents' remaining slots.
export function conferenceSchedule(layout) {
  const schedule = [],
    played = new Map(),
    weeks = new Map(),
    manual = layout.crossovers;
  const pairKey = (a, b) => [Math.min(a, b), Math.max(a, b)].join("-");
  function add(a, b, round, category) {
    const weekA = weeks.get(a) ?? new Set(),
      weekB = weeks.get(b) ?? new Set();
    if (!round) {
      round = 1;
      while (weekA.has(round) || weekB.has(round)) round++;
    }
    weekA.add(round);
    weekB.add(round);
    weeks.set(a, weekA);
    weeks.set(b, weekB);
    const key = pairKey(a, b);
    played.set(key, (played.get(key) || 0) + 1);
    schedule.push({ a, b, round, category });
  }
  const location = new Map();
  for (const conf of layout.conferences)
    for (const div of conf.divisions)
      for (const id of div.entries) location.set(id, { conf, div });
  for (const f of manual)
    add(
      f.a,
      f.b,
      f.round,
      location.get(f.a).conf === location.get(f.b).conf
        ? "Conference"
        : "Interconference",
    );
  const quotas = layout.games;
  assert(
    quotas &&
      ["division", "conference", "cross"].every(
        (k) => Number.isInteger(quotas[k]) && quotas[k] >= 0 && quotas[k] <= 64,
      ) &&
      quotas.division + quotas.conference + quotas.cross > 0,
    "Enter 0–64 games per category, with at least one regular-season game.",
  );
  function fill(partitions, quota, category) {
    const groups = partitions.map((ids) => ({
      members: ids.map((id) => ({ id, left: quota })),
      left: 0,
    }));
    const by = new Map(groups.flatMap((g) => g.members.map((m) => [m.id, m])));
    for (const f of manual) {
      const type =
        location.get(f.a).conf === location.get(f.b).conf
          ? "Conference"
          : "Interconference";
      if (type === category && by.has(f.a)) {
        by.get(f.a).left--;
        by.get(f.b).left--;
      }
    }
    for (const g of groups) {
      assert(
        g.members.every((m) => m.left >= 0),
        "Manual games exceed the selected quota.",
      );
      g.left = g.members.reduce((n, m) => n + m.left, 0);
    }
    let total = groups.reduce((n, g) => n + g.left, 0);
    assert(
      total % 2 === 0 && groups.every((g) => g.left <= total / 2),
      category +
        " game counts cannot be paired with these entrants and manual fixtures.",
    );
    while (total) {
      groups.sort((a, b) => b.left - a.left);
      const [g, h] = groups;
      const priority = (a, b) => b.left - a.left || a.id - b.id;
      const first = g.members.filter((m) => m.left > 0).sort(priority)[0];
      const second = h.members
        .filter((m) => m.left > 0)
        .sort(
          (a, b) =>
            (played.get(pairKey(first.id, a.id)) || 0) -
              (played.get(pairKey(first.id, b.id)) || 0) || priority(a, b),
        )[0];
      add(first.id, second.id, null, category);
      first.left--;
      second.left--;
      g.left--;
      h.left--;
      total -= 2;
      // Rotate equal-capacity groups to vary opponents over repeated rounds.
      groups.push(groups.shift());
    }
  }
  for (const conf of layout.conferences) {
    for (const d of conf.divisions) {
      // Schedule each complete division round robin before adding partial rounds.
      // A quota of N−1 must pair every opponent once.
      const perCycle = d.entries.length - 1;
      const cycles = Math.floor(quotas.division / perCycle);
      for (let cycle = 0; cycle < cycles; cycle++) {
        const order = [...d.entries];
        if (order.length % 2) order.push(null);
        for (let round = 1; round < order.length; round++) {
          for (let i = 0; i < order.length / 2; i++) {
            const a = order[i],
              b = order[order.length - 1 - i];
            if (a && b) add(a, b, null, "Division");
          }
          order.splice(1, 0, order.pop());
        }
      }
      fill(
        d.entries.map((id) => [id]),
        quotas.division % perCycle,
        "Division",
      );
    }
    fill(
      conf.divisions.map((d) => d.entries),
      quotas.conference,
      "Conference",
    );
  }
  fill(
    layout.conferences.map((c) => c.divisions.flatMap((d) => d.entries)),
    quotas.cross,
    "Interconference",
  );
  return schedule.sort((a, b) => a.round - b.round);
}
