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
  const rating = (v) =>
    Number(v ?? 1000).toLocaleString(undefined, { maximumFractionDigits: 2 });
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
        $(".hint", d).textContent = x.message;
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
  const playerLink = (p) =>
    `<a class="player-cell" href="${APP.url("player", { player: p.player_id || p.id })}">${avatar(p.name, "avatar-sm", p.photo)}<span class="name">${esc(p.name)}</span></a>`;
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
      items.forEach((t, i) => {
        t.onclick = () => activate(t);
        t.onkeydown = (e) => {
          let j = i;
          if (["ArrowRight", "ArrowDown"].includes(e.key))
            j = (i + 1) % items.length;
          else if (["ArrowLeft", "ArrowUp"].includes(e.key))
            j = (i + items.length - 1) % items.length;
          else if (e.key === "Home") j = 0;
          else if (e.key === "End") j = items.length - 1;
          else return;
          e.preventDefault();
          items[j].focus();
          activate(items[j]);
        };
      });
    });
  }
  async function picker(selectEl, options = {}) {
    let search = selectEl.previousElementSibling;
    if (!search?.matches("[data-picker-search]")) {
      search = document.createElement("input");
      search.type = "search";
      search.className = "input";
      search.placeholder = options.teams
        ? "Search team catalog…"
        : "Search players…";
      search.setAttribute("aria-label", search.placeholder);
      search.dataset.pickerSearch = "";
      selectEl.before(search);
    }
    async function load() {
      const result = await APP.api(
        (options.teams ? "teams/" + APP.slug : "players") +
          "?limit=100&q=" +
          encodeURIComponent(search.value),
      );
      const rows = result.rows;
      rows.forEach((p) =>
        (options.teams ? APP.teams : APP.players).set(p.id, p),
      );
      const current = selectEl.value || String(options.value || "");
      selectEl.innerHTML =
        '<option value="">Choose…</option>' +
        rows
          .map(
            (p) =>
              `<option value="${p.id}">${esc(p.name)}${options.teams ? " · " + (p.overall ?? "overall needed") : ""}</option>`,
          )
          .join("");
      if (current && [...selectEl.options].some((o) => o.value === current))
        selectEl.value = current;
      else if (current) {
        const old = (options.teams ? APP.teams : APP.players).get(
          Number(current),
        );
        if (old) {
          selectEl.add(new Option(old.name, String(current)));
          selectEl.value = current;
        }
      }
    }
    let timeout;
    search.oninput = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => load().catch((e) => toast(e.message)), 200);
    };
    await load();
    return load;
  }
  function score(m) {
    const side = (n) =>
      m.participants
        .filter((p) => p.side === n)
        .map((p) => esc(p.name))
        .join(" + ");
    const s = m.score;
    if (m.forfeit)
      return `<div class="match-summary"><span>${side(0)}</span><b>Forfeit</b><span>${side(1)}</span></div>`;
    if (s.games) {
      const kind = m.rules?.kind || APP.game.kind,
        cols = s.games.length,
        totalLabel = kind === "tennis" ? "Sets" : "Games";
      const rows = [0, 1]
        .map(
          (n) =>
            `<div class="tennis-score-row ${m.winner === n ? "match-winner" : ""}"><span class="tennis-score-player"><span title="${side(n)}">${side(n)}</span></span>${s.games.map((g) => `<span class="tennis-score-cell ${g.winner === n ? "set-winner" : ""}">${n === 0 ? g.a : g.b}${g.tb ? "<sup>" + g.tb[n] + "</sup>" : ""}${g.winner === n && g.jv ? '<sup class="jv">JV</sup>' : ""}${g.suddenDeath ? "<sup>SD</sup>" : ""}</span>`).join("")}<span class="tennis-score-total">${n === 0 ? m.a_score : m.b_score}</span></div>`,
        )
        .join("");
      return `<div class="${kind === "smash" ? "smash-scoreboard" : "tennis-scoreboard"} ${kind === "tt" ? "tt-scoreboard" : ""}" style="--tennis-set-count:${cols};--tennis-score-columns:minmax(112px,1.8fr) repeat(${cols},minmax(24px,.4fr)) 30px" aria-label="${esc(kind)} scorecard"><div class="tennis-score-row tennis-score-head"><span>Player</span>${s.games.map((_, i) => '<span class="tennis-score-cell">' + (i + 1) + "</span>").join("")}<span class="tennis-score-total-head">${totalLabel}</span></div>${rows}</div>`;
    }
    const detail = s.games
      ? s.games
          .map(
            (g) =>
              `${g.a}–${g.b}${g.tb ? " (" + g.tb.join("–") + ")" : ""}${g.suddenDeath ? " SD" : ""}${g.jv ? " JV" : ""}`,
          )
          .join(" · ")
      : `${m.a_score}–${m.b_score}${s.aet ? " a.e.t." : ""}${s.pens ? " (" + s.pens.join("–") + " pens)" : ""}`;
    return `<div class="match-summary"><span class="side">${side(0)}</span><span class="score">${m.a_score}–${m.b_score}</span><span class="side">${side(1)}</span></div><div class="muted" style="font-size:.76rem">${esc(detail)}</div>`;
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
    const d = dialog(
      "Match result",
      `${score(m)}<p class="sub">${esc(status(m))} · ${date(m.submitted)}</p>${m.locked ? '<p class="notice-strip">Locked by a downstream match submission.</p>' : ""}${m.score.note ? `<p>${esc(m.score.note)}</p>` : ""}${m.teams?.length ? "<p>" + m.teams.map((t) => esc(t.name) + " · " + (t.overall ?? "overall missing")).join(" vs ") + "</p>" : ""}${m.score.games?.some((g) => g.fighters) ? '<div class="smash-meta">' + m.score.games.map((g, i) => "<p>Game " + (i + 1) + " · " + esc(g.stage) + "<br>" + g.fighters.map((f, j) => esc(m.participants.find((p) => p.id === m.score.fighterPlayers?.[j])?.name || "Player " + (j + 1)) + ": " + esc(f)).join(" · ") + "</p>").join("") + "</div>" : ""}${m.ledger.length ? '<div class="summary-meta">' + m.ledger.map((l) => "<div><span>" + esc(m.participants.find((p) => p.id === l.player_id)?.name) + "</span><b>" + rating(l.before) + " → " + rating(l.after) + "</b></div>").join("") + "</div>" : ""}<div class="form-actions">${m.permissions.accept ? button("Accept result", "accept") : ""}${m.permissions.elo ? button("Check off Elo", "elo") : ""}${m.permissions.eloToggle ? button(m.elo_enabled ? "Exclude from Elo" : "Include in Elo", "elo-enabled") : ""}${m.permissions.edit ? button("Correct result", "edit") : ""}${m.permissions.void ? button("Void result", "void") : ""}</div><p class="hint" role="alert"></p>`,
    );
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
            $(".hint", d).textContent = e.message;
          } finally {
            b.disabled = false;
          }
        }),
    );
  }
  function standingsTable(c, rows) {
    const fc = APP.games.find((g) => g.slug === c.game)?.kind === "fc";
    return `<div class="table-wrap"><table><thead><tr><th>#</th><th>${c.format === "doubles" ? "Pair" : "Player"}</th><th>P</th><th>W</th>${fc ? "<th>D</th>" : ""}<th>L</th><th>${fc ? "Goals" : "Games / sets"}</th>${fc ? "<th>Pts</th>" : ""}</tr></thead><tbody>${rows.map((r) => `<tr><td>${r.position}</td><td>${r.players.map((p) => playerLink(p)).join(" + ")}</td><td>${r.played}</td><td>${r.w}</td>${fc ? `<td>${r.d}</td>` : ""}<td>${r.l}</td><td>${r.for}–${r.against}</td>${fc ? `<td>${r.points}</td>` : ""}</tr>`).join("")}</tbody></table></div>`;
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
    toast,
    dialog,
    button,
    formDialog,
    field,
    select,
    playerLink,
    pager,
    tabs,
    picker,
    score,
    status,
    matchDialog,
    standingsTable,
  };
  APP.shell = Promise.all([APP.ready, APP.dom]).then(async () => {
    // All runtime deviations correspond to explicit requirements; original HTML/CSS remain unchanged.
    const styles = document.createElement("style");
    styles.textContent =
      ".live-pagination{padding:16px;flex-wrap:wrap}.live-pagination .muted{margin-right:auto}.live-game-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:16px 0;border-bottom:1px solid var(--line)}.live-game-row h4,.live-game-row .wide{grid-column:1/-1}.live-score-grid{display:grid;gap:16px}.dialog{max-width:min(720px,calc(100vw - 24px))}.dialog .form-actions{flex-wrap:wrap}.input,.select{min-width:0;max-width:100%}.player-cell .name{overflow-wrap:anywhere}.avatar img{width:100%;height:100%;object-fit:cover;border-radius:inherit}.bracket-match{min-width:200px}.live-pagination button:disabled{opacity:.4}.table-wrap{max-width:100%;overflow:auto}.settings-layout>*,.settings-card,.sidebar,.view>*{min-width:0}.view{grid-template-columns:minmax(0,1fr)}";
    document.head.append(styles);
    const g = APP.game;
    if (document.body.hasAttribute("data-game")) {
      document.body.dataset.game = {
        fc: "eafc",
        tennis: "tennis",
        tt: "table-tennis",
        smash: "smash",
      }[g.kind];
      if (g.slug === "eafc26") document.body.dataset.gameVariant = "eafc26";
    }
    text("[data-game-label]", g.name);
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
            "<p>Ratings start at 1000. Results need a separate admin Elo checkoff. Game strength, winning margin, and competition importance affect the change. Penalty shootouts count as draws for football Elo. Singles and doubles are independent.</p>",
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
    $$(".sample-tag").forEach((e) => e.remove());
    // Remove demo/season wording in text nodes without touching structure or accessibility attributes.
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) {
      if (n.parentElement.closest("script,style")) continue;
      n.textContent = n.textContent
        .replace(
          /All (numbers|players and results shown) are sample data\./g,
          "",
        )
        .replace(
          /Season 2026\/27|2026\/27|this season|Season snapshot|Your season|current season|season tour/gi,
          (m) =>
            m === "Season snapshot"
              ? "Record snapshot"
              : m === "Your season"
                ? "Your record"
                : "All time",
        )
        .replace(/\s*[·—]\s*sample\b/gi, "")
        .replace(/Sample data only\.|Sample data\./g, "");
    }
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
    tabs();
    icons();
    if (
      !/\/(game|player|players|competition|account|admin|login)\.html$/.test(
        location.pathname,
      )
    ) {
      const p = await APP.api("players?limit=5");
      if ($(".home-players .avatar-stack"))
        $(".home-players .avatar-stack").innerHTML = p.rows
          .map((p) => avatar(p.name, "avatar-sm", p.photo))
          .join("");
      text(".home-players-copy b", `${p.total} players`);
      text(".home-players-copy span", "One group. Independent game records.");
      $(".home-players .avatar-stack")?.setAttribute(
        "aria-label",
        "Group players",
      );
      text(
        '.game-card[data-tone="eafc"] p',
        "Teams, ratings, and match records.",
      );
      text(
        '.game-card[data-tone="tennis"] p',
        "Singles, doubles, sets, and competitions.",
      );
      text(
        '.game-card[data-tone="tt"] p',
        "Games to 11 or 21, best of 1, 3, 5, or 7.",
      );
      $$(".game-card .avatar-stack").forEach((e) => (e.innerHTML = ""));
      const recent = await APP.api(
        "matches?game=eafc27&status=accepted&limit=1",
      );
      text(".hero-result-label", "Latest accepted result");
      const result = $(".result-line");
      if (result)
        result.innerHTML = recent.rows.length
          ? score(recent.rows[0])
          : "<span>No results yet. Start the record book.</span>";
      document.body.dataset.ready = "true";
      document.documentElement.style.visibility = "";
    }
  });
  APP.shell.catch((e) => {
    console.error(e);
    document.documentElement.style.visibility = "";
    toast(e.message);
  });
})();
