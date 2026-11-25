/* Template icon vocabulary and live interaction helpers. */
(() => {
  const paths = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>',
    calendar:
      '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    trophy:
      '<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4"/><path d="M12 13v4M8 21h8M9 21v-2h6v2"/>',
    users:
      '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 19 7a4 4 0 0 1-3 3.87"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    play: '<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4V8Z"/>',
    shield:
      '<path d="M12 3 4 6v5c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
    arrow: '<path d="M4 12h16M14 6l6 6-6 6"/>',
    "arrow-up": '<path d="M7 17 17 7M8 7h9v9"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/>',
    settings:
      '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.9 1.9-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V20h-2.68v-.09a1.7 1.7 0 0 0-1.1-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.9-1.9.06-.06A1.7 1.7 0 0 0 8.6 15a1.7 1.7 0 0 0-1.56-1.03H7v-2.68h.09A1.7 1.7 0 0 0 8.65 10.2a1.7 1.7 0 0 0-.34-1.88L8.25 8.25l1.9-1.9.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 13.12 5.2V5h2.68v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 1.9 1.9-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03H22v2.68h-.09A1.7 1.7 0 0 0 19.4 15Z"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    upload:
      '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    external:
      '<path d="M14 3h7v7M21 3l-9 9"/><path d="M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>',
    game: '<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 10v4M5 12h4M16 11h.01M18 13h.01"/>',
    bracket:
      '<path d="M4 5h4v4H4zM4 15h4v4H4zM16 10h4v4h-4z"/><path d="M8 7h4v10h4M8 17h4"/>',
    logout:
      '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    sword: '<path d="M5 4h4l10 10M5 4v4l10 10M19 15l-4 4M8 16l-4 4"/>',
    spark:
      '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"/>',
  };

  function icon(name, size) {
    const d = paths[name] || paths.info;
    return (
      '<svg class="od-icon" style="--od-icon-size:' +
      (size || 20) +
      'px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      d +
      "</svg>"
    );
  }

  const $ = (s, r = document) => r.querySelector(s),
    $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const initials = (n) =>
    String(n || "?")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0])
      .join("")
      .toUpperCase();
  const avatar = (name, size = "avatar-sm", photo) =>
    `<span class="avatar ${size}">${photo ? `<img src="${esc(photo)}" alt="${esc(name)}">` : esc(initials(name))}</span>`;
  const text = (s, v) => {
    $$(s).forEach((el) => (el.textContent = v ?? "—"));
  };
  const empty = (message = "No records yet.") =>
    `<div class="panel-body muted">${esc(message)}</div>`;
  const date = (t) =>
    t
      ? new Date(t).toLocaleString([], {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "Not scheduled";
  const count = (value, singular, plural = singular + "s") =>
    `${value} ${Number(value) === 1 ? singular : plural}`;
  const rating = (v) =>
    Number(v ?? 1000).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const elo = (state, value = state?.elo) =>
    Number(value ?? 1000).toLocaleString(undefined, {
      maximumFractionDigits: 0,
    }) + (state?.provisional === false ? "" : "?");
  const peak = (state) =>
    state?.provisional === false && state.peak != null
      ? elo({ elo: state.peak, provisional: false })
      : "—";
  function icons(root = document) {
    $$("[data-icon]", root).forEach((el) => {
      el.innerHTML = icon(el.dataset.icon, Number(el.dataset.size) || 20);
    });
  }
  function toast(message) {
    let n = $("#toast");
    if (!n) {
      n = document.createElement("div");
      n.id = "toast";
      n.className = "toast";
      n.setAttribute("role", "status");
      document.body.append(n);
    }
    n.textContent = message;
    n.classList.add("show");
    clearTimeout(n.timer);
    n.timer = setTimeout(() => n.classList.remove("show"), 5000);
  }
  function dialog(title, body) {
    const d = document.createElement("dialog");
    d.className = "dialog";
    d.setAttribute("aria-label", title);
    d.innerHTML = `<div class="dialog-head"><h2>${esc(title)}</h2><button class="dialog-close" type="button" aria-label="Close">${icon("close")}</button></div><div class="dialog-body">${body}</div>`;
    document.body.append(d);
    $(".dialog-close", d).onclick = () => d.close();
    d.addEventListener("close", () => d.remove(), { once: true });
    d.showModal();
    return d;
  }
  const button = (label, action, extra = "") =>
    `<button class="btn btn-outline btn-sm" type="button" data-action="${esc(action)}" ${extra}>${esc(label)}</button>`;
  function formDialog(title, fields, save) {
    const d = dialog(
      title,
      `<form class="settings-form">${fields}<p class="hint" role="alert"></p><div class="form-actions"><button class="btn btn-primary">Save</button></div></form>`,
    );
    $("form", d).onsubmit = async (e) => {
      e.preventDefault();
      const b = $("button[type=submit],.btn-primary", d);
      b.disabled = true;
      try {
        await save(new FormData(e.target), d);
        d.close();
      } catch (x) {
        $("[role=alert]", d).textContent = x.message;
      } finally {
        b.disabled = false;
      }
    };
    return d;
  }
  const field = (label, name, value = "", type = "text", extra = "") =>
    `<div class="field"><label for="field-${esc(name)}">${esc(label)}</label><input class="input" id="field-${esc(name)}" name="${esc(name)}" type="${type}" value="${esc(value)}" ${extra}></div>`;
  const select = (label, name, options, value) =>
    `<div class="field"><label for="field-${esc(name)}">${esc(label)}</label><select class="select" id="field-${esc(name)}" name="${esc(name)}">${options.map(([v, l]) => `<option value="${esc(v)}" ${String(value) === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div>`;
  const playerLink = (p) => {
    const profile = p.profile || p;
    const nationality = ["tennis", "tt", "pickleball"].includes(APP.game.kind)
      ? UI.nationalityFlags?.(profile) || ""
      : "";
    return `<a class="player-cell" href="player.html?player=${p.player_id || p.id}">${avatar(p.name, "avatar-sm", p.photo)}<span class="player-link-copy"><span class="name">${esc(p.name)}</span>${nationality}</span></a>`;
  };
  function pager(parent, result, load) {
    let nav = parent.querySelector(":scope > .live-pagination");
    if (!nav) {
      nav = document.createElement("div");
      nav.className = "form-actions live-pagination";
      parent.append(nav);
    }
    nav.innerHTML = `<span class="muted">${result.total ? result.offset + 1 : 0}–${Math.min(result.offset + result.limit, result.total)} of ${result.total}</span>${button("Previous", "previous", result.offset === 0 ? "disabled" : "")}${button("Next", "next", result.offset + result.limit >= result.total ? "disabled" : "")}`;
    $$("button", nav).forEach(
      (b) =>
        (b.onclick = () =>
          load(
            b.dataset.action === "next"
              ? result.offset + result.limit
              : Math.max(0, result.offset - result.limit),
          )),
    );
  }
  function tabs(root = document) {
    $$("[role=tablist]", root).forEach((list) => {
      const items = $$("[role=tab]", list);
      const activate = (t) => {
        items.forEach((x) => {
          const yes = x === t;
          x.setAttribute("aria-selected", yes);
          x.tabIndex = yes ? 0 : -1;
          const panel = document.getElementById(
            x.getAttribute("aria-controls"),
          );
          if (panel) panel.hidden = !yes;
        });
      };
      items.forEach((t) => {
        t.onclick = () => activate(t);
        t.onkeydown = (e) => {
          const available = items.filter((item) => !item.hidden);
          const i = available.indexOf(t);
          let j = i;
          if (["ArrowRight", "ArrowDown"].includes(e.key))
            j = (i + 1) % available.length;
          else if (["ArrowLeft", "ArrowUp"].includes(e.key))
            j = (i + available.length - 1) % available.length;
          else if (e.key === "Home") j = 0;
          else if (e.key === "End") j = available.length - 1;
          else return;
          e.preventDefault();
          available[j].focus();
          activate(available[j]);
        };
      });
    });
  }
  async function picker(selectEl, options = {}) {
    // Keep the form value and its existing change handlers; only the combobox is visible.
    const cache = options.teams ? APP.teams : APP.players;
    const endpoint = options.teams ? "teams/" + APP.slug : "players";
    const initial = String(options.value || selectEl.value || "");
    const root = document.createElement("div");
    root.className = "player-picker";
    selectEl.before(root);
    root.append(selectEl);
    selectEl.hidden = true;
    selectEl.tabIndex = -1;
    const required = selectEl.required;
    selectEl.required = false;
    const search = document.createElement("input");
    search.type = "search";
    search.className = "input";
    search.id = selectEl.id + "-search";
    search.placeholder = options.teams ? "Search teams…" : "Search players…";
    search.autocomplete = "off";
    search.required = required;
    search.setAttribute("role", "combobox");
    search.setAttribute("aria-autocomplete", "list");
    search.setAttribute("aria-expanded", "false");
    const label = [...document.querySelectorAll("label")].find(
      (el) => el.htmlFor === selectEl.id,
    );
    if (label) label.htmlFor = search.id;
    else
      search.setAttribute(
        "aria-label",
        selectEl.getAttribute("aria-label") || search.placeholder,
      );
    const list = document.createElement("div");
    list.className = "player-picker-results";
    list.id = search.id + "-results";
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", options.teams ? "Teams" : "Players");
    list.hidden = true;
    search.setAttribute("aria-controls", list.id);
    const status = document.createElement("span");
    status.className = "sr-only";
    status.setAttribute("role", "status");
    root.append(search, list, status);
    let rows = [],
      active = -1,
      version = 0,
      timer;
    function close() {
      clearTimeout(timer);
      version++;
      list.hidden = true;
      search.setAttribute("aria-expanded", "false");
      search.removeAttribute("aria-activedescendant");
    }
    function setValue(player, notify = false) {
      close();
      selectEl.innerHTML = '<option value="">Choose…</option>';
      if (player) {
        cache.set(player.id, player);
        selectEl.add(new Option(player.name, String(player.id)));
      }
      selectEl.value = player ? String(player.id) : "";
      search.value = player?.name || "";
      search.setCustomValidity("");
      if (notify)
        selectEl.dispatchEvent(new Event("change", { bubbles: true }));
    }
    function highlight(index) {
      active = index;
      [...list.querySelectorAll('[role="option"]')].forEach((el, i) => {
        el.setAttribute("aria-selected", String(i === active));
        if (i === active) {
          search.setAttribute("aria-activedescendant", el.id);
          el.scrollIntoView({ block: "nearest" });
        }
      });
    }
    async function load(query = search.value) {
      const request = ++version;
      active = -1;
      rows = [];
      search.removeAttribute("aria-activedescendant");
      list.hidden = false;
      search.setAttribute("aria-expanded", "true");
      list.innerHTML = '<div class="picker-message">Searching…</div>';
      try {
        const result = await APP.api(
          endpoint + "?limit=50&q=" + encodeURIComponent(query),
        );
        if (request !== version || !root.isConnected) return;
        rows = result.rows;
        rows.forEach((p) => cache.set(p.id, p));
        list.innerHTML = rows.length
          ? rows
              .map(
                (p, i) =>
                  `<div class="player-picker-option" role="option" aria-selected="false" id="${esc(list.id)}-${i}" data-index="${i}"><span>${esc(p.name)}</span>${p.handle ? `<small>@${esc(p.handle)}</small>` : ""}</div>`,
              )
              .join("")
          : '<div class="picker-message">No matches found. Try another name.</div>';
        status.textContent = rows.length
          ? `${count(rows.length, "result")}. Use arrow keys to choose.`
          : "No matches found.";
      } catch (e) {
        if (request !== version) return;
        list.innerHTML = `<div class="picker-message">${esc(e.message)}. Type to retry.</div>`;
        status.textContent = e.message;
      }
    }
    search.addEventListener("focus", () => {
      search.select();
      load(selectEl.value ? "" : search.value);
    });
    search.addEventListener("input", () => {
      close();
      rows = [];
      active = -1;
      selectEl.value = "";
      search.setCustomValidity(
        search.value ? "Choose a player from the search results." : "",
      );
      selectEl.dispatchEvent(new Event("change", { bubbles: true }));
      timer = setTimeout(() => load(), 180);
    });
    search.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
      if (["ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        if (list.hidden) load(selectEl.value ? "" : search.value);
        else if (rows.length)
          highlight(
            (active +
              (e.key === "ArrowDown" ? 1 : active < 0 ? 0 : -1) +
              rows.length) %
              rows.length,
          );
      }
      if (e.key === "Enter" && !list.hidden) {
        e.preventDefault();
        if (active >= 0 && rows[active]) setValue(rows[active], true);
      }
    });
    list.addEventListener("pointerdown", (e) => e.preventDefault());
    list.addEventListener("click", (e) => {
      const option = e.target.closest("[data-index]");
      if (option) setValue(rows[Number(option.dataset.index)], true);
    });
    root.addEventListener("focusout", (e) => {
      if (!root.contains(e.relatedTarget)) close();
    });
    const syncDisabled = () => {
      search.disabled = selectEl.disabled;
      if (search.disabled) close();
    };
    new MutationObserver(syncDisabled).observe(selectEl, {
      attributes: true,
      attributeFilter: ["disabled"],
    });
    syncDisabled();
    let player = initial ? cache.get(Number(initial)) : null;
    if (initial && !player) player = await APP.api(endpoint + "/" + initial);
    setValue(player);
    [...selectEl.options].forEach((option) => {
      option.defaultSelected = option.selected;
    });
    selectEl.form?.addEventListener("reset", () =>
      requestAnimationFrame(() => setValue(player, true)),
    );
    return load;
  }
  function setupSiteContext() {
    if (/\/(account|player)\.html$/.test(location.pathname)) {
      document.body.removeAttribute("data-game");
      document.body.removeAttribute("data-game-variant");
      document.body.classList.add("site-page");
      const header = $(".header-inner");
      const nav = document.createElement("nav");
      nav.className = "main-nav";
      nav.setAttribute("aria-label", "Primary");
      nav.innerHTML =
        '<a class="nav-link" href="index.html">Home</a><a class="nav-link" href="players.html">Players</a>';
      $(".brand", header).after(nav);
      const back = $('.header-actions a[href*="game.html"]');
      if (back) {
        back.href = "index.html";
        back.innerHTML = `${icon("arrow", 18)} Home`;
      }
    }
  }
  function setupGameIdentity() {
    const main = $("main#main");
    if (!main || !document.body.hasAttribute("data-game")) return;
    const g = APP.game;
    const banner = document.createElement("a");
    banner.className = "game-identity";
    banner.dataset.kind = g.kind;
    banner.dataset.size = "compact";
    banner.href = APP.url("game");
    banner.setAttribute("aria-label", g.name + " overview");
    banner.innerHTML = `<img src="assets/brand/${esc(g.logo)}" alt="${esc(g.name)}"><span class="game-identity-name" aria-hidden="true">${esc(g.name)}</span>`;
    main.prepend(banner);
    UI.gameIdentity = (view) => {
      banner.dataset.size = view === "overview" ? "large" : "compact";
    };
    if ($(".app-body")) UI.gameIdentity(APP.params.get("view") || "overview");
  }
  function setupNavigation() {
    let sidebar = $(".sidebar"),
      shell = $(".app-body");
    const main = $("main#main");
    if (!main || !document.body.hasAttribute("data-game")) return;
    const gamePage = !!shell;
    if (!shell) {
      shell = document.createElement("div");
      shell.className = "app-body";
      main.before(shell);
      sidebar = document.createElement("aside");
      sidebar.className = "sidebar";
      sidebar.setAttribute("aria-label", "Game navigation");
      const groups = [
        [
          "The game",
          [
            ["overview", "Overview", "home"],
            ["matches", "Matches", "calendar"],
            ["rankings", "Rankings", "chart"],
          ],
        ],
        [
          "Play",
          [
            ["competitions", "Competitions", "trophy"],
            ["record", "Record a result", "plus"],
          ],
        ],
        [
          "Group",
          [
            ["players", "Players", "users"],
            ...(APP.admin()
              ? [
                  ["review", "Admin review", "shield"],
                  ["settings", "Game administration", "settings"],
                ]
              : []),
          ],
        ],
      ];
      sidebar.innerHTML = groups
        .map(
          ([title, links]) =>
            `<div class="side-group"><div class="side-label">${title}</div><nav class="side-nav">${links.map(([view, label, glyph]) => `<a class="side-link" href="${view === "players" ? "players.html" : view === "settings" ? APP.url("admin") : APP.url("game", { view })}">${icon(glyph, 19)} ${label}</a>`).join("")}</nav></div>`,
        )
        .join("");
      shell.append(sidebar, main);
      main.classList.add("app-main");
    }
    shell.classList.add("adaptive-navigation");
    sidebar.id = "game-navigation";
    const menu = document.createElement("button");
    menu.type = "button";
    menu.className = "icon-btn navigation-menu";
    menu.setAttribute("aria-label", "Game navigation");
    menu.setAttribute("aria-controls", sidebar.id);
    menu.innerHTML = icon("menu", 20);
    $(".header-actions").prepend(menu);
    // An edge target supports hover and keyboard access without taking page space.
    const edge = document.createElement("button");
    edge.type = "button";
    edge.className = "navigation-edge";
    edge.setAttribute("aria-label", "Game navigation");
    edge.setAttribute("aria-controls", sidebar.id);
    shell.prepend(edge);
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "btn btn-ghost btn-sm navigation-dismiss";
    dismiss.innerHTML = icon("close") + "Close navigation";
    sidebar.prepend(dismiss);
    const backdrop = document.createElement("div");
    backdrop.className = "navigation-backdrop";
    backdrop.setAttribute("aria-hidden", "true");
    shell.append(backdrop);
    const mobile = matchMedia("(max-width: 1024px), (hover: none)");
    let context,
      open = false,
      restoringFocus = false,
      suppressHover = false,
      closeTimer;
    const pinned = () => !mobile.matches && gamePage && context === "overview";
    function render(value, focus = false) {
      clearTimeout(closeTimer);
      open = pinned() || value;
      const restoreFocus = !open && sidebar.contains(document.activeElement);
      shell.dataset.navMode = pinned() ? "pinned" : "drawer";
      shell.dataset.navOpen = String(open);
      sidebar.inert = !open;
      sidebar.setAttribute("aria-hidden", String(!open));
      for (const opener of [menu, edge])
        opener.setAttribute("aria-expanded", String(open));
      const modal = open && mobile.matches;
      main.inert = modal;
      $(".site-header")?.toggleAttribute("inert", modal);
      document.body.classList.toggle("navigation-modal", modal);
      sidebar.toggleAttribute("aria-modal", modal);
      if (modal) {
        sidebar.setAttribute("role", "dialog");
        sidebar.setAttribute("aria-modal", "true");
      } else sidebar.removeAttribute("role");
      if (focus && open && !pinned()) dismiss.focus();
      if (!open && (focus || restoreFocus)) {
        restoringFocus = true;
        if (!mobile.matches && !focus) {
          main.tabIndex = -1;
          main.focus({ preventScroll: true });
        } else {
          suppressHover = true;
          (mobile.matches ? menu : edge).focus({ preventScroll: true });
        }
        restoringFocus = false;
      }
    }
    function closeSoon() {
      clearTimeout(closeTimer);
      closeTimer = setTimeout(() => {
        if (
          !mobile.matches &&
          !pinned() &&
          !sidebar.matches(":hover") &&
          !edge.matches(":hover") &&
          !sidebar.contains(document.activeElement) &&
          document.activeElement !== edge
        )
          render(false);
      }, 180);
    }
    UI.navigation = (view) => {
      if (context === view) return;
      context = view;
      render(false);
    };
    mobile.addEventListener("change", () => render(false));
    menu.onclick = () => render(!open, true);
    edge.onclick = () => render(true, true);
    const openOnHover = () => {
      if (
        !open &&
        !mobile.matches &&
        !pinned() &&
        !suppressHover &&
        !$("dialog[open]")
      ) {
        if (document.activeElement === edge) edge.blur();
        render(true);
      }
    };
    edge.onpointerenter = edge.onpointermove = openOnHover;
    edge.onfocus = () => {
      if (!pinned() && !restoringFocus) render(true);
    };
    edge.onpointerleave = () => {
      suppressHover = false;
      closeSoon();
    };
    edge.onblur = closeSoon;
    sidebar.onpointerenter = () => clearTimeout(closeTimer);
    sidebar.onpointerleave = closeSoon;
    sidebar.addEventListener("focusout", closeSoon);
    dismiss.onclick = backdrop.onclick = () => render(false, true);
    sidebar.addEventListener("click", (event) => {
      if (event.target.closest("a") && !pinned()) render(false);
    });
    document.addEventListener("keydown", (event) => {
      if (!open || pinned()) return;
      if (event.key === "Escape" && !$("dialog[open]")) {
        event.preventDefault();
        render(false, true);
      }
      if (event.key === "Tab" && mobile.matches) {
        const items = [...sidebar.querySelectorAll("a,button")].filter(
          (el) => el.getClientRects().length && !el.disabled,
        );
        const first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
    const header = $(".site-header");
    const headerObserver = new ResizeObserver(() =>
      shell.style.setProperty(
        "--nav-top",
        header.getBoundingClientRect().height + "px",
      ),
    );
    headerObserver.observe(header);
    UI.navigation(gamePage ? APP.params.get("view") || "overview" : "detail");
  }
  function catalogVisual(item, stage = false) {
    const cls = stage ? "catalog-stage-photo" : "catalog-stock-icon";
    return item?.image
      ? `<img class="${cls}" src="${esc(item.image)}" alt="" loading="lazy">`
      : `<span class="${cls} catalog-image-fallback" aria-hidden="true">${esc(item?.code || (stage ? "Stage" : "—"))}</span>`;
  }
  function fighterIcons(m, index, side) {
    const fighters = m.smash_games?.[index]?.fighters || [];
    return fighters
      .map((fighter, i) => {
        const player = m.participants.find((p) => p.id === fighter.player_id);
        const fighterSide = player?.side ?? (i < fighters.length / 2 ? 0 : 1);
        return fighterSide === side
          ? `<span class="match-fighter-icon" role="img" aria-label="${esc((player?.name || "Player " + (i + 1)) + ": " + fighter.name)}" title="${esc((player?.name || "Player " + (i + 1)) + ": " + fighter.name)}">${catalogVisual(fighter)}</span>`
          : "";
      })
      .join("");
  }
  function smashDetails(m) {
    return m.smash_games?.length
      ? '<div class="smash-game-details">' +
          m.smash_games
            .map(
              (g, i) =>
                `<section class="smash-game-detail"><h3>Game ${i + 1}</h3><figure>${catalogVisual(g.stage, true)}<figcaption>${esc(g.stage.name)}</figcaption></figure><div class="match-fighter-list">${g.fighters.map((f, j) => `<span class="match-fighter-label">${catalogVisual(f)}<span>${esc(m.participants.find((p) => p.id === f.player_id)?.name || "Player " + (j + 1))}: ${esc(f.name)}</span></span>`).join("")}</div></section>`,
            )
            .join("") +
          "</div>"
      : "";
  }
  function score(m) {
    const side = (n) =>
      m.participants
        .filter((p) => p.side === n)
        .map((p) => esc(p.name))
        .join(" + ");
    const s = m.score;
    if (m.forfeit && !s.games)
      return `<div class="match-summary"><span>${side(0)}</span><b>Forfeit</b><span>${side(1)}</span></div>`;
    if (s.games) {
      const kind = m.rules?.kind || APP.game.kind,
        cols = s.games.length,
        totalLabel = kind === "tennis" ? "Sets" : "Games";
      const identities = (side) =>
        m.participants
          .filter((player) => player.side === side)
          .map(
            (player) =>
              `<span class="score-player-identity"><span>${esc(player.name)}</span>${["tennis", "tt", "pickleball"].includes(kind) ? UI.nationalityFlags?.(player) || "" : ""}</span>`,
          )
          .join('<span class="score-pair-separator"> + </span>');
      const rows = [0, 1]
        .map(
          (n) =>
            `<div class="tennis-score-row ${m.winner === n ? "match-winner" : ""}"><span class="tennis-score-player"><span title="${side(n)}">${identities(n)}</span></span>${s.games.map((g, i) => `<span class="tennis-score-cell ${g.winner === n ? "set-winner" : ""}">${kind === "smash" ? '<span class="match-stock-icons">' + fighterIcons(m, i, n) + "</span>" : ""}${n === 0 ? g.a : g.b}${g.tb ? "<sup>" + g.tb[n] + "</sup>" : ""}${kind === "smash" && g.winner === n && g.jv ? `<sup class="jv">JV${1 + Math.abs(g.a - g.b)}</sup>` : ""}${g.suddenDeath ? "<sup>SD</sup>" : ""}</span>`).join("")}<span class="tennis-score-total">${n === 0 ? m.a_score : m.b_score}</span></div>`,
        )
        .join("");
      return `<div class="${kind === "smash" ? "smash-scoreboard" : "tennis-scoreboard"} ${kind === "tt" ? "tt-scoreboard" : ""}" style="--tennis-set-count:${cols};--tennis-score-columns:minmax(112px,1.8fr) repeat(${cols},minmax(24px,.4fr)) 30px" aria-label="${esc(kind)} scorecard"><div class="tennis-score-row tennis-score-head"><span>Player</span>${s.games.map((_, i) => '<span class="tennis-score-cell">' + (i + 1) + "</span>").join("")}<span class="tennis-score-total-head">${totalLabel}</span></div>${rows}</div>`;
    }
    const team = (n) => clubMark(m.teams?.[n]);
    const detail = [
      ...(s.legScores || []).map((leg, i) => `Leg ${i + 1}: ${leg.a}–${leg.b}`),
      s.pens ? "Penalties" : s.aet ? "a.e.t." : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const score = s.pens
      ? `<span class="score fc-shootout" aria-label="${s.legScores ? "Aggregate" : "Match"} score ${m.a_score} to ${m.b_score}. Penalties ${s.pens[0]} to ${s.pens[1]}">${m.a_score} <small>(${s.pens[0]})</small>–${m.b_score} <small>(${s.pens[1]})</small></span>`
      : `<span class="score">${m.a_score} - ${m.b_score}</span>`;
    return `<div class="match-summary fc-scoreline"><span class="fc-player">${side(0)}</span>${team(0)}${score}${team(1)}<span class="fc-player">${side(1)}</span></div>${detail ? `<div class="muted match-score-detail">${esc(detail)}</div>` : ""}`;
  }
  function clubMark(team) {
    return team
      ? `<span class="match-team-label" title="${esc(team.name)}" aria-label="${esc(team.name)}">${catalogVisual(team)}</span>`
      : '<span class="match-team-label" aria-label="No club selected">—</span>';
  }

  function matchTable(table) {
    table.classList.add("match-table");
    const labels = [...table.querySelectorAll("thead th")].map(
      (th) => th.textContent,
    );
    table.querySelectorAll("tbody tr").forEach((row) => {
      if (row.children.length !== labels.length) return;
      row.classList.add("match-record");
      [...row.children].forEach((cell, i) => {
        cell.dataset.label = labels[i];
        if (i === 0) cell.classList.add("match-date");
        else if (i === 1) cell.classList.add("match-result");
        else if (labels[i] === "Action" || !labels[i])
          cell.classList.add("match-open");
        else cell.classList.add("match-meta");
      });
    });
  }
  function resultCard(match) {
    const names = [0, 1]
      .map((side) =>
        match.participants
          .filter((p) => p.side === side)
          .map((p) => p.name)
          .join(" + "),
      )
      .join(" vs ");
    return `<a class="match-result-trigger" data-match="${match.id}" href="${esc(APP.url("game", { game: match.game, view: "matches", match: match.id }))}" aria-label="${esc("View match: " + names)}">${score(match)}</a>`;
  }
  function status(m) {
    return m.forfeit
      ? "Forfeit · no Elo"
      : m.status === "submitted"
        ? "Awaiting result acceptance"
        : !m.elo_enabled
          ? "Accepted · Elo off"
          : m.elo_checked
            ? "Accepted · Elo checked"
            : "Accepted · Elo awaiting admin";
  }
  async function matchDialog(id) {
    const m = await APP.api("matches/" + id);
    const { renderMatchOverview } = await import("./match-overview.js");
    const d = dialog(
      "Match result",
      renderMatchOverview(m, { score, status, smashDetails, button }),
    );
    d.classList.add("match-overview-dialog");
    $(".dialog-head h2", d).id = "match-overview-title-" + m.id;
    d.setAttribute("aria-labelledby", "match-overview-title-" + m.id);
    $$("[data-action]", d).forEach(
      (b) =>
        (b.onclick = async () => {
          try {
            b.disabled = true;
            const action = b.dataset.action;
            if (action === "edit") {
              d.close();
              location.href = APP.url("game", { view: "record", edit: m.id });
              return;
            }
            if (
              action === "void" &&
              !confirm(
                "Void this result? Its eligible Elo changes will be recalculated.",
              )
            )
              return;
            if (
              action === "forfeit" &&
              !confirm(
                "Replace this score with a forfeit? The recorded winner and later bracket results will stay. Any Elo from this result will be removed.",
              )
            )
              return;
            await APP.api(
              "matches/" + id + (action === "void" ? "" : "/" + action),
              {
                revision: m.revision,
                ...(action === "elo-enabled"
                  ? { enabled: !m.elo_enabled }
                  : {}),
              },
              action === "void"
                ? "DELETE"
                : action === "elo-enabled"
                  ? "PATCH"
                  : "POST",
            );
            d.close();
            toast("Saved.");
            window.dispatchEvent(new Event("records-changed"));
          } catch (e) {
            $("[role=alert]", d).textContent = e.message;
          } finally {
            b.disabled = false;
          }
        }),
    );
  }
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest?.(
      "button[data-seat-history], button[data-standing-note]",
    );
    if (!trigger) return;
    const content = trigger.nextElementSibling.content.cloneNode(true);
    const d = dialog(
      trigger.dataset.standingNote || "Seat history",
      "",
    );
    d.querySelector(".dialog-body").append(content);
    d.addEventListener("close", () => trigger.focus(), { once: true });
  });
  function seatHistory(row) {
    if (!row.seatHistory?.length) return "";
    const names = row.players.map((p) => p.name).join(" + ");
    const notes = [];
    const items = row.seatHistory
      .map((h) => {
        const transfer = h.type === "transfer";
        const label = transfer ? "Permanent transfer" : "One-match substitute";
        const detail = transfer
          ? h.incoming + " took over from " + h.outgoing
          : h.incoming + " for " + h.outgoing + " · " + h.label;
        const when = transfer
          ? "Effective"
          : h.played_at
            ? "Played"
            : h.scheduled
              ? "Scheduled"
              : "Assigned";
        const date = new Date(h.time).toLocaleString();
        notes.push(`${detail}. ${when} ${date}.`);
        return `<li><strong>${label}</strong><div>${esc(detail)}</div><small>${when} ${esc(date)}</small></li>`;
      })
      .join("");
    return `<button type="button" class="seat-history-trigger" data-seat-history title="${esc(notes.join(" "))}" aria-haspopup="dialog" aria-label="Seat history for ${esc(names)}">*</button><template><p>Current seat holder · <strong>${esc(names)}</strong></p><ul class="seat-history-list">${items}</ul></template>`;
  }
  const standingsLabels = {
    "division-winner": "Division winner",
    "group-winner": "Group winner",
    qualified: "Qualified",
    champion: "Champion",
    eliminated: "Eliminated",
    withdrawn: "Withdrawn",
  };
  function standingsLegend(statuses) {
    const shown = new Set(statuses);
    const items = Object.entries(standingsLabels)
      .filter(([status]) => shown.has(status))
      .map(([status, label]) => `<li data-standing="${status}">${label}</li>`)
      .join("");
    return items ? `<ul class="standings-legend" aria-label="Standings legend">${items}</ul>` : "";
  }
  function standingsTable(c, rows, highlight = [], { legend = true } = {}) {
    const kind = APP.games.find((g) => g.slug === c.game)?.kind;
    const withdrawn = new Map(
      (c.entries || [])
        .filter((entry) => entry.withdrawn)
        .map((entry) => [entry.id, entry.withdrawnAt]),
    );
    const regularSeasonQualifiers = new Set(c.regularSeasonQualifiers || []);
    const changes = c.qualificationChanges;
    const replaced = new Set(changes?.outgoing);
    const replacements = new Set(changes?.incoming);
    const replacementNames = (c.entries || [])
      .filter((entry) => replacements.has(entry.id))
      .map((entry) => entry.players.map((p) => p.name).join(" + "));
    const round = c.kind === "league" ? "playoffs" : "knockout stage";
    const standingNote = (row) => {
      const wasReplaced = replaced.has(row.entry);
      const isWithdrawn = withdrawn.has(row.entry);
      if (!wasReplaced && !isWithdrawn) return "";
      const names = row.players.map((p) => p.name).join(" + ");
      const title = isWithdrawn ? "Withdrawal note" : "Qualification note";
      const details = [];
      if (isWithdrawn) {
        const time = withdrawn.get(row.entry);
        details.push(
          time
            ? `${names}’s withdrawal was recorded on ${new Date(time).toLocaleDateString(undefined, { dateStyle: "long" })}.`
            : `No withdrawal date was recorded for ${names}.`,
        );
      }
      if (wasReplaced) {
        details.push(
          replaced.size === 1 && replacementNames.length === 1
            ? `${replacementNames[0]} took ${names}’s spot in the ${round}.`
            : `${names} qualified through the standings. The final ${round} lineup added ${replacementNames.join(", ")}.`,
        );
      }
      return `<button type="button" class="standing-note-trigger" data-standing-note="${title}" title="${esc(details.join(" "))}" aria-haspopup="dialog" aria-label="${title} for ${esc(names)}">*</button><template>${details.map((detail) => `<p>${esc(detail)}</p>`).join("")}</template>`;
    };
    const progress = (row) => {
      const state = c.projection?.rows.find((item) => item.entry === row.entry);
      if (c.kind === "league") {
        const status = withdrawn.has(row.entry)
          ? "withdrawn"
          : c.settings.playoffs
            ? regularSeasonQualifiers.has(row.entry) ||
              (c.regularSeasonQualifiers == null &&
                !c.settings.conferenceLayout?.playoffSeeds &&
                state?.status === "qualified")
              ? "qualified"
              : "contending"
            : state?.status === "champion"
              ? "champion"
              : "contending";
        return { status, group_winner: false };
      }
      if (replaced.has(row.entry)) return { ...state, status: "qualified" };
      if (state?.status === "qualified" && replacements.has(row.entry))
        return { ...state, status: "contending" };
      return state;
    };
    const rowStanding = (row, state) => {
      if (withdrawn.has(row.entry)) return "withdrawn";
      if (state?.status === "champion") return "champion";
      if (row.divisionWinner) return "division-winner";
      if (state?.group_winner && state.status !== "eliminated") return "group-winner";
      return standingsLabels[state?.status] ? state.status : "";
    };
    const { statCatalog, defaultColumns, statText } = UI.standingsStats;
    const catalog = statCatalog(kind);
    const columns = (c.settings?.tableColumns || defaultColumns(kind)).filter(
      (key) => catalog[key],
    );
    const headings = columns
      .map((key) => {
        const [label, title] = catalog[key];
        return `<th scope="col" data-stat="${key}" title="${title}" aria-label="${title}">${label}</th>`;
      })
      .join("");
    const statuses = new Set();
    const body = rows
      .map((row) => {
        const state = progress(row);
        const standing = rowStanding(row, state);
        if (standing) statuses.add(standing);
        const progressAttrs = state
          ? ` data-progress="${state.status}" data-group-winner="${Boolean(state.group_winner && state.status !== "eliminated")}"`
          : "";
        const cells = columns
          .map((key) => `<td data-stat="${key}">${statText(row, key)}</td>`)
          .join("");
        return `<tr${progressAttrs}${standing ? ` data-standing="${standing}"` : ""}${row.players.some((p) => highlight.includes(p.id)) ? ' class="match-standings-highlight"' : ""}><td class="standings-rank">${row.position}</td><td class="standings-player">${row.pool ? `<span class="chip">Group ${esc(row.pool)}</span> ` : ""}<span class="seat-identity">${row.players.map((p) => (p.id || p.player_id ? playerLink(p) : esc(p.name))).join(" + ")}${standingNote(row)}${seatHistory(row)}</span>${standing ? `<span class="sr-only">${standingsLabels[standing]}</span>` : ""}</td>${cells}</tr>`;
      })
      .join("");
    return `${legend ? standingsLegend(statuses) : ""}<div class="table-wrap competition-standings-table stat-table"><table><thead><tr><th scope="col" class="standings-rank">#</th><th scope="col" class="standings-player">${c.format === "doubles" ? "Pair" : "Player"}</th>${headings}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  window.UI = {
    $,
    $$,
    esc,
    icon,
    icons,
    initials,
    avatar,
    text,
    empty,
    date,
    rating,
    elo,
    peak,
    count,
    toast,
    dialog,
    button,
    formDialog,
    field,
    select,
    playerLink,
    catalogVisual,
    clubMark,
    pager,
    tabs,
    picker,
    score,
    resultCard,
    status,
    matchDialog,
    matchTable,
    standingsTable,
    standingsLegend,
  };
  APP.shell = Promise.all([APP.ready, APP.dom]).then(async () => {
    UI.standingsStats = await import("./standings-stats.js");
    // All runtime deviations correspond to explicit requirements; original HTML/CSS remain unchanged.
    const appearance = document.createElement("link");
    appearance.rel = "stylesheet";
    appearance.href =
      "css/appearance.css?v=competition-overview-and-bracket-fit";
    await new Promise((resolve, reject) => {
      appearance.onload = resolve;
      appearance.onerror = () =>
        reject(new Error("Could not load the site appearance. Please reload."));
      document.head.append(appearance);
    });
    const flairs = await import("./profile-flairs.js");
    await flairs.countryList();
    UI.nationalityFlags = flairs.nationalityFlags;
    const styles = document.createElement("style");
    styles.textContent =
      ".live-pagination{padding:16px;flex-wrap:wrap}.live-pagination .muted{margin-right:auto}.live-game-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:16px 0;border-bottom:1px solid var(--line)}.live-game-row h4,.live-game-row .wide{grid-column:1/-1}.live-score-grid{display:grid;gap:16px}.dialog{max-width:min(720px,calc(100vw - 24px))}.dialog .form-actions{flex-wrap:wrap}.input,.select{min-width:0;max-width:100%}.player-cell .name{overflow-wrap:anywhere}.avatar img{width:100%;height:100%;object-fit:cover;border-radius:inherit}.bracket-match{min-width:200px}.live-pagination button:disabled{opacity:.4}.table-wrap{max-width:100%;overflow:auto}.settings-layout>*,.settings-card,.sidebar,.view>*{min-width:0}.view{grid-template-columns:minmax(0,1fr)}";
    styles.textContent += `
      .player-picker { position: relative; min-width: 0; }
      .player-picker-results { position: absolute; z-index: 40; top: calc(100% + 5px); left: 0; right: 0; max-height: 240px; overflow-y: auto; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface); box-shadow: var(--shadow-md); }
      .player-picker-option { padding: 12px; cursor: pointer; display: flex; flex-wrap: wrap; gap: 6px 12px; justify-content: space-between; overflow-wrap: anywhere; }
      .player-picker-option small, .picker-message { color: var(--muted); }
      .picker-message { padding: 12px; font-size: .85rem; }
      .player-picker-option:hover, .player-picker-option[aria-selected="true"] { background: var(--accent-soft); }
      .fc-scoreline { display: inline-grid; grid-template-columns: minmax(0,1fr) auto auto auto minmax(0,1fr); align-items: center; gap: 8px; max-width: 100%; }
      .fc-scoreline .fc-player { overflow-wrap: anywhere; min-width: 0; line-height: 1.5; }
      .fc-scoreline .fc-player:first-child { text-align: right; }
      .fc-scoreline .score { white-space: nowrap; }
      .fc-scoreline .catalog-stock-icon { width: 30px; height: 30px; }
      .fc-scoreline .catalog-image-fallback { background: transparent; width: auto; min-width: 28px; }
      .match-score-detail { margin-top: 5px; font-size: .76rem; }
      #record-fc-score { display: block; margin-top: 18px; }
      #record-fc-score .fc-scoreline { display: grid; }
      .match-table .match-result { min-width: 280px; }
      .match-table .fc-scoreline { width: 100%; }
      @media (max-width: 640px) {
        .match-table { display: block; min-width: 0; }
        .match-table thead { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); }
        .match-table tbody { display: block; }
        .match-table .match-record { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px 16px; padding: 18px 14px; border-bottom: 1px solid var(--line); }
        .match-table .match-record:last-child { border-bottom: 0; }
        .match-table .match-record td { display: block; padding: 0; border: 0; min-width: 0; overflow-wrap: anywhere; }
        .match-table .match-result { grid-column: 1 / -1; order: -2; padding-bottom: 12px !important; border-bottom: 1px solid var(--line) !important; }
        .match-table .match-date { grid-column: 1 / -1; order: -1; color: var(--muted); font-size: .76rem; }
        .match-table .match-meta { font-size: .8rem; }
        .match-table .match-meta::before { content: attr(data-label); display: block; color: var(--muted); font-family: var(--font-condensed); font-size: .62rem; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 3px; }
        .match-table .match-open { grid-column: 1 / -1; text-align: right; }
        .fc-scoreline { column-gap: 5px; }
        .fc-scoreline .catalog-stock-icon { width: 24px; height: 24px; }
        .fc-scoreline .catalog-image-fallback { min-width: 24px; }
      }
      .catalog-stock-icon { display: inline-block; width: 40px; height: 40px; flex: none; object-fit: contain; vertical-align: middle; }
      .catalog-stage-photo { display: block; width: 100%; max-width: 320px; aspect-ratio: 16 / 9; object-fit: contain; border-radius: var(--radius-sm); background: var(--surface-2); }
      img.catalog-stock-icon, img.catalog-stage-photo, img.directory-avatar { background: transparent; }
      .avatar:has(> img), .player-id .avatar:has(> img) { background: transparent; }
      .catalog-image-fallback { display: inline-grid; place-items: center; background: var(--surface-3); color: var(--muted); font-size: .7rem; }
      .catalog-image-row { display: flex; align-items: center; gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--line); }
      .catalog-image-row > .catalog-stage-photo { width: 120px; flex: none; }
      .catalog-image-copy { min-width: 0; overflow-wrap: anywhere; }
      .catalog-image-copy p { font-size: .78rem; color: var(--muted); }
      .catalog-image-copy .form-actions { flex-wrap: wrap; margin-top: 8px; }
      .match-team-label, .match-fighter-label { display: flex; align-items: center; gap: 8px; font-size: .78rem; }
      .match-stock-icons { display: flex; justify-content: center; flex-wrap: wrap; }
      .match-stock-icons .catalog-stock-icon { width: 24px; height: 24px; font-size: .55rem; }
      .match-fighter-list { display: grid; gap: 8px; margin-top: 12px; }
      .smash-game-details { display: grid; gap: 0; margin-top: 16px; }
      .smash-game-detail { padding: 16px 0; border-top: 1px solid var(--line); }
      .smash-game-detail figure { margin: 12px 0; }
      .smash-game-detail figcaption { margin-top: 6px; font-size: .8rem; }
      .player-id { gap: 20px; }
      #player-avatar { display: flex; flex: none; }
      .player-id > div { min-width: 0; overflow-wrap: anywhere; }
      .player-id .avatar { width: 112px; height: 112px; font-size: 2rem; }
      #overview-table .player-cell .avatar,
      [data-view-panel="rankings"] .player-cell .avatar {
        width: 48px; height: 48px; font-size: 1rem;
      }
      @media (max-width: 480px) {
        .player-id { gap: 16px; flex-wrap: wrap; }
        .player-id .avatar { width: 88px; height: 88px; font-size: 1.6rem; }
      }
    `;
    document.head.append(styles);
    setupSiteContext();
    const g = APP.game;
    if (document.body.hasAttribute("data-game")) {
      document.body.dataset.game = {
        fc: "eafc",
        tennis: "tennis",
        tt: "table-tennis",
        smash: "smash",
        pickleball: "pickleball",
      }[g.kind];
      if (g.slug === "eafc26") document.body.dataset.gameVariant = "eafc26";
    }
    text("[data-game-label]", g.name);
    const switcherMenu = $(".switcher-menu");
    const pickleball = APP.games.find((game) => game.slug === "pickleball");
    if (switcherMenu && pickleball) {
      const link = document.createElement("a");
      link.href = "game.html?game=pickleball";
      link.innerHTML = `<span class="monogram" data-tone="pickleball">PB</span><span><span class="sw-name">Pickleball</span><span class="sw-note">Singles, doubles, and game scores</span></span>`;
      switcherMenu.insertBefore(link, $(".switcher-sep", switcherMenu));
      $$('a[href*="game.html"]', switcherMenu).forEach((a) => {
        a.setAttribute(
          "aria-current",
          (new URL(a.href).searchParams.get("game") || "eafc27") === APP.slug
            ? "true"
            : "false",
        );
      });
    }
    if (pickleball) {
      $$(".footer-col")
        .filter((column) =>
          $$('a[href*="game.html"]', column).some(
            (link) => !new URL(link.href).searchParams.has("view"),
          ),
        )
        .forEach((column) => {
          column.insertAdjacentHTML(
            "beforeend",
            '<a href="game.html?game=pickleball">Pickleball</a>',
          );
        });
    }
    text("#ov-title", "The record book");
    $$('a[href*="game.html"]').forEach((a) => {
      const u = new URL(a.href);
      if (
        !u.searchParams.has("game") &&
        !a.closest(".switcher-menu,.games-grid,.footer-col") &&
        !document.body.classList.contains("home-page")
      )
        u.searchParams.set("game", APP.slug);
      a.href = u.pathname + u.search;
    });
    const switchLogo = $(".game-switcher [data-logo-27]");
    if (switchLogo)
      switchLogo.innerHTML = `<img src="assets/brand/${esc(g.logo)}" alt="${esc(g.name)}">`;
    $$("a.header-user").forEach((a) => {
      a.href = APP.me
        ? "account.html"
        : "login.html?next=" +
          encodeURIComponent(location.pathname + location.search);
      a.innerHTML = APP.me
        ? avatar(APP.me.name, "avatar-sm", APP.me.photo) +
          `<span>${esc(APP.me.name)}</span>`
        : "Log in";
    });
    $$("a.header-login").forEach((a) => {
      if (APP.me) {
        a.textContent = "My account";
        a.href = "account.html";
      }
    });
    $$("[data-demo]").forEach((el) => {
      const copy = el.dataset.demo || "";
      el.removeAttribute("data-demo");
      if (el.getAttribute("aria-label") === "Notifications") return;
      else if (/How Elo|Elo uses/.test(el.textContent + copy))
        el.onclick = () =>
          dialog(
            "How Elo works",
            "<p>Ratings start at 1000. A question mark marks a provisional rating until 8 matches receive Elo checkoff in that game and format. Early matches still affect the rating. Each player starts at K=124, tapering logarithmically to K=24 on rated match 45. Each match uses the average K of its participants. Results need a separate admin Elo checkoff. Game strength, winning margin, and competition importance affect the change. Penalty shootouts count as draws for football Elo. Singles and doubles are independent.</p>",
          );
      else if (/forgot password/i.test(el.textContent)) {
        el.href = "#";
        el.onclick = (e) => {
          e.preventDefault();
          toast("Ask the site admin for a private password-reset link.");
        };
      } else if (/invite|add player/i.test(el.textContent)) {
        el.onclick = () => {
          if (!APP.me) return APP.login();
          if (APP.admin() || APP.me.site_admin)
            location.href = "admin.html?game=" + APP.slug;
          else {
            navigator.clipboard
              ?.writeText(location.origin + "/login.html")
              .then(() => toast("Registration link copied."))
              .catch(() => toast(location.origin + "/login.html"));
          }
        };
      } else if (!el.closest("#adp-people,.settings-side")) el.remove();
    });
    $$("[data-close]").forEach(
      (b) => (b.onclick = () => b.closest("dialog")?.close()),
    );
    $$(".sample-tag,.demo-note").forEach((e) => e.remove());
    if ($("#menu-btn"))
      $("#menu-btn").onclick = () => {
        const open = $("#menu-btn").getAttribute("aria-expanded") === "true";
        $("#menu-btn").setAttribute("aria-expanded", !open);
        $("#mobile-nav").hidden = open;
        $("#mobile-nav").dataset.open = String(!open);
      };
    const bell = $('button[aria-label="Notifications"]');
    if (bell) {
      bell.hidden = !APP.me;
      bell.onclick = async () => {
        try {
          const n = await APP.api("notifications");
          dialog(
            "Notifications",
            n.rows.length
              ? n.rows
                  .map(
                    (x) =>
                      `<article class="activity-row"><a href="${esc(x.href)}">${esc(x.message)}</a><small>${date(x.created)}</small></article>`,
                  )
                  .join("")
              : empty("You’re all caught up."),
          );
          await APP.api("notifications/read", {});
        } catch (e) {
          toast(e.message);
        }
      };
    }
    setupGameIdentity();
    setupNavigation();
    tabs();
    icons();
    if (
      !/\/(game|player|players|competition|account|admin|login)\.html$/.test(
        location.pathname,
      )
    ) {
      $$(".game-badge.live").forEach((badge) => badge.remove());
      $(".games-grid").classList.add("uniform-game-grid");
      $$(".games-grid .game-card").forEach((card) => {
        card.classList.remove("large", "small");
        $(".game-card-foot", card).innerHTML =
          `<span class="game-card-cta">Open game ${icon("arrow", 16)}</span>`;
      });
      const p = await APP.api("players?limit=5");
      if ($(".home-players .avatar-stack"))
        $(".home-players .avatar-stack").innerHTML = p.rows
          .map((p) => avatar(p.name, "avatar-sm", p.photo))
          .join("");
      text(".home-players-copy b", count(p.total, "player"));
      text(".home-players-copy span", "One group. Independent game records.");
      $(".home-players .avatar-stack")?.setAttribute(
        "aria-label",
        "Group players",
      );
      $$(".game-card .avatar-stack").forEach((e) => (e.innerHTML = ""));
      const recent = await APP.api("recent-results");
      const { renderHomeResults } = await import("./home-results.js");
      renderHomeResults($(".last-approved-band"), recent.rows);
      document.body.dataset.ready = "true";
      document.documentElement.style.visibility = "";
    }
  });
  APP.shell.catch((e) => {
    console.error(e);
    // Never expose the reference's sample records when live data cannot load.
    document.body.innerHTML =
      '<main class="wrap panel" style="padding:32px;margin-top:32px"><h1>Could not load the record book</h1><p id="load-error"></p><a class="btn btn-outline" href="">Try again</a></main>';
    document.querySelector("#load-error").textContent = e.message;
    document.body.dataset.ready = "true";
    document.documentElement.style.visibility = "";
  });
})();
