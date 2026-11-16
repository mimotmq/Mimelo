/* Game hub rendering and demo interactions. */
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
  if (window.COMP_STORE) COMP_STORE.merge(M, gameSlug);
  const gameMeta = M.games.find((g) => g.slug === gameSlug) || M.games[0];

  const $ = UI.$;
  const $$ = UI.$$;
  const esc = UI.esc;

  const playerLink = (p, size) =>
    '<a class="player-cell" href="player.html?player=' + p.id + gameQuery + '">' +
    UI.avatar(p.name, size || "avatar-sm") +
    '<span class="name">' + esc(p.name) + "</span></a>";

  const pname = (id) => {
    const p = UI.playerById(id);
    return p ? p.name : "Player";
  };

  const teamTitle = (p) =>
    (p.teams || []).map((t) => t.code + " ×" + t.count).join(" · ");

  function teamStack(p) {
    if (!p || !p.teams || !p.teams.length) return '<span class="muted">—</span>';
    const shown = p.teams.slice(0, 3);
    return '<span class="team-stack" title="' + esc(teamTitle(p)) + '">' +
      shown.map((t) => UI.monogram(t.code)).join("") +
      (p.teams.length > shown.length ? '<span class="team-more">+' + (p.teams.length - shown.length) + "</span>" : "") +
      "</span>";
  }

  function lastUsedTeam(p) {
    const match = M.matches.find((m) => m.p1 === p.id || m.p2 === p.id);
    if (match) return match.p1 === p.id ? match.club1 : match.club2;
    return p.club;
  }

  const stackFor = (p) => (isTennis || isTableTennis ? UI.identity(p) : teamStack(p));

  function tennisSide(m, which) {
    if (m.format === "doubles") {
      const ids = which === 1 ? m.team1 : m.team2;
      const names = (ids || []).map((id) => { const q = UI.playerById(id); return q ? q.name : "Player"; });
      return '<span class="side">' + esc(names.join(" + ")) + "</span>";
    }
    const p = UI.playerById(which === 1 ? m.p1 : m.p2);
    return '<span class="side">' + (p ? UI.flagChip(p) + esc(p.name) : "Player") + "</span>";
  }

  function tennisSummary(m) {
    return isTableTennis ? UI.tableTennisScorecard(m) : UI.tennisScoreboard(m);
  }

  const signed = (n) => (n > 0 ? "+" + n : n < 0 ? "−" + Math.abs(n) : "0");
  const starLabel = (team) => {
    if (!team) return "—";
    const s = Number(team.stars || 0);
    return (Number.isInteger(s) ? s : s.toFixed(1)) + "★";
  };
  function setDelta(selector, value) {
    const el = $(selector);
    if (!el) return;
    el.textContent = signed(value);
    el.className = value > 0 ? "delta-up" : value < 0 ? "delta-down" : "delta-flat";
  }


  function renderStats() {
    const leader = M.standings[0];
    const leaderPlayer = leader ? UI.playerByName(leader.name) : null;
    const pending = M.matches.filter((m) => m.status === "pending").length;
    const toPlay = Math.max(M.stats.matches - M.stats.played, 0);

    const set = (id, value) => { const el = $("#" + id); if (el) el.textContent = value; };
    set("stat-players", M.players.length);
    set("stat-matches", M.stats.matches);
    set("stat-pending", pending);
    set("stat-leader", leader ? leader.name : "—");
    set("stat-leader-foot", "");
    const leaderFoot = $("#stat-leader-foot");
    if (leaderFoot && leader) {
      leaderFoot.innerHTML = '<span class="accent">' + (leaderPlayer ? leaderPlayer.elo + " Elo" : "—") + "</span> · " + leader.pts + " pts";
    }
    const matchesFoot = $("#stat-matches-foot");
    if (matchesFoot) matchesFoot.innerHTML = '<span class="up">' + M.stats.played + "</span> approved · " + toPlay + " to play";
    const pendingFoot = $("#stat-pending-foot");
    if (pendingFoot) pendingFoot.textContent = pending ? "Waiting for a game admin" : "Nothing waiting";

    const badge = $("#review-badge");
    if (badge) { badge.textContent = pending; badge.hidden = pending === 0; }
    const reviewCount = $("#review-count");
    if (reviewCount) reviewCount.textContent = pending + " pending";

    const comp = M.competitions[0];
    const ovTitle = $("#overview-table-title");
    if (ovTitle && comp) ovTitle.textContent = comp.name + " table";
    const ovSub = $("#overview-table-sub");
    if (ovSub && leader) ovSub.textContent = "After " + leader.pld + " matches · sample";
    const ovPageSub = $("#overview-sub");
    if (ovPageSub && comp) ovPageSub.textContent = comp.name + ", ratings, and the group's record. All numbers are sample data.";
    const leagueTitle = $("#league-title");
    if (leagueTitle && comp) leagueTitle.textContent = comp.name;
    const leagueSub = $("#league-sub");
    if (leagueSub && comp) leagueSub.textContent = comp.format + " · " + comp.players + " players · sample";
    const matchday = $("#league-matchday");
    if (matchday && leader) matchday.textContent = "Matchday " + leader.pld;
    const rankingsTitle = $("#rankings-title");
    const rankingsSub = rankingsTitle && rankingsTitle.parentElement.querySelector(".sub");
    if (rankingsSub && isTableTennis) rankingsSub.textContent = "Singles Elo and the Club Ladder table. Table Tennis ratings are independent from other games.";
    else if (rankingsSub && isSmash) rankingsSub.textContent = "Singles Elo and the Smash League table. Smash ratings are separate from the other games.";
  }

  function pendingTitle(m) {
    if (isTennis || isTableTennis) {
      const s = tennisSideNames(m);
      return esc(s.a) + " vs " + esc(s.b) + " · " + (isTableTennis ? UI.gameSetScore(m.sets) : UI.setScore(m.sets));
    }
    if (isSmash) {
      const s = tennisSideNames(m);
      const r = UI.smashResult(m);
      return esc(s.a) + " vs " + esc(s.b) + " · " + r.a + "–" + r.b + " games";
    }
    return esc(pname(m.p1)) + " " + m.s1 + "–" + m.s2 + " " + esc(pname(m.p2));
  }

  function tennisSideNames(m) {
    if (m.format === "doubles") {
      const n = (ids) => (ids || []).map((id) => { const q = UI.playerById(id); return q ? q.name : "Player"; }).join(" + ");
      return { a: n(m.team1), b: n(m.team2) };
    }
    const p1 = UI.playerById(m.p1), p2 = UI.playerById(m.p2);
    return { a: p1 ? p1.name : "Player 1", b: p2 ? p2.name : "Player 2" };
  }

  function renderOverview() {
    const tbody = $("#overview-table");
    if (tbody) {
      if (isTennis || isTableTennis) {
        const rows = M.standings.slice(0, 5).map((s) => {
          const p = UI.playerByName(s.name);
          const setRecord = isTableTennis ? s.gf + "–" + s.ga : s.gd;
          return "<tr>" +
            '<td class="c"><span class="num">' + s.p + "</span></td>" +
            "<td>" + (p ? playerLink(p) : esc(s.name)) + "</td>" +
            "<td>" + (p ? UI.identity(p) : '<span class="muted">—</span>') + "</td>" +
            '<td class="c num">' + s.pld + "</td>" +
            '<td class="c num">' + s.w + "–" + s.l + "</td>" +
            '<td class="c num">' + (isTableTennis ? setRecord : (setRecord > 0 ? "+" : "") + setRecord) + "</td>" +
            '<td class="c num"><b>' + s.pts + "</b></td>" +
            "<td>" + UI.formDots(s.form) + "</td>" +
            "</tr>";
        }).join("");
        tbody.closest("table").innerHTML =
          '<thead><tr><th class="c">#</th><th>Player</th><th>Nat</th><th class="c">P</th><th class="c">W–L</th><th class="c">' + (isTableTennis ? "Games W–L" : "Sets") + '</th><th class="c">Pts</th><th>Form</th></tr></thead><tbody>' + rows + "</tbody>";
      } else if (isSmash) {
        const rows = M.standings.slice(0, 5).map((s) => {
          const p = UI.playerByName(s.name);
          return "<tr>" +
            '<td class="c"><span class="num">' + s.p + "</span></td>" +
            "<td>" + (p ? playerLink(p) : esc(s.name)) + "</td>" +
            "<td>" + (p ? UI.smashIdentity(p) : '<span class="muted">—</span>') + "</td>" +
            '<td class="c num">' + s.pld + "</td>" +
            '<td class="c num">' + s.w + "–" + s.l + "</td>" +
            '<td class="c num">' + s.gf + "–" + s.ga + "</td>" +
            '<td class="c num"><b>' + s.pts + "</b></td>" +
            "<td>" + UI.formDots(s.form) + "</td>" +
            "</tr>";
        }).join("");
        tbody.closest("table").innerHTML =
          '<thead><tr><th class="c">#</th><th>Player</th><th>Mains</th><th class="c">P</th><th class="c">W–L</th><th class="c">Games W–L</th><th class="c">Pts</th><th>Form</th></tr></thead><tbody>' + rows + "</tbody>";
      } else {
        tbody.innerHTML = M.standings.slice(0, 5).map((s) => {
          const p = UI.playerByName(s.name);
          return "<tr>" +
            '<td class="c"><span class="num">' + s.p + "</span></td>" +
            "<td>" + (p ? playerLink(p) : esc(s.name)) + "</td>" +
            "<td>" + (p ? teamStack(p) : '<span class="muted">—</span>') + "</td>" +
            '<td class="c num">' + s.pld + "</td>" +
            '<td class="c num">' + (s.gd > 0 ? "+" : "") + s.gd + "</td>" +
            '<td class="c num"><b>' + s.pts + "</b></td>" +
            "<td>" + UI.formDots(s.form) + "</td>" +
            "</tr>";
        }).join("");
      }
    }

    const activity = $("#overview-activity");
    if (activity) {
      activity.innerHTML = M.activity.map((a) =>
        '<div class="activity-row">' +
        '<span class="activity-icon">' + UI.icon(a.icon, 17) + "</span>" +
        '<div class="activity-copy"><b>' + esc(a.title) + "</b><span>" + esc(a.sub) + "</span></div>" +
        '<span class="activity-meta">' + esc(a.time) + "</span>" +
        "</div>"
      ).join("");
    }

    const pending = $("#overview-pending");
    if (pending) {
      pending.innerHTML = M.matches.filter((m) => m.status === "pending").slice(0, 2).map((m) =>
        '<div class="leader-row">' +
        '<span class="leader-rank">' + UI.icon("clock", 15) + "</span>" +
        '<div class="leader-name"><b>' + pendingTitle(m) + "</b><span>" + esc(m.league) + " · submitted by " + esc(m.submitted) + "</span></div>" +
        '<button class="btn btn-outline btn-sm" type="button" data-review="' + m.id + '">Review</button>' +
        "</div>"
      ).join("");
    }
  }

  function matchFilter(m) {
    if (isTennis || isTableTennis || isSmash) {
      const comp = M.competitions.find((c) => c.name === m.league);
      return comp && comp.kind === "League" ? "league" : "cup";
    }
    if (/cup|knockout/i.test(m.league)) return "cup";
    return "league";
  }

  function renderMatches() {
    const tbody = $("#matches-body");
    if (!tbody) return;
    tbody.innerHTML = M.matches.map((m) => {
      const delta = m.delta == null ? '<span class="delta-flat">—</span>'
        : '<span class="' + (m.delta > 0 ? "delta-up" : m.delta < 0 ? "delta-down" : "delta-flat") + '">' +
          (m.delta > 0 ? "+" : "") + m.delta + "</span>";
      return '<tr data-kind="' + matchFilter(m) + '" data-status="' + m.status + '">' +
        "<td>" + esc(UI.formatDate(m.date)) + '<br><span class="muted" style="font-size:.72rem">' + esc(m.time) + "</span></td>" +
        "<td>" + (isSmash ? UI.smashScorecard(m) : (isTennis || isTableTennis ? tennisSummary(m) : UI.summary(m))) + "</td>" +
        '<td><span class="chip">' + esc(m.league) + "</span></td>" +
        '<td class="c">' + delta + "</td>" +
        "<td>" + (m.status === "pending"
          ? '<span class="status status-pending">Pending</span>'
          : '<span class="status status-locked">Locked</span>') + "</td>" +
        '<td><div class="table-actions">' +
        (m.status === "pending"
          ? '<button class="btn btn-outline btn-sm" type="button" data-review="' + m.id + '">Review</button>'
          : '<button class="btn btn-outline btn-sm" type="button" data-demo-live="Match detail is a demo placeholder.">View</button>') +
        "</div></td></tr>";
    }).join("");
  }

  function renderTennisRankings() {
    const tabElo = $("#tab-elo");
    const tabLeague = $("#tab-league");
    if (tabElo) tabElo.textContent = "Singles";
    if (tabLeague) tabLeague.textContent = "Doubles";
    const how = $("#elo-how");
    if (how) how.setAttribute("data-demo", "Singles and doubles ratings move by how dominant a win is — a 6-0 6-0 blowout moves more than 7-6 7-6. Demo only.");

    const panelElo = $("#panel-elo");
    if (panelElo) {
      const rows = M.players.slice().sort((a, b) => b.elo - a.elo).map((p) =>
        "<tr>" +
        '<td class="c"><span class="num">' + p.rank + "</span></td>" +
        "<td>" + playerLink(p) + "</td>" +
        "<td>" + UI.identity(p) + "</td>" +
        '<td class="r num"><b>' + p.elo + "</b></td>" +
        '<td class="r num">' + p.peak + "</td>" +
        '<td class="c num">' + p.w + "–" + p.l + "</td>" +
        "<td>" + UI.formDots(p.form) + "</td>" +
        '<td class="r"><span class="' + (p.trend > 0 ? "delta-up" : p.trend < 0 ? "delta-down" : "delta-flat") + '">' + (p.trend > 0 ? "+" : "") + p.trend + "</span></td>" +
        "</tr>"
      ).join("");
      panelElo.innerHTML =
        '<div class="panel-head"><div><h2>Singles</h2><p class="sub">Singles Elo, peak, and form · sample</p></div><span class="chip">Season 2026</span></div>' +
        '<div class="table-wrap"><table>' +
        '<thead><tr><th class="c">#</th><th>Player</th><th>Nat</th><th class="r">Elo</th><th class="r">Peak</th><th class="c">W–L</th><th>Form</th><th class="r">Move</th></tr></thead><tbody>' + rows + "</tbody></table></div>";
    }

    const panelDoubles = $("#panel-league");
    if (panelDoubles) {
      const rows = M.players.slice().sort((a, b) => b.eloD - a.eloD).map((p) =>
        "<tr>" +
        '<td class="c"><span class="num">' + p.rankD + "</span></td>" +
        "<td>" + playerLink(p) + "</td>" +
        "<td>" + UI.identity(p) + "</td>" +
        '<td class="r num"><b>' + p.eloD + "</b></td>" +
        '<td class="r num">' + p.peakD + "</td>" +
        '<td class="r"><span class="' + (p.trendD > 0 ? "delta-up" : p.trendD < 0 ? "delta-down" : "delta-flat") + '">' + (p.trendD > 0 ? "+" : "") + p.trendD + "</span></td>" +
        "</tr>"
      ).join("");
      panelDoubles.innerHTML =
        '<div class="panel-head"><div><h2>Doubles</h2><p class="sub">Doubles Elo, peak, and movement · sample</p></div><span class="chip">Season 2026</span></div>' +
        '<div class="table-wrap"><table>' +
        '<thead><tr><th class="c">#</th><th>Player</th><th>Nat</th><th class="r">Elo</th><th class="r">Peak</th><th class="r">Move</th></tr></thead><tbody>' + rows + "</tbody></table></div>";
    }
  }

  function renderSmashRankings() {
    const tabElo = $("#tab-elo");
    const tabLeague = $("#tab-league");
    if (tabElo) tabElo.textContent = "Singles";
    if (tabLeague) tabLeague.textContent = "Doubles";
    const how = $("#elo-how");
    if (how) how.setAttribute("data-demo", "Singles and doubles ratings move by how dominant a win is — a 3–0 with JVs moves more than a tight 3–2. Demo only.");

    const panelElo = $("#panel-elo");
    if (panelElo) {
      const rows = M.players.slice().sort((a, b) => b.elo - a.elo).map((p) =>
        "<tr>" +
        '<td class="c"><span class="num">' + p.rank + "</span></td>" +
        "<td>" + playerLink(p) + "</td>" +
        "<td>" + UI.smashIdentity(p) + "</td>" +
        '<td class="r num"><b>' + p.elo + "</b></td>" +
        '<td class="r num">' + p.peak + "</td>" +
        '<td class="c num">' + p.w + "–" + p.l + "</td>" +
        "<td>" + UI.formDots(p.form) + "</td>" +
        '<td class="r"><span class="' + (p.trend > 0 ? "delta-up" : p.trend < 0 ? "delta-down" : "delta-flat") + '">' + (p.trend > 0 ? "+" : "") + p.trend + "</span></td>" +
        "</tr>"
      ).join("");
      panelElo.innerHTML =
        '<div class="panel-head"><div><h2>Singles</h2><p class="sub">Singles Elo, peak, and form · sample</p></div><span class="chip">Season 2026</span></div>' +
        '<div class="table-wrap"><table>' +
        '<thead><tr><th class="c">#</th><th>Player</th><th>Mains</th><th class="r">Elo</th><th class="r">Peak</th><th class="c">W–L</th><th>Form</th><th class="r">Move</th></tr></thead><tbody>' + rows + "</tbody></table></div>";
    }

    const panelDoubles = $("#panel-league");
    if (panelDoubles) {
      const rows = M.players.slice().sort((a, b) => b.eloD - a.eloD).map((p) =>
        "<tr>" +
        '<td class="c"><span class="num">' + p.rankD + "</span></td>" +
        "<td>" + playerLink(p) + "</td>" +
        "<td>" + UI.smashIdentity(p) + "</td>" +
        '<td class="r num"><b>' + p.eloD + "</b></td>" +
        '<td class="r num">' + p.peakD + "</td>" +
        '<td class="r"><span class="' + (p.trendD > 0 ? "delta-up" : p.trendD < 0 ? "delta-down" : "delta-flat") + '">' + (p.trendD > 0 ? "+" : "") + p.trendD + "</span></td>" +
        "</tr>"
      ).join("");
      panelDoubles.innerHTML =
        '<div class="panel-head"><div><h2>Doubles</h2><p class="sub">Doubles Elo, peak, and movement · sample</p></div><span class="chip">Season 2026</span></div>' +
        '<div class="table-wrap"><table>' +
        '<thead><tr><th class="c">#</th><th>Player</th><th>Mains</th><th class="r">Elo</th><th class="r">Peak</th><th class="r">Move</th></tr></thead><tbody>' + rows + "</tbody></table></div>";
    }
  }

  function renderRankings() {
    if (isTennis) { renderTennisRankings(); return; }
    if (isTableTennis) { renderTableTennisRankings(); return; }
    if (isSmash) { renderSmashRankings(); return; }
    const elo = $("#elo-body");
    if (elo) {
      elo.innerHTML = M.players.map((p) =>
        "<tr>" +
        '<td class="c"><span class="num">' + p.rank + "</span></td>" +
        "<td>" + playerLink(p) + "</td>" +
        "<td>" + teamStack(p) + "</td>" +
        '<td class="r num"><b>' + p.elo + "</b></td>" +
        '<td class="r num">' + p.peak + "</td>" +
        '<td class="c num">' + p.w + "–" + p.d + "–" + p.l + "</td>" +
        "<td>" + UI.formDots(p.form) + "</td>" +
        '<td class="r"><span class="' + (p.trend > 0 ? "delta-up" : p.trend < 0 ? "delta-down" : "delta-flat") + '">' +
        (p.trend > 0 ? "+" : "") + p.trend + "</span></td>" +
        "</tr>"
      ).join("");
    }

    const league = $("#league-body");
    if (league) {
      league.innerHTML = M.standings.map((s) => {
        const p = UI.playerByName(s.name);
        return "<tr>" +
        '<td class="c"><span class="num">' + s.p + "</span></td>" +
          "<td>" + (p ? playerLink(p) : esc(s.name)) + "</td>" +
          "<td>" + (p ? teamStack(p) : '<span class="muted">—</span>') + "</td>" +
          '<td class="c num">' + s.pld + "</td><td class=\"c num\">" + s.w + "</td><td class=\"c num\">" + s.d + "</td><td class=\"c num\">" + s.l + "</td>" +
          '<td class="c num">' + s.gf + "</td><td class=\"c num\">" + s.ga + "</td>" +
          '<td class="c num">' + (isTableTennis ? s.gf + "–" + s.ga : (s.gd > 0 ? "+" : "") + s.gd) + "</td>" +
          '<td class="c num"><b>' + s.pts + "</b></td>" +
          "<td>" + UI.formDots(s.form) + "</td></tr>";
      }).join("");
    }
  }

  function renderTableTennisRankings() {
    const tabElo = $("#tab-elo"), tabLeague = $("#tab-league");
    if (tabElo) tabElo.textContent = "Singles Elo";
    if (tabLeague) tabLeague.textContent = "Game table";
    const how = $("#elo-how");
    if (how) how.setAttribute("data-demo", "Table Tennis uses its own singles rating. Approved matches update Elo; submitted scores wait for admin approval.");

    const panelElo = $("#panel-elo");
    if (panelElo) {
      const rows = M.players.slice().sort((a, b) => b.elo - a.elo).map((p) =>
        "<tr><td class=\"c\"><span class=\"num\">" + p.rank + "</span></td><td>" + playerLink(p) + "</td><td>" + UI.identity(p) + "</td>" +
        '<td class="r num"><b>' + p.elo + "</b></td><td class=\"r num\">" + p.peak + "</td><td class=\"c num\">" + p.w + "–" + p.l + "</td><td>" + UI.formDots(p.form) + "</td>" +
        '<td class="r"><span class="' + (p.trend > 0 ? "delta-up" : p.trend < 0 ? "delta-down" : "delta-flat") + '">' + (p.trend > 0 ? "+" : "") + p.trend + "</span></td></tr>"
      ).join("");
      panelElo.innerHTML = '<div class="panel-head"><div><h2>Singles Elo</h2><p class="sub">Table Tennis rating, peak, and form · sample</p></div><span class="chip">Season 2026</span></div><div class="table-wrap"><table><thead><tr><th class="c">#</th><th>Player</th><th>Nat</th><th class="r">Elo</th><th class="r">Peak</th><th class="c">W–L</th><th>Form</th><th class="r">Move</th></tr></thead><tbody>' + rows + "</tbody></table></div>";
    }

    const panelLeague = $("#panel-league");
    if (panelLeague) {
      const rows = M.standings.map((s) => {
        const p = UI.playerByName(s.name);
        const gameDiff = s.gf - s.ga;
        return "<tr><td class=\"c\"><span class=\"num\">" + s.p + "</span></td><td>" + (p ? playerLink(p) : esc(s.name)) + "</td><td>" + (p ? UI.identity(p) : '<span class="muted">—</span>') + "</td>" +
          '<td class="c num">' + s.pld + "</td><td class=\"c num\">" + s.w + "</td><td class=\"c num\">" + s.l + "</td><td class=\"c num\">" + s.gf + "–" + s.ga + "</td><td class=\"c num\"><b>" + s.pts + "</b></td><td>" + UI.formDots(s.form) + "</td></tr>";
      }).join("");
      panelLeague.innerHTML = '<div class="panel-head"><div><h2>' + esc(M.competitions[0].name) + '</h2><p class="sub">Match wins and games won · sample</p></div><span class="chip">Season 2026</span></div><div class="table-wrap"><table><thead><tr><th class="c">#</th><th>Player</th><th>Nat</th><th class="c">P</th><th class="c">W</th><th class="c">L</th><th class="c">Games W–L</th><th class="c">Pts</th><th>Form</th></tr></thead><tbody>' + rows + "</tbody></table></div>";
    }
  }

  function renderCompetitions() {
    const grid = $("#competition-grid");
    if (!grid) return;
    const iconFor = { League: "list", Tournament: "trophy" };
    grid.innerHTML = M.competitions.map((c) => {
      const pct = c.fixtures ? Math.round((c.played / c.fixtures) * 100) : 0;
      return '<a class="competition-card panel" href="competition.html?id=' + encodeURIComponent(c.id) + gameQuery + '">' +
        '<div class="competition-card-top"><span class="monogram" data-tone="' + (c.kind === "League" ? "navy" : "orange") + '">' + UI.icon(iconFor[c.kind] || "trophy", 18) + "</span>" +
        '<span class="competition-card-chips"><span class="chip">' + esc(c.status) + "</span>" +
        (c.custom ? '<span class="chip">Custom</span>' : "") + "</span></div>" +
        "<div><h3>" + esc(c.name) + "</h3><p class=\"meta\">" + esc(c.kind) + " · " + esc(c.format) + "</p></div>" +
        '<div class="competition-progress" aria-label="' + pct + '% complete"><i style="width:' + pct + '%"></i></div>' +
        '<div class="competition-card-foot"><span>' + c.played + " of " + c.fixtures + " matches</span><span>" + esc(c.leader) + "</span></div>" +
        "</a>";
    }).join("");
  }

  function renderPlayers() {
    const tbody = $("#players-body");
    if (!tbody) return;
    if (isTennis || isTableTennis || isSmash) {
      const rows = M.players.map((p) =>
        "<tr>" +
        '<td class="c"><span class="num">' + p.rank + "</span></td>" +
        "<td>" + playerLink(p) + "</td>" +
        "<td>" + (isSmash ? UI.smashIdentity(p) : UI.identity(p)) + "</td>" +
        '<td class="r num"><b>' + p.elo + "</b></td>" +
        '<td class="c num">' + p.w + "–" + p.l + "</td>" +
        "<td>" + UI.formDots(p.form) + "</td>" +
        '<td class="r"><a class="btn btn-outline btn-sm" href="player.html?player=' + p.id + gameQuery + '">Profile</a></td>' +
        "</tr>"
      ).join("");
      tbody.closest("table").innerHTML =
        '<thead><tr><th class="c">#</th><th>Player</th><th>' + (isSmash ? "Mains" : "Nat") + '</th><th class="r">Elo</th><th class="c">W–L</th><th>Form</th><th class="r">Profile</th></tr></thead><tbody>' + rows + "</tbody>";
      return;
    }
    tbody.innerHTML = M.players.map((p) =>
      "<tr>" +
      '<td class="c"><span class="num">' + p.rank + "</span></td>" +
      "<td>" + playerLink(p) + "</td>" +
      "<td>" + teamStack(p) + "</td>" +
      '<td class="r num"><b>' + p.elo + "</b></td>" +
      '<td class="c num">' + p.w + "–" + p.d + "–" + p.l + "</td>" +
      "<td>" + UI.formDots(p.form) + "</td>" +
      '<td class="r"><a class="btn btn-outline btn-sm" href="player.html?player=' + p.id + gameQuery + '">Profile</a></td>' +
      "</tr>"
    ).join("");
  }

  function renderReview() {
    const tbody = $("#review-body");
    if (tbody) {
      const pending = M.matches.filter((m) => m.status === "pending");
      tbody.innerHTML = pending.map((m) =>
        "<tr>" +
        "<td>" + esc(UI.formatDate(m.date)) + "</td>" +
        "<td>" + (isSmash ? UI.smashScorecard(m) : (isTennis || isTableTennis ? tennisSummary(m) : UI.summary(m))) + "</td>" +
        '<td><span class="chip">' + esc(m.league) + "</span></td>" +
        "<td>" + esc(m.submitted) + "</td>" +
        '<td><div class="table-actions"><button class="btn btn-primary btn-sm" type="button" data-review="' + m.id + '">Review</button></div></td>' +
        "</tr>"
      ).join("");
    }

    const locked = $("#locked-body");
    if (locked) {
      locked.innerHTML = M.matches.filter((m) => m.status === "locked").slice(0, 3).map((m) =>
        "<tr><td>" + esc(UI.formatDate(m.date)) + "</td><td>" + (isSmash ? UI.smashScorecard(m) : (isTennis || isTableTennis ? tennisSummary(m) : UI.summary(m))) + "</td>" +
        '<td><span class="chip">' + esc(m.league) + "</span></td>" +
        '<td class="c"><span class="' + (m.delta > 0 ? "delta-up" : "delta-down") + '">' + (m.delta > 0 ? "+" : "") + m.delta + "</span></td></tr>"
      ).join("");
    }
  }

  function initFilters() {
    const buttons = $$("#match-filters button");
    const search = $("#match-search");
    if (isTennis || isTableTennis || isSmash) {
      buttons.forEach((b) => { if (b.getAttribute("data-filter") === "cup") b.textContent = "Tournament"; });
      if (search) search.setAttribute("placeholder", "Search players");
    }
    let active = "all";

    function apply() {
      const q = (search && search.value || "").trim().toLowerCase();
      $$("#matches-body tr").forEach((row) => {
        const kind = row.getAttribute("data-kind");
        const status = row.getAttribute("data-status");
        const kindOk = active === "all" || (active === "pending" ? status === "pending" : kind === active);
        const queryOk = !q || row.textContent.toLowerCase().includes(q);
        row.hidden = !(kindOk && queryOk);
      });
    }

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        active = btn.getAttribute("data-filter");
        buttons.forEach((b) => b.setAttribute("aria-pressed", b === btn ? "true" : "false"));
        apply();
      });
    });
    if (search) search.addEventListener("input", apply);
  }

  function initTennisRecord() {
    const section = $("[data-view-panel='record']");
    if (!section) return;
    const layout = section.querySelector(".record-layout");
    if (!layout) return;

    const opts = M.players.map((p) => '<option value="' + p.id + '">' + esc(p.name) + "</option>").join("");
    const comps = M.competitions.map((c) => '<option value="' + esc(c.name) + '">' + esc(c.name) + "</option>").join("") +
      '<option value="Friendly — no table">Friendly — no table</option>';

    layout.innerHTML =
      '<div class="panel">' +
      '<div class="panel-head"><div><h2>Match details</h2><p class="sub">Singles or doubles, best-of sets, and a surface.</p></div><span class="sample-tag">Demo</span></div>' +
      '<div class="panel-body">' +
      '<form id="record-form" class="tennis-form" novalidate>' +
      '<div class="form-section">' +
      '<div class="form-section-title">Match setup</div>' +
      '<div class="field"><label for="t-comp">Competition</label><select class="select" id="t-comp">' + comps + "</select></div>" +
      '<div class="field"><span class="field-label">Format</span>' +
      '<div class="segmented" role="group" aria-label="Format" id="t-format">' +
      '<button type="button" data-tformat="singles" aria-pressed="true">Singles</button>' +
      '<button type="button" data-tformat="doubles" aria-pressed="false">Doubles</button>' +
      "</div></div>" +
      '<div class="form-grid">' +
      '<div class="field"><label for="t-best">Match format</label><select class="select" id="t-best"><option value="1">Best of 1 set</option><option value="3" selected>Best of 3 sets</option><option value="5">Best of 5 sets</option></select></div>' +
      '<div class="field"><label for="t-surface">Surface</label><select class="select" id="t-surface"><option value="Hardcourt" selected>Hardcourt</option><option value="Grass">Grass</option><option value="Clay">Clay</option></select></div>' +
      "</div>" +
      '<label class="check" id="t-tb-wrap"><input type="checkbox" id="t-tb" checked><span class="check-copy"><b>Tiebreak at 6–6</b><span>Decide a level set with a 7-point tiebreak.</span></span></label>' +
      "</div>" +
      '<div class="form-section">' +
      '<div class="form-section-title" id="t-players-title">Players</div>' +
      '<div class="form-grid">' +
      '<div class="field"><label for="t-p1" id="t-p1-label">Player one</label><select class="select" id="t-p1">' + opts + "</select></div>" +
      '<div class="field" id="t-p1b-wrap" hidden><label for="t-p1b">Team one · player B</label><select class="select" id="t-p1b">' + opts + "</select></div>" +
      '<div class="field"><label for="t-p2" id="t-p2-label">Player two</label><select class="select" id="t-p2">' + opts + "</select></div>" +
      '<div class="field" id="t-p2b-wrap" hidden><label for="t-p2b">Team two · player B</label><select class="select" id="t-p2b">' + opts + "</select></div>" +
      "</div></div>" +
      '<div class="form-section">' +
      '<div class="form-section-title">Enter games won in each set</div>' +
      '<div class="set-head"><span>Set</span><span>Player 1</span><span></span><span>Player 2</span><span class="set-label">TB score</span></div>' +
      '<div id="t-sets"></div>' +
      '<p class="hint">Type each player’s games for every set, for example 6–4 or 7–6. For a tiebreak, enter both players’ points in player 1–player 2 order, such as 7–5.</p>' +
      "</div>" +
      '<div class="form-section">' +
      '<label class="check"><input type="checkbox" id="t-elo" checked><span class="check-copy"><b>Counts for Elo</b><span>On by default; turn off only for a friendly that should not move ratings.</span></span></label>' +
      '<div class="field"><label for="t-note">Note <span class="muted">(optional)</span></label><textarea class="textarea" id="t-note" placeholder="Anything the group should know about this match."></textarea></div>' +
      "</div>" +
      '<div class="form-actions">' +
      '<button class="btn btn-primary" type="submit"><span data-icon="check" data-size="18"></span> Submit for approval</button>' +
      '<button class="btn btn-ghost" type="reset">Reset</button>' +
      "</div>" +
      '<div class="demo-note" style="margin-top:14px;"><span data-icon="info" data-size="16"></span><span>This is a static mockup. Submitting shows a confirmation but saves nothing.</span></div>' +
      "</form>" +
      "</div></div>" +
      '<aside class="record-summary">' +
      '<div class="summary-match">' +
      '<div class="form-section-title">Match preview</div>' +
      '<div class="tennis-summary" id="t-summary"></div>' +
      '<div class="summary-tags" id="t-tags" style="margin-top:12px;"></div>' +
      '<div class="elo-projection" id="t-projection"></div>' +
      '<div class="summary-meta">' +
      '<div><span>Format</span><b id="t-meta-format">Singles</b></div>' +
      '<div><span>Best of</span><b id="t-meta-best">3 sets</b></div>' +
      '<div><span>Status</span><b>Needs approval</b></div>' +
      "</div>" +
      "</div>" +
      '<div class="notice-card"><h3>How approval works</h3><p>The opponent confirms the score, then a game admin reviews it. Only approved matches count toward Elo and the table.</p></div>' +
      "</aside>";

    const form = $("#record-form");
    const fmtButtons = $$("#t-format button");
    const bestSel = $("#t-best");
    const surfaceSel = $("#t-surface");
    const tbCheck = $("#t-tb");
    const eloCheck = $("#t-elo");
    const compSel = $("#t-comp");
    const p1 = $("#t-p1");
    const p2 = $("#t-p2");
    const p1b = $("#t-p1b");
    const p2b = $("#t-p2b");
    const setsWrap = $("#t-sets");
    let format = "singles";

    if (p2) p2.value = M.players[1] ? String(M.players[1].id) : "";
    if (p1b) p1b.value = M.players[2] ? String(M.players[2].id) : "";
    if (p2b) p2b.value = M.players[3] ? String(M.players[3].id) : "";

    function setFormat(next) {
      format = next;
      fmtButtons.forEach((b) => b.setAttribute("aria-pressed", b.getAttribute("data-tformat") === next ? "true" : "false"));
      const doubles = next === "doubles";
      $("#t-p1b-wrap").hidden = !doubles;
      $("#t-p2b-wrap").hidden = !doubles;
      $("#t-p1-label").textContent = doubles ? "Team one · player A" : "Player one";
      $("#t-p2-label").textContent = doubles ? "Team two · player A" : "Player two";
      $("#t-players-title").textContent = doubles ? "Teams" : "Players";
      update();
    }

    fmtButtons.forEach((b) => b.addEventListener("click", () => setFormat(b.getAttribute("data-tformat"))));

    function renderSets() {
      const count = Number(bestSel.value) || 3;
      let html = "";
      for (let i = 1; i <= count; i++) {
        html += '<div class="set-row" data-set="' + i + '">' +
          '<span class="set-row-label">' + i + '</span>' +
          '<input class="input" type="number" min="0" max="99" inputmode="numeric" data-role="a" aria-label="Set ' + i + ' games player one">' +
          '<span class="set-label">–</span>' +
          '<input class="input" type="number" min="0" max="99" inputmode="numeric" data-role="b" aria-label="Set ' + i + ' games player two">' +
          '<input class="input tb-in" type="text" inputmode="numeric" maxlength="5" placeholder="7-5" data-role="tb" aria-label="Set ' + i + ' tiebreak points, player one then player two" disabled>' +
          "</div>";
      }
      setsWrap.innerHTML = html;
      update();
    }

    function collectedSets() {
      const out = [];
      $$("#t-sets .set-row").forEach((row) => {
        const aInput = row.querySelector('[data-role="a"]');
        const bInput = row.querySelector('[data-role="b"]');
        if (!aInput.value && !bInput.value) return;
        const tbInput = row.querySelector('[data-role="tb"]');
        const tieMatch = tbInput && tbInput.value.match(/^\s*(\d{1,2})\s*[-–]\s*(\d{1,2})\s*$/);
        out.push({
          a: aInput.value === "" ? null : Number(aInput.value),
          b: bInput.value === "" ? null : Number(bInput.value),
          tbA: tieMatch ? Number(tieMatch[1]) : null,
          tbB: tieMatch ? Number(tieMatch[2]) : null
        });
      });
      return out;
    }

    function playerName(id) { const p = UI.playerById(id); return p ? p.name : "Player"; }

    function sideNames() {
      if (format === "doubles") {
        return { a: playerName(p1.value) + " + " + playerName(p1b.value), b: playerName(p2.value) + " + " + playerName(p2b.value) };
      }
      return { a: playerName(p1.value), b: playerName(p2.value) };
    }

    function update() {
      $$("#t-sets .set-row").forEach((row) => {
        const a = Number(row.querySelector('[data-role="a"]').value) || 0;
        const b = Number(row.querySelector('[data-role="b"]').value) || 0;
        const g = 6;
        const tb = row.querySelector('[data-role="tb"]');
        const tiebreak = tbCheck.checked && ((a === g + 1 && b === g) || (a === g && b === g + 1));
        tb.disabled = !tiebreak || (!row.querySelector('[data-role="a"]').value && !row.querySelector('[data-role="b"]').value);
        if (!tiebreak) tb.value = "";
      });

      const names = sideNames();
      const sets = collectedSets();
      const scoreHead = $$("#t-sets").length ? $(".set-head", section) : null;
      if (scoreHead) {
        const labels = scoreHead.querySelectorAll("span");
        labels[1].textContent = names.a;
        labels[3].textContent = names.b;
      }
      const summary = $("#t-summary");
      if (summary) {
        summary.innerHTML = UI.tennisScoreboard({
          format: format,
          p1: Number(p1.value), p2: Number(p2.value),
          team1: [Number(p1.value), Number(p1b.value)], team2: [Number(p2.value), Number(p2b.value)],
          sets: sets.length ? sets : [{ a: null, b: null }]
        });
      }
      const tags = $("#t-tags");
      if (tags) {
        tags.innerHTML = '<span class="chip">' + esc(compSel.value) + "</span>" +
          '<span class="chip">' + (format === "doubles" ? "Doubles" : "Singles") + "</span>" +
          '<span class="chip" id="t-elo-chip">' + (eloCheck.checked ? "Elo on" : "Elo off") + "</span>";
      }
      $("#t-meta-format").textContent = format === "doubles" ? "Doubles" : "Singles";
      $("#t-meta-best").textContent = (Number(bestSel.value) || 3) + " sets";

      const proj = $("#t-projection");
      if (proj) {
        const completeSets = sets.filter((set) => set.a != null && set.b != null && set.a !== set.b);
        const targetSets = Math.floor((Number(bestSel.value) || 3) / 2) + 1;
        const setsWon = [completeSets.filter((set) => set.a > set.b).length, completeSets.filter((set) => set.b > set.a).length];
        const matchComplete = Math.max(setsWon[0], setsWon[1]) >= targetSets;
        proj.hidden = !eloCheck.checked;
        if (eloCheck.checked && matchComplete) {
          let eloA, eloB;
          if (format === "doubles") {
            const idsA = [p1.value, p1b.value].map(Number);
            const idsB = [p2.value, p2b.value].map(Number);
            eloA = avg(idsA.map((id) => (UI.playerById(id) || {}).eloD || 1500));
            eloB = avg(idsB.map((id) => (UI.playerById(id) || {}).eloD || 1500));
          } else {
            eloA = (UI.playerById(p1.value) || {}).elo || 1500;
            eloB = (UI.playerById(p2.value) || {}).elo || 1500;
          }
          const r = ELO.tennisProject({ eloA: eloA, eloB: eloB, sets: completeSets });
          proj.innerHTML =
            '<div class="elo-projection-head"><span>Projected ' + (format === "doubles" ? "doubles" : "singles") + " Elo</span><span>Margin-aware</span></div>" +
            '<div class="elo-projection-row"><span>' + esc(names.a) + "</span><b>" + (r.deltaA > 0 ? "+" : "") + r.deltaA + "</b></div>" +
            '<div class="elo-projection-row"><span>' + esc(names.b) + "</span><b>" + (r.deltaB > 0 ? "+" : "") + r.deltaB + "</b></div>" +
            '<p class="elo-projection-note">' + r.setsWonA + "–" + r.setsWonB + " sets · games diff " + (r.gamesDiff > 0 ? "+" : "") + r.gamesDiff + " · K " + r.k + "</p>";
        } else {
          proj.innerHTML = eloCheck.checked ? '<p class="elo-projection-note">Enter a complete match score to see the Elo projection.</p>' : "";
        }
      }
    }

    function avg(list) { return list.length ? list.reduce((s, n) => s + n, 0) / list.length : 1500; }

    bestSel.addEventListener("change", renderSets);
    tbCheck.addEventListener("change", update);
    eloCheck.addEventListener("change", update);
    surfaceSel.addEventListener("change", update);
    compSel.addEventListener("change", update);
    [p1, p2].forEach((s) => s && s.addEventListener("change", update));
    [p1b, p2b].forEach((s) => s && s.addEventListener("change", update));
    form.addEventListener("input", (e) => { if (e.target.closest("#t-sets")) update(); });
    form.addEventListener("change", (e) => { if (e.target.closest("#t-sets")) update(); });

    form.addEventListener("reset", () => setTimeout(() => { renderSets(); }, 0));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (format === "doubles") {
        const ids = [p1.value, p1b.value, p2.value, p2b.value];
        if (new Set(ids).size !== 4) { UI.toast("Choose four different players for a doubles match."); return; }
      } else if (p1.value === p2.value) {
        UI.toast("Choose two different players for this result.");
        return;
      }
      const sets = collectedSets();
      const bestOf = Number(bestSel.value) || 3;
      const targetSets = Math.floor(bestOf / 2) + 1;
      const rows = $$("#t-sets .set-row");
      let foundGap = false;
      let gapBeforeScore = false;
      rows.forEach((row) => {
        const a = row.querySelector('[data-role="a"]').value;
        const b = row.querySelector('[data-role="b"]').value;
        if (!a && !b) foundGap = true;
        else if (foundGap) gapBeforeScore = true;
      });
      if (gapBeforeScore) { UI.toast("Enter set scores in order without skipping a set."); return; }
      const completed = sets.filter((set) => set.a != null && set.b != null);
      if (sets.some((set) => set.a == null || set.b == null)) {
        UI.toast("Enter both players’ scores for each set, or leave that set blank.");
        return;
      }
      if (completed.some((set) => !Number.isInteger(set.a) || !Number.isInteger(set.b) || set.a < 0 || set.b < 0 || set.a > 99 || set.b > 99)) {
        UI.toast("Set scores must be whole numbers from 0 to 99.");
        return;
      }
      const gamesToWin = 6;
      const badSet = completed.find((set) => {
        const high = Math.max(set.a, set.b), low = Math.min(set.a, set.b);
        const tiebreakSet = tbCheck.checked && high === gamesToWin + 1 && low === gamesToWin;
        const invalidTiebreakFormat = tbCheck.checked && (high > gamesToWin + 1 || high === gamesToWin + 1 && low < gamesToWin);
        const tiePoints = [set.tbA, set.tbB];
        const tieHigh = Math.max(...tiePoints.map((value) => value == null ? -1 : value));
        const tieLow = Math.min(...tiePoints.map((value) => value == null ? -1 : value));
        const tieWinnerScore = set.a > set.b ? set.tbA : set.tbB;
        const tieLoserScore = set.a > set.b ? set.tbB : set.tbA;
        const invalidTieScore = tiebreakSet && (tiePoints.some((value) => value == null) || tieHigh < 7 || tieHigh - tieLow < 2 || tieWinnerScore <= tieLoserScore);
        return high === low || high < gamesToWin || (high - low < 2 && !tiebreakSet) || invalidTiebreakFormat || invalidTieScore || (!tiebreakSet && tiePoints.some((value) => value != null));
      });
      if (badSet) {
        UI.toast("Check the set score. A 7–6 set needs valid tiebreak points in player 1–player 2 order, such as 7–5.");
        return;
      }
      const resultSets = [completed.filter((set) => set.a > set.b).length, completed.filter((set) => set.b > set.a).length];
      if (Math.max(resultSets[0], resultSets[1]) !== targetSets || completed.length > bestOf) {
        UI.toast("Enter scores through the winning set using the selected best-of format.");
        return;
      }
      const winnerIndex = resultSets[0] > resultSets[1] ? 0 : 1;
      const winnerSetPosition = completed.reduce((last, set, index) =>
        (winnerIndex === 0 ? set.a > set.b : set.b > set.a) ? index + 1 : last, 0);
      if (winnerSetPosition !== completed.length) {
        UI.toast("Remove any set scores entered after the match was decided.");
        return;
      }
      update();
      const customCompetition = M.competitions.find(c => c.custom && c.name === compSel.value);
      if (customCompetition) {
        COMP_RESULTS.recordFromForm(gameSlug, customCompetition.id, UI.playerById(Number(p1.value)).name, UI.playerById(Number(p2.value)).name, {a:resultSets[0],b:resultSets[1],sets:completed,detail:completed.map(s=>s.a+"–"+s.b).join(", ")});
        return;
      }
      UI.toast("Sample result — not saved. Open a custom competition to record a scheduled fixture.");
    });

    renderSets();
    update();
  }

  function initTableTennisRecord() {
    const section = $("[data-view-panel='record']");
    const layout = section && section.querySelector(".record-layout");
    if (!layout) return;
    const opts = M.players.map((p) => '<option value="' + p.id + '">' + esc(p.name) + "</option>").join("");
    const comps = M.competitions.map((c) => '<option value="' + esc(c.name) + '">' + esc(c.name) + "</option>").join("") + '<option value="Friendly — no table">Friendly — no table</option>';
    layout.innerHTML = '<div class="panel"><div class="panel-head"><div><h2>Match details</h2><p class="sub">Singles scoring · games to 11, win by 2.</p></div><span class="sample-tag">Demo</span></div><div class="panel-body">' +
      '<form id="tt-record-form" class="tt-record-form" novalidate><div class="form-section"><div class="form-section-title">Match setup</div>' +
      '<div class="field"><label for="tt-comp">Competition</label><select class="select" id="tt-comp">' + comps + "</select></div>" +
      '<div class="form-grid"><div class="field"><label for="tt-best">Match format</label><select class="select" id="tt-best"><option value="1">Best of 1 game</option><option value="3" selected>Best of 3 games</option><option value="5">Best of 5 games</option></select></div>' +
      '<div class="field"><label>Rating</label><p class="hint">Singles Elo, separate from other games.</p></div></div></div>' +
      '<div class="form-section"><div class="form-section-title">Players</div><div class="form-grid"><div class="field"><label for="tt-p1">Player one</label><select class="select" id="tt-p1">' + opts + '</select></div><div class="field"><label for="tt-p2">Player two</label><select class="select" id="tt-p2">' + opts + '</select></div></div></div>' +
      '<div class="form-section"><div class="form-section-title">Enter points in each game</div><div class="tt-game-head"><span>Game</span><span>Player one</span><span>Player two</span></div><div id="tt-games"></div><p class="hint">Games go to at least 11, with a 2-point lead required, including at deuce. No tennis-style set tiebreaks.</p></div>' +
      '<div class="form-section"><label class="check"><input type="checkbox" id="tt-elo-toggle" checked><span class="check-copy"><b>Counts for Elo</b><span>Approved results move the Table Tennis singles rating.</span></span></label><div class="field"><label for="tt-note">Note <span class="muted">(optional)</span></label><textarea class="textarea" id="tt-note" placeholder="Anything the group should know about this match."></textarea></div></div>' +
      '<div class="form-actions"><button class="btn btn-primary" type="submit"><span data-icon="check" data-size="18"></span> Submit for approval</button><button class="btn btn-ghost" type="reset">Reset</button></div>' +
      '<div class="demo-note" style="margin-top:14px;">' + UI.icon("info", 16) + '<span>This is a static mockup. Submitting shows a confirmation but saves nothing.</span></div></form></div></div>' +
      '<aside class="record-summary"><div class="summary-match"><div class="form-section-title">Match preview</div><div class="tennis-summary" id="tt-summary"></div><div class="summary-tags" id="tt-tags" style="margin-top:12px;"></div><div class="elo-projection" id="tt-projection"></div>' +
      '<div class="summary-meta"><div><span>Format</span><b id="tt-meta-best">Best of 3</b></div><div><span>Status</span><b>Needs approval</b></div></div></div>' +
      '<div class="notice-card"><h3>How approval works</h3><p>The opponent confirms the score, then a game admin reviews it. Only approved matches count toward Elo and the table.</p></div></aside>';

    const form = $("#tt-record-form"), best = $("#tt-best"), p1 = $("#tt-p1"), p2 = $("#tt-p2"), elo = $("#tt-elo-toggle"), comp = $("#tt-comp"), wrap = $("#tt-games");
    if (M.players[1]) p2.value = String(M.players[1].id);
    const presetComp = params.get("comp");
    const presetCompetition = presetComp && M.competitions.find((competition) => competition.id === presetComp);
    if (presetCompetition) comp.value = presetCompetition.name;

    function renderGames() {
      wrap.innerHTML = Array.from({ length: Number(best.value) || 3 }, (_, index) =>
        '<div class="tt-game-row" data-game="' + (index + 1) + '"><span class="set-row-label">' + (index + 1) + '</span><input class="input" type="number" min="0" max="99" inputmode="numeric" data-side="a" aria-label="Game ' + (index + 1) + ' player one points"><input class="input" type="number" min="0" max="99" inputmode="numeric" data-side="b" aria-label="Game ' + (index + 1) + ' player two points"></div>'
      ).join("");
      update();
    }

    function games() {
      return $$("#tt-games .tt-game-row").map((row) => {
        const a = row.querySelector('[data-side="a"]').value, b = row.querySelector('[data-side="b"]').value;
        return { a: a === "" ? null : Number(a), b: b === "" ? null : Number(b) };
      });
    }

    function update() {
      const scored = games().filter((g) => g.a != null || g.b != null);
      const entries = scored.length ? scored : [{ a: null, b: null }];
      const match = { p1: Number(p1.value), p2: Number(p2.value), sets: entries };
      $("#tt-summary").innerHTML = UI.tableTennisScorecard(match);
      $("#tt-tags").innerHTML = '<span class="chip">' + esc(comp.value) + '</span><span class="chip">Singles</span><span class="chip">' + (elo.checked ? "Elo on" : "Elo off") + "</span>";
      $("#tt-meta-best").textContent = "Best of " + best.value;
      const allGamesValid = scored.length > 0 && scored.every((g) => g.a != null && g.b != null && g.a !== g.b && Math.max(g.a, g.b) >= 11 && Math.abs(g.a - g.b) >= 2);
      const completed = allGamesValid ? scored : [];
      const winsA = completed.filter((g) => g.a > g.b).length, winsB = completed.length - winsA;
      const target = Math.floor(Number(best.value) / 2) + 1;
      let decidedAt = 0, rollingA = 0, rollingB = 0;
      completed.forEach((g, index) => { if (g.a > g.b) rollingA++; else rollingB++; if (!decidedAt && Math.max(rollingA, rollingB) === target) decidedAt = index + 1; });
      const projection = $("#tt-projection");
      projection.hidden = !elo.checked;
      if (elo.checked && Math.max(winsA, winsB) === target && decidedAt === completed.length) {
        const a = UI.playerById(p1.value), b = UI.playerById(p2.value);
        const result = ELO.tableTennisProject({ eloA: a ? a.elo : 1500, eloB: b ? b.elo : 1500, games: completed });
        projection.innerHTML = '<div class="elo-projection-head"><span>Projected Table Tennis Elo</span><span>Margin-aware</span></div><div class="elo-projection-row"><span>' + esc(a.name) + '</span><b>' + signed(result.deltaA) + '</b></div><div class="elo-projection-row"><span>' + esc(b.name) + '</span><b>' + signed(result.deltaB) + '</b></div><p class="elo-projection-note">' + result.gamesWonA + "–" + result.gamesWonB + " games · points diff " + (result.pointsDiff > 0 ? "+" : "") + result.pointsDiff + " · K " + result.k + "</p>";
      } else projection.innerHTML = elo.checked ? '<p class="elo-projection-note">Enter a complete match score to see the Elo projection.</p>' : "";
    }

    best.addEventListener("change", renderGames);
    [p1, p2, elo, comp].forEach((input) => input.addEventListener("change", update));
    form.addEventListener("input", (event) => { if (event.target.closest("#tt-games")) update(); });
    form.addEventListener("reset", () => setTimeout(() => { if (M.players[1]) p2.value = String(M.players[1].id); renderGames(); }, 0));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (p1.value === p2.value) { UI.toast("Choose two different players for this result."); return; }
      const rows = $$("#tt-games .tt-game-row"), entered = rows.map((row) => [row.querySelector('[data-side="a"]').value, row.querySelector('[data-side="b"]').value]);
      let blank = false, gap = false;
      entered.forEach(([a, b]) => { if (a === "" && b === "") blank = true; else if (blank) gap = true; });
      if (gap) { UI.toast("Enter game scores in order without skipping a game."); return; }
      const scored = entered.filter(([a, b]) => a !== "" || b !== "");
      if (!scored.length || scored.some(([a, b]) => a === "" || b === "")) { UI.toast("Enter both players’ points for each game."); return; }
      const parsed = scored.map(([a, b]) => [Number(a), Number(b)]);
      if (parsed.some(([a, b]) => !Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a > 99 || b > 99)) { UI.toast("Game scores must be whole numbers from 0 to 99."); return; }
      if (parsed.some(([a, b]) => a === b || Math.max(a, b) < 11 || Math.abs(a - b) < 2)) { UI.toast("Each game must reach at least 11 points with a 2-point lead."); return; }
      const target = Math.floor(Number(best.value) / 2) + 1;
      let winsA = 0, winsB = 0, decidedAt = 0;
      parsed.forEach(([a, b], index) => { if (a > b) winsA++; else winsB++; if (!decidedAt && Math.max(winsA, winsB) === target) decidedAt = index + 1; });
      if (Math.max(winsA, winsB) !== target || parsed.length !== decidedAt) { UI.toast("Enter scores through the winning game using the selected best-of format."); return; }
      update();
      const customCompetition = M.competitions.find(c => c.custom && c.name === comp.value);
      if (customCompetition) {
        COMP_RESULTS.recordFromForm(gameSlug, customCompetition.id, UI.playerById(Number(p1.value)).name, UI.playerById(Number(p2.value)).name, {a:winsA,b:winsB,games:parsed,detail:parsed.map(s=>s.join("–")).join(", ")});
        return;
      }
      UI.toast("Sample result — not saved. Open a custom competition to record a scheduled fixture.");
    });
    renderGames();
  }

  function initSmashRecord() {
    const section = $("[data-view-panel='record']");
    const layout = section && section.querySelector(".record-layout");
    if (!layout) return;

    const roster = M.roster || [];
    const stages = M.stages || [];
    const opts = M.players.map((p) => '<option value="' + p.id + '">' + esc(p.name) + "</option>").join("");
    const comps = M.competitions.map((c) => '<option value="' + esc(c.name) + '">' + esc(c.name) + "</option>").join("") + '<option value="Friendly — no table">Friendly — no table</option>';

    layout.innerHTML =
      '<div class="panel">' +
      '<div class="panel-head"><div><h2>Match details</h2><p class="sub">Singles or doubles, stocks, fighters, and stages.</p></div><span class="sample-tag">Demo</span></div>' +
      '<div class="panel-body">' +
      '<form id="smash-record-form" class="smash-form" novalidate>' +
      '<div class="form-section">' +
      '<div class="form-section-title">Match setup</div>' +
      '<div class="field"><label for="sm-comp">Competition</label><select class="select" id="sm-comp">' + comps + "</select></div>" +
      '<div class="field"><span class="field-label">Format</span>' +
      '<div class="segmented" role="group" aria-label="Format" id="sm-format">' +
      '<button type="button" data-smformat="singles" aria-pressed="true">Singles</button>' +
      '<button type="button" data-smformat="doubles" aria-pressed="false">Doubles</button>' +
      "</div></div>" +
      '<div class="form-grid">' +
      '<div class="field"><label for="sm-best">Match format</label><select class="select" id="sm-best"><option value="1">Best of 1 game</option><option value="3" selected>Best of 3 games</option><option value="5">Best of 5 games</option></select></div>' +
      '<div class="field"><label for="sm-stocks">Stocks</label><select class="select" id="sm-stocks"><option value="2">2 stocks</option><option value="3" selected>3 stocks</option><option value="4">4 stocks</option><option value="5">5 stocks</option></select></div>' +
      "</div></div>" +
      '<div class="form-section">' +
      '<div class="form-section-title" id="sm-players-title">Players</div>' +
      '<div class="form-grid">' +
      '<div class="field"><label for="sm-p1" id="sm-p1-label">Player one</label><select class="select" id="sm-p1">' + opts + "</select></div>" +
      '<div class="field" id="sm-p1b-wrap" hidden><label for="sm-p1b">Team one · player B</label><select class="select" id="sm-p1b">' + opts + "</select></div>" +
      '<div class="field"><label for="sm-p2" id="sm-p2-label">Player two</label><select class="select" id="sm-p2">' + opts + "</select></div>" +
      '<div class="field" id="sm-p2b-wrap" hidden><label for="sm-p2b">Team two · player B</label><select class="select" id="sm-p2b">' + opts + "</select></div>" +
      "</div></div>" +
      '<div class="form-section">' +
      '<div class="form-section-title">Enter stocks in each game</div>' +
      '<div class="smash-game-head"><span>Game</span><span>P1 stocks</span><span>P2 stocks</span><span>Fighter</span><span>Fighter</span><span>Stage</span><span>JV</span></div>' +
      '<div id="sm-games"></div>' +
      '<p class="hint">A game ends when one fighter takes every stock. Pick a fighter and a stage for each game; toggle JV when the winner took no damage (0%), and the badge shows their JV number.</p>' +
      "</div>" +
      '<div class="form-section">' +
      '<label class="check"><input type="checkbox" id="sm-elo" checked><span class="check-copy"><b>Counts for Elo</b><span>Approved results move the singles or doubles rating.</span></span></label>' +
      '<div class="field"><label for="sm-note">Note <span class="muted">(optional)</span></label><textarea class="textarea" id="sm-note" placeholder="Anything the group should know about this match."></textarea></div>' +
      "</div>" +
      '<div class="form-actions">' +
      '<button class="btn btn-primary" type="submit"><span data-icon="check" data-size="18"></span> Submit for approval</button>' +
      '<button class="btn btn-ghost" type="reset">Reset</button>' +
      "</div>" +
      '<div class="demo-note" style="margin-top:14px;"><span data-icon="info" data-size="16"></span><span>This is a static mockup. Submitting shows a confirmation but saves nothing.</span></div>' +
      "</form></div></div>" +
      '<aside class="record-summary"><div class="summary-match">' +
      '<div class="form-section-title">Match preview</div>' +
      '<div class="tennis-summary" id="sm-summary"></div>' +
      '<div class="summary-tags" id="sm-tags" style="margin-top:12px;"></div>' +
      '<div class="elo-projection" id="sm-projection"></div>' +
      '<div class="summary-meta">' +
      '<div><span>Format</span><b id="sm-meta-format">Singles</b></div>' +
      '<div><span>Best of</span><b id="sm-meta-best">3 games</b></div>' +
      '<div><span>Stocks</span><b id="sm-meta-stocks">3</b></div>' +
      '<div><span>Status</span><b>Needs approval</b></div>' +
      "</div></div>" +
      '<div class="notice-card"><h3>How approval works</h3><p>The opponent confirms the score, then a game admin reviews it. Only approved matches count toward Elo and the table.</p></div>' +
      "</aside>";

    const form = $("#smash-record-form");
    const fmtButtons = $$("#sm-format button");
    const best = $("#sm-best");
    const stocksSel = $("#sm-stocks");
    const elo = $("#sm-elo");
    const comp = $("#sm-comp");
    const p1 = $("#sm-p1");
    const p2 = $("#sm-p2");
    const p1b = $("#sm-p1b");
    const p2b = $("#sm-p2b");
    const wrap = $("#sm-games");
    let format = "singles";

    if (M.players[1]) p2.value = String(M.players[1].id);
    if (M.players[2]) p1b.value = String(M.players[2].id);
    if (M.players[3]) p2b.value = String(M.players[3].id);

    const primaryId = (side) => {
      if (format === "doubles") {
        const sel = side === 1 ? p1b : p2b;
        return sel && sel.value ? Number(sel.value) : Number(p1.value);
      }
      return side === 1 ? Number(p1.value) : Number(p2.value);
    };

    const defaultChar = (side) => {
      const id = primaryId(side);
      const player = UI.playerById(id);
      return player && player.mains && player.mains.length ? player.mains[0] : (roster[0] ? roster[0].id : null);
    };

    function charLabel(id) {
      const c = UI.smashCharById(id);
      return c ? '<span class="char-tile">' + esc(c.code) + "</span>" : '<span class="muted">Fighter</span>';
    }
    function stageLabel(id) {
      const s = UI.smashStageById(id);
      return s.code || "Stage";
    }
    function sideNames() {
      if (format === "doubles") {
        return { a: (UI.playerById(p1.value) || {}).name + " + " + (UI.playerById(p1b.value) || {}).name, b: (UI.playerById(p2.value) || {}).name + " + " + (UI.playerById(p2b.value) || {}).name };
      }
      return { a: (UI.playerById(p1.value) || {}).name || "Player 1", b: (UI.playerById(p2.value) || {}).name || "Player 2" };
    }

    function renderGames() {
      const count = Number(best.value) || 3;
      const cA = defaultChar(1);
      const cB = defaultChar(2);
      let html = "";
      for (let i = 1; i <= count; i++) {
        html += '<div class="smash-game-row" data-game="' + i + '" data-char-a="' + (cA || "") + '" data-char-b="' + (cB || "") + '" data-stage="' + (stages[0] ? stages[0].id : "") + '">' +
          '<span class="set-row-label">' + i + '</span>' +
          '<input class="input stock-in" type="number" min="0" max="' + Number(stocksSel.value) + '" inputmode="numeric" data-side="a" aria-label="Game ' + i + ' stocks player one">' +
          '<input class="input stock-in" type="number" min="0" max="' + Number(stocksSel.value) + '" inputmode="numeric" data-side="b" aria-label="Game ' + i + ' stocks player two">' +
          '<button class="btn btn-outline btn-sm char-pick" type="button" data-slot="a" data-game="' + i + '">' + charLabel(cA) + "</button>" +
          '<button class="btn btn-outline btn-sm char-pick" type="button" data-slot="b" data-game="' + i + '">' + charLabel(cB) + "</button>" +
          '<button class="btn btn-outline btn-sm stage-pick" type="button" data-game="' + i + '">' + stageLabel(stages[0] ? stages[0].id : "") + "</button>" +
          '<button class="jv-toggle" type="button" data-jv aria-pressed="false" aria-label="Game ' + i + ' JV">JV</button>' +
          "</div>";
      }
      wrap.innerHTML = html;
      update();
    }

    function collectedGames() {
      const stocks = Number(stocksSel.value) || 3;
      const out = [];
      $$("#sm-games .smash-game-row").forEach((row) => {
        const a = row.querySelector('[data-side="a"]').value;
        const b = row.querySelector('[data-side="b"]').value;
        if (!a && !b) return;
        out.push({
          a: a === "" ? null : Number(a),
          b: b === "" ? null : Number(b),
          cA: Number(row.getAttribute("data-char-a")) || null,
          cB: Number(row.getAttribute("data-char-b")) || null,
          st: row.getAttribute("data-stage") || null,
          stocks: stocks,
          jv: row.querySelector("[data-jv]").getAttribute("aria-pressed") === "true"
        });
      });
      return out;
    }

    function update() {
      const names = sideNames();
      const scoreHead = $(".smash-game-head", section);
      if (scoreHead) {
        const labels = scoreHead.querySelectorAll("span");
        labels[1].textContent = names.a;
        labels[2].textContent = names.b;
      }
      const stocks = Number(stocksSel.value) || 3;
      $$("#sm-games .smash-game-row").forEach((row) => {
        const a = row.querySelector('[data-side="a"]').value;
        const b = row.querySelector('[data-side="b"]').value;
        const toggle = row.querySelector("[data-jv]");
        const av = a === "" ? null : Number(a);
        const bv = b === "" ? null : Number(b);
        const on = toggle.getAttribute("aria-pressed") === "true";
        const jvNum = on && av != null && bv != null && av !== bv && Math.max(av, bv) === stocks ? (stocks - Math.min(av, bv)) + 1 : 0;
        toggle.textContent = on && jvNum ? "JV" + jvNum : "JV";
      });

      const games = collectedGames();
      const match = {
        format: format,
        p1: Number(p1.value), p2: Number(p2.value),
        team1: [Number(p1.value), Number(p1b.value)], team2: [Number(p2.value), Number(p2b.value)],
        games: games.length ? games : [{ a: null, b: null, cA: null, cB: null, st: null }],
        stocks: stocks
      };
      const summary = $("#sm-summary");
      if (summary) summary.innerHTML = UI.smashScorecard(match);
      const tags = $("#sm-tags");
      if (tags) {
        tags.innerHTML = '<span class="chip">' + esc(comp.value) + "</span>" +
          '<span class="chip">' + (format === "doubles" ? "Doubles" : "Singles") + "</span>" +
          '<span class="chip">Best of ' + best.value + "</span>" +
          '<span class="chip">' + stocks + " stocks</span>" +
          '<span class="chip">' + (elo.checked ? "Elo on" : "Elo off") + "</span>";
      }
      $("#sm-meta-format").textContent = format === "doubles" ? "Doubles" : "Singles";
      $("#sm-meta-best").textContent = "Best of " + best.value;
      $("#sm-meta-stocks").textContent = stocks;

      const proj = $("#sm-projection");
      if (proj) {
        proj.hidden = !elo.checked;
        const complete = games.filter((g) => g.a != null && g.b != null && g.a !== g.b && (g.a === stocks || g.b === stocks));
        const target = Math.floor((Number(best.value) || 3) / 2) + 1;
        let winsA = 0, winsB = 0, decidedAt = 0;
        complete.forEach((g, idx) => { if (g.a > g.b) winsA++; else winsB++; if (!decidedAt && Math.max(winsA, winsB) === target) decidedAt = idx + 1; });
        const matchComplete = Math.max(winsA, winsB) === target && decidedAt === complete.length;
        if (elo.checked && matchComplete) {
          let eloA, eloB;
          if (format === "doubles") {
            const idsA = [p1.value, p1b.value].map(Number);
            const idsB = [p2.value, p2b.value].map(Number);
            eloA = avg(idsA.map((id) => (UI.playerById(id) || {}).eloD || 1500));
            eloB = avg(idsB.map((id) => (UI.playerById(id) || {}).eloD || 1500));
          } else {
            eloA = (UI.playerById(p1.value) || {}).elo || 1500;
            eloB = (UI.playerById(p2.value) || {}).elo || 1500;
          }
          const r = ELO.smashProject({ eloA: eloA, eloB: eloB, games: complete, stocks: stocks });
          proj.innerHTML =
            '<div class="elo-projection-head"><span>Projected ' + (format === "doubles" ? "doubles" : "singles") + " Elo</span><span>Margin-aware</span></div>" +
            '<div class="elo-projection-row"><span>' + esc(names.a) + "</span><b>" + signed(r.deltaA) + "</b></div>" +
            '<div class="elo-projection-row"><span>' + esc(names.b) + "</span><b>" + signed(r.deltaB) + "</b></div>" +
            '<p class="elo-projection-note">' + r.gamesWonA + "–" + r.gamesWonB + " games · stock diff " + (r.stockDiff > 0 ? "+" : "") + r.stockDiff + " · K " + r.k + "</p>";
        } else {
          proj.innerHTML = elo.checked ? '<p class="elo-projection-note">Enter a complete match score to see the Elo projection.</p>' : "";
        }
      }
    }

    function avg(list) { return list.length ? list.reduce((s, n) => s + n, 0) / list.length : 1500; }

    function setFormat(next) {
      format = next;
      fmtButtons.forEach((b) => b.setAttribute("aria-pressed", b.getAttribute("data-smformat") === next ? "true" : "false"));
      const doubles = next === "doubles";
      $("#sm-p1b-wrap").hidden = !doubles;
      $("#sm-p2b-wrap").hidden = !doubles;
      $("#sm-p1-label").textContent = doubles ? "Team one · player A" : "Player one";
      $("#sm-p2-label").textContent = doubles ? "Team two · player A" : "Player two";
      $("#sm-players-title").textContent = doubles ? "Teams" : "Players";
      renderGames();
    }

    fmtButtons.forEach((b) => b.addEventListener("click", () => setFormat(b.getAttribute("data-smformat"))));

    /* Fighter + stage pickers */
    let pickSlot = null;
    const charDialog = $("#char-dialog");
    const stageDialog = $("#stage-dialog");
    const charGrid = $("#char-grid");
    const stageGrid = $("#stage-grid");
    const charSearch = $("#char-search");

    function renderCharGrid(filter) {
      const q = (filter || "").trim().toLowerCase();
      const list = roster.filter((c) => !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
      charGrid.innerHTML = list.map((c) =>
        '<button class="char-menu-item" type="button" data-char="' + c.id + '">' +
        '<span class="char-tile">' + esc(c.code) + "</span>" +
        '<span>' + esc(c.name) + "</span>" +
        '<span class="char-num">#' + c.num + "</span>" +
        "</button>"
      ).join("") || '<p class="hint">No fighters match that search.</p>';
    }

    function renderStageGrid() {
      stageGrid.innerHTML = stages.map((s) =>
        '<button class="stage-tile" type="button" data-stage="' + esc(s.id) + '">' +
        '<span class="stage-glyph">' + esc(s.code) + "</span>" +
        '<span>' + esc(s.name) + "</span>" +
        "</button>"
      ).join("");
    }

    if (charGrid && stageGrid) {
      renderCharGrid("");
      renderStageGrid();
      charSearch.addEventListener("input", () => renderCharGrid(charSearch.value));
      charGrid.addEventListener("click", (e) => {
        const item = e.target.closest("[data-char]");
        if (!item) return;
        const id = Number(item.getAttribute("data-char"));
        if (pickSlot) {
          const row = wrap.querySelector('[data-game="' + pickSlot.game + '"]');
          if (row) {
            row.setAttribute("data-char-" + pickSlot.slot, String(id));
            const btn = row.querySelector('.char-pick[data-slot="' + pickSlot.slot + '"]');
            if (btn) btn.innerHTML = charLabel(id);
          }
          update();
        }
        UI.closeDialog(charDialog);
      });
      stageGrid.addEventListener("click", (e) => {
        const item = e.target.closest("[data-stage]");
        if (!item) return;
        const id = item.getAttribute("data-stage");
        if (pickSlot) {
          const row = wrap.querySelector('[data-game="' + pickSlot.game + '"]');
          if (row) {
            row.setAttribute("data-stage", id);
            const btn = row.querySelector(".stage-pick");
            if (btn) btn.textContent = stageLabel(id);
          }
          update();
        }
        UI.closeDialog(stageDialog);
      });
    }

    wrap.addEventListener("click", (e) => {
      const charBtn = e.target.closest(".char-pick");
      const stageBtn = e.target.closest(".stage-pick");
      const jvBtn = e.target.closest("[data-jv]");
      if (charBtn) {
        pickSlot = { type: "char", game: charBtn.getAttribute("data-game"), slot: charBtn.getAttribute("data-slot") };
        renderCharGrid(charSearch ? charSearch.value : "");
        UI.openDialog(charDialog, charBtn);
      } else if (stageBtn) {
        pickSlot = { type: "stage", game: stageBtn.getAttribute("data-game"), slot: null };
        renderStageGrid();
        UI.openDialog(stageDialog, stageBtn);
      } else if (jvBtn) {
        jvBtn.setAttribute("aria-pressed", jvBtn.getAttribute("aria-pressed") === "true" ? "false" : "true");
        update();
      }
    });

    best.addEventListener("change", renderGames);
    stocksSel.addEventListener("change", renderGames);
    elo.addEventListener("change", update);
    comp.addEventListener("change", update);
    [p1, p2, p1b, p2b].forEach((s) => s && s.addEventListener("change", () => { renderGames(); }));
    form.addEventListener("input", (e) => { if (e.target.closest("#sm-games")) update(); });
    form.addEventListener("reset", () => setTimeout(() => { if (M.players[1]) p2.value = String(M.players[1].id); renderGames(); }, 0));

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (format === "doubles") {
        const ids = [p1.value, p1b.value, p2.value, p2b.value];
        if (new Set(ids).size !== 4) { UI.toast("Choose four different players for a doubles match."); return; }
      } else if (p1.value === p2.value) {
        UI.toast("Choose two different players for this result.");
        return;
      }
      const stocks = Number(stocksSel.value) || 3;
      const rows = $$("#sm-games .smash-game-row");
      const entered = rows.map((row) => [row.querySelector('[data-side="a"]').value, row.querySelector('[data-side="b"]').value]);
      let blank = false, gap = false;
      entered.forEach(([a, b]) => { if (a === "" && b === "") blank = true; else if (blank) gap = true; });
      if (gap) { UI.toast("Enter game scores in order without skipping a game."); return; }
      const scored = entered.filter(([a, b]) => a !== "" || b !== "");
      if (!scored.length || scored.some(([a, b]) => a === "" || b === "")) { UI.toast("Enter both players’ stocks for each game."); return; }
      const parsed = scored.map(([a, b]) => [Number(a), Number(b)]);
      if (parsed.some(([a, b]) => !Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a > stocks || b > stocks)) { UI.toast("Stocks must be whole numbers up to " + stocks + "."); return; }
      if (parsed.some(([a, b]) => a === b || (a !== stocks && b !== stocks))) { UI.toast("Each game needs a winner — one fighter must take all " + stocks + " stocks."); return; }
      const target = Math.floor((Number(best.value) || 3) / 2) + 1;
      let winsA = 0, winsB = 0, decidedAt = 0;
      parsed.forEach(([a, b], idx) => { if (a > b) winsA++; else winsB++; if (!decidedAt && Math.max(winsA, winsB) === target) decidedAt = idx + 1; });
      if (Math.max(winsA, winsB) !== target || parsed.length !== decidedAt) { UI.toast("Enter scores through the winning game using the selected best-of format."); return; }
      update();
      const customCompetition = M.competitions.find(c => c.custom && c.name === comp.value);
      if (customCompetition) {
        COMP_RESULTS.recordFromForm(gameSlug, customCompetition.id, UI.playerById(Number(p1.value)).name, UI.playerById(Number(p2.value)).name, {a:winsA,b:winsB,games:collectedGames(),detail:parsed.map(s=>s.join("–")).join(", ")});
        return;
      }
      UI.toast("Sample result — not saved. Open a custom competition to record a scheduled fixture.");
    });

    renderGames();
  }

  function initRecord() {
    if (isTennis) { initTennisRecord(); return; }
    if (isTableTennis) { initTableTennisRecord(); return; }
    if (isSmash) { initSmashRecord(); return; }
    const form = $("#record-form");
    if (!form) return;
    const p1 = $("#r-p1");
    const p2 = $("#r-p2");
    const c1 = $("#r-club1");
    const c2 = $("#r-club2");
    const s1 = $("#r-s1");
    const s2 = $("#r-s2");
    const pens = $("#r-pens");
    const aet = $("#r-aet");
    const elo = $("#r-elo");

    const comp = $("#r-comp");
    comp.innerHTML = M.competitions.map((c) => '<option value="' + esc(c.name) + '">' + esc(c.name) + "</option>").join("") +
      '<option value="Friendly — no table">Friendly — no table</option>';
    const presetComp = params.get("comp");
    const preset = presetComp && M.competitions.find((c) => c.id === presetComp);
    if (preset) comp.value = preset.name;

    p1.innerHTML = M.players.map((p) => '<option value="' + p.id + '">' + esc(p.name) + "</option>").join("");
    p2.innerHTML = p1.innerHTML;
    if (M.players[1]) p2.value = String(M.players[1].id);

    function setTeam(side, code) {
      const sel = side === 1 ? c1 : c2;
      sel.value = code;
      const team = TEAM_PICKER.teamByCode(code);
      const btn = $("#team-btn" + side);
      if (btn) {
        btn.querySelector(".monogram").textContent = code;
        $("#team-btn" + side + "-name").textContent = team ? team.name : code;
        $("#team-btn" + side + "-meta").textContent = team ? [team.league, team.nation].join(" · ") : "";
      }
      update();
    }

    function syncTeam(playerSel, side) {
      const p = UI.playerById(playerSel.value);
      if (p) setTeam(side, lastUsedTeam(p));
    }

    function openTeamPicker(side) {
      const player = UI.playerById(side === 1 ? p1.value : p2.value);
      if (!player) return;
      TEAM_PICKER.open({
        player: player,
        current: side === 1 ? c1.value : c2.value,
        lastUsed: lastUsedTeam(player),
        trigger: $("#team-btn" + side),
        onSelect: (team) => setTeam(side, team.code)
      });
    }

    syncTeam(p1, 1);
    syncTeam(p2, 2);
    p1.addEventListener("change", () => { syncTeam(p1, 1); });
    p2.addEventListener("change", () => { syncTeam(p2, 2); });

    const teamBtn1 = $("#team-btn1");
    const teamBtn2 = $("#team-btn2");
    if (teamBtn1) teamBtn1.addEventListener("click", () => openTeamPicker(1));
    if (teamBtn2) teamBtn2.addEventListener("click", () => openTeamPicker(2));

    function update() {
      const a = UI.playerById(p1.value);
      const b = UI.playerById(p2.value);
      const t1 = TEAM_PICKER.teamByCode(c1.value);
      const t2 = TEAM_PICKER.teamByCode(c2.value);
      $('#sum-name1').textContent = a ? a.name : "Player one";
      $('#sum-name2').textContent = b ? b.name : "Player two";
      $('#sum-club1').textContent = c1.value;
      $('#sum-club2').textContent = c2.value;
      $('#sum-team1').textContent = t1 ? t1.name : c1.value;
      $('#sum-team2').textContent = t2 ? t2.name : c2.value;
      $('#sum-stars1').innerHTML = t1 ? UI.stars(t1.stars) : "";
      $('#sum-stars2').innerHTML = t2 ? UI.stars(t2.stars) : "";
      $('#sum-score').textContent = (s1.value || "0") + "–" + (s2.value || "0");
      $('#sum-comp').textContent = comp.value;
      $('#sum-elo').textContent = elo.checked ? "Elo on" : "Elo off";
      $('#sum-by').textContent = a ? a.name : "—";

      const projection = $("#sum-elo-projection");
      if (projection) {
        projection.hidden = !elo.checked;
        if (elo.checked && a && b) {
          const shootout = pens.checked ? [Number($('#r-pen1').value) || 0, Number($('#r-pen2').value) || 0] : null;
          const p = ELO.project({
            eloA: a.elo,
            eloB: b.elo,
            starsA: t1 ? t1.stars : 3,
            starsB: t2 ? t2.stars : 3,
            scoreA: Number(s1.value) || 0,
            scoreB: Number(s2.value) || 0,
            pens: shootout
          });
          $('#sum-elo-name1').textContent = a.name;
          $('#sum-elo-name2').textContent = b.name;
          setDelta('#sum-elo-delta1', p.deltaA);
          setDelta('#sum-elo-delta2', p.deltaB);
          $('#sum-elo-note').textContent = (t1 ? t1.name : c1.value) + " " + starLabel(t1) + " vs " +
            (t2 ? t2.name : c2.value) + " " + starLabel(t2) + " · K " + p.k;
        }
      }

      const vs = $(".record-summary .summary-score .vs");
      if (vs) {
        if (pens.checked) vs.textContent = "pens " + ($('#r-pen1').value || "0") + "–" + ($('#r-pen2').value || "0");
        else if (aet.checked) vs.textContent = "a.e.t.";
        else vs.textContent = "final";
      }
    }

    form.addEventListener("input", update);
    form.addEventListener("change", update);

    pens.addEventListener("change", () => {
      $("#pens-fields").hidden = !pens.checked;
      update();
    });

    form.addEventListener("reset", () => {
      setTimeout(() => {
        $("#pens-fields").hidden = true;
        if (M.players[1]) p2.value = String(M.players[1].id);
        syncTeam(p1, 1);
        syncTeam(p2, 2);
        update();
      }, 0);
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (p1.value === p2.value) {
        UI.toast("Choose two different players for this result.");
        p1.focus();
        return;
      }
      if (pens.checked && $('#r-pen1').value === $('#r-pen2').value) {
        UI.toast("A penalty shootout needs a winner. Check the shootout score.");
        $('#r-pen1').focus();
        return;
      }
      update();
      const customCompetition = M.competitions.find(c => c.custom && c.name === comp.value);
      if (customCompetition) {
        COMP_RESULTS.recordFromForm(gameSlug, customCompetition.id, UI.playerById(Number(p1.value)).name, UI.playerById(Number(p2.value)).name, {a:Number(s1.value),b:Number(s2.value),winner:pens.checked ? UI.playerById(Number($("#r-pen1").value)>Number($("#r-pen2").value)?Number(p1.value):Number(p2.value)).name : null});
        return;
      }
      UI.toast("Sample result — not saved. Open a custom competition to record a scheduled fixture.");
    });

    update();
  }

  function openTennisReview(m, trigger) {
    const dialog = $("#review-dialog");
    const names = tennisSideNames(m);
    const summary = dialog.querySelector(".summary-match");
    $("#rd-sub").textContent = UI.formatDate(m.date) + " · " + m.league;
    if (summary) {
      const scorecard = isSmash ? UI.smashScorecard(m) : (isTableTennis ? UI.tableTennisScorecard(m) : UI.tennisScoreboard(m));
      const formatChip = isSmash
        ? '<span class="chip">' + (m.format === "doubles" ? "Doubles" : "Singles") + "</span>"
        : (isTableTennis ? '<span class="chip">Singles</span>' : UI.surfaceChip(m.surface));
      summary.innerHTML =
        scorecard +
        '<div class="summary-tags"><span class="chip" id="rd-comp">' + esc(m.league) + "</span>" + formatChip + '<span class="chip" id="rd-elo">' + (m.elo ? "Counts for Elo" : "No Elo") + "</span></div>" +
        '<div class="summary-meta">' +
        '<div><span>Submitted by</span><b id="rd-by"></b></div>' +
        '<div><span>Submitted</span><b id="rd-time"></b></div>' +
        '<div><span>Elo on approval</span><b id="rd-delta"></b></div>' +
        '<div><span>Opponent confirmation</span><b>Confirmed</b></div>' +
        "</div>";
    }
    const avg = (list) => list.length ? list.reduce((s, n) => s + n, 0) / list.length : 1500;
    const deltaEl = $("#rd-delta");
    if (m.elo) {
      let eloA, eloB;
      if (m.format === "doubles") {
        eloA = avg((m.team1 || []).map((id) => (UI.playerById(id) || {}).eloD || 1500));
        eloB = avg((m.team2 || []).map((id) => (UI.playerById(id) || {}).eloD || 1500));
      } else {
        eloA = (UI.playerById(m.p1) || {}).elo || 1500;
        eloB = (UI.playerById(m.p2) || {}).elo || 1500;
      }
      const r = isSmash
        ? ELO.smashProject({ eloA: eloA, eloB: eloB, games: m.games, stocks: m.stocks })
        : isTableTennis
          ? ELO.tableTennisProject({ eloA: eloA, eloB: eloB, games: m.sets })
          : ELO.tennisProject({ eloA: eloA, eloB: eloB, sets: m.sets });
      const dA = m.delta == null ? r.deltaA : m.delta;
      if (deltaEl) { deltaEl.textContent = signed(dA) + " / " + signed(-dA); deltaEl.className = dA > 0 ? "delta-up" : dA < 0 ? "delta-down" : "delta-flat"; }
    } else if (deltaEl) { deltaEl.textContent = "Not counted"; deltaEl.className = "muted"; }
    $("#rd-by").textContent = m.submitted;
    $("#rd-time").textContent = UI.formatDate(m.date);
    $("#rd-note").value = "";
    UI.openDialog(dialog, trigger);
  }

  let currentReview = null;
  function openReview(id, trigger) {
    const m = M.matches.find((x) => x.id === Number(id));
    if (!m) return;
    currentReview = m;
    if (isTennis || isTableTennis || isSmash) { openTennisReview(m, trigger); return; }
    const dialog = $("#review-dialog");
    $("#rd-sub").textContent = UI.formatDate(m.date) + " · " + m.league;
    $("#rd-name1").textContent = pname(m.p1);
    $("#rd-name2").textContent = pname(m.p2);
    $("#rd-club1").textContent = m.club1;
    $("#rd-club2").textContent = m.club2;
    const rt1 = TEAM_PICKER.teamByCode(m.club1);
    const rt2 = TEAM_PICKER.teamByCode(m.club2);
    $("#rd-team1").textContent = rt1 ? rt1.name : m.club1;
    $("#rd-team2").textContent = rt2 ? rt2.name : m.club2;
    $("#rd-stars1").innerHTML = rt1 ? UI.stars(rt1.stars) : "";
    $("#rd-stars2").innerHTML = rt2 ? UI.stars(rt2.stars) : "";
    $("#rd-score").textContent = m.s1 + (m.pens ? " (" + m.pens[0] + ")" : "") + "-" + (m.pens ? "(" + m.pens[1] + ") " : "") + m.s2;
    $("#rd-comp").textContent = m.league;
    $("#rd-elo").textContent = m.elo ? "Counts for Elo" : "No Elo";
    if (m.elo) {
      const pa = UI.playerById(m.p1);
      const pb = UI.playerById(m.p2);
      const projected = ELO.project({
        eloA: pa ? pa.elo : 1500,
        eloB: pb ? pb.elo : 1500,
        starsA: rt1 ? rt1.stars : 3,
        starsB: rt2 ? rt2.stars : 3,
        scoreA: m.s1,
        scoreB: m.s2,
        pens: m.pens
      });
      const dA = m.delta == null ? projected.deltaA : m.delta;
      $("#rd-delta").textContent = signed(dA) + " / " + signed(-dA);
      $("#rd-delta").className = dA > 0 ? "delta-up" : dA < 0 ? "delta-down" : "delta-flat";
    } else {
      $("#rd-delta").textContent = "Not counted";
      $("#rd-delta").className = "muted";
    }
    $("#rd-by").textContent = m.submitted;
    $("#rd-time").textContent = UI.formatDate(m.date);
    $("#rd-note").value = "";
    UI.openDialog(dialog, trigger);
  }

  function initReview() {
    document.addEventListener("click", (e) => {
      const trigger = e.target.closest("[data-review]");
      if (trigger) {
        e.preventDefault();
        openReview(trigger.getAttribute("data-review"), trigger);
        return;
      }
      const demo = e.target.closest("[data-demo-live]");
      if (demo) {
        e.preventDefault();
        UI.toast(demo.getAttribute("data-demo-live"));
      }
    });

    $("#approve-btn").addEventListener("click", () => {
      UI.closeDialog($("#review-dialog"));
      UI.toast("Result approved and locked — demo only. Elo was not changed.");
    });
    $("#reject-btn").addEventListener("click", () => {
      UI.closeDialog($("#review-dialog"));
      UI.toast("Result sent back to the players — demo only. Nothing was saved.");
    });
  }

  function initViews() {
    const names = ["overview", "matches", "rankings", "competitions", "players", "record", "review"];
    const links = $$("[data-view]");

    function setView(name, push) {
      if (!names.includes(name)) name = "overview";
      $$("[data-view-panel]").forEach((panel) => {
        panel.hidden = panel.getAttribute("data-view-panel") !== name;
      });
      links.forEach((link) => {
        const isCurrent = link.getAttribute("data-view") === name;
        if (isCurrent) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });
      const titles = { overview: "The current season", matches: "Matches", rankings: "Rankings", competitions: "Competitions", players: "Players", record: "Record a result", review: "Admin review" };
      document.title = titles[name] + " — " + gameMeta.name + " — mimELo";
      if (push) {
        const url = new URL(location.href);
        url.searchParams.set("view", name);
        history.replaceState(null, "", url.pathname + "?" + url.searchParams.toString());
      }
      window.scrollTo(0, 0);
    }

    links.forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        setView(link.getAttribute("data-view"), true);
      });
    });

    const initial = new URLSearchParams(location.search).get("view") || "overview";
    setView(initial, false);
  }

  function initGameContext() {
    if (isTennis || isTableTennis) {
      const gameName = isTableTennis ? "Table tennis" : "Tennis";
      document.body.dataset.game = isTableTennis ? "table-tennis" : "tennis";
      document.body.removeAttribute("data-game-variant");
      $$("[data-game-label]").forEach((el) => { el.textContent = gameName; });
      const settingsLink = $(".side-nav a[href='admin.html']");
      if (settingsLink) settingsLink.href = "admin.html?game=" + gameSlug;
      const logo27 = $("[data-logo-27]");
      if (logo27) logo27.hidden = true;
      const logo26 = $("[data-logo-26]");
      if (logo26) {
        logo26.hidden = false;
        logo26.innerHTML = isTableTennis
          ? '<img src="assets/brand/tt-logo.png" alt="Table tennis">'
          : '<img src="assets/brand/tennis-logo.png" alt="Tennis">';
      }
      const current = $(".switcher-menu a[aria-current='true']");
      if (current) current.removeAttribute("aria-current");
      const gameLink = $(".switcher-menu a[href='game.html?game=" + gameSlug + "']");
      if (gameLink) gameLink.setAttribute("aria-current", "true");
      $$("a[href*='view=']").forEach((a) => {
        const href = a.getAttribute("href");
        if (!/[?&]game=/.test(href)) a.setAttribute("href", href + "&game=" + gameSlug);
      });
      const banner = $("#game-banner");
      if (banner) {
        banner.hidden = false;
        banner.innerHTML = UI.icon("info", 18) + '<span><b>A separate game.</b> ' + (isTableTennis ? "Table Tennis has its own singles Elo, games-to-11 scoring, and competitions." : "Tennis has its own singles and doubles ratings, surface record, and tournaments.") + " Nothing here is shared with the other game records.</span>";
      }
    } else if (isSmash) {
      document.body.dataset.game = "smash";
      document.body.removeAttribute("data-game-variant");
      $$("[data-game-label]").forEach((el) => { el.textContent = "Super Smash Bros."; });
      const settingsLink = $(".side-nav a[href='admin.html']");
      if (settingsLink) settingsLink.href = "admin.html?game=smash";
      const logo27 = $("[data-logo-27]");
      if (logo27) logo27.hidden = true;
      const logo26 = $("[data-logo-26]");
      if (logo26) {
        logo26.hidden = false;
        logo26.innerHTML = '<img src="assets/brand/smash-logo.png" alt="Super Smash Bros.">';
      }
      const current = $(".switcher-menu a[aria-current='true']");
      if (current) current.removeAttribute("aria-current");
      const gameLink = $(".switcher-menu a[href='game.html?game=smash']");
      if (gameLink) gameLink.setAttribute("aria-current", "true");
      $$("a[href*='view=']").forEach((a) => {
        const href = a.getAttribute("href");
        if (!/[?&]game=/.test(href)) a.setAttribute("href", href + "&game=smash");
      });
      const banner = $("#game-banner");
      if (banner) {
        banner.hidden = false;
        banner.innerHTML = UI.icon("info", 18) + '<span><b>A separate game.</b> Super Smash Bros. has its own singles and doubles ratings, character and stage records, and competitions. Nothing here is shared with the other game records.</span>';
      }
    } else if (gameSlug === "eafc26") {
      document.body.dataset.gameVariant = "eafc26";
      const banner = $("#game-banner");
      if (banner) banner.hidden = false;
      $$("[data-game-label]").forEach((el) => { el.textContent = "EA FC 26"; });
      const current = $(".switcher-menu a[aria-current='true']");
      if (current) current.removeAttribute("aria-current");
      const link26 = $(".switcher-menu a[href='game.html?game=eafc26']");
      if (link26) link26.setAttribute("aria-current", "true");
      const logo27 = $("[data-logo-27]");
      if (logo27) logo27.hidden = true;
      const logo26 = $("[data-logo-26]");
      if (logo26) {
        logo26.hidden = false;
        logo26.innerHTML = '<img src="assets/brand/ea-fc-26.png" alt="EA FC 26">';
      }
      $$("a[href*='view=']").forEach((a) => {
        const href = a.getAttribute("href");
        if (!/[?&]game=/.test(href)) a.setAttribute("href", href + "&game=eafc26");
      });
    }
    document.title = gameMeta.name + " — mimELo";
  }

  initGameContext();
  renderOverview();
  renderStats();
  renderMatches();
  renderRankings();
  renderCompetitions();
  renderPlayers();
  renderReview();
  initFilters();
  initRecord();
  initReview();
  initViews();

  const playerSearch = $("#player-search");
  if (playerSearch) UI.initSearch(playerSearch, $$("#players-body tr"));
})();

