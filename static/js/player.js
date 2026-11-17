APP.run(async () => {
  const { $, $$, esc, text } = UI,
    id = Number(APP.params.get("player"));
  let format = "singles";
  let p = await APP.api("players/" + id);
  if (p.merged_into) {
    location.replace(APP.url("player", { player: p.merged_into }));
    return;
  }
  text("[data-player-name]", p.name);
  text("[data-player-handle]", p.handle ? "@" + p.handle : "Fill-in player");
  $("#player-avatar").innerHTML = UI.avatar(p.name, "", p.photo);
  $("#player-flairs").innerHTML = [
    "nationality",
    "favoriteTeam",
    "tag",
    "mains",
  ]
    .filter((k) => p.profile[k])
    .map((k) => `<span class="chip">${esc(p.profile[k])}</span>`)
    .join("");
  text("#spark-wrap ~ .sub", "Published Elo history");
  text(".spark-wrap", "");
  $("#record-link").href = APP.url("game", { view: "record" });
  text("#team-count", "Profile");
  $("#player-teams").innerHTML = esc(p.profile.bio || "No bio yet.");
  $$(".notice-card").forEach((el) => {
    if (el.textContent.includes("Profile pictures"))
      el.innerHTML =
        "<h3>Independent records</h3><p>Each game maintains its own Elo. Accepted results await a separate admin Elo checkoff.</p>";
  });
  const selector = document.createElement("div");
  selector.className = "filter-row";
  selector.innerHTML =
    UI.select(
      "Game",
      "profile-game",
      APP.games.map((g) => [g.slug, g.name]),
      APP.slug,
    ) +
    (["tennis", "smash"].includes(APP.game.kind)
      ? UI.select(
          "Rating format",
          "profile-format",
          [
            ["singles", "Singles"],
            ["doubles", "Doubles"],
          ],
          format,
        )
      : "");
  $(".filter-row").before(selector);
  $("#field-profile-game").onchange = (e) =>
    (location.href = "player.html?player=" + id + "&game=" + e.target.value);
  async function render(offset = 0, refresh = false) {
    if (refresh) p = await APP.api("players/" + id);
    const r = p.ratings.find((r) => r.game === APP.slug && r.format === format);
    text("[data-player-elo]", UI.elo(r));
    text("[data-player-peak]", UI.elo(r, r?.peak));
    const book = await APP.api(
      `players/${id}/record?game=${APP.slug}&format=${format}`,
    );
    text("[data-player-rank]", book.rank ? "#" + book.rank : "Unranked");
    text(
      ".player-elo .label",
      book.provisional
        ? `Provisional · ${book.rated_matches} of ${book.provisional_matches} rated matches`
        : "Established Elo",
    );
    const result = await APP.api(
      `matches?game=${APP.slug}&player=${id}&format=${format}&offset=${offset}`,
    );
    const history = book.history.reverse();
    text(
      "#elo-change",
      (r ? UI.rating(r.elo - 1000) : "0") +
        (book.provisional ? " · provisional" : " all time"),
    );
    text("#match-count", UI.count(result.total, "match", "matches"));
    text("#spark-wrap", "");
    text(
      ".player-grid .panel:first-child .sub",
      "Latest 200 Elo checkoffs in this game and format",
    );
    $("#player-teams").innerHTML =
      "<p>" +
      esc(p.profile.bio || "") +
      "</p>" +
      book.teams
        .map(
          (t) =>
            '<div class="team-usage"><span class="monogram">' +
            esc(t.code) +
            "</span><b>" +
            esc(t.name) +
            "</b><span>" +
            UI.count(t.appearances, "match", "matches") +
            "</span></div>",
        )
        .join("");
    text("#team-count", book.teams.length || "Profile");
    $("#player-stats").innerHTML =
      `<div class="player-stat"><b>${book.w} / ${book.l}${APP.game.kind === "fc" ? " / " + book.d : ""}</b><span>Wins / losses${APP.game.kind === "fc" ? " / draws" : ""}</span></div><div class="player-stat"><b>${UI.elo(r)}</b><span>${format} Elo</span></div>`;
    const rows = result.rows
      .map(
        (m) =>
          `<tr><td>${UI.date(m.submitted)}</td><td>${UI.score(m)}</td><td>${esc(m.competition_name || "Friendly")}</td><td>${UI.status(m)}</td><td>${UI.rating(m.ledger.find((l) => l.player_id === id)?.delta ?? 0)}</td><td>${UI.button("Open", "match", `data-match="${m.id}"`)}</td></tr>`,
      )
      .join("");
    for (const body of ["#recent-body", "#all-matches-body"]) {
      const b = $(body);
      b.closest("table").querySelector("thead").innerHTML =
        "<tr><th>Date</th><th>Match</th><th>Competition</th><th>Status</th><th>Elo change</th><th></th></tr>";
      b.innerHTML =
        rows || '<tr><td colspan="6">No matches in this game yet.</td></tr>';
      UI.matchTable(b.closest("table"));
    }
    $$("[data-match]").forEach(
      (b) => (b.onclick = () => UI.matchDialog(b.dataset.match)),
    );
    UI.pager($("#pp-matches"), result, render);
    if (!history.length)
      $("#spark-wrap").innerHTML = UI.empty(
        "No Elo checkoffs yet. Starting rating: 1000.",
      );
    else {
      const values = [history[0].before, ...history.map((h) => h.after)],
        lo = Math.min(...values) - 10,
        hi = Math.max(...values) + 10;
      const pts = values
        .map(
          (v, i) =>
            `${20 + (i / (values.length - 1)) * 660},${180 - ((v - lo) / (hi - lo)) * 150}`,
        )
        .join(" ");
      $("#spark-wrap").innerHTML =
        `<svg viewBox="0 0 700 210" role="img" aria-label="Published Elo history"><line x1="20" y1="180" x2="680" y2="180" stroke="var(--line)"/><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="3"/><text x="20" y="205" fill="currentColor">${UI.date(history[0].submitted)}</text></svg>`;
    }
    $("#snapshot-body").innerHTML =
      `<div class="summary-meta"><div><span>Game</span><b>${esc(APP.game.name)}</b></div><div><span>Format</span><b>${format}</b></div><div><span>Peak</span><b>${UI.elo(r, r?.peak)}</b></div></div>`;
  }
  if ($("#field-profile-format"))
    $("#field-profile-format").onchange = async (e) => {
      format = e.target.value;
      await render();
    };
  window.addEventListener("records-changed", () =>
    render(0, true).catch((e) => UI.toast(e.message)),
  );
  await render();
});
