/* Player profile rendering (EA FC + tennis). */
(function () {
  const params = new URLSearchParams(location.search);
  const gameParam = params.get("game");
  const ctx = gameParam === "eafc27"
    ? { slug: "eafc27", M: window.GAME_SET.eafc27, query: "", href: "game.html", isTennis: false, isTableTennis: false, isSmash: false }
    : window.resolveGame(params);
  const gameSlug = ctx.slug;
  const M = ctx.M;
  const isTennis = ctx.isTennis;
  const isTableTennis = ctx.isTableTennis;
  const isSmash = ctx.isSmash;
  const gameQuery = ctx.query;
  const gameHref = ctx.href;
  const gameMeta = M.games.find((g) => g.slug === gameSlug) || M.games[0];

  if (isSmash) {
    document.body.dataset.game = "smash";
    document.body.removeAttribute("data-game-variant");
  } else if (isTennis || isTableTennis) {
    document.body.dataset.game = isTableTennis ? "table-tennis" : "tennis";
    document.body.removeAttribute("data-game-variant");
  } else if (gameSlug === "eafc26") {
    document.body.dataset.gameVariant = "eafc26";
  }

  const $ = UI.$;
  const esc = UI.esc;

  const id = Number(params.get("player")) || 1;
  const p = M.players.find((x) => x.id === id) || M.players[0];

  document.title = p.name + " — " + gameMeta.name + " — mimELo";

  const crumbGame = $("#crumb-game");
  if (crumbGame) { crumbGame.textContent = gameMeta.name; crumbGame.href = gameHref; }
  const crumbPlayers = $("#crumb-players");
  if (crumbPlayers) crumbPlayers.href = "players.html";
  const backPlayers = $("#back-players");
  if (backPlayers) backPlayers.href = "players.html";
  const recordLink = $("#record-link");
  if (recordLink) recordLink.href = "game.html?view=record" + gameQuery;

  document.querySelectorAll("[data-player-name]").forEach((el) => { el.textContent = p.name; });
  document.querySelectorAll("[data-player-handle]").forEach((el) => { el.textContent = p.handle; });
  document.querySelectorAll("[data-player-elo]").forEach((el) => { el.textContent = p.elo; });
  document.querySelectorAll("[data-player-peak]").forEach((el) => { el.textContent = p.peak; });
  document.querySelectorAll("[data-player-rank]").forEach((el) => { el.textContent = "#" + p.rank; });

  const avatar = $("#player-avatar");
  if (avatar) avatar.innerHTML = UI.avatar(p.name, "avatar-lg", "quiet");

  /* ---- hero extras for tennis: doubles rating line + label ---- */
  if (isTennis || isTableTennis || isSmash) {
    const label = document.querySelector(".player-elo .label");
    if (label) label.textContent = isTableTennis ? "Table Tennis Elo" : (isSmash ? "Smash Elo" : "Singles Elo");
    const eloBox = document.querySelector(".player-elo");
    if (eloBox && (isTennis || isSmash)) {
      eloBox.insertAdjacentHTML("beforeend",
        '<div class="peak" style="margin-top:6px;">Doubles <span>' + p.eloD + "</span> · Rank <span>#" + p.rankD + "</span></div>");
    }
  }

  const flairs = $("#player-flairs");
  if (flairs) {
    if (isSmash) {
      flairs.innerHTML =
        UI.smashIdentity(p) +
        (p.flairs || []).map((f) => '<span class="chip">' + esc(f) + "</span>").join("");
    } else if (isTennis || isTableTennis) {
      flairs.innerHTML =
        '<span class="flag-chip" title="' + esc(p.nation) + '">' + esc(p.flag) + "</span>" +
        UI.tierChip(p) +
        (p.flairs || []).map((f) => '<span class="chip">' + esc(f) + "</span>").join("");
    } else {
      const club = UI.clubByCode(p.club);
      const others = p.flairs.filter((f) => f !== club.name);
      flairs.innerHTML = ["Favourite: " + club.name, ...others, "Rank #" + p.rank]
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .map((f) => '<span class="chip">' + esc(f) + "</span>").join("");
    }
  }

  const stats = $("#player-stats");
  if (stats) {
    if (isSmash) {
      const matches = p.w + p.l;
      const winRate = matches ? Math.round((p.w / matches) * 100) : 0;
      stats.innerHTML =
        '<div class="player-stat"><b>#' + p.rank + "</b><span>Singles rank</span></div>" +
        '<div class="player-stat"><b>' + p.w + "–" + p.l + "</b><span>W–L</span></div>" +
        '<div class="player-stat"><b>' + winRate + "%</b><span>Win rate</span></div>" +
        '<div class="player-stat"><b>' + p.gamesW + "–" + p.gamesL + "</b><span>Games</span></div>" +
        '<div class="player-stat"><b>' + p.elo + "</b><span>Smash Elo</span></div>" +
        '<div class="player-stat"><b>#' + p.rankD + "</b><span>Doubles rank</span></div>";
    } else if (isTennis || isTableTennis) {
      const matches = p.w + p.l;
      const winRate = matches ? Math.round((p.w / matches) * 100) : 0;
      if (isTableTennis) {
        stats.innerHTML =
          '<div class="player-stat"><b>#' + p.rank + "</b><span>Singles rank</span></div>" +
          '<div class="player-stat"><b>' + p.w + "–" + p.l + "</b><span>W–L</span></div>" +
          '<div class="player-stat"><b>' + winRate + "%</b><span>Win rate</span></div>" +
          '<div class="player-stat"><b>' + p.gamesW + "–" + p.gamesL + "</b><span>Games</span></div>" +
          '<div class="player-stat"><b>' + p.elo + "</b><span>Table Tennis Elo</span></div>" +
          '<div class="player-stat"><b>#' + p.rank + "</b><span>Game rank</span></div>";
      } else {
      stats.innerHTML =
        '<div class="player-stat"><b>#' + p.rank + "</b><span>Singles rank</span></div>" +
        '<div class="player-stat"><b>' + p.w + "–" + p.l + "</b><span>W–L</span></div>" +
        '<div class="player-stat"><b>' + winRate + "%</b><span>Win rate</span></div>" +
        '<div class="player-stat"><b>' + p.setsW + "–" + p.setsL + "</b><span>Sets</span></div>" +
        '<div class="player-stat"><b>#' + p.rankD + "</b><span>Doubles rank</span></div>" +
        '<div class="player-stat"><b>' + p.gamesW + "–" + p.gamesL + "</b><span>Games</span></div>";
      }
    } else {
      const matches = p.w + p.d + p.l;
      const winRate = Math.round((p.w / matches) * 100);
      stats.innerHTML =
        '<div class="player-stat"><b>#' + p.rank + "</b><span>Rank</span></div>" +
        '<div class="player-stat"><b>' + p.w + "–" + p.d + "–" + p.l + "</b><span>W–D–L</span></div>" +
        '<div class="player-stat"><b>' + winRate + "%</b><span>Win rate</span></div>" +
        '<div class="player-stat"><b>' + matches + "</b><span>Matches</span></div>" +
        '<div class="player-stat"><b>' + p.gf + "</b><span>Goals for</span></div>" +
        '<div class="player-stat"><b>' + p.ga + "</b><span>Goals against</span></div>";
    }
  }

  const change = $("#elo-change");
  if (change) {
    change.textContent = (p.trend > 0 ? "+" : "") + p.trend + " this season";
    if (p.trend > 0) change.classList.add("chip-accent");
  }

  function sparkline(values, label) {
    const w = 600, h = 180, padX = 22, padTop = 22, padBottom = 34;
    const min = Math.min.apply(null, values) - 6;
    const max = Math.max.apply(null, values) + 6;
    const x = (i) => padX + (i / (values.length - 1)) * (w - padX * 2);
    const y = (v) => padTop + (1 - (v - min) / (max - min)) * (h - padTop - padBottom);
    const pts = values.map((v, i) => x(i).toFixed(1) + "," + y(v).toFixed(1));
    const area = "M" + pts.join(" L") + " L" + x(values.length - 1) + "," + (h - padBottom) + " L" + padX + "," + (h - padBottom) + " Z";
    return '<svg class="spark" viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="Elo rating trend for ' + esc(p.name) + '">' +
      '<line x1="' + padX + '" y1="' + y(max) + '" x2="' + (w - padX) + '" y2="' + y(max) + '" stroke="var(--line)" stroke-dasharray="3 5"/>' +
      '<line x1="' + padX + '" y1="' + y(min) + '" x2="' + (w - padX) + '" y2="' + y(min) + '" stroke="var(--line)" stroke-dasharray="3 5"/>' +
      '<path d="' + area + '" fill="var(--accent)" opacity=".10"/>' +
      '<polyline points="' + pts.join(" ") + '" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="' + x(values.length - 1) + '" cy="' + y(values[values.length - 1]) + '" r="4.5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>' +
      '<text class="spark-axis" x="' + padX + '" y="' + (h - 12) + '">Start</text>' +
      '<text class="spark-axis" x="' + (w - padX) + '" y="' + (h - 12) + '" text-anchor="end">Now</text>' +
      '<text class="spark-label" x="' + (w - padX) + '" y="' + (y(values[values.length - 1]) - 12) + '" text-anchor="end">' + label + "</text>" +
      '<text class="spark-axis" x="' + padX + '" y="' + (y(max) - 7) + '">Peak ' + p.peak + "</text>" +
      "</svg>";
  }

  const spark = $("#spark-wrap");
  if (spark) {
    const base = p.elo - p.trend;
    const values = [base - 18, base - 11, base - 15, base - 4, base + 2, base - 3, base + 7, base + 3, base + 10, base + 5, base + 11, p.elo];
    spark.innerHTML = sparkline(values, p.elo);
  }

  /* ---- tennis match helpers ---- */
  function isOnSide(m, side) {
    if (m.format === "doubles") return (side === 1 ? m.team1 : m.team2 || []).includes(p.id);
    return side === 1 ? m.p1 === p.id : m.p2 === p.id;
  }

  function oppNames(m) {
    if (m.format === "doubles") {
      const mineSide = (m.team1 || []).includes(p.id) ? 1 : 2;
      const ids = mineSide === 1 ? m.team2 : m.team1;
      return (ids || []).map((pid) => { const q = UI.playerById(pid); return q ? q.name : "Player"; }).join(" + ");
    }
    const isP1 = m.p1 === p.id;
    const opp = UI.playerById(isP1 ? m.p2 : m.p1);
    return opp ? opp.name : "Player";
  }

  function tennisOutcome(m) {
    const r = isSmash
      ? UI.smashResult(m)
      : isTableTennis
        ? (m.sets || []).reduce((result, game) => {
          if (game.a > game.b) result.a++;
          else if (game.b > game.a) result.b++;
          return result;
        }, { a: 0, b: 0 })
        : UI.tennisResult(m);
    const mine = isOnSide(m, 1) ? r.a : r.b;
    const theirs = isOnSide(m, 1) ? r.b : r.a;
    return mine > theirs ? "W" : mine < theirs ? "L" : "—";
  }

  function deltaFor(m) {
    if (m.delta == null) return '<span class="delta-flat">—</span>';
    const d = isOnSide(m, 1) ? m.delta : -m.delta;
    return '<span class="' + (d > 0 ? "delta-up" : d < 0 ? "delta-down" : "delta-flat") + '">' + (d > 0 ? "+" : "") + d + "</span>";
  }

  const recent = $("#recent-body");
  if (recent) {
    const rows = M.matches.filter((m) => ((isTennis || isTableTennis || isSmash) ? isOnSide(m, 1) || isOnSide(m, 2) : (m.p1 === p.id || m.p2 === p.id)) && m.status === "locked").slice(0, 5);
    if (isTennis || isTableTennis || isSmash) {
      recent.closest("table").innerHTML =
        '<thead><tr><th>Date</th><th>Opponent</th><th class="c">Score</th><th>Competition</th><th class="c">Elo</th></tr></thead><tbody id="recent-body"></tbody>';
    }
    const tb = $("#recent-body");
    if (tb) {
      tb.innerHTML = rows.map((m) => {
        if (isTennis || isTableTennis || isSmash) {
          return "<tr>" +
            "<td>" + esc(UI.formatDate(m.date)) + "</td>" +
            '<td><span class="player-cell">' + UI.avatar(oppNames(m), "avatar-sm") + '<span class="name">' + esc(oppNames(m)) + "</span></span></td>" +
            '<td>' + (isSmash ? UI.smashScorecard(m) : isTableTennis ? UI.tableTennisScorecard(m) : UI.tennisScoreboard(m)) + "</td>" +
            '<td><span class="chip">' + esc(m.league) + "</span></td>" +
            '<td class="c">' + deltaFor(m) + "</td>" +
            "</tr>";
        }
        const o = (() => {
          const isP1 = m.p1 === p.id;
          const opp = UI.playerById(isP1 ? m.p2 : m.p1);
          const scored = isP1 ? m.s1 : m.s2;
          const conceded = isP1 ? m.s2 : m.s1;
          return { isP1, opp, scored, conceded };
        })();
        return "<tr>" +
          "<td>" + esc(UI.formatDate(m.date)) + "</td>" +
          '<td><span class="player-cell">' + UI.avatar(o.opp.name, "avatar-sm") + '<span class="name">' + esc(o.opp.name) + "</span></span></td>" +
          "<td>" + teamPair(m, o.isP1) + "</td>" +
          '<td class="c num"><b>' + o.scored + "–" + o.conceded + "</b></td>" +
          '<td><span class="chip">' + esc(m.league) + "</span></td>" +
          '<td class="c">' + deltaFor(m) + "</td>" +
          "</tr>";
      }).join("");
    }
  }

  const all = $("#all-matches-body");
  if (all) {
    const rows = M.matches.filter((m) => ((isTennis || isTableTennis || isSmash) ? isOnSide(m, 1) || isOnSide(m, 2) : (m.p1 === p.id || m.p2 === p.id)));
    const count = $("#match-count");
    if (count) count.textContent = rows.length + " matches";
    if (isTennis || isTableTennis || isSmash) {
      all.closest("table").innerHTML =
        '<thead><tr><th>Date</th><th>Opponent</th><th class="c">Score</th><th>Competition</th><th class="c">Result</th><th class="c">Elo</th></tr></thead><tbody id="all-matches-body"></tbody>';
    }
    const tb = $("#all-matches-body");
    if (tb) {
      tb.innerHTML = rows.map((m) => {
        if (isTennis || isTableTennis || isSmash) {
          const res = m.status === "pending" ? null : tennisOutcome(m);
          const badge = res
            ? '<span class="form-dot ' + res.toLowerCase() + '">' + res + "</span>"
            : '<span class="status status-pending">Pending</span>';
          return "<tr>" +
            "<td>" + esc(UI.formatDate(m.date)) + "</td>" +
            '<td><span class="player-cell">' + UI.avatar(oppNames(m), "avatar-sm") + '<span class="name">' + esc(oppNames(m)) + "</span></span></td>" +
            '<td>' + (isSmash ? UI.smashScorecard(m) : isTableTennis ? UI.tableTennisScorecard(m) : UI.tennisScoreboard(m)) + "</td>" +
            '<td><span class="chip">' + esc(m.league) + "</span></td>" +
            '<td class="c">' + badge + "</td>" +
            '<td class="c">' + deltaFor(m) + "</td>" +
            "</tr>";
        }
        const o = (() => {
          const isP1 = m.p1 === p.id;
          const opp = UI.playerById(isP1 ? m.p2 : m.p1);
          const scored = isP1 ? m.s1 : m.s2;
          const conceded = isP1 ? m.s2 : m.s1;
          return { isP1, opp, scored, conceded };
        })();
        const res = m.status === "pending" ? null : (o.scored > o.conceded ? "W" : o.scored < o.conceded ? "L" : "D");
        const badge = res
          ? '<span class="form-dot ' + res.toLowerCase() + '">' + res + "</span>"
          : '<span class="status status-pending">Pending</span>';
        return "<tr>" +
          "<td>" + esc(UI.formatDate(m.date)) + "</td>" +
          '<td><span class="player-cell">' + UI.avatar(o.opp.name, "avatar-sm") + '<span class="name">' + esc(o.opp.name) + "</span></span></td>" +
          "<td>" + teamPair(m, o.isP1) + "</td>" +
          '<td class="c num"><b>' + o.scored + "–" + o.conceded + '</b>' + (m.pens ? '<br><span class="muted" style="font-size:.72rem">pens</span>' : "") + "</td>" +
          '<td><span class="chip">' + esc(m.league) + "</span></td>" +
          '<td class="c">' + badge + "</td>" +
          '<td class="c">' + deltaFor(m) + "</td>" +
          "</tr>";
      }).join("");
    }
  }

  const snapshot = $("#snapshot-body");
  if (snapshot) {
    if (isSmash) {
      snapshot.innerHTML =
        '<div class="summary-meta">' +
        '<div><span>Tag</span><b>' + (p.tag ? esc(p.tag) : "—") + "</b></div>" +
        '<div><span>Main</span><b>' + (p.mains && p.mains[0] ? UI.smashChar(p.mains[0]) : "—") + "</b></div>" +
        '<div><span>Singles</span><b>' + p.elo + " · peak " + p.peak + "</b></div>" +
        '<div><span>Doubles</span><b>' + p.eloD + " · peak " + p.peakD + "</b></div>" +
        '<div><span>Season record</span><b>' + p.w + "W · " + p.l + "L</b></div>" +
        '<div><span>Current form</span><b>' + UI.formDots(p.form) + "</b></div>" +
        "</div>";
    } else if (isTennis || isTableTennis) {
      snapshot.innerHTML =
        '<div class="summary-meta">' +
        '<div><span>Nationality</span><b>' + esc(p.nation) + "</b></div>" +
        '<div><span>Tier</span><b>' + esc(p.tier) + "</b></div>" +
        '<div><span>' + (isTableTennis ? "Table Tennis singles" : "Singles") + '</span><b>' + p.elo + " · peak " + p.peak + "</b></div>" +
        (isTableTennis ? "" : '<div><span>Doubles</span><b>' + p.eloD + " · peak " + p.peakD + "</b></div>") +
        '<div><span>Season record</span><b>' + p.w + "W · " + p.l + "L</b></div>" +
        '<div><span>Current form</span><b>' + UI.formDots(p.form) + "</b></div>" +
        "</div>";
    } else {
      const club = UI.clubByCode(p.club);
      snapshot.innerHTML =
        '<div class="summary-meta">' +
        '<div><span>Favourite team</span><b>' + UI.monogram(p.club) + " " + esc(club.name) + "</b></div>" +
        "<div><span>Joined</span><b>" + esc(p.since) + "</b></div>" +
        "<div><span>Season record</span><b>" + p.w + "W · " + p.d + "D · " + p.l + "L</b></div>" +
        "<div><span>Goals</span><b>" + p.gf + " for · " + p.ga + " against</b></div>" +
        "<div><span>Current form</span><b>" + UI.formDots(p.form) + "</b></div>" +
        "<div><span>Peak Elo</span><b>" + p.peak + "</b></div>" +
        "</div>";
    }
  }

  const teams = $("#player-teams");
  if (teams) {
    if (isSmash) {
      const heading = teams.closest(".panel").querySelector("h2");
      if (heading) heading.textContent = "Character usage";
      const sub = teams.closest(".panel").querySelector(".sub");
      if (sub) sub.textContent = "Characters picked across recorded singles games";
      const counts = {};
      M.matches.forEach((m) => {
        if (m.format !== "singles") return;
        (m.games || []).forEach((g) => {
          let id = null;
          if (m.p1 === p.id) id = g.cA;
          else if (m.p2 === p.id) id = g.cB;
          if (id != null) counts[id] = (counts[id] || 0) + 1;
        });
      });
      const total = Object.values(counts).reduce((s, n) => s + n, 0);
      const tc = $("#team-count");
      if (tc) tc.textContent = total + " games";
      teams.innerHTML = Object.keys(counts).map((id) => {
        const c = UI.smashCharById(id);
        const n = counts[id];
        const pct = total ? Math.round((n / total) * 100) : 0;
        const isMain = (p.mains || []).map(String).includes(String(id));
        return '<div class="team-usage' + (isMain ? " is-fav" : "") + '">' +
          UI.smashChar(id) +
          '<span class="usage-name">' + esc(c ? c.name : id) + (isMain ? ' <span class="usage-fav">Main</span>' : "") +
          "<b>" + n + " games</b></span>" +
          '<span class="usage-pct">' + pct + "%</span>" +
          '<span class="usage-bar"><i style="width:' + pct + '%"></i></span>' +
          "</div>";
      }).join("");
    } else if (isTennis || isTableTennis) {
      const heading = teams.closest(".panel").querySelector("h2");
      if (heading) heading.textContent = isTableTennis ? "Venue record" : "Surface record";
      const sub = teams.closest(".panel").querySelector(".sub");
      if (sub) sub.textContent = isTableTennis ? "Table Tennis matches are played indoors" : "Matches played on each surface";
      const surfaces = isTableTennis ? { Indoor: 0 } : { Hardcourt: 0, Grass: 0, Clay: 0 };
      M.matches.forEach((m) => {
        const mine = isOnSide(m, 1) || isOnSide(m, 2);
        if (mine && (isTableTennis || m.surface)) {
          const surface = isTableTennis ? "Indoor" : m.surface;
          surfaces[surface] = (surfaces[surface] || 0) + 1;
        }
      });
      const total = Object.values(surfaces).reduce((sum, count) => sum + count, 0);
      const tc = $("#team-count");
      if (tc) tc.textContent = total + " matches";
      teams.innerHTML = (isTableTennis ? ["Indoor"] : ["Hardcourt", "Grass", "Clay"]).map((s) => {
        const n = surfaces[s] || 0;
        const pct = total ? Math.round((n / total) * 100) : 0;
        return '<div class="team-usage">' + UI.surfaceChip(s) +
          '<span class="usage-name">' + s + "<b>" + n + " matches</b></span>" +
          '<span class="usage-pct">' + pct + "%</span>" +
          '<span class="usage-bar"><i style="width:' + pct + '%"></i></span></div>';
      }).join("");
    } else {
      const total = p.teams.reduce((sum, t) => sum + t.count, 0);
      teams.innerHTML = p.teams.map((t) => {
        const info = UI.clubByCode(t.code);
        const pct = total ? Math.round((t.count / total) * 100) : 0;
        const fav = t.code === p.club;
        return '<div class="team-usage' + (fav ? " is-fav" : "") + '">' +
          UI.monogram(t.code) +
          '<span class="usage-name">' + esc(info.name) + (fav ? ' <span class="usage-fav">Favourite</span>' : "") +
          "<b>" + t.count + " matches</b></span>" +
          '<span class="usage-pct">' + pct + "%</span>" +
          '<span class="usage-bar"><i style="width:' + pct + '%"></i></span>' +
          "</div>";
      }).join("");
      const teamCount = $("#team-count");
      if (teamCount) teamCount.textContent = p.teams.length + " teams";
    }
  }

  function teamPair(m, isP1) {
    const own = isP1 ? m.club1 : m.club2;
    const opp = isP1 ? m.club2 : m.club1;
    return '<span class="team-pair" title="' + esc(own + " v " + opp) + '">' +
      UI.monogram(own) + '<span class="pair-v">v</span>' + UI.monogram(opp) + "</span>";
  }
})();
