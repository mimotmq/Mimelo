APP.run(async () => {
  const { $, esc } = UI;
  UI.text(
    ".directory-disclaimer",
    "Shared player identities, independent records in each game.",
  );
  UI.text(".directory-hint", "Browse player profiles");
  $("#directory-search").placeholder = "Search names or handles";
  async function load(offset = 0) {
    const result = await APP.api(
      "players?offset=" +
        offset +
        "&q=" +
        encodeURIComponent($("#directory-search").value),
    );
    UI.text("#directory-count", result.total);
    $("#directory-empty").hidden = result.total > 0;
    $("#player-directory").innerHTML = result.rows
      .map((p) => {
        const games = APP.games.filter((g) =>
          p.records.some((r) => r.game === g.slug),
        );
        return `<article class="directory-player panel"><div class="directory-player-main">${p.photo ? `<img class="directory-avatar" src="${esc(p.photo)}" alt="${esc(p.name)}">` : UI.avatar(p.name, "")}<a class="directory-player-name" href="player.html?player=${p.id}"><h2>${esc(p.handle ? "@" + p.handle : p.name)}</h2><span>${esc(p.handle ? p.name : "Fill-in player")}</span></a></div><div class="directory-games"><span class="directory-label">Game records</span><div class="directory-game-list">${games.map((g) => `<a class="directory-game-link" href="player.html?player=${p.id}&game=${g.slug}"><span class="directory-game-dot" data-game="${g.slug}"></span>${esc(g.name)} ${UI.icon("arrow", 14)}</a>`).join("") || '<span class="muted">No recorded games yet.</span>'}</div></div><a class="link-arrow" href="player.html?player=${p.id}">View profile ${UI.icon("arrow", 16)}</a></article>`;
      })
      .join("");
    UI.pager($("#player-directory").parentElement, result, load);
  }
  let timer;
  $("#directory-search").oninput = () => {
    clearTimeout(timer);
    timer = setTimeout(() => load().catch((e) => UI.toast(e.message)), 200);
  };
  await load();
});
