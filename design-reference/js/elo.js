/* Elo projection used by the record form preview.
   Team strength is part of the expected result: every star above 3 adds
   25 rating points to that side, every star below 3 takes 25 away. */
(function () {
  const K = 24;
  const STAR_BONUS = 25;

  const teamBonus = (stars) => (Number(stars || 3) - 3) * STAR_BONUS;
  const expected = (ratingA, ratingB) => 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));

  function outcome(scoreA, scoreB, pens) {
    if (pens && pens.length === 2 && pens[0] !== pens[1]) return pens[0] > pens[1] ? 1 : 0;
    if (scoreA > scoreB) return 1;
    if (scoreA < scoreB) return 0;
    return 0.5;
  }

  function project(opts) {
    const effA = Number(opts.eloA || 0) + teamBonus(opts.starsA);
    const effB = Number(opts.eloB || 0) + teamBonus(opts.starsB);
    const expA = expected(effA, effB);
    const actA = outcome(Number(opts.scoreA) || 0, Number(opts.scoreB) || 0, opts.pens);
    const deltaA = Math.round(K * (actA - expA));
    return { deltaA: deltaA, deltaB: -deltaA, expectedA: expA, effectiveA: effA, effectiveB: effB, k: K };
  }

  /* Tennis Elo: margin-aware. A straight-set blowout (6-0 6-0) moves more than a
     tight straight-sets win (7-6 7-6), which moves more than a three-set win.
     `eloA`/`eloB` are ratings; for doubles pass each team's average rating. */
  function tennisProject(opts) {
    const eloA = Number(opts.eloA || 1500);
    const eloB = Number(opts.eloB || 1500);
    const expA = expected(eloA, eloB);
    const sets = opts.sets || [];
    let a = 0, b = 0, games = 0;
    sets.forEach((s) => {
      if (s.a == null || s.b == null) return;
      const sa = Number(s.a) || 0, sb = Number(s.b) || 0;
      games += sa - sb;
      if (sa > sb) a++;
      else if (sb > sa) b++;
    });
    const actA = a > b ? 1 : b > a ? 0 : 0.5;
    const straight = Math.abs(a - b) >= 2 ? 0.08 : 0;
    const margin = Math.max(0.7, Math.min(1.3, 0.7 + Math.abs(games) * 0.06 + straight));
    const deltaA = Math.round(K * (actA - expA) * margin);
    return { deltaA: deltaA, deltaB: -deltaA, expectedA: expA, margin: margin, k: K, setsWonA: a, setsWonB: b, gamesDiff: games };
  }

  function tableTennisProject(opts) {
    const eloA = Number(opts.eloA || 1500);
    const eloB = Number(opts.eloB || 1500);
    const expA = expected(eloA, eloB);
    const games = opts.games || [];
    let a = 0, b = 0, points = 0;
    games.forEach((game) => {
      const pa = Number(game.a) || 0, pb = Number(game.b) || 0;
      points += pa - pb;
      if (pa > pb) a++;
      else if (pb > pa) b++;
    });
    const actA = a > b ? 1 : b > a ? 0 : 0.5;
    const margin = Math.max(0.7, Math.min(1.3, 0.7 + Math.abs(points) * 0.015 + Math.abs(a - b) * 0.08));
    const deltaA = Math.round(K * (actA - expA) * margin);
    return { deltaA: deltaA, deltaB: -deltaA, expectedA: expA, margin: margin, k: K, gamesWonA: a, gamesWonB: b, pointsDiff: points };
  }

  /* Smash Elo: margin-aware by games won and stock difference. A 3–0 sweep
     with JVs moves more than a tight 3–2. Singles and doubles are separate ratings. */
  function smashProject(opts) {
    const eloA = Number(opts.eloA || 1500);
    const eloB = Number(opts.eloB || 1500);
    const expA = expected(eloA, eloB);
    const games = opts.games || [];
    let a = 0, b = 0, diff = 0;
    games.forEach((game) => {
      const sa = Number(game.a) || 0, sb = Number(game.b) || 0;
      diff += sa - sb;
      if (sa > sb) a++;
      else if (sb > sa) b++;
    });
    const actA = a > b ? 1 : b > a ? 0 : 0.5;
    const margin = Math.max(0.7, Math.min(1.3, 0.7 + Math.abs(a - b) * 0.12 + Math.abs(diff) * 0.03));
    const deltaA = Math.round(K * (actA - expA) * margin);
    return { deltaA: deltaA, deltaB: -deltaA, expectedA: expA, margin: margin, k: K, gamesWonA: a, gamesWonB: b, stockDiff: diff };
  }

  window.ELO = { K: K, STAR_BONUS: STAR_BONUS, teamBonus: teamBonus, expected: expected, outcome: outcome, project: project, tennisProject: tennisProject, tableTennisProject: tableTennisProject, smashProject: smashProject };
})();
