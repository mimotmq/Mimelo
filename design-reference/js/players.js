/* All-games player directory. */
(function () {
  const games = [
    { slug: "eafc27", label: "EA FC 27", query: "&game=eafc27" },
    { slug: "eafc26", label: "EA FC 26", query: "&game=eafc26" },
    { slug: "smash", label: "Super Smash Bros.", query: "&game=smash" },
    { slug: "tennis", label: "Tennis", query: "&game=tennis" },
    { slug: "tt", label: "Table tennis", query: "&game=tt" }
  ];
  const directories = window.GAME_SET;
  const byName = new Map();

  games.forEach((game) => {
    const source = directories[game.slug];
    (source && source.players || []).forEach((player) => {
      if (!player.handle) return;
      let entry = byName.get(player.name);
      if (!entry) {
        entry = { name: player.name, handle: player.handle, records: [] };
        byName.set(player.name, entry);
      }
      entry.records.push({ game: game, playerId: player.id });
    });
  });
  const profileQuery = (game) => game.query;

  const players = Array.from(byName.values()).sort((a, b) => a.handle.localeCompare(b.handle));
  const list = document.getElementById("player-directory");
  const search = document.getElementById("directory-search");
  const count = document.getElementById("directory-count");
  const empty = document.getElementById("directory-empty");
  if (!list || !search || !count || !empty) return;

  function render() {
    const query = search.value.trim().toLowerCase();
    const visible = players.filter((player) =>
      player.handle.toLowerCase().includes(query) ||
      player.name.toLowerCase().includes(query) ||
      player.records.some((record) => record.game.label.toLowerCase().includes(query))
    );
    count.textContent = visible.length;
    empty.hidden = visible.length > 0;
    list.innerHTML = visible.map((player) => {
      const records = player.records.map((record) =>
        '<a class="directory-game-link" href="player.html?player=' + record.playerId + profileQuery(record.game) + '" aria-label="Open ' + UI.esc(record.game.label) + ' profile for ' + UI.esc(player.handle) + '">' +
        '<span class="directory-game-dot" data-game="' + UI.esc(record.game.slug) + '" aria-hidden="true"></span>' + UI.esc(record.game.label) +
        UI.icon("arrow", 14) + "</a>"
      ).join("");
      return '<article class="directory-player panel">' +
        '<div class="directory-player-main">' +
        '<img class="directory-avatar" src="assets/brand/profile-placeholder.svg" width="68" height="68" alt="Generic profile photo placeholder for ' + UI.esc(player.handle) + '">' +
        '<div class="directory-player-name"><h2>' + UI.esc(player.handle) + '</h2><span>' + UI.esc(player.name) + '</span></div></div>' +
        '<div class="directory-games"><span class="directory-label">Games with records</span><div class="directory-game-list">' + records + '</div></div>' +
        '</article>';
    }).join("");
  }

  document.querySelectorAll("[data-icon]").forEach((node) => {
    node.outerHTML = UI.icon(node.getAttribute("data-icon"), Number(node.getAttribute("data-size")) || 20);
  });
  search.addEventListener("input", render);
  render();
})();
