/* Competition detail rendering. */
(function () {
  const params = new URLSearchParams(location.search);
  const ctx = window.resolveGame(params);
  const gameSlug = ctx.slug;
  const M = ctx.M;
  const isTennis = ctx.isTennis;
  const isTableTennis = ctx.isTableTennis;
  const isSmash = ctx.isSmash;
  const gameQuery = ctx.query;
  const gameHref = ctx.href;
  window.MOCK = M;
  if (isSmash) {
    document.body.dataset.game = "smash";
    document.body.removeAttribute("data-game-variant");
  } else if (isTennis || isTableTennis) {
    document.body.dataset.game = isTableTennis ? "table-tennis" : "tennis";
    document.body.removeAttribute("data-game-variant");
  } else if (gameSlug === "eafc26") {
    document.body.dataset.gameVariant = "eafc26";
  }
  if (window.COMP_STORE) COMP_STORE.merge(M, gameSlug);
  const gameMeta = M.games.find((g) => g.slug === gameSlug) || M.games[0];

  const $ = UI.$;
  const $$ = UI.$$;
  const esc = UI.esc;

  const id = params.get("id") || "winter";
  const comp = M.competitions.find((c) => c.id === id) || M.competitions[0];
  if (comp.custom && window.COMP_RESULTS) COMP_RESULTS.recalc(comp, gameSlug);
  const custom = !!comp.custom;
  const data = comp.data || {};

  const crumbGame = $("#crumb-game");
  if (crumbGame) { crumbGame.textContent = gameMeta.name; crumbGame.href = gameHref; }
  const crumbComps = $("#crumb-comps");
  if (crumbComps) crumbComps.href = "game.html?view=competitions" + gameQuery;
  const backGame = $("#back-game");
  if (backGame) backGame.href = gameHref;
  const recordLink = $("#record-link");
  if (recordLink) recordLink.href = "game.html?view=record" + gameQuery + "&comp=" + encodeURIComponent(comp.id);

  const blurbs = {
    winter: "Everyone plays everyone twice. Three points for a win; Elo moves after every approved match.",
    continental: "Two groups of four, then a four-team knockout. Group results count for Elo.",
    friday: "One night, one bracket. Draws go to extra time and penalties, then a single champion.",
    summer: "Everyone plays everyone twice in sets. Ratings move by how dominant the scoreline was.",
    clubopen: "Two groups of four, then a four-team knockout. Sets and tie-breaks decide it.",
    mixer: "One night, one bracket, best of three sets to the final.",
    "smash-ladder": "Everyone plays everyone twice. Games won separate the table; Elo moves after every approved set.",
    "smash-major": "A double-elimination bracket with winners and losers sides. Lose once and you drop to losers; lose twice and you are out."
  };

  $$("[data-comp-name]").forEach((el) => { el.textContent = comp.name; });
  $$("[data-comp-kind]").forEach((el) => { el.textContent = comp.kind; });
  $$("[data-comp-format]").forEach((el) => { el.textContent = comp.format; });
  $$("[data-comp-status]").forEach((el) => { el.textContent = comp.status; });
  $$("[data-comp-played]").forEach((el) => { el.textContent = comp.played; });
  $$("[data-comp-leader]").forEach((el) => { el.textContent = comp.leader; });
  $$("[data-comp-custom]").forEach((el) => { el.hidden = !custom; });

  const shape = custom
    ? { matchdays: comp.matchdays || 0, rounds: comp.rounds || 0 }
    : ({ winter: { matchdays: 14, rounds: 2 }, summer: { matchdays: 14, rounds: 2 }, continental: { matchdays: 3, rounds: 2 }, clubopen: { matchdays: 3, rounds: 2 }, friday: { matchdays: 1, rounds: 3 }, mixer: { matchdays: 1, rounds: 3 }, "smash-ladder": { matchdays: 14, rounds: 2 }, "smash-major": { matchdays: 2, rounds: 4 } }[comp.id] || { matchdays: 14, rounds: 2 });
  $$("[data-comp-players]").forEach((el) => { el.textContent = comp.players; });
  $$("[data-comp-fixtures]").forEach((el) => { el.textContent = comp.fixtures; });
  $$("[data-comp-played-stat]").forEach((el) => { el.textContent = comp.played; });
  $$("[data-comp-matchdays]").forEach((el) => { el.textContent = shape.matchdays; });
  $$("[data-comp-rounds]").forEach((el) => { el.textContent = shape.rounds; });
  const blurb = $("[data-comp-blurb]");
  if (blurb) blurb.textContent = comp.blurb || blurbs[comp.id] || blurbs.winter;
  if (custom && comp.settings && comp.settings.seeds && blurb) {
    const seedDetails = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Initial competition seeds";
    seedDetails.appendChild(summary);
    const list = document.createElement("ol");
    comp.settings.seeds.forEach(seed => { const li = document.createElement("li"); li.value = seed.seed; li.textContent = seed.name; list.appendChild(li); });
    seedDetails.appendChild(list);
    blurb.after(seedDetails);
  }
  const playedLabel = $(".player-elo .label");
  if (playedLabel) playedLabel.textContent = "of " + comp.fixtures + " matches played";
  const tableChip = $("#table-chip");
  if (tableChip) tableChip.textContent = custom ? "Custom" : "2026/27";
  const rulesElo = $("#rules-elo-copy");
  if (rulesElo && !comp.elo) {
    rulesElo.textContent = "This competition does not count for Elo. Approved results only update its table or bracket.";
  }
  const pureKnockout = custom ? !!(data.bracket && !data.groups && !(data.standings || []).length) : (comp.id === "friday" || comp.id === "mixer" || comp.id === "tt-cup" || comp.id === "smash-major");
  if (pureKnockout) {
    const pointsMono = $("#rules-points-mono");
    const pointsTitle = $("#rules-points-title");
    const pointsCopy = $("#rules-points-copy");
    if (pointsMono) pointsMono.textContent = isSmash ? "DE" : "KO";
    if (pointsTitle) pointsTitle.textContent = isSmash ? "Double elimination" : "Knockout";
    if (pointsCopy) pointsCopy.textContent = isSmash
      ? "Best of three games. Lose once and you drop to losers; lose twice and you are out. Grand Finals runs to a reset if needed."
      : isTableTennis
        ? "Best of three games to 11, win by two. The winner advances; the final decides the champion."
        : isTennis
          ? "Best of three sets. The winner advances; the final decides the champion."
          : "Draws go to extra time and penalties. The winner advances; the final decides the champion.";
  }
  document.title = comp.name + " — " + gameMeta.name + " — mimELo";

  if (params.get("created") === "1") {
    UI.toast("Competition created — demo only. Saved in this browser.");
  }

  function playerCell(name) {
    return '<span class="player-cell">' + UI.avatar(name, "avatar-sm") + '<span class="name">' + esc(name) + "</span></span>";
  }

  function sideCell(name) {
    return UI.playerByName(name) ? playerCell(name) : '<span class="muted">' + esc(name) + "</span>";
  }

  function teamStack(name) {
    const p = UI.playerByName(name);
    if (!p || !p.teams || !p.teams.length) return '<span class="muted">—</span>';
    const shown = p.teams.slice(0, 3);
    const title = p.teams.map((t) => t.code + " ×" + t.count).join(" · ");
    return '<span class="team-stack" title="' + esc(title) + '">' +
      shown.map((t) => UI.monogram(t.code)).join("") +
      (p.teams.length > shown.length ? '<span class="team-more">+' + (p.teams.length - shown.length) + "</span>" : "") +
      "</span>";
  }

  function tennisLeague(rows, sub, tableTennis) {
    $("#table-heading").textContent = comp.name;
    $("#table-sub").textContent = sub;
    $("#comp-table-wrap").innerHTML =
      '<div class="table-wrap"><table>' +
      '<thead><tr><th class="c">#</th><th>Player</th><th class="c">P</th><th class="c">W</th><th class="c">L</th><th class="c">' + (tableTennis ? "Games W–L" : "Sets") + '</th><th class="c">Pts</th><th>Form</th></tr></thead><tbody>' +
      rows.map((s, i) =>
        "<tr>" +
        '<td class="c"><span class="num">' + (s.p || i + 1) + "</span></td>" +
        "<td>" + playerCell(s.name) + "</td>" +
        '<td class="c num">' + s.pld + "</td>" +
        '<td class="c num">' + s.w + "</td>" +
        '<td class="c num">' + s.l + "</td>" +
        '<td class="c num">' + s.gf + "–" + s.ga + "</td>" +
        '<td class="c num"><b>' + s.pts + "</b></td>" +
        "<td>" + UI.formDots(s.form) + "</td>" +
        "</tr>"
      ).join("") +
      "</tbody></table></div>";
  }

  function tennisGroup(name, rows) {
    return '<div class="panel">' +
      '<div class="panel-head"><h3>Group ' + name + "</h3><span class=\"chip\">Top two advance</span></div>" +
      '<div class="table-wrap"><table><thead><tr><th class="c">#</th><th>Player</th><th class="c">P</th><th class="c">W</th><th class="c">L</th><th class="c">Pts</th></tr></thead><tbody>' +
      rows.map((s, i) => {
        const played = s.pld != null ? s.pld : s.p;
        return "<tr>" +
          '<td class="c"><span class="num">' + (i + 1) + "</span></td>" +
          "<td>" + playerCell(s.name) + "</td>" +
          '<td class="c num">' + played + "</td>" +
          '<td class="c num">' + s.w + "</td>" +
          '<td class="c num">' + s.l + "</td>" +
          '<td class="c num"><b>' + s.pts + "</b></td>" +
          "</tr>";
      }).join("") +
      "</tbody></table></div></div>";
  }

  function tennisWinner(f) {
    const sets = String(f.score || "").split(/\s+/).filter((s) => /[–—-]/.test(s));
    let a = 0, b = 0;
    sets.forEach((set) => {
      const parts = set.replace(/[–—]/g, "-").split("-");
      const x = parseInt(parts[0], 10) || 0;
      const y = parseInt(parts[1], 10) || 0;
      if (x > y) a++; else if (y > x) b++;
    });
    return a > b ? "home" : b > a ? "away" : null;
  }

  function renderLeague(rows, sub) {
    $("#table-heading").textContent = comp.name;
    $("#table-sub").textContent = sub;
    $("#comp-table-wrap").innerHTML =
      '<div class="table-wrap"><table>' +
      '<thead><tr><th class="c">#</th><th>Player</th><th>Teams</th><th class="c">P</th><th class="c">W</th><th class="c">D</th><th class="c">L</th><th class="c">GD</th><th class="c">Pts</th><th>Form</th></tr></thead><tbody>' +
      rows.map((s, i) =>
        "<tr>" +
        '<td class="c"><span class="num">' + (s.p || i + 1) + "</span></td>" +
        "<td>" + playerCell(s.name) + "</td>" +
        "<td>" + teamStack(s.name) + "</td>" +
        '<td class="c num">' + s.pld + "</td>" +
        '<td class="c num">' + s.w + "</td>" +
        '<td class="c num">' + s.d + "</td>" +
        '<td class="c num">' + s.l + "</td>" +
        '<td class="c num">' + (s.gd > 0 ? "+" : "") + s.gd + "</td>" +
        '<td class="c num"><b>' + s.pts + "</b></td>" +
        "<td>" + UI.formDots(s.form) + "</td>" +
        "</tr>"
      ).join("") +
      "</tbody></table></div>";
  }

  function groupTable(name, rows) {
    return '<div class="panel">' +
      '<div class="panel-head"><h3>Group ' + name + "</h3><span class=\"chip\">Top two advance</span></div>" +
      '<div class="table-wrap"><table><thead><tr><th class="c">#</th><th>Player</th><th class="c">P</th><th class="c">GD</th><th class="c">Pts</th></tr></thead><tbody>' +
      rows.map((s, i) => {
        const played = s.pld != null ? s.pld : s.p;
        return "<tr>" +
          '<td class="c"><span class="num">' + (i + 1) + "</span></td>" +
          "<td>" + playerCell(s.name) + "</td>" +
          '<td class="c num">' + played + "</td>" +
          '<td class="c num">' + (s.gd > 0 ? "+" : "") + s.gd + "</td>" +
          '<td class="c num"><b>' + s.pts + "</b></td>" +
          "</tr>";
      }).join("") +
      "</tbody></table></div></div>";
  }

  function renderNoTable() {
    $("#table-heading").textContent = "Knockout competition";
    $("#table-sub").textContent = custom ? "No table — the bracket decides it · custom" : "No table — the bracket decides it";
    $("#comp-table-wrap").innerHTML =
      '<div class="empty-state">' + UI.icon("bracket", 34) + '<h3>No league table</h3><p>This is a ' + (custom ? (data.bracket.type === "double" ? "double-elimination" : "single-elimination") : (isSmash ? "double-elimination" : "single-elimination")) + ' bracket. Open the Bracket tab to see the path to the final.</p><button class="btn btn-outline btn-sm" type="button" id="go-bracket" style="margin-top:14px;">View bracket</button></div>';
    const go = $("#go-bracket");
    if (go) go.addEventListener("click", () => {
      const tab = $("#ct-bracket");
      if (tab) tab.click();
    });
  }

  if (custom) {
    if (data.groups) {
      $("#table-heading").textContent = "Group stage";
      $("#table-sub").textContent = Object.keys(data.groups).length + " groups · top " + (comp.settings ? comp.settings.advance : 2) + " advance per group";
      const gTable = isTennis || isTableTennis ? tennisGroup : groupTable;
      $("#comp-table-wrap").innerHTML = '<div class="group-grid">' + Object.entries(data.groups).map(([key, rows]) => gTable(key.toUpperCase(), rows)).join("") + "</div>";
    } else if (data.standings && data.standings.length) {
      if (isTennis || isTableTennis) tennisLeague(data.standings, "No matches played yet · custom", isTableTennis);
      else renderLeague(data.standings, "No matches played yet · custom");
    } else {
      renderNoTable();
    }
  } else if (comp.id === "winter") {
    renderLeague(M.standings, "After " + M.standings[0].pld + " matches · sample");
  } else if (comp.id === "summer") {
    tennisLeague(M.standings, "After " + M.standings[0].pld + " matches · sample");
  } else if (comp.id === "tt-ladder") {
    tennisLeague(M.standings, "Match wins and games won · sample", true);
  } else if (comp.id === "smash-ladder") {
    tennisLeague(M.standings, "After " + M.standings[0].pld + " games · sample", true);
  } else if (comp.id === "smash-major") {
    renderNoTable();
  } else if (comp.id === "continental" || comp.id === "clubopen") {
    $("#table-heading").textContent = "Group stage";
    $("#table-sub").textContent = "Two groups of four · top two advance";
    const groups = '<div class="group-grid">' + (isTennis || isTableTennis ? tennisGroup : groupTable)("A", M.groups.a) + (isTennis || isTableTennis ? tennisGroup : groupTable)("B", M.groups.b) + "</div>";
    $("#comp-table-wrap").innerHTML = groups;
  } else {
    renderNoTable();
  }

  const fixtures = $("#fixtures-body");
  const fixturesSub = $("#fixtures-sub");
  const fixturesOrder = $("#fixtures-order");
  if (fixturesSub) fixturesSub.textContent = "Every match in the competition · " + (custom ? "custom" : "sample");
  if (fixturesOrder) fixturesOrder.textContent = custom ? "Schedule order" : "Newest first";
  if (fixtures) {
    const fixtureRows = custom ? (data.fixtures || []) : comp.id === "tt-ladder"
      ? M.matches.filter((match) => match.league === comp.name).map((match) => ({
        date: match.date,
        stage: "Ladder",
        home: UI.playerById(match.p1).name,
        away: UI.playerById(match.p2).name,
        score: UI.gameSetScore(match.sets),
        status: match.status
      }))
      : M.fixtures;
    fixtures.innerHTML = fixtureRows.map((f) => {
      const status = (f.status === "locked" || f.status === "approved")
        ? '<span class="status status-locked">Final</span>'
        : f.status === "pending"
          ? '<span class="status status-pending">Pending</span>'
          : '<span class="status">' + esc(f.status === 'waiting' ? 'Awaiting qualification/result' : f.status === 'conditional' ? 'If needed' : 'Scheduled') + '</span>';
      return "<tr>" +
        "<td>" + esc(f.date) + "</td>" +
        '<td><span class="chip">' + esc(f.stage) + "</span></td>" +
        "<td>" + sideCell(f.home) + "</td>" +
        '<td class="c num"><b>' + esc(f.score) + "</b></td>" +
        "<td>" + sideCell(f.away) + "</td>" +
        "<td>" + status + "</td>" +
        "</tr>";
    }).join("");
  }

  function customBracket(rounds) {
    return '<div class="bracket-scroll"><div class="bracket">' +
      rounds.map((round) => {
        const isFinal = /final/i.test(round.title) && !/semi/i.test(round.title);
        return '<div class="bracket-round"><div class="bracket-round-title">' + esc(round.title) + "</div>" +
          round.matches.map((f) => {
            const homeKnown = !!UI.playerByName(f.home);
            const awayKnown = !!UI.playerByName(f.away);
            const homeWin = !!f.winner && f.winner === f.home;
            const awayWin = !!f.winner && f.winner === f.away;
            const score = f.status === "bye" ? "BYE" : (f.score || "—");
            return '<div class="bracket-node' + (isFinal && f.winner ? " champion" : "") + '">' +
              '<p><span class="' + [homeWin ? "winner" : "", homeKnown ? "" : "side-tbd"].filter(Boolean).join(" ") + '">' + esc(f.home) + '</span><span class="score">' + esc(score) + "</span></p>" +
              '<p><span class="' + [awayWin ? "winner" : "", awayKnown ? "" : "side-tbd"].filter(Boolean).join(" ") + '">' + esc(f.away) + "</span><span></span></p>" +
              "</div>";
          }).join("") +
          "</div>";
      }).join("") +
      "</div></div>";
  }

  function deNode(f, grand) {
    const homeWin = !!f.winner && f.winner === f.home;
    const awayWin = !!f.winner && f.winner === f.away;
    const score = f.status === "bye" ? "BYE" : (f.score || "—");
    return '<div class="bracket-node' + (grand ? " grand-node" : "") + '">' +
      '<p><span class="' + (homeWin ? "winner" : "") + '">' + esc(f.home) + '</span><span class="score">' + esc(score) + "</span></p>" +
      '<p><span class="' + (awayWin ? "winner" : "") + '">' + esc(f.away) + "</span><span></span></p>" +
      (grand && f.reset ? '<span class="reset-tag">Bracket reset' + (f.status === "conditional" ? " · if needed" : "") + '</span>' : "") +
      "</div>";
  }

  function deBracket(b) {
    const rounds = (arr) => arr.map((r) =>
      '<div class="bracket-round"><div class="bracket-round-title">' + esc(r.title) + "</div>" +
      r.matches.map((f) => deNode(f, false)).join("") + "</div>").join("");
    const grand = '<div class="bracket-round"><div class="bracket-round-title">' + esc(b.grand.title) + "</div>" +
      b.grand.matches.map((f) => deNode(f, true)).join("") + "</div>";
    return '<div class="bracket-scroll"><div class="de-bracket">' +
      '<div class="de-col de-col-winners"><div class="de-col-title">Winners bracket</div>' + rounds(b.winners) + "</div>" +
      '<div class="de-col de-col-losers"><div class="de-col-title">Losers bracket</div>' + rounds(b.losers) + "</div>" +
      '<div class="de-col de-col-grand"><div class="de-col-title">Grand Finals</div>' + grand + "</div>" +
      "</div></div>";
  }

  const bracket = $("#bracket-wrap");
  const bracketHeading = $("#bracket-heading");
  const bracketSub = $("#bracket-sub");
  if (bracket) {
    if (isSmash && comp.id === "smash-major") {
      if (bracketHeading) bracketHeading.textContent = "Double-elimination bracket";
      if (bracketSub) bracketSub.textContent = "Winners bracket · losers bracket · grand finals";
      bracket.innerHTML = deBracket(M.bracket);
    } else if (custom) {
      if (data.bracket) {
        if (bracketHeading) bracketHeading.textContent = comp.settings && comp.settings.playoffs ? "League playoffs" : data.groups ? "Knockout stage" : "Knockout bracket";
        if (bracketSub) bracketSub.textContent = (data.bracket.type === "double" ? "Double elimination · reset if needed" : "Single elimination") + (data.groups ? " · group qualifiers" : comp.settings && comp.settings.playoffs ? " · top " + comp.settings.playoffCount + " league finishers" : "");
        bracket.innerHTML = data.bracket.type === "double" ? deBracket(data.bracket) : customBracket(data.bracket.rounds);
      } else {
        if (bracketHeading) bracketHeading.textContent = "Knockout stage";
        if (bracketSub) bracketSub.textContent = "No knockout stage in this league · custom";
        bracket.innerHTML = '<div class="empty-state">' + UI.icon("info", 34) + '<h3>No knockout stage</h3><p>The ' + esc(comp.name) + ' is decided by the table. Elo still moves after every approved match.</p></div>';
      }
    } else if (comp.id === "winter" || comp.id === "summer" || comp.id === "tt-ladder") {
      bracket.innerHTML = '<div class="empty-state">' + UI.icon("info", 34) + '<h3>No knockout stage</h3><p>The ' + esc(comp.name) + ' is decided by the table. Elo still moves after every approved match.</p></div>';
    } else {
      const parseScore = (score) => String(score).replace(/[–—]/g, "-").split("-").map((n) => parseInt(n, 10) || 0);
      const node = (f, champion) => {
        const homeWin = isTennis || isTableTennis ? tennisWinner(f) === "home" : (() => { const s = parseScore(f.score); return s[0] >= s[1]; })();
        return '<div class="bracket-node' + (champion ? " champion" : "") + '">' +
          '<p><span class="' + (homeWin ? "winner" : "") + '">' + esc(f.home) + '</span><span class="score">' + esc(f.score) + "</span></p>" +
          '<p><span class="' + (homeWin ? "" : "winner") + '">' + esc(f.away) + "</span><span></span></p>" +
          "</div>";
      };
      const semis = M.fixtures.filter((f) => /semifinal/i.test(f.stage));
      const final = M.fixtures.find((f) => /final/i.test(f.stage) && !/semi/i.test(f.stage));
      bracket.innerHTML = '<div class="bracket-scroll"><div class="bracket">' +
        '<div class="bracket-round"><div class="bracket-round-title">Semifinals</div>' + semis.map((f) => node(f, false)).join("") + "</div>" +
        '<div class="bracket-round"><div class="bracket-round-title">Final</div>' + (final ? node(final, true) : "") + "</div>" +
        "</div></div>";
    }
  }

  if (custom) {
    const deleteBtn = $("#delete-comp");
    const deleteDialog = $("#delete-dialog");
    if (deleteBtn && deleteDialog) {
      deleteBtn.hidden = false;
      deleteBtn.addEventListener("click", () => UI.openDialog(deleteDialog, deleteBtn));
      const deleteName = $("#delete-name");
      if (deleteName) deleteName.textContent = comp.name;
      const confirmDelete = $("#delete-confirm");
      if (confirmDelete) confirmDelete.addEventListener("click", () => {
        if (window.COMP_STORE) COMP_STORE.remove(gameSlug, comp.id);
        UI.closeDialog(deleteDialog);
        location.href = "game.html?view=competitions" + gameQuery;
      });
    }
  }
})();
