import { assert, integer } from "./db.js";
const n = (v, max = 200) => integer(v, 0, max);
const race = (a, b, target) =>
  Math.max(a, b) >= target &&
  Math.abs(a - b) >= 2 &&
  (Math.max(a, b) === target || Math.abs(a - b) === 2);
// USA Pickleball 2026, sections 4 and 15.C.1. A single game to 11
// is also supported for recreational play. Longer standard matches use 11.
export function validatePickleballFormat(bestOf, target) {
  assert(
    [1, 3, 5].includes(bestOf),
    "Pickleball matches are best of 1, 3, or 5 games.",
  );
  assert(
    [11, 15, 21].includes(target),
    "Pickleball games must be to 11, 15, or 21.",
  );
  assert(
    target === 11 || bestOf === 1,
    "Standard pickleball uses a single game to 15 or 21; best-of-3 and best-of-5 games are to 11.",
  );
}
export function validateScore(kind, format, input, knockout = false) {
  assert(input && typeof input === "object", "Enter a score.");
  const s = structuredClone(input);
  let a = 0,
    b = 0,
    winner = null,
    outcome = 0.5,
    margin = 1;
  if (kind === "fc") {
    a = n(s.a, 99);
    b = n(s.b, 99);
    s.a = a;
    s.b = b;
    s.aet = !!s.aet;
    assert(
      Number.isInteger(s.teamA) && Number.isInteger(s.teamB),
      "Choose both teams.",
    );
    if (s.pens) {
      assert(a === b, "Penalty shootouts require a tied match score.");
      assert(
        Array.isArray(s.pens) && s.pens.length === 2,
        "Enter both shootout scores.",
      );
      s.pens = s.pens.map((x) => n(x, 99));
      assert(s.pens[0] !== s.pens[1], "The shootout needs a winner.");
      winner = s.pens[0] > s.pens[1] ? 0 : 1;
    } else winner = a === b ? null : a > b ? 0 : 1;
    assert(!knockout || winner !== null, "A knockout match needs a winner.");
    outcome = a === b ? 0.5 : a > b ? 1 : 0;
    margin = Math.min(1.6, 1 + Math.log2(1 + Math.abs(a - b)) * 0.15);
  } else {
    if (kind === "pickleball") validatePickleballFormat(s.bestOf, s.target);
    const lengths =
      kind === "tt"
        ? [1, 3, 5, 7]
        : kind === "tennis" && format === "doubles"
          ? [1, 3]
          : [1, 3, 5];
    assert(lengths.includes(s.bestOf), "Choose a supported best-of length.");
    assert(
      Array.isArray(s.games) &&
        s.games.length > 0 &&
        s.games.length <= s.bestOf,
      "Enter games/sets in order.",
    );
    let diff = 0,
      total = 0,
      jv = 0,
      sd = 0;
    const target = Math.ceil(s.bestOf / 2);
    for (let i = 0; i < s.games.length; i++) {
      assert(
        a < target && b < target,
        "Remove scores entered after the match was won.",
      );
      const g = s.games[i];
      assert(
        g && typeof g === "object" && !Array.isArray(g),
        "Enter a score for each game/set.",
      );
      g.a = n(g.a);
      g.b = n(g.b);
      let w;
      if (kind === "tennis") {
        const deciding = i === s.bestOf - 1;
        const replacement =
          format === "doubles" && s.matchTiebreak && deciding && s.bestOf > 1;
        if (replacement) {
          assert(
            race(g.a, g.b, 10),
            "The deciding match tiebreak is first to 10, win by two.",
          );
          g.matchTiebreak = true;
        } else {
          const hi = Math.max(g.a, g.b),
            lo = Math.min(g.a, g.b);
          assert(
            (hi === 6 && lo <= 4) || (hi === 7 && (lo === 5 || lo === 6)),
            "A tennis set ends at 6–0 through 6–4, 7–5, or 7–6.",
          );
          if (hi === 7 && lo === 6) {
            assert(
              Array.isArray(g.tb) && g.tb.length === 2,
              "Enter both tiebreak point scores.",
            );
            g.tb = g.tb.map((x) => n(x));
            assert(
              race(...g.tb, deciding ? 10 : 7),
              "Invalid tiebreak: win by two at the required target.",
            );
            assert(
              g.a > g.b === g.tb[0] > g.tb[1],
              "The set and tiebreak winner must agree.",
            );
          } else delete g.tb;
        }
        w = g.a > g.b ? 0 : 1;
        diff += replacement ? (g.a - g.b) / 2 : g.a - g.b;
        total += replacement ? (g.a + g.b) / 2 : g.a + g.b;
      } else if (kind === "tt" || kind === "pickleball") {
        assert(
          (kind === "pickleball" ? [11, 15, 21] : [11, 21]).includes(s.target),
          "Choose a supported points target.",
        );
        assert(
          race(g.a, g.b, s.target),
          `${kind === "pickleball" ? "Pickleball" : "Table tennis"} games must reach the target and be won by two. Stop at the first winning score.`,
        );
        w = g.a > g.b ? 0 : 1;
        diff += g.a - g.b;
        total += g.a + g.b;
      } else {
        const stocks = format === "doubles" ? 6 : 3;
        assert(
          g.a <= stocks && g.b <= stocks,
          "Stocks taken exceed the allowed team total.",
        );
        assert(
          Array.isArray(g.fighters) &&
            g.fighters.length === (format === "doubles" ? 4 : 2) &&
            g.fighters.every(
              (x) => typeof x === "string" && x.trim().length && x.length < 80,
            ),
          "Select a fighter for every player.",
        );
        assert(
          typeof g.stage === "string" &&
            g.stage.trim().length &&
            g.stage.length < 100,
          "Select a stage for each game.",
        );
        if (g.suddenDeath) {
          assert(
            g.a === g.b && g.a < stocks,
            "Sudden death requires equal stocks taken below the normal winning total.",
          );
          assert(
            g.winner === 0 || g.winner === 1,
            "Select the sudden-death winner.",
          );
          w = g.winner;
          sd++;
        } else {
          assert(
            g.a !== g.b && Math.max(g.a, g.b) === stocks,
            "The winner must take all opposing stocks.",
          );
          w = g.a > g.b ? 0 : 1;
        }
        assert(
          !g.jv || format === "singles",
          "JV is available only in singles.",
        );
        assert(
          !(g.jv && g.suddenDeath),
          "JV and sudden death cannot both describe a game.",
        );
        if (g.jv) jv++;
        diff += g.a - g.b;
        total += g.a + g.b;
      }
      g.winner = w;
      w === 0 ? a++ : b++;
    }
    assert(
      Math.max(a, b) === target,
      "Enter all games/sets through the match-winning result.",
    );
    winner = a > b ? 0 : 1;
    outcome = winner === 0 ? 1 : 0;
    margin = Math.min(
      1.3,
      0.7 +
        (0.35 * Math.abs(a - b)) / s.games.length +
        (0.25 * Math.abs(diff)) / Math.max(1, total),
    );
    if (kind === "smash") {
      margin = Math.max(0.7, margin - (0.1 * sd) / s.games.length);
      if (jv) margin *= 1 + (0.011 * jv) / s.games.length;
    }
  }
  s.note = String(s.note || "").slice(0, 1000);
  return { score: s, a, b, winner, outcome, margin };
}
// ratedMatches is the number completed before the match being calculated.
export function ratingK(ratedMatches) {
  const completed = Math.max(0, Math.min(44, ratedMatches));
  return 24 + 100 * (1 - Math.log1p(completed) / Math.log(45));
}
export function eloDelta(a, b, outcome, margin, weight, overalls, k = 24) {
  const strength = overalls ? (overalls[0] - overalls[1]) * 20 : 0;
  const expected = 1 / (1 + 10 ** ((b - a - strength) / 400));
  return Math.round(k * weight * margin * (outcome - expected) * 10000) / 10000;
}
