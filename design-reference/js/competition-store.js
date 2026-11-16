(function () {
  const PREFIX = "mimelo.competitions.v1.";

  const initials = (name) => String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  function read(slug) {
    try {
      const raw = localStorage.getItem(PREFIX + slug);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.filter(isCompetition) : [];
    } catch (err) {
      return [];
    }
  }

  function write(slug, list) {
    try {
      localStorage.setItem(PREFIX + slug, JSON.stringify(list));
      return true;
    } catch (err) {
      return false;
    }
  }

  function isCompetition(c) {
    return c && typeof c.id === "string" && typeof c.name === "string" && c.data && Array.isArray(c.data.fixtures);
  }

  function uid() {
    return "custom-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
  }

  function rows(players) {
    return players.map((p, i) => ({
      p: i + 1,
      name: p.name,
      initials: p.initials || initials(p.name),
      pld: 0,
      w: 0,
      d: 0,
      l: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      pts: 0,
      form: ""
    }));
  }

  function roundRobin(items) {
    const list = items.slice();
    if (list.length % 2) list.push(null);
    const n = list.length;
    const rounds = [];
    for (let r = 0; r < n - 1; r++) {
      const pairs = [];
      for (let i = 0; i < n / 2; i++) {
        const a = list[i];
        const b = list[n - 1 - i];
        if (a && b) pairs.push(r % 2 ? [b, a] : [a, b]);
      }
      rounds.push(pairs);
      list.splice(1, 0, list.pop());
    }
    return rounds;
  }

  function fixture(stage, home, away, round, extra) {
    return Object.assign({
      date: "TBD",
      stage: stage,
      home: home,
      away: away,
      score: "—",
      status: "scheduled",
      round: round
    }, extra || {});
  }

  function leagueData(players, legs) {
    const rounds = [];
    const base = roundRobin(players);
    for (let leg = 0; leg < legs; leg++) {
      base.forEach((pairs) => {
        rounds.push({
          matchday: rounds.length + 1,
          pairs: leg === 0 ? pairs : pairs.map((pair) => [pair[1], pair[0]])
        });
      });
    }
    const fixtures = [];
    rounds.forEach((r) => {
      r.pairs.forEach((pair) => {
        fixtures.push(fixture("Matchday " + r.matchday, pair[0].name, pair[1].name, r.matchday));
      });
    });
    return { standings: rows(players), groups: null, bracket: null, fixtures: fixtures, matchdays: rounds.length };
  }

  function seedOrder(size) {
    let order = [1];
    while (order.length < size) {
      const next = [];
      const n = order.length * 2 + 1;
      order.forEach((seed) => { next.push(seed, n - seed); });
      order = next;
    }
    return order;
  }

  function roundMeta(matchCount) {
    if (matchCount === 1) return { title: "Final", code: "F" };
    if (matchCount === 2) return { title: "Semifinals", code: "SF" };
    if (matchCount === 4) return { title: "Quarterfinals", code: "QF" };
    return { title: "Round of " + matchCount * 2, code: "R" + matchCount * 2 };
  }

  function knockoutBracket(players) {
    let size = 1;
    while (size < players.length) size *= 2;
    const slots = seedOrder(size).map((seed) => players[seed - 1] || null);
    const rounds = [];
    let count = size / 2;
    let meta = roundMeta(count);
    let current = [];
    for (let i = 0; i < slots.length; i += 2) {
      const home = slots[i];
      const away = slots[i + 1];
      const bye = !home || !away;
      current.push({
        code: meta.code + (i / 2 + 1),
        home: home ? home.name : "TBD",
        away: away ? away.name : "Bye",
        score: "",
        status: bye ? "bye" : "scheduled",
        winner: bye ? (home || away || {}).name || null : null,
        bye: bye
      });
    }
    rounds.push({ title: meta.title, matches: current });
    while (count > 1) {
      const nextCount = count / 2;
      meta = roundMeta(nextCount);
      const next = [];
      for (let i = 0; i < nextCount; i++) {
        const homeMatch = current[i * 2];
        const awayMatch = current[i * 2 + 1];
        next.push({
          code: meta.code + (i + 1),
          home: homeMatch.winner || "Winner " + homeMatch.code,
          away: awayMatch.winner || "Winner " + awayMatch.code,
          score: "",
          status: "scheduled",
          winner: null,
          bye: false
        });
      }
      rounds.push({ title: meta.title, matches: next });
      current = next;
      count = nextCount;
    }
    return { size: size, rounds: rounds };
  }

  function bracketFixtures(bracket) {
    const fixtures = [];
    bracket.rounds.forEach((round, index) => {
      round.matches.forEach((match) => {
        if (match.bye) return;
        fixtures.push(fixture(round.title, match.home, match.away, index + 1));
      });
    });
    return fixtures;
  }

  function doubleBracket(players) {
    let size = 2;
    while (size < players.length) size *= 2;
    const slots = seedOrder(size).map((seed) => players[seed - 1] ? players[seed - 1].name : null);
    const winners = [], losers = [];
    const win = (m) => m.bye ? m.winner : "Winner " + m.code;
    const lose = (m) => m.bye ? null : "Loser " + m.code;
    function match(code, home, away) {
      const bye = !home || !away;
      return { code, home: home || "Bye", away: away || "Bye", score: "", bye,
        winner: bye ? home || away : null, status: bye ? "bye" : "scheduled" };
    }
    let entrants = slots, r = 1;
    while (entrants.length > 1) {
      const matches = [];
      for (let i = 0; i < entrants.length; i += 2) matches.push(match("W" + r + "-" + (i / 2 + 1), entrants[i], entrants[i + 1]));
      winners.push({ title: entrants.length === 2 ? "Winners final" : "Winners round " + r, matches });
      entrants = matches.map(win); r++;
    }
    let survivors;
    if (size === 2) survivors = [lose(winners[0].matches[0])];
    else {
      const drops = winners[0].matches.map(lose);
      let lr = 1;
      function lower(inputs) {
        const matches = [];
        for (let i = 0; i < inputs.length; i += 2) matches.push(match("L" + lr + "-" + (i / 2 + 1), inputs[i], inputs[i + 1]));
        losers.push({ title: "Losers round " + lr++, matches });
        return matches.map(win);
      }
      survivors = lower(drops);
      for (let w = 1; w < winners.length; w++) {
        const incoming = winners[w].matches.map(lose).reverse();
        const inputs = survivors.flatMap((name, i) => [name, incoming[i]]);
        survivors = lower(inputs);
        if (w < winners.length - 1) survivors = lower(survivors);
      }
    }
    const final = match("GF", win(winners[winners.length - 1].matches[0]), survivors[0]);
    const reset = match("RESET", final.home, final.away);
    reset.reset = true; reset.status = "conditional";
    return { size, type: "double", winners, losers, grand: { title: "Grand finals", matches: [final, reset] } };
  }

  function makeBracket(players, elimination) {
    return elimination === "double" ? doubleBracket(players) : knockoutBracket(players);
  }

  function allRounds(bracket) {
    return bracket.type === "double" ? [...bracket.winners, ...bracket.losers, bracket.grand] : bracket.rounds;
  }

  function scheduleBracket(bracket, offset = 0) {
    return allRounds(bracket).flatMap((round, i) => round.matches.filter((m) => !m.bye).map((m) =>
      fixture(round.title + (m.reset ? " · reset if needed" : ""), m.home, m.away, offset + i + 1,
        { code: m.code, status: m.reset ? "conditional" : "scheduled" })));
  }

  function groupData(players, count, advance, elimination) {
    const buckets = Array.from({ length: count }, () => []);
    players.forEach((p, i) => {
      const row = Math.floor(i / count), column = i % count;
      buckets[row % 2 ? count - 1 - column : column].push(p);
    });
    const groups = {}, fixtures = [];
    let days = 0;
    const label = (i) => {
      let n = i + 1, result = "";
      while (n) { n--; result = String.fromCharCode(65 + n % 26) + result; n = Math.floor(n / 26); }
      return result;
    };
    buckets.forEach((bucket, i) => {
      const name = label(i);
      groups[name.toLowerCase()] = rows(bucket);
      const rounds = roundRobin(bucket);
      days = Math.max(days, rounds.length);
      rounds.forEach((pairs, day) => pairs.forEach(([home, away]) => fixtures.push(fixture("Group " + name + " · Matchday " + (day + 1), home.name, away.name, day + 1))));
    });
    const qualifiers = [];
    for (let place = 1; place <= advance; place++) {
      for (let i = 0; i < count; i++) qualifiers.push({ name: "Group " + label(i) + " #" + place });
    }
    const bracket = makeBracket(qualifiers, elimination);
    fixtures.push(...scheduleBracket(bracket, days));
    return { standings: [], groups, bracket, fixtures, matchdays: days + allRounds(bracket).length };
  }

  function generate(opts, players) {
    if (players.length < 2) throw new Error("Select at least 2 players.");
    const seeding = ["manual", "preseeded"].includes(opts.seeding) ? opts.seeding : "elo";
    const sorted = players.slice();
    if (seeding === "manual") {
      const order = (opts.seedOrder || []).map(String);
      if (new Set(order).size !== order.length || players.some(p => !order.includes(String(p.id)))) throw new Error("Give each selected player one place in the seed order.");
      sorted.sort((a, b) => order.indexOf(String(a.id)) - order.indexOf(String(b.id)));
    } else if (seeding === "preseeded") {
      const values = players.map(p => Number((opts.seeds || {})[p.id]));
      if (values.some(n => !Number.isInteger(n) || n < 1) || new Set(values).size !== values.length) throw new Error("Enter a unique positive whole-number seed for every selected player.");
      sorted.sort((a, b) => opts.seeds[a.id] - opts.seeds[b.id]);
    } else sorted.sort((a, b) => b.elo - a.elo);
    const elimination = opts.elimination === "double" ? "double" : "single";
    const eliminationLabel = elimination === "double" ? "Double elimination" : "Single elimination";
    let kind = "League", format, data, rounds, blurb;
    if (opts.format === "groups") {
      const count = Number(opts.groupCount), advance = Number(opts.advance);
      if (!Number.isInteger(count) || count < 1 || count > Math.floor(players.length / 2))
        throw new Error("Choose a whole number of groups with at least 2 players in each.");
      if (!Number.isInteger(advance) || advance < 1 || advance > Math.floor(players.length / count) || advance * count < 2)
        throw new Error("Choose qualifiers that fit every group and send at least 2 players to the bracket.");
      data = groupData(sorted, count, advance, elimination);
      kind = "Tournament"; format = "Groups + " + eliminationLabel.toLowerCase(); rounds = 2;
      blurb = Object.entries(data.groups).map(([key, group]) => "Group " + key.toUpperCase() + ": " + group.length).join(" · ") +
        " players · top " + advance + " per group advance (" + count * advance + " total) · " + eliminationLabel.toLowerCase() + ".";
    } else if (opts.format === "knockout") {
      const bracket = makeBracket(sorted, elimination);
      data = { standings: [], groups: null, bracket, fixtures: scheduleBracket(bracket), matchdays: allRounds(bracket).length };
      kind = "Tournament"; format = eliminationLabel; rounds = data.matchdays;
      blurb = sorted.length + " players · " + eliminationLabel.toLowerCase() + " · seeded field · " + (bracket.size - sorted.length) + " first-round byes.";
    } else {
      const legs = Number(opts.legs) === 2 ? 2 : 1;
      data = leagueData(sorted, legs); rounds = legs;
      format = legs === 2 ? "Double round robin" : "Single round robin";
      blurb = sorted.length + " players · " + format.toLowerCase() + " · " + data.fixtures.length + " fixtures.";
    }
    const playoffs = opts.format === "league" && !!opts.playoffs;
    if (playoffs) {
      const count = Number(opts.playoffCount);
      if (!Number.isInteger(count) || count < 2 || count > players.length) throw new Error("Choose 2 to " + players.length + " league finishers for playoffs.");
      const qualifiers = Array.from({ length: count }, (_, i) => ({ name: "League #" + (i + 1) }));
      data.bracket = makeBracket(qualifiers, elimination);
      data.fixtures.push(...scheduleBracket(data.bracket, data.matchdays));
      data.matchdays += allRounds(data.bracket).length;
      format += " + playoffs";
      rounds += allRounds(data.bracket).length;
      blurb += " Top " + count + " league finishers qualify for " + eliminationLabel.toLowerCase() + " playoffs, seeded by final league position.";
    }
    blurb += " Initial seeding: " + (seeding === "elo" ? "Elo" : seeding === "manual" ? "manual order" : "pre-seeded numbers") + ".";
    if ((opts.format !== "league" || playoffs) && elimination === "double") blurb += " Includes a conditional grand-final reset.";
    return {
      id: uid(), name: opts.name, kind, format, players: players.length, fixtures: data.fixtures.length,
      played: 0, leader: "—", elo: !!opts.elo, status: "Scheduled", matchdays: data.matchdays,
      rounds, blurb, custom: true, createdAt: new Date().toISOString(),
      settings: { elimination, groupCount: opts.groupCount, advance: opts.advance, playoffs, playoffCount: playoffs ? Number(opts.playoffCount) : null, seeding,
        seeds: sorted.map((p, i) => ({ playerId: p.id, name: p.name, seed: seeding === "preseeded" ? Number(opts.seeds[p.id]) : i + 1 })) },
      data: { standings: data.standings, groups: data.groups, bracket: data.bracket, fixtures: data.fixtures }
    };
  }

  function save(slug, competition) {
    const list = read(slug);
    list.push(competition);
    return write(slug, list);
  }

  function remove(slug, id) {
    return write(slug, read(slug).filter((c) => c.id !== id));
  }

  function find(slug, id) {
    return read(slug).find((c) => c.id === id) || null;
  }

  function merge(target, slug) {
    const existing = new Set((target.competitions || []).map((c) => c.id));
    read(slug).forEach((competition) => {
      if (!existing.has(competition.id)) target.competitions.push(competition);
    });
    return target;
  }

  window.COMP_STORE = {
    replace: (slug, c) => write(slug, read(slug).map(x => x.id === c.id ? c : x)),
    read: read,
    save: save,
    remove: remove,
    find: find,
    merge: merge,
    generate: generate
  };
})();

