/* Admin demo: game catalog, people, and a live theme preview. */
(function () {
  const params = new URLSearchParams(location.search);
  const ctx = window.resolveGame(params);
  const M = ctx.M;
  if (ctx.isSmash) document.body.dataset.game = "smash";
  else if (ctx.isTennis || ctx.isTableTennis) document.body.dataset.game = ctx.isTableTennis ? "table-tennis" : "tennis";
  else if (ctx.slug === "eafc26") document.body.dataset.gameVariant = "eafc26";
  const $ = UI.$;
  const $$ = UI.$$;
  const esc = UI.esc;

  const tones = { eafc: "#00c25a", eafc26: "#1d5bdb", smash: "#ef3f6b", tennis: "#a58adc", tt: "#ff6b5e" };

  const games = $("#admin-games-body");
  if (games) {
    games.innerHTML = M.games.map((g) => {
      const live = g.live;
      return "<tr>" +
        '<td><span class="player-cell"><span class="theme-dot" style="background:' + (tones[g.tone] || "#232d4b") + '"></span><b>' + esc(g.name) + "</b></span></td>" +
        "<td>" + esc(g.scoring || "—") + "</td>" +
        "<td><span class=\"mono\" style=\"font-size:.72rem\">" + (g.tone || "—") + "</span></td>" +
        '<td class="c num">' + (live ? g.players : "—") + "</td>" +
        '<td class="c num">' + (live ? g.matches : "—") + "</td>" +
        "<td>" + (live ? '<span class="status status-live">Live</span>' : '<span class="chip">Reserved</span>') + "</td>" +
        '<td><div class="table-actions">' +
        (live
          ? '<a class="btn btn-outline btn-sm" href="' + esc(g.href) + '">Open</a>'
          : '<button class="btn btn-outline btn-sm" type="button" data-demo="' + esc(g.name) + ' is reserved for a future season. Theme and scoring slots are ready.">Reserved</button>') +
        "</div></td></tr>";
    }).join("");
  }

  const people = $("#admin-people-body");
  if (people) {
    people.innerHTML = M.players.map((p) => {
      const site = p.id === 1;
      const gameAdmin = p.id === 1 || p.id === 2;
      return "<tr>" +
        '<td><span class="player-cell">' + UI.avatar(p.name, "avatar-sm") + '<span class="name">' + esc(p.name) + "</span></span></td>" +
        "<td>" + esc(p.handle) + "</td>" +
        '<td><div class="tag-row">' +
        (site ? '<span class="role-chip site">Site admin</span>' : "") +
        (gameAdmin ? '<span class="role-chip game">Game admin</span>' : '<span class="role-chip">Player</span>') +
        "</div></td>" +
        "<td>" + esc(p.since) + "</td>" +
        '<td><div class="table-actions"><button class="btn btn-outline btn-sm" type="button" data-demo="Role changes are disabled in the static mockup.">Manage</button></div></td>' +
        "</tr>";
    }).join("");
  }

  const presets = {
    uva: { bg: "#232d4b", surface: "#ffffff", accent: "#e57200", radius: 20, note: "UVA · gateway" },
    eafc: { bg: "#07130c", surface: "#ffffff", accent: "#00c25a", radius: 22, note: "EA FC 27 · live" },
    eafc26: { bg: "#081227", surface: "#ffffff", accent: "#1d5bdb", radius: 22, note: "EA FC 26 · live" },
    smash: { bg: "#22122c", surface: "#ffffff", accent: "#ef3f6b", radius: 24, note: "Super Smash Bros. · live" },
    tennis: { bg: "#0f2f24", surface: "#ffffff", accent: "#a58adc", radius: 18, note: "Tennis · live" },
    tt: { bg: "#142b40", surface: "#fffefa", accent: "#e65b4b", radius: 16, note: "Table tennis · live" }
  };

  const bg = $("#theme-bg");
  const surface = $("#theme-surface");
  const accent = $("#theme-accent");
  const radius = $("#theme-radius");
  const radiusOut = $("#theme-radius-out");
  const preview = $("#theme-preview");
  const note = $("#tp-note");
  const presetButtons = $$("[data-preset]");

  function applyPreset(key) {
    const p = presets[key];
    if (!p) return;
    bg.value = p.bg;
    surface.value = p.surface;
    accent.value = p.accent;
    radius.value = p.radius;
    if (note) note.textContent = p.note;
    presetButtons.forEach((b) => b.setAttribute("aria-pressed", b.getAttribute("data-preset") === key ? "true" : "false"));
    update();
  }

  function update() {
    if (!preview) return;
    preview.style.setProperty("--preview-bg", bg.value);
    preview.style.setProperty("--preview-surface", surface.value);
    preview.style.setProperty("--preview-accent", accent.value);
    preview.style.setProperty("--preview-radius", radius.value + "px");
    if (radiusOut) radiusOut.textContent = radius.value + "px";
  }

  [bg, surface, accent, radius].forEach((input) => {
    if (input) input.addEventListener("input", () => {
      presetButtons.forEach((b) => b.setAttribute("aria-pressed", "false"));
      update();
    });
  });

  presetButtons.forEach((btn) => {
    btn.addEventListener("click", () => applyPreset(btn.getAttribute("data-preset")));
  });

  const save = $("#theme-save");
  if (save) save.addEventListener("click", () => UI.toast("Theme saved — demo only. The rest of the mockup is unchanged."));
  const reset = $("#theme-reset");
  if (reset) reset.addEventListener("click", () => {
    applyPreset("eafc");
    UI.toast("Theme reset to the EA FC 27 sample.");
  });

  applyPreset("eafc");
})();
