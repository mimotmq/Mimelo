/* Shared UI helpers for the mimELo mockup. */
(function () {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const paths = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4"/><path d="M12 13v4M8 21h8M9 21v-2h6v2"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 19 7a4 4 0 0 1-3 3.87"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    play: '<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4V8Z"/>',
    shield: '<path d="M12 3 4 6v5c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
    arrow: '<path d="M4 12h16M14 6l6 6-6 6"/>',
    "arrow-up": '<path d="M7 17 17 7M8 7h9v9"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/>',
    settings: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.9 1.9-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V20h-2.68v-.09a1.7 1.7 0 0 0-1.1-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.9-1.9.06-.06A1.7 1.7 0 0 0 8.6 15a1.7 1.7 0 0 0-1.56-1.03H7v-2.68h.09A1.7 1.7 0 0 0 8.65 10.2a1.7 1.7 0 0 0-.34-1.88L8.25 8.25l1.9-1.9.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 13.12 5.2V5h2.68v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 1.9 1.9-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03H22v2.68h-.09A1.7 1.7 0 0 0 19.4 15Z"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    external: '<path d="M14 3h7v7M21 3l-9 9"/><path d="M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>',
    game: '<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 10v4M5 12h4M16 11h.01M18 13h.01"/>',
    bracket: '<path d="M4 5h4v4H4zM4 15h4v4H4zM16 10h4v4h-4z"/><path d="M8 7h4v10h4M8 17h4"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    sword: '<path d="M5 4h4l10 10M5 4v4l10 10M19 15l-4 4M8 16l-4 4"/>',
    spark: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"/>'
  };

  function icon(name, size) {
    const d = paths[name] || paths.info;
    return '<svg class="od-icon" style="--od-icon-size:' + (size || 20) + 'px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";
  }

  const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const playerById = (id) => window.MOCK.players.find((p) => p.id === Number(id));
  const clubByCode = (code) => (window.MOCK.teamPool || []).find((t) => t.code === code) ||
    window.MOCK.clubs.find((c) => c.code === code) || { code: code || "—", name: code || "—" };
  const playerByName = (name) => window.MOCK.players.find((p) => p.name === name);

  function avatar(name, sizeClass, tone) {
    return '<span class="avatar ' + (sizeClass || "") + '"' + (tone ? ' data-tone="' + tone + '"' : "") + ">" + esc(initials(name)) + "</span>";
  }

  function monogram(code, tone) {
    return '<span class="monogram"' + (tone ? ' data-tone="' + tone + '"' : "") + ">" + esc(code || "—") + "</span>";
  }

  function stars(value) {
    const v = Math.max(0, Math.min(5, Math.round((Number(value) || 0) * 2) / 2));
    const label = (Number.isInteger(v) ? v : v.toFixed(1)) + " out of 5 stars";
    const one = (i) => {
      const fill = Math.round(Math.max(0, Math.min(1, v - (i - 1))) * 100);
      return '<span class="star-glyph"><span class="base" aria-hidden="true">★</span><span class="on" aria-hidden="true" style="width:' + fill + '%">★</span></span>';
    };
    return '<span class="star-rating" role="img" aria-label="' + esc(label) + '" title="' + esc(label) + '">' +
      [1, 2, 3, 4, 5].map(one).join("") + "</span>";
  }

  function formDots(form) {
    return '<span class="form-dots" aria-label="Form: ' + esc(String(form).split("").join(", ")) + '">' +
      String(form).split("").map((r) => '<span class="form-dot ' + r.toLowerCase() + '" title="' + (r === "W" ? "Win" : r === "D" ? "Draw" : "Loss") + '">' + r + "</span>").join("") + "</span>";
  }

  function formatDate(value) {
    if (!value) return "";
    const d = new Date(value + "T12:00:00");
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  function summary(m) {
    const p1 = playerById(m.p1);
    const p2 = playerById(m.p2);
    const n1 = p1 ? p1.name : "Player 1";
    const n2 = p2 ? p2.name : "Player 2";
    const pen1 = m.pens ? "(" + m.pens[0] + ")" : "";
    const pen2 = m.pens ? "(" + m.pens[1] + ")" : "";
    return '<span class="match-summary">' +
      '<span class="side">' + monogram(m.club1) + esc(n1) + "</span>" +
      '<span class="score">' + m.s1 + pen1 + "–" + pen2 + m.s2 + "</span>" +
      '<span class="side">' + monogram(m.club2) + esc(n2) + "</span>" +
      (m.aet ? '<span class="tag">a.e.t.</span>' : "") +
      (m.pens ? '<span class="tag">pens</span>' : "") +
      "</span>";
  }

  let toastTimer = null;
  function toast(message) {
    let node = document.getElementById("toast");
    if (!node) {
      node = document.createElement("div");
      node.id = "toast";
      node.className = "toast";
      node.setAttribute("role", "status");
      node.setAttribute("aria-live", "polite");
      document.body.appendChild(node);
    }
    node.innerHTML = icon("info", 18) + "<span>" + esc(message) + "</span>";
    node.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove("show"), 3800);
  }

  function openDialog(dialog, trigger) {
    if (!dialog) return;
    dialog.dataset.returnFocus = trigger && trigger.id ? trigger.id : "";
    dialog._trigger = trigger || document.activeElement;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    const focusTarget = dialog.querySelector("[data-dialog-focus]") || dialog.querySelector("button, a, input, select, textarea");
    if (focusTarget) setTimeout(() => focusTarget.focus(), 0);
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    const trigger = dialog._trigger;
    if (trigger && document.contains(trigger)) setTimeout(() => trigger.focus(), 0);
  }

  function initDialogs() {
    $$("[data-close]").forEach((btn) => {
      btn.addEventListener("click", () => closeDialog(btn.closest("dialog")));
    });
    $$("dialog.dialog").forEach((dialog) => {
      dialog.addEventListener("click", (e) => {
        if (e.target === dialog) closeDialog(dialog);
      });
    });
  }

  function initTabs(root) {
    const scope = root || document;
    $$('[role="tab"]', scope).forEach((tab) => {
      tab.addEventListener("click", () => activateTab(tab));
      tab.addEventListener("keydown", (e) => {
        const tabs = $$('[role="tab"]', tab.closest('[role="tablist"]') || scope);
        const i = tabs.indexOf(tab);
        if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); const next = tabs[(i + 1) % tabs.length]; next.focus(); activateTab(next); }
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); const next = tabs[(i - 1 + tabs.length) % tabs.length]; next.focus(); activateTab(next); }
        if (e.key === "Home") { e.preventDefault(); tabs[0].focus(); activateTab(tabs[0]); }
        if (e.key === "End") { e.preventDefault(); tabs[tabs.length - 1].focus(); activateTab(tabs[tabs.length - 1]); }
      });
    });
    function activateTab(tab) {
      const list = tab.closest('[role="tablist"]');
      if (!list) return;
      $$('[role="tab"]', list).forEach((t) => {
        const selected = t === tab;
        t.setAttribute("aria-selected", selected ? "true" : "false");
        t.setAttribute("tabindex", selected ? "0" : "-1");
        const panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !selected;
      });
    }
  }

  function initMobileNav() {
    const btn = document.getElementById("menu-btn");
    const nav = document.getElementById("mobile-nav");
    if (!btn || !nav) return;
    btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", open ? "false" : "true");
      nav.hidden = open;
    });
    $$("a", nav).forEach((a) => a.addEventListener("click", () => {
      btn.setAttribute("aria-expanded", "false");
      nav.hidden = true;
    }));
  }

  function initSwitcher() {
    const switcher = document.querySelector("details.game-switcher");
    if (!switcher) return;
    document.addEventListener("click", (e) => {
      if (!switcher.contains(e.target)) switcher.removeAttribute("open");
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") switcher.removeAttribute("open");
    });
  }

  function initGameSelection() {
    $$('a[href*="game.html"]').forEach((link) => {
      link.addEventListener("click", () => {
        const target = new URL(link.href, location.href);
        const selected = target.searchParams.get("game") ||
          (document.body.dataset.game === "tennis" ? "tennis" : document.body.dataset.game === "table-tennis" ? "tt" : document.body.dataset.gameVariant || "eafc27");
        try { sessionStorage.setItem("mimelo-preview-game", selected); } catch (_) {}
      });
    });
  }

  function initDemo() {
    $$("[data-demo]").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (el.tagName === "A") e.preventDefault();
        toast(el.getAttribute("data-demo") || "Demo only — nothing was saved.");
      });
    });
  }

  function initSearch(input, items, renderEmpty) {
    if (!input) return;
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      let shown = 0;
      items.forEach((el) => {
        const hit = !q || el.textContent.toLowerCase().includes(q);
        el.hidden = !hit;
        if (hit) shown++;
      });
      if (renderEmpty) renderEmpty(shown === 0);
    });
  }

  function init() {
    $$("[data-icon]").forEach((el) => {
      el.innerHTML = icon(el.getAttribute("data-icon"), Number(el.getAttribute("data-size")) || 20);
    });
    initDialogs();
    initTabs();
    initMobileNav();
    initSwitcher();
    initGameSelection();
    initDemo();
  }

  function setScore(sets) {
    if (!sets || !sets.length) return "—";
    return sets.map((s) => {
      if (s.a == null || s.b == null) return "—";
      let t = s.a + "–" + s.b;
      if (s.tb != null) t += "(" + s.tb + ")";
      return t;
    }).join(" ");
  }

  function gameSetScore(sets) {
    if (!sets || !sets.length) return "—";
    return sets.map((game) => game.a == null || game.b == null ? "—" : game.a + "–" + game.b).join(" ");
  }

  function tennisScoreboard(match) {
    const teamNames = (ids) => (ids || []).map((id) => {
      const player = playerById(id);
      return player ? player.name : "Player";
    }).join(" + ");
    const sides = match.format === "doubles"
      ? [{ ids: match.team1 || [], name: teamNames(match.team1) }, { ids: match.team2 || [], name: teamNames(match.team2) }]
      : [match.p1, match.p2].map((id) => {
        const player = playerById(id);
        return { ids: player ? [player.id] : [], name: player ? player.name : "Player" };
      });
    const sets = match.sets || [];
    const won = [0, 0];
    sets.forEach((set) => {
      if (set.a != null && set.b != null && set.a !== set.b) won[set.a > set.b ? 0 : 1]++;
    });
    const matchWinner = won[0] === won[1] ? -1 : won[0] > won[1] ? 0 : 1;
    const rows = sides.map((side, sideIndex) => {
      const player = side.ids.length === 1 ? playerById(side.ids[0]) : null;
      const scores = sets.map((set) => {
        const score = set[sideIndex === 0 ? "a" : "b"];
        const winner = set.a != null && set.b != null && set.a !== set.b && (set.a > set.b ? 0 : 1) === sideIndex;
        const explicitTie = sideIndex === 0 ? set.tbA : set.tbB;
        const legacyTie = set.tb != null && set.a !== set.b && (set.a > set.b ? 1 : 0) === sideIndex ? set.tb : null;
        const tie = explicitTie != null ? explicitTie : legacyTie;
        return '<span class="tennis-score-cell' + (winner ? " set-winner" : "") + '">' +
          esc(score == null ? "—" : score) + (tie != null ? '<sup>' + esc(tie) + "</sup>" : "") + "</span>";
      }).join("");
      const setTotal = won[sideIndex];
      return '<div class="tennis-score-row' + (matchWinner === sideIndex ? " match-winner" : "") + '">' +
        '<span class="tennis-score-player">' + (player ? flagChip(player) : "") + '<span>' + esc(side.name) + "</span></span>" +
        scores + '<span class="tennis-score-total">' + (sets.some((set) => set.a != null && set.b != null) ? setTotal : "—") + "</span></div>";
    }).join("");
    const columns = Math.max(1, sets.length);
    const columnTemplate = 'minmax(112px,1.8fr) repeat(' + columns + ',minmax(24px,.4fr)) 30px';
    return '<div class="tennis-scoreboard" style="--tennis-set-count:' + columns + ';--tennis-score-columns:' + columnTemplate + '" aria-label="Tennis set scorecard">' +
      '<div class="tennis-score-row tennis-score-head"><span>Player</span>' +
      (sets.length ? sets.map((_, index) => '<span class="tennis-score-cell">' + (index + 1) + "</span>").join("") : '<span class="tennis-score-cell">Sets</span>') +
      '<span class="tennis-score-total-head">Sets</span>' +
      "</div>" + rows + "</div>";
  }

  function tennisResult(m) {
    let a = 0, b = 0;
    (m.sets || []).forEach((s) => {
      if ((s.a || 0) > (s.b || 0)) a++;
      else if ((s.b || 0) > (s.a || 0)) b++;
    });
    return { a: a, b: b };
  }

  function tableTennisScorecard(match) {
    const players = [playerById(match.p1), playerById(match.p2)];
    const games = match.sets || [];
    const wins = [0, 0];
    games.forEach((game) => {
      if (game.a != null && game.b != null && game.a !== game.b) wins[game.a > game.b ? 0 : 1]++;
    });
    const matchWinner = wins[0] === wins[1] ? -1 : wins[0] > wins[1] ? 0 : 1;
    const hasScore = games.some((game) => game.a != null || game.b != null);
    const displayGames = hasScore ? games : [{ a: null, b: null }];
    const rows = players.map((player, side) => {
      const scoreCells = displayGames.map((game) => {
        const a = game.a, b = game.b;
        const winner = a != null && b != null && a !== b && (a > b ? 0 : 1) === side;
        const score = side === 0 ? a : b;
        return '<span class="tennis-score-cell' + (winner ? " set-winner" : "") + '">' + esc(score == null ? "—" : score) + "</span>";
      }).join("");
      return '<div class="tennis-score-row' + (matchWinner === side ? " match-winner" : "") + '">' +
        '<span class="tennis-score-player">' + (player ? flagChip(player) : "") + '<span>' + esc(player ? player.name : "Player") + "</span></span>" +
        scoreCells + '<span class="tennis-score-total">' + (hasScore ? wins[side] : "—") + "</span></div>";
    }).join("");
    const columns = Math.max(1, displayGames.length);
    const columnTemplate = 'minmax(112px,1.8fr) repeat(' + columns + ',minmax(24px,.4fr)) 30px';
    return '<div class="tennis-scoreboard tt-scoreboard" style="--tennis-set-count:' + columns + ';--tennis-score-columns:' + columnTemplate + '" aria-label="Table tennis game scores">' +
      '<div class="tennis-score-row tennis-score-head"><span>Player</span>' +
      displayGames.map((_, index) => '<span class="tennis-score-cell">' + (index + 1) + "</span>").join("") +
      '<span class="tennis-score-total-head">Games</span></div>' + rows + "</div>";
  }

  function flagChip(p) {
    if (!p || !p.flag) return '<span class="muted">—</span>';
    return '<span class="flag-chip" title="' + esc(p.nation || p.flag) + '">' + esc(p.flag) + "</span>";
  }

  function tierChip(p) {
    if (!p) return '<span class="muted">—</span>';
    const t = p.tier ? p.tier.toLowerCase() : "";
    return '<span class="tier-chip" data-tier="' + esc(t) + '">' + esc(p.tier || "—") + "</span>";
  }

  function identity(p) {
    if (!p) return '<span class="muted">—</span>';
    return '<span class="identity-stack">' + flagChip(p) + tierChip(p) + "</span>";
  }

  function surfaceChip(surface) {
    const s = surface || "Hardcourt";
    return '<span class="surface-chip" data-surface="' + esc(s.toLowerCase()) + '">' + esc(s) + "</span>";
  }

  function smashCharById(id) {
    const roster = (window.MOCK && window.MOCK.roster) || [];
    return roster.find((c) => c.id === Number(id)) || null;
  }

  function smashStageById(id) {
    const stages = (window.MOCK && window.MOCK.stages) || [];
    return stages.find((s) => s.id === id) || { id: id, name: id || "—", code: "—" };
  }

  function smashChar(id) {
    const c = smashCharById(id);
    if (!c) return '<span class="muted">—</span>';
    return '<span class="char-tile" title="' + esc(c.name) + ' · #' + c.num + '">' + esc(c.code) + "</span>";
  }

  function smashTag(p) {
    if (!p || !p.tag) return "";
    return '<span class="tag-chip">' + esc(p.tag) + "</span>";
  }

  function smashIdentity(p) {
    if (!p) return '<span class="muted">—</span>';
    const mains = (p.mains || []).map((id) => smashChar(id)).join("");
    return '<span class="smash-identity">' + mains + smashTag(p) + "</span>";
  }

  function smashResult(m) {
    const games = m.games || [];
    let a = 0, b = 0;
    games.forEach((g) => { if (g.a > g.b) a++; else if (g.b > g.a) b++; });
    return { a: a, b: b };
  }

  function smashScorecard(match) {
    const sideIds = match.format === "doubles" ? [(match.team1 || []), (match.team2 || [])] : [[match.p1], [match.p2]];
    const sideNames = sideIds.map((ids) => (ids || []).map((id) => { const p = playerById(id); return p ? p.name : "Player"; }).join(" + "));
    const games = match.games || [];
    const stocks = match.stocks || 3;
    const wins = [0, 0];
    games.forEach((g) => { if (g.a != null && g.b != null && g.a !== g.b) wins[g.a > g.b ? 0 : 1]++; });
    const matchWinner = wins[0] === wins[1] ? -1 : wins[0] > wins[1] ? 0 : 1;
    const rows = sideIds.map((ids, side) => {
      const cells = games.map((g) => {
        const v = side === 0 ? g.a : g.b;
        const win = g.a != null && g.b != null && g.a !== g.b && (g.a > g.b ? 0 : 1) === side;
        const jv = win && g.jv;
        const jvNum = jv ? (stocks - (side === 0 ? g.b : g.a)) + 1 : 0;
        return '<span class="tennis-score-cell' + (win ? " set-winner" : "") + '">' + esc(v == null ? "—" : v) + (jv ? '<sup class="jv">JV' + jvNum + '</sup>' : "") + "</span>";
      }).join("");
      return '<div class="tennis-score-row' + (matchWinner === side ? " match-winner" : "") + '">' +
        '<span class="tennis-score-player"><span>' + esc(sideNames[side]) + "</span></span>" +
        cells + '<span class="tennis-score-total">' + (games.length ? wins[side] : "—") + "</span></div>";
    }).join("");
    const columns = Math.max(1, games.length);
    const columnTemplate = 'minmax(96px,1.6fr) repeat(' + columns + ',minmax(30px,.5fr)) 30px';
    const usedChars = Array.from(new Set(games.map((g) => [g.cA, g.cB]).flat().filter((id) => id != null))).map((id) => smashChar(id)).join("") || '<span class="muted">—</span>';
    const usedStages = Array.from(new Set(games.map((g) => g.st ? smashStageById(g.st).code : "").filter(Boolean))).join(" · ") || "—";
    return '<div class="smash-scoreboard" style="--tennis-set-count:' + columns + ';--tennis-score-columns:' + columnTemplate + '" aria-label="Smash game scores">' +
      '<div class="tennis-score-row tennis-score-head"><span>Player</span>' +
      games.map((_, index) => '<span class="tennis-score-cell">' + (index + 1) + "</span>").join("") +
      '<span class="tennis-score-total-head">Games</span></div>' + rows +
      '<div class="smash-meta"><span class="smash-chars">' + usedChars + '</span><span class="smash-stages">' + esc(usedStages) + "</span></div></div>";
  }

  window.UI = { $, $$, esc, icon, initials, avatar, monogram, stars, formDots, formatDate, summary, toast, openDialog, closeDialog, initTabs, initSearch, playerById, clubByCode, playerByName, setScore, gameSetScore, tennisScoreboard, tableTennisScorecard, tennisResult, flagChip, tierChip, identity, surfaceChip, smashCharById, smashStageById, smashChar, smashTag, smashIdentity, smashResult, smashScorecard };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
