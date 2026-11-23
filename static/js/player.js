APP.run(async () => {
  const { $, $$, esc, text } = UI;
  const id = Number(APP.params.get("player"));
  const requestedGame = APP.params.get("game");
  const overview = !requestedGame;
  let p = await APP.api("players/" + id);
  const profileUrl = (game, format) => {
    const query = new URLSearchParams({ player: id });
    if (game) query.set("game", game);
    if (format) query.set("format", format);
    return "player.html?" + query;
  };
  if (p.merged_into) {
    const query = new URLSearchParams(APP.params);
    query.set("player", p.merged_into);
    location.replace("player.html?" + query);
    return;
  }
  document.title = p.name + " · Player profile · mimELo";
  $(".breadcrumb").innerHTML =
    `<a href="index.html">Home</a><span class="sep">/</span><a href="players.html">Players</a><span class="sep">/</span><span>${esc(p.name)}</span>`;
  text("[data-player-name]", p.name);
  text("[data-player-handle]", p.handle ? "@" + p.handle : "Fill-in player");
  $("#player-avatar").innerHTML = UI.avatar(p.name, "", p.photo);
  const { renderProfileFlairs } = await import("./profile-flairs.js");
  $("#player-flairs").innerHTML = renderProfileFlairs(
    p.profile,
    overview ? null : APP.game.kind,
  );
  if (p.profile.bio) {
    $(".player-hero").insertAdjacentHTML(
      "afterend",
      `<p class="profile-bio">${esc(p.profile.bio)}</p>`,
    );
  }
  const records = p.records || [];
  const activeGames = APP.games.filter((g) =>
    records.some((r) => r.game === g.slug),
  );
  const filterRow = $("#record-link").closest(".filter-row");
  const teamsPanel = $("#player-teams").closest(".panel");
  $$(".notice-card").forEach((el) => {
    el.innerHTML =
      "<h3>Independent records</h3><p>Each game keeps its own ratings and results. Accepted results need a separate admin Elo checkoff.</p>";
  });
  function hideDetails() {
    filterRow.hidden = true;
    $("#pp-overview").hidden = true;
    $("#pp-matches").hidden = true;
  }
  if (overview) {
    hideDetails();
    $(".player-elo").hidden = true;
    const total = records.reduce((sum, r) => sum + r.matches, 0);
    $("#player-stats").innerHTML = total
      ? `<div class="player-stat"><b>${activeGames.length}</b><span>Games played</span></div><div class="player-stat"><b>${total}</b><span>Recorded matches</span></div>`
      : "";
    const section = document.createElement("section");
    section.className = "profile-game-section";
    section.setAttribute("aria-labelledby", "profile-games-title");
    section.innerHTML =
      '<h2 id="profile-games-title" class="section-title">Game records</h2>' +
      (activeGames.length
        ? `<div class="profile-games">${activeGames
            .map((g) => {
              const pools = records.filter((r) => r.game === g.slug);
              return `<a class="profile-game-card panel" data-profile-game="${g.slug}" href="${esc(profileUrl(g.slug))}"><h2>${esc(g.name)}</h2>${pools
                .map((pool) => {
                  const rating = p.ratings.find(
                    (r) => r.game === g.slug && r.format === pool.format,
                  );
                  return `<div class="profile-game-format"><span>${pool.format === "doubles" ? "Doubles" : "Singles"} · ${UI.count(pool.matches, "match", "matches")}</span>${rating ? `<b>${UI.elo(rating)} Elo</b>` : "<span>Not rated yet</span>"}</div>`;
                })
                .join(
                  "",
                )}<span class="link-arrow">View records ${UI.icon("arrow", 16)}</span></a>`;
            })
            .join("")}</div>`
        : UI.empty("No recorded games yet."));
    ($(".profile-bio") || $(".player-hero")).after(section);
    return;
  }
  const game = APP.games.find((g) => g.slug === requestedGame);
  const pools = records.filter((r) => r.game === requestedGame);
  const header = document.createElement("div");
  header.className = "profile-game-header";
  header.innerHTML = `<a class="btn btn-outline btn-sm" href="${esc(profileUrl())}">All games</a><h2>${esc(game?.name || "Game records")}</h2>`;
  filterRow.before(header);
  if (!game || !pools.length) {
    hideDetails();
    $(".player-elo").hidden = true;
    $("#player-stats").hidden = true;
    header.after(
      Object.assign(document.createElement("div"), {
        className: "panel panel-body",
        textContent: game
          ? `No matches recorded for this player in ${game.name}.`
          : "Choose a game from this player's overview.",
      }),
    );
    return;
  }
  let format = pools.some((r) => r.format === APP.params.get("format"))
    ? APP.params.get("format")
    : pools.some((r) => r.format === "singles")
      ? "singles"
      : pools[0].format;
  const selector = document.createElement("div");
  selector.className = "filter-row";
  selector.innerHTML =
    UI.select(
      "Game",
      "profile-game",
      [["", "All games"], ...activeGames.map((g) => [g.slug, g.name])],
      game.slug,
    ) +
    (pools.length > 1
      ? UI.select(
          "Rating format",
          "profile-format",
          pools.map((pool) => [
            pool.format,
            pool.format === "doubles" ? "Doubles" : "Singles",
          ]),
          format,
        )
      : "");
  header.after(selector);
  $("#field-profile-game").onchange = (event) => {
    location.href = profileUrl(event.target.value);
  };
  $("#record-link").href =
    "game.html?" + new URLSearchParams({ game: game.slug, view: "record" });
  const allMatches = $("#recent-body")
    .closest(".panel")
    .querySelector(".panel-link");
  allMatches.href = profileUrl(game.slug, format) + "#matches";
  allMatches.onclick = (event) => {
    event.preventDefault();
    $("#pt-matches").click();
  };
  async function render(offset = 0, refresh = false) {
    if (refresh) p = await APP.api("players/" + id);
    const [book, result] = await Promise.all([
      APP.api(`players/${id}/record?game=${game.slug}&format=${format}`),
      APP.api(
        `matches?game=${game.slug}&player=${id}&format=${format}&offset=${offset}`,
      ),
    ]);
    const rating = p.ratings.find(
      (r) => r.game === game.slug && r.format === format,
    );
    text("[data-player-elo]", rating ? UI.elo(rating) : "Unrated");
    const peak = $(".player-elo .peak");
    peak.innerHTML = [
      rating && !book.provisional ? `Peak ${UI.peak(rating)}` : "",
      book.rank ? `Rank #${book.rank}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    peak.hidden = !peak.textContent;
    text(
      ".player-elo .label",
      rating
        ? book.provisional
          ? `Provisional · ${book.rated_matches} of ${book.provisional_matches} rated matches`
          : "Established Elo"
        : "Awaiting first Elo checkoff",
    );
    $("#player-stats").innerHTML =
      `<div class="player-stat"><b>${book.w} / ${book.l}${game.kind === "fc" ? " / " + book.d : ""}</b><span>Wins / losses${game.kind === "fc" ? " / draws" : ""}</span></div><div class="player-stat"><b>${result.total}</b><span>Recorded ${format} matches</span></div>`;
    text(
      "#elo-change",
      rating
        ? UI.rating(rating.elo - 1000) +
            (book.provisional ? " · provisional" : " all time")
        : "Not rated yet",
    );
    text("#match-count", UI.count(result.total, "match", "matches"));
    text(
      ".player-grid .panel:first-child .sub",
      "Latest 200 Elo checkoffs in this game and format",
    );
    const rows = result.rows
      .map((m) => {
        const entry = m.ledger.find((l) => l.player_id === id);
        return `<tr><td>${UI.date(m.played_at ?? m.submitted)}</td><td>${UI.resultCard(m)}</td><td>${esc(m.competition_name || "Friendly")}</td><td>${UI.status(m)}</td><td>${entry ? UI.rating(entry.delta) : "—"}</td></tr>`;
      })
      .join("");
    for (const body of ["#recent-body", "#all-matches-body"]) {
      const target = $(body);
      $("thead", target.closest("table")).innerHTML =
        "<tr><th>Date</th><th>Match</th><th>Competition</th><th>Status</th><th>Elo change</th></tr>";
      target.innerHTML =
        rows || '<tr><td colspan="5">No matching results.</td></tr>';
      UI.matchTable(target.closest("table"));
    }
    $("#recent-body").closest(".panel").querySelector(".sub").textContent =
      "Accepted and pending results";
    $$("[data-match]").forEach((button) => {
      button.onclick = (event) => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
          return;
        event.preventDefault();
        UI.matchDialog(button.dataset.match).catch((error) =>
          UI.toast(error.message),
        );
      };
    });
    UI.pager($("#pp-matches"), result, render);
    const history = [...book.history].reverse();
    const historyPanel = $("#spark-wrap").closest(".panel");
    historyPanel.hidden = history.length === 0;
    if (history.length) {
      const values = [history[0].before, ...history.map((h) => h.after)];
      const lo = Math.min(...values) - 10,
        hi = Math.max(...values) + 10;
      const points = values
        .map(
          (value, i) =>
            `${20 + (i / (values.length - 1)) * 660},${180 - ((value - lo) / (hi - lo)) * 150}`,
        )
        .join(" ");
      $("#spark-wrap").innerHTML =
        `<svg viewBox="0 0 700 210" role="img" aria-label="Published Elo history"><line x1="20" y1="180" x2="680" y2="180" stroke="var(--line)"/><polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="3"/><text x="20" y="205" fill="currentColor">${UI.date(history[0].played_at ?? history[0].submitted)}</text></svg>`;
    }
    teamsPanel.hidden = game.kind !== "fc" || book.teams.length === 0;
    $("#player-teams").innerHTML = book.teams
      .map(
        (team) =>
          `<div class="team-usage"><span class="monogram">${esc(team.code)}</span><b>${esc(team.name)}</b><span>${UI.count(team.appearances, "match", "matches")}</span></div>`,
      )
      .join("");
    text("#team-count", book.teams.length);
    $("#snapshot-body").innerHTML =
      `<div class="summary-meta"><div><span>Game</span><b>${esc(game.name)}</b></div><div><span>Format</span><b>${format}</b></div>${rating && !book.provisional ? `<div><span>Peak</span><b>${UI.peak(rating)}</b></div>` : ""}</div>`;
  }
  if ($("#field-profile-format"))
    $("#field-profile-format").onchange = async (event) => {
      format = event.target.value;
      await render();
    };
  window.addEventListener("records-changed", () =>
    render(0, true).catch((error) => UI.toast(error.message)),
  );
  await render();
});
