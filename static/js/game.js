APP.run(async () => {
  const { $, $$, esc, text, button, field, select } = UI,
    g = APP.game;
  document.body.classList.add("game-page");
  const descriptions = [
    "Everyone plays everyone. Results build the table; eligible matches count for Elo after admin checkoff.",
    "Group tables seed a bracket. Eligible results count for Elo after admin checkoff; knockout rounds can be weighted.",
    g.kind === "fc"
      ? "A knockout bracket with one champion. Tied knockout matches need a winner after extra time or penalties."
      : "A knockout bracket with one champion. Each completed match sends its winner to the next round.",
  ];
  $$(".format-card p").forEach((paragraph, i) => {
    if (descriptions[i]) paragraph.textContent = descriptions[i];
  });
  const mobileNav = document.createElement("nav");
  mobileNav.className = "game-mobile-nav";
  mobileNav.setAttribute("aria-label", "Game views");
  mobileNav.innerHTML = [
    ["overview", "Overview"],
    ["matches", "Matches"],
    ["rankings", "Rankings"],
    ["competitions", "Competitions"],
  ]
    .map(
      ([name, label]) =>
        `<a href="${esc(APP.url("game", { view: name }))}" data-view="${name}">${label}</a>`,
    )
    .join("");
  $(".game-identity").after(mobileNav);
  let view = APP.params.get("view") || "overview",
    format = "singles",
    matchStatus = "";
  const valid = [
    "overview",
    "matches",
    "rankings",
    "competitions",
    "players",
    "record",
    "review",
  ];
  if (!valid.includes(view)) view = "overview";
  text(
    "#overview-sub",
    `${g.name}: independent ratings, competitions, and match records.`,
  );
  text("#overview-table-title", "Elo rankings");
  text("#overview-table-sub", "? = provisional until 8 rated matches");
  text("#stat-leader-foot", "Singles Elo leader");
  text("#stat-leader .label", "Rating leader");
  text(
    "#rankings-title + .sub",
    "Continuous ratings. ? = provisional until 8 rated matches in this game and format.",
  );
  text(
    "[data-view-panel=matches] .page-head .sub",
    "Accepted results count toward competitions. Elo requires a separate admin checkoff.",
  );
  text(
    "[data-view-panel=matches] .table-note",
    "Browse results and their approval status.",
  );
  text(
    "[data-view-panel=record] .page-head .sub",
    "Submit the result, confirm it with the other side, and let an admin check off Elo.",
  );
  text(
    ".record-summary .notice-card p",
    "An organizer, admin, or representatives from both sides can accept a result. Elo is reviewed separately by an admin.",
  );
  text(
    "[data-view-panel=review] .notice-strip",
    "Accept results and review Elo as separate steps. Only relevant admins can check off ratings.",
  );
  text("#review-title", "Result & Elo review");
  if ($("#game-banner")) $("#game-banner").hidden = true;
  $$("a.side-link")
    .filter((a) => /settings/i.test(a.textContent))
    .forEach((a) => {
      a.textContent = "Game administration";
      a.href = "admin.html?game=" + APP.slug;
      a.hidden = !APP.admin();
    });
  if (["tennis", "smash", "pickleball"].includes(g.kind)) {
    const f = document.createElement("div");
    f.className = "filter-row";
    f.innerHTML = select(
      "Rating format",
      "ranking-format",
      [
        ["singles", "Singles"],
        ["doubles", "Doubles"],
      ],
      format,
    );
    $("#panel-elo .panel-head").after(f);
    $("#field-ranking-format").onchange = async (e) => {
      format = e.target.value;
      await rankings();
    };
  }
  const matchRows = (rows) =>
    rows
      .map(
        (m) =>
          `<tr><td>${UI.date(m.played_at ?? m.submitted)}</td><td>${UI.resultCard(m)}</td><td>${esc(m.competition_name || "Friendly")}</td><td>${m.elo_checked ? "Checked" : "—"}</td><td><span class="status ${m.status === "submitted" ? "status-pending" : "status-live"}">${esc(UI.status(m))}</span></td></tr>`,
      )
      .join("") || '<tr><td colspan="5">No matching results.</td></tr>';
  function bindMatches(root = document) {
    $$("[data-match]", root).forEach(
      (b) =>
        (b.onclick = (event) => {
          if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
            return;
          event.preventDefault();
          UI.matchDialog(b.dataset.match).catch((e) => UI.toast(e.message));
        }),
    );
  }
  async function overview() {
    const [s, r, recent, pending] = await Promise.all([
      APP.api(`games/${APP.slug}/summary`),
      APP.api(`games/${APP.slug}/rankings?limit=5`),
      APP.api(`matches?game=${APP.slug}&limit=5`),
      APP.api(`matches?game=${APP.slug}&status=submitted&limit=5`),
    ]);
    text("#stat-players", s.players);
    text("#stat-matches", s.matches);
    text("#stat-pending", (s.pending || 0) + (s.elo_pending || 0));
    text("#stat-leader", s.leader?.name || "—");
    text(
      "#stat-leader-foot",
      s.leader ? UI.elo(s.leader) + " Elo" : "No rated matches yet",
    );
    text("#stat-matches-foot", UI.count(s.accepted || 0, "accepted result"));
    text(
      "#stat-pending-foot",
      `${UI.count(s.pending || 0, "result")} · ${UI.count(s.elo_pending || 0, "Elo checkoff")}`,
    );
    text("#review-badge", (s.pending || 0) + (s.elo_pending || 0));
    const table = $("#overview-table").closest("table");
    $("thead", table).innerHTML =
      "<tr><th>#</th><th>Player</th><th>Elo</th><th>W</th><th>L</th></tr>";
    $("#overview-table").innerHTML =
      r.rows
        .map(
          (p) =>
            `<tr><td>${p.rank}</td><td>${UI.playerLink(p)}</td><td class="num">${UI.elo(p)}</td><td>${p.w || 0}</td><td>${p.l || 0}</td></tr>`,
        )
        .join("") ||
      '<tr><td colspan="5">The first Elo checkoff starts the rankings.</td></tr>';
    $("#overview-activity").innerHTML =
      recent.rows
        .map(
          (m) =>
            `<div class="activity-row"><span class="activity-icon">${UI.icon(m.status === "accepted" ? "check" : "clock", 17)}</span><div class="activity-copy"><b>${m.participants.map((p) => esc(p.name)).join(" · ")}</b><span>${esc(UI.status(m))}</span></div><span class="activity-meta">${UI.date(m.played_at ?? m.submitted)}</span></div>`,
        )
        .join("") || UI.empty("No activity yet.");
    $("#overview-pending").innerHTML =
      pending.rows
        .map((m) => `<div class="leader-row">${UI.resultCard(m)}</div>`)
        .join("") || UI.empty("No results waiting.");
    bindMatches();
  }
  async function matches(offset = 0) {
    const result = await APP.api(
      `matches?game=${APP.slug}&offset=${offset}&status=${matchStatus}&q=${encodeURIComponent($("#match-search").value)}`,
    );
    $("#matches-body").closest("table").querySelector("thead").innerHTML =
      "<tr><th>Date</th><th>Match</th><th>Competition</th><th>Elo</th><th>Status</th></tr>";
    $("#matches-body").innerHTML = matchRows(result.rows);
    UI.matchTable($("#matches-body").closest("table"));
    UI.pager($("[data-view-panel=matches]"), result, matches);
    bindMatches();
  }
  $("#match-filters").innerHTML = [
    ["", "All"],
    ["submitted", "Pending result"],
    ["accepted", "Accepted"],
    ["elo", "Awaiting Elo"],
  ]
    .map(
      ([v, l]) =>
        `<button type="button" data-status="${v}" aria-pressed="${v === matchStatus}">${l}</button>`,
    )
    .join("");
  $$("[data-status]").forEach(
    (b) =>
      (b.onclick = async () => {
        matchStatus = b.dataset.status;
        $$("[data-status]").forEach((x) =>
          x.setAttribute("aria-pressed", x === b),
        );
        await matches();
      }),
  );
  let searchTimer;
  $("#match-search").oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(
      () => matches().catch((e) => UI.toast(e.message)),
      200,
    );
  };
  async function rankings(offset = 0) {
    const result = await APP.api(
      `games/${APP.slug}/rankings?format=${format}&offset=${offset}`,
    );
    const table = $("#elo-body").closest("table");
    table.classList.add("game-ranking-table");
    $("thead", table).innerHTML =
      "<tr><th>#</th><th>Player</th><th>Elo</th><th>Peak</th><th>W</th><th>D</th><th>L</th></tr>";
    $("#elo-body").innerHTML =
      result.rows
        .map(
          (p) =>
            `<tr class="game-ranking-row"><td data-label="Rank">${p.rank}</td><td>${UI.playerLink(p)}</td><td class="num" data-label="Elo">${UI.elo(p)}</td><td data-label="Peak">${UI.peak(p)}</td><td data-label="W">${p.w || 0}</td><td data-label="D">${p.d || 0}</td><td data-label="L">${p.l || 0}</td></tr>`,
        )
        .join("") ||
      '<tr><td colspan="7">No rated results in this format yet.</td></tr>';
    UI.pager($("#panel-elo"), result, rankings);
    const comps = await APP.api(`competitions?game=${APP.slug}&limit=100`);
    const leagues = comps.rows.filter((c) =>
      ["league", "groups"].includes(c.kind),
    );
    let chooser = $("#league-selector");
    if (!chooser) {
      chooser = document.createElement("select");
      chooser.className = "select";
      chooser.id = "league-selector";
      chooser.setAttribute("aria-label", "Competition table");
      $("#panel-league .panel-head").after(chooser);
    }
    chooser.innerHTML =
      '<option value="">Choose a competition…</option>' +
      leagues
        .map((c) => `<option value="${c.id}">${esc(c.name)}</option>`)
        .join("");
    text("#league-title", "Competition standings");
    text("#league-sub", "Accepted results only");
    text("#league-matchday", "");
    const load = async () => {
      let out = $("#live-league-table");
      if (!out) {
        out = document.createElement("div");
        out.id = "live-league-table";
        $("#panel-league .table-wrap").replaceWith(out);
      }
      if (!chooser.value) {
        out.innerHTML = UI.empty("Choose a league or group competition.");
        return;
      }
      const [detail, projection] = await Promise.all([
        APP.api("competitions/" + chooser.value),
        APP.api(`competitions/${chooser.value}/projection`),
      ]);
      const c = { ...detail, projection };
      out.innerHTML =
        Object.entries(c.standings)
          .map(
            ([pool, rows]) =>
              `<h3 class="panel-body">${pool ? "Group " + esc(pool) : esc(c.name)}</h3>` +
              UI.standingsTable(c, rows),
          )
          .join("") || UI.empty("Generate the draw to create standings.");
    };
    chooser.onchange = () => load().catch((e) => UI.toast(e.message));
    await load();
  }
  async function competitions(offset = 0) {
    const result = await APP.api(
      `competitions?game=${APP.slug}&offset=${offset}`,
    );
    $("#competition-grid").innerHTML =
      result.rows
        .map(
          (c) =>
            `<a class="competition-card panel" href="${APP.url("competition", { id: c.id })}"><div class="panel-body"><div class="tag-row"><span class="chip">${esc(c.kind)}</span><span class="status status-live">${esc(c.state)}</span><span class="chip">${esc(c.format)}</span></div><h2 style="margin:16px 0">${esc(c.name)}</h2><p class="sub">${UI.count(c.entry_count, "entry", "entries")} · ${c.played} of ${UI.count(c.fixture_count, "fixture")} accepted</p><span class="link-arrow">Open competition ${UI.icon("arrow", 16)}</span></div></a>`,
        )
        .join("") || UI.empty("No competitions yet. Create the first one.");
    UI.pager($("[data-view-panel=competitions]"), result, competitions);
  }
  APP.refreshCompetitions = competitions;
  async function players(offset = 0) {
    const result = await APP.api(
      `players?game=${APP.slug}&offset=${offset}&q=${encodeURIComponent($("#player-search").value)}`,
    );
    const table = $("#players-body").closest("table");
    $("thead", table).innerHTML =
      "<tr><th>Player</th><th>Handle</th><th>Singles Elo</th><th>Profile</th></tr>";
    $("#players-body").innerHTML = result.rows
      .map(
        (p) =>
          `<tr><td>${UI.playerLink(p)}</td><td>${esc(p.handle ? "@" + p.handle : "Fill-in")}</td><td>${p.ratings.some((r) => r.game === APP.slug && r.format === "singles") ? UI.elo(p.ratings.find((r) => r.game === APP.slug && r.format === "singles")) : "Unrated"}</td><td><a class="panel-link" href="player.html?player=${p.id}">View</a></td></tr>`,
      )
      .join("");
    UI.pager($("[data-view-panel=players]"), result, players);
  }
  $("#player-search").oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(
      () => players().catch((e) => UI.toast(e.message)),
      200,
    );
  };
  async function review(offset = 0) {
    const [pending, elo] = await Promise.all([
      APP.api(`matches?game=${APP.slug}&status=submitted&offset=${offset}`),
      APP.api(`matches?game=${APP.slug}&status=elo&offset=${offset}`),
    ]);
    text(
      "#review-count",
      `${UI.count(pending.total, "result")} · ${elo.total} Elo`,
    );
    for (const [id, result, title] of [
      ["#review-body", pending, "Pending result acceptance"],
      ["#locked-body", elo, "Accepted · awaiting Elo"],
    ]) {
      const b = $(id);
      $("thead", b.closest("table")).innerHTML =
        "<tr><th>Submitted</th><th>Match</th><th>Competition</th><th>Elo</th><th>Status</th></tr>";
      b.innerHTML = matchRows(result.rows);
      UI.matchTable(b.closest("table"));
      $(".panel-head h2", b.closest(".panel")).textContent = title;
      UI.pager(b.closest(".panel"), result, review);
    }
    const panel = $("#locked-body").closest(".panel");
    let bulk = $("[data-action=check-all-elo]", panel);
    if (!bulk && (APP.me?.site_admin || APP.me?.admin_of?.includes(APP.slug))) {
      bulk = document.createElement("button");
      bulk.type = "button";
      bulk.className = "btn btn-outline btn-sm";
      bulk.dataset.action = "check-all-elo";
      bulk.textContent = "Check off all Elo";
      $(".panel-head", panel).append(bulk);
      bulk.onclick = async () => {
        bulk.disabled = true;
        try {
          const result = await APP.api(`games/${APP.slug}/elo-checkoff`, {});
          UI.toast(`${result.checked} Elo checkoffs completed.`);
          await review();
        } catch (error) {
          UI.toast(error.message);
          bulk.disabled = false;
        }
      };
    }
    if (bulk) bulk.disabled = !elo.total;
    bindMatches();
  }
  async function show(name, push = true) {
    view = valid.includes(name) ? name : "overview";
    $$("[data-view-panel]").forEach(
      (p) => (p.hidden = p.dataset.viewPanel !== view),
    );
    $$("[data-view]").forEach((a) =>
      a.setAttribute(
        "aria-current",
        a.dataset.view === view ? "page" : "false",
      ),
    );
    if (push) {
      const u = new URL(location.href);
      u.searchParams.set("view", view);
      history.pushState({}, "", u);
    }
    UI.navigation?.(view);
    UI.gameIdentity?.(view);
    document.title = `${g.name} · ${view} · mimELo`;
    const fn = { overview, matches, rankings, competitions, players, review }[
      view
    ];
    if (fn) await fn();
    UI.icons();
  }
  $$("[data-view]").forEach(
    (a) =>
      (a.onclick = (e) => {
        e.preventDefault();
        show(a.dataset.view).catch((e) => UI.toast(e.message));
      }),
  );
  window.addEventListener("popstate", () =>
    show(new URLSearchParams(location.search).get("view") || "overview", false),
  );
  window.addEventListener("records-changed", () =>
    show(view, false).catch((e) => UI.toast(e.message)),
  );
  await setupRecord();
  await show(view, false);
  if (APP.params.get("match")) await UI.matchDialog(APP.params.get("match"));
  async function setupRecord() {
    const gameScores = new Map();
    const form = $("#record-form");
    if (!APP.me) {
      $(".record-layout").innerHTML =
        `<div class="panel panel-body"><h2>Log in to record a result</h2><p>Results can be submitted by participants and relevant admins.</p><a class="btn btn-primary" href="login.html?next=${encodeURIComponent(APP.url("game", { view: "record" }))}">Log in</a></div>`;
      return;
    }
    if (!APP.me.approved) {
      $(".record-layout").innerHTML =
        '<div class="panel panel-body"><h2>Awaiting account approval</h2><p>A site admin must approve your account before you can record results. You can browse as a spectator in the meantime.</p></div>';
      return;
    }
    let fixed = null,
      editing = null,
      savedSides = null,
      smashRecorder = null,
      recordFormat = "singles";
    if (APP.params.get("edit")) {
      editing = await APP.api("matches/" + APP.params.get("edit"));
      if (!editing.permissions.edit)
        throw new Error("This result cannot be edited.");
      recordFormat = editing.format;
      savedSides = [0, 1].map((s) =>
        editing.participants.filter((p) => p.side === s).map((p) => p.id),
      );
      if (g.kind === "smash" && editing.score.fighterPlayers) {
        const order = editing.score.fighterPlayers;
        for (const game of editing.score.games)
          game.fighters = savedSides
            .flat()
            .map((id) => game.fighters[order.indexOf(id)]);
        editing.score.fighterPlayers = savedSides.flat();
      }
      editing.participants.forEach((p) => APP.players.set(p.id, p));
      if (editing.fixture_id) {
        const c = await APP.api("competitions/" + editing.competition_id);
        fixed = { c, f: c.fixtures.find((f) => f.id === editing.fixture_id) };
      }
    }
    if (APP.params.get("fixture")) {
      const c = await APP.api("competitions/" + APP.params.get("competition")),
        f = c.fixtures.find((f) => f.id === Number(APP.params.get("fixture")));
      if (!f || f.status !== "ready")
        throw new Error("This fixture is not ready.");
      fixed = { c, f };
      recordFormat = c.format;
      savedSides = [f.a, f.b].map((id) =>
        c.entries
          .find((e) => e.id === id)
          .players.map((p) => {
            APP.players.set(p.id, p);
            return p.id;
          }),
      );
    }
    text("#record-title", editing ? "Correct result" : "Record a result");
    const setsGame = g.kind !== "fc";
    const pickleball =
      g.kind === "pickleball" ? await import("./pickleball.js") : null;
    if (!setsGame) {
      const summary = $(".summary-match");
      $$(".summary-club,.summary-score", summary).forEach((el) => el.remove());
      $(".form-section-title", summary).insertAdjacentHTML(
        "afterend",
        '<div id="record-fc-score"></div>',
      );
    }
    const config = () =>
      fixed?.c.settings || {
        bestOf: Number($("#field-bestOf")?.value || editing?.score.bestOf || 3),
        target: Number(
          $("#field-target")?.value || editing?.score.target || 11,
        ),
        matchTiebreak: $("#field-matchTiebreak")?.checked || false,
      };
    if (setsGame) {
      form.className =
        g.kind === "tennis"
          ? "tennis-form"
          : ["tt", "pickleball"].includes(g.kind)
            ? "tt-record-form"
            : "smash-form";
      form.innerHTML = `<div class="form-section"><div class="form-section-title">Match details</div>${select(
        "Format",
        "record-format",
        g.kind === "tt"
          ? [["singles", "Singles"]]
          : [
              ["singles", "Singles"],
              ["doubles", "Doubles"],
            ],
        recordFormat,
      )}<div class="form-grid" id="record-players"></div><div class="form-grid" id="record-config"></div><div class="live-score-grid" id="record-games"></div></div><div class="field"><label for="r-note">Note (optional)</label><textarea class="textarea" id="r-note"></textarea></div><label class="check"><input type="checkbox" id="r-elo" checked><span>Counts for Elo</span></label><div class="form-actions"><button class="btn btn-primary" type="submit">${editing ? "Save correction" : "Submit result"}</button></div><p class="hint" id="record-error" role="alert"></p>`;
      if (pickleball)
        $("#record-games").insertAdjacentHTML(
          "beforebegin",
          '<p class="hint pickleball-score-key">Scores · Side 1 – Side 2</p>',
        );
      if (["tt", "tennis", "pickleball"].includes(g.kind)) {
        $("#r-note")
          .closest(".field")
          .insertAdjacentHTML(
            "beforebegin",
            field("Umpire (optional)", "umpire", editing?.score.umpire || "") +
              (["tt", "pickleball"].includes(g.kind)
                ? field(
                    "Score adjustment reason (optional)",
                    "score-adjustment",
                    editing?.score.scoreAdjustment || "",
                  ) +
                  '<p class="hint">Use for an adjusted score, such as a points penalty.</p>'
                : ""),
          );
      }
      if (fixed || editing) $("#field-record-format").disabled = true;
      if (g.kind === "smash") {
        const { createSmashRecorder } = await import("./smash-record.js");
        smashRecorder = createSmashRecorder(form, {
          catalog: APP.smashCatalog,
          format: () => recordFormat,
          initial: editing?.score.games || [],
        });
      }
      async function renderPlayers() {
        const count = recordFormat === "doubles" ? 2 : 1;
        $("#record-players").innerHTML = [0, 1]
          .map((side) =>
            Array.from({ length: count }, (_, i) =>
              select(
                `Side ${side + 1} · player ${i + 1}`,
                `p${side}${i}`,
                [],
                null,
              ),
            ).join(""),
          )
          .join("");
        for (let side = 0; side < 2; side++)
          for (let i = 0; i < count; i++) {
            const el = $(`#field-p${side}${i}`);
            await UI.picker(el, {
              value:
                savedSides?.[side][i] ||
                (side === 0 && i === 0 ? APP.me.player_id : null),
            });
            if (savedSides) el.disabled = true;
          }
        renderConfig();
      }
      function renderConfig() {
        const opts =
            g.kind === "tt"
              ? [1, 3, 5, 7]
              : g.kind === "tennis" && recordFormat === "doubles"
                ? [1, 3]
                : [1, 3, 5],
          s = fixed?.c.settings || editing?.score || {};
        $("#record-config").innerHTML =
          select(
            "Best of",
            "bestOf",
            opts.map((n) => [
              n,
              UI.count(n, g.kind === "tennis" ? "set" : "game"),
            ]),
            s.bestOf || 3,
          ) +
          (["tt", "pickleball"].includes(g.kind)
            ? select(
                "Points per game",
                "target",
                [[11, 11], ...(pickleball ? [[15, 15]] : []), [21, 21]],
                s.target || 11,
              )
            : "") +
          (g.kind === "tennis" && recordFormat === "doubles"
            ? `<label class="check"><input id="field-matchTiebreak" type="checkbox" ${s.matchTiebreak ? "checked" : ""}>Deciding match tiebreak to 10</label>`
            : "") +
          (pickleball ? pickleball.scoringHelp : "");
        if (fixed)
          $$("input,select", $("#record-config")).forEach(
            (e) => (e.disabled = true),
          );
        if (pickleball)
          pickleball.bindScoring(
            $("#field-bestOf"),
            $("#field-target"),
            renderGames,
          );
        else $("#field-bestOf").onchange = renderGames;
        renderGames();
      }
      function renderGames() {
        const s = config();
        if (smashRecorder) {
          smashRecorder.renderGames(s.bestOf);
          return;
        }
        $$("#record-games [data-game-row]").forEach((row) => {
          const index = Number(row.dataset.gameRow);
          gameScores.set(index, {
            a: $("#field-score" + index + "a").value,
            b: $("#field-score" + index + "b").value,
            tb: [
              $("#field-tb" + index + "a")?.value || "",
              $("#field-tb" + index + "b")?.value || "",
            ],
          });
        });
        $("#record-games").classList.toggle(
          "pickleball-scoreline",
          !!pickleball,
        );
        $("#record-games").innerHTML = Array.from(
          { length: s.bestOf },
          (_, i) => {
            const prev = gameScores.get(i) || editing?.score.games?.[i] || {};
            if (pickleball)
              return `<section class="live-game-row pickleball-record-game" data-game-row="${i}" aria-labelledby="pickleball-game-${i}"><h4 id="pickleball-game-${i}">Game ${i + 1}</h4>${field(`Game ${i + 1} · Side 1 score`, `score${i}a`, prev.a ?? "", "number", 'min="0" max="200" inputmode="numeric"')}<span class="pickleball-score-separator" aria-hidden="true">–</span>${field(`Game ${i + 1} · Side 2 score`, `score${i}b`, prev.b ?? "", "number", 'min="0" max="200" inputmode="numeric"')}</section>`;
            return `<section class="live-game-row" data-game-row="${i}"><h4>${g.kind === "tennis" ? "Set" : "Game"} ${i + 1}</h4>${field("Side 1 score", `score${i}a`, prev.a ?? "", "number", 'min="0" max="200" inputmode="numeric"')}${field("Side 2 score", `score${i}b`, prev.b ?? "", "number", 'min="0" max="200" inputmode="numeric"')}${g.kind === "tennis" ? field("Tiebreak points · side 1", `tb${i}a`, prev.tb?.[0] ?? "", "number", 'min="0" inputmode="numeric"') + field("Tiebreak points · side 2", `tb${i}b`, prev.tb?.[1] ?? "", "number", 'min="0" inputmode="numeric"') : ""}</section>`;
          },
        ).join("");
        form.dispatchEvent(new Event("input"));
      }
      $("#field-record-format").onchange = async (e) => {
        recordFormat = e.target.value;
        await renderPlayers();
      };
      await renderPlayers();
    } else {
      $$(".demo-note", form).forEach((e) => e.remove());
      $("#r-comp").innerHTML =
        `<option>${esc(fixed?.c.name || "Friendly")}</option>`;
      $("#r-comp").disabled = true;
      $("#r-s1").value = editing?.score.a ?? 0;
      $("#r-s2").value = editing?.score.b ?? 0;
      $("#r-aet").checked = !!editing?.score.aet;
      $("#r-pens").checked = !!editing?.score.pens;
      $("#pens-fields").hidden = !$("#r-pens").checked;
      $("#r-pen1").value = editing?.score.pens?.[0] ?? 0;
      $("#r-pen2").value = editing?.score.pens?.[1] ?? 0;
      $("#r-pens").onchange = () =>
        ($("#pens-fields").hidden = !$("#r-pens").checked);
      for (let side = 0; side < 2; side++) {
        const el = $("#r-p" + (side + 1));
        await UI.picker(el, {
          value:
            savedSides?.[side][0] || (side === 0 ? APP.me.player_id : null),
        });
        if (savedSides) el.disabled = true;
        const selected = editing?.score[side === 0 ? "teamA" : "teamB"];
        if (selected)
          APP.teams.set(
            selected,
            await APP.api(`teams/${APP.slug}/${selected}`),
          );
        $("#r-club" + (side + 1)).value = selected || "";
        text(
          "#team-btn" + (side + 1) + "-name",
          APP.teams.get(selected)?.name || "Choose team",
        );
        text("#team-btn" + (side + 1) + "-meta", "Overall required for Elo");
        $("#team-btn" + (side + 1) + " .monogram").textContent = "—";
        const setTeam = (t) => {
          if (t) APP.teams.set(t.id, t);
          $("#r-club" + (side + 1)).value = t?.id || "";
          text("#team-btn" + (side + 1) + "-name", t?.name || "Choose team");
          text(
            "#team-btn" + (side + 1) + "-meta",
            t
              ? `${t.league} · ${t.overall ?? "Missing"} overall`
              : "Overall required for Elo",
          );
          $("#team-btn" + (side + 1) + " .monogram").textContent =
            t?.code || "—";
        };
        const lastTeam = async () =>
          el.value
            ? APP.api(`players/${el.value}/last-team?game=${APP.slug}`)
            : null;
        setTeam(selected ? APP.teams.get(selected) : await lastTeam());
        let teamRequest = 0;
        el.onchange = async () => {
          const request = ++teamRequest;
          try {
            const team = await lastTeam();
            if (request !== teamRequest) return;
            setTeam(team);
            preview();
          } catch (e) {
            UI.toast(e.message);
          }
        };
        $("#team-btn" + (side + 1)).onclick = () => teamPicker(side + 1);
      }
      form.insertAdjacentHTML(
        "beforeend",
        '<p class="hint" id="record-error" role="alert"></p>',
      );
    }
    $("#r-note").value = editing?.score.note || "";
    $("#r-elo").checked = editing ? !!editing.elo_enabled : true;
    text("#sum-comp", fixed?.c.name || "Friendly");
    text("#sum-by", APP.me.name);
    text("#sum-elo-note", "Complete the score to estimate the rating change.");
    text(
      ".elo-projection-head span:last-child",
      g.kind === "fc"
        ? "Adaptive K · team overall included"
        : "Adaptive K · margin included",
    );
    $$(".summary-meta > div")
      .filter((e) => /Season/.test(e.textContent))
      .forEach((e) => e.remove());
    const timing = document.createElement("fieldset");
    timing.className = "record-timing";
    timing.innerHTML = `<legend>Match timing <span class="muted">Optional</span></legend><div class="form-grid"><div class="field"><label for="r-played-date">Date played</label><input class="input" type="date" id="r-played-date" aria-describedby="played-time-hint"></div><div class="field"><label for="r-start-time">Start time</label><input class="input" type="time" id="r-start-time" aria-describedby="played-time-hint"></div><div class="field"><label for="r-duration">Duration (minutes)</label><input class="input" type="number" id="r-duration" min="1" max="10080" step="1" placeholder="Optional"></div></div><p class="hint" id="played-time-hint">Enter both a date and start time, or leave both blank to use the submission date. Your local time (${esc(Intl.DateTimeFormat().resolvedOptions().timeZone)}). Duration is optional.</p>`;
    form.querySelector(".form-actions").before(timing);
    const playedDate = $("#r-played-date"),
      startTime = $("#r-start-time");
    if (editing?.played_at) {
      const local = new Date(editing.played_at);
      const value = new Date(
        local.getTime() - local.getTimezoneOffset() * 60000,
      ).toISOString();
      playedDate.value = value.slice(0, 10);
      startTime.value = value.slice(11, 16);
    }
    if (editing?.duration_minutes)
      $("#r-duration").value = editing.duration_minutes;
    const initialPlayedDate = playedDate.value,
      initialStartTime = startTime.value;
    const sides = () =>
      [0, 1].map((s) =>
        Array.from({ length: recordFormat === "doubles" ? 2 : 1 }, (_, i) =>
          Number($(setsGame ? `#field-p${s}${i}` : "#r-p" + (s + 1)).value),
        ),
      );
    function read() {
      if (!!playedDate.value !== !!startTime.value)
        throw new Error(
          "Enter both the played date and start time, or leave both blank.",
        );
      let score;
      if (!setsGame)
        score = {
          a: Number($("#r-s1").value),
          b: Number($("#r-s2").value),
          teamA: Number($("#r-club1").value),
          teamB: Number($("#r-club2").value),
          aet: $("#r-aet").checked,
          ...($("#r-pens").checked
            ? { pens: [Number($("#r-pen1").value), Number($("#r-pen2").value)] }
            : {}),
        };
      else {
        const games = [];
        let blank = false;
        for (const row of $$("[data-game-row]")) {
          const i = Number(row.dataset.gameRow),
            a = $(`#field-score${i}a`).value,
            b = $(`#field-score${i}b`).value;
          if (a === "" && b === "") {
            blank = true;
            continue;
          }
          if (blank || a === "" || b === "")
            throw new Error(
              "Enter both scores in order, stopping when the match is won.",
            );
          const result = { a: Number(a), b: Number(b) };
          if (g.kind === "tennis") {
            const ta = $(`#field-tb${i}a`).value,
              tb = $(`#field-tb${i}b`).value;
            if (ta !== "" || tb !== "") {
              if (ta === "" || tb === "")
                throw new Error("Enter both tiebreak scores.");
              result.tb = [Number(ta), Number(tb)];
            }
          }
          if (g.kind === "smash") {
            Object.assign(result, smashRecorder.read(i));
          }
          games.push(result);
        }
        score = { ...config(), games };
      }
      score.note = $("#r-note").value;
      if (["tt", "tennis", "pickleball"].includes(g.kind)) {
        score.umpire = $("#field-umpire").value;
        if (["tt", "pickleball"].includes(g.kind))
          score.scoreAdjustment = $("#field-score-adjustment").value.trim();
      }
      return {
        played_at:
          editing &&
          playedDate.value === initialPlayedDate &&
          startTime.value === initialStartTime
            ? editing.played_at
            : playedDate.value
              ? new Date(`${playedDate.value}T${startTime.value}`).getTime()
              : null,
        duration_minutes: $("#r-duration").value
          ? Number($("#r-duration").value)
          : null,
        format: recordFormat,
        sides: savedSides || sides(),
        score,
        elo_enabled: $("#r-elo").checked,
        ...(fixed ? { fixture: fixed.f.id } : {}),
      };
    }
    let projectionTimer,
      projectionVersion = 0;
    async function project(version) {
      try {
        const body = read();
        if (body.sides.flat().some((x) => !x))
          throw new Error("Choose all participants.");
        if (editing) delete body.fixture;
        const result = await APP.api(`games/${APP.slug}/preview`, body);
        if (version !== projectionVersion) return;
        if (result.pending) throw new Error(result.message);
        text("#sum-score", result.a + "–" + result.b);
        for (let side = 0; side < 2; side++) {
          text(
            "#sum-elo-name" + (side + 1),
            body.sides[side]
              .map((id) => APP.players.get(id)?.name || "Player")
              .join(" + "),
          );
          const delta = result.sides[side][0].delta;
          text(
            "#sum-elo-delta" + (side + 1),
            (delta >= 0 ? "+" : "") + UI.rating(delta),
          );
        }
        text(
          "#sum-elo-note",
          `Estimate · K ${UI.rating(result.k)} · ${result.weight}× weight. Admin checkoff applies Elo by played date, or entry date when omitted.`,
        );
      } catch (e) {
        if (version !== projectionVersion) return;
        text("#sum-elo-delta1", "—");
        text("#sum-elo-delta2", "—");
        text("#sum-elo-note", e.message);
      }
    }
    function preview() {
      clearTimeout(projectionTimer);
      const version = ++projectionVersion;
      projectionTimer = setTimeout(() => project(version), 350);
      const ss = savedSides || sides();
      for (let s = 0; s < 2; s++) {
        text(
          "#sum-name" + (s + 1) + ",#sum-elo-name" + (s + 1),
          ss[s]
            .map((id) => APP.players.get(id)?.name || "Choose player")
            .join(" + "),
        );
        const team = !setsGame
          ? APP.teams.get(Number($("#r-club" + (s + 1)).value))
          : null;
        text("#sum-club" + (s + 1), team?.code || String(s + 1));
        text(
          "#sum-team" + (s + 1),
          team?.name || (recordFormat === "doubles" ? "Doubles" : "Singles"),
        );
        text(
          "#sum-stars" + (s + 1),
          team ? ` · ${team.overall ?? "Missing"} overall` : "",
        );
      }
      text(
        "#sum-score",
        setsGame
          ? "—"
          : Number($("#r-s1").value) + "–" + Number($("#r-s2").value),
      );
      if (!setsGame) {
        $("#record-fc-score").innerHTML = UI.score({
          participants: ss.flatMap((ids, side) =>
            ids.map((id) => ({
              side,
              name: APP.players.get(id)?.name || "Choose player",
            })),
          ),
          teams: [1, 2].map((n) =>
            APP.teams.get(Number($("#r-club" + n).value)),
          ),
          score: {
            aet: $("#r-aet").checked,
            ...($("#r-pens").checked
              ? {
                  pens: [
                    Number($("#r-pen1").value),
                    Number($("#r-pen2").value),
                  ],
                }
              : {}),
          },
          a_score: Number($("#r-s1").value),
          b_score: Number($("#r-s2").value),
        });
      }
      text("#sum-elo", $("#r-elo").checked ? "Elo on" : "Elo off");
    }
    $$("input", form).forEach((e) => {
      e.defaultValue = e.value;
      e.defaultChecked = e.checked;
    });
    form.addEventListener("reset", () =>
      requestAnimationFrame(() => {
        if ($("#pens-fields")) $("#pens-fields").hidden = !$("#r-pens").checked;
        preview();
      }),
    );
    form.addEventListener("input", preview);
    form.addEventListener("change", preview);
    preview();
    form.onsubmit = async (e) => {
      e.preventDefault();
      const b = $("button[type=submit]", form);
      b.disabled = true;
      try {
        const body = read();
        if (body.sides.flat().some((x) => !x))
          throw new Error("Choose every participant.");
        const m = editing
          ? await APP.api(
              "matches/" + editing.id,
              { ...body, revision: editing.revision },
              "PATCH",
            )
          : await APP.api(`games/${APP.slug}/matches`, body);
        location.href = APP.url("game", { view: "matches", match: m.id });
      } catch (x) {
        text("#record-error", x.message);
      } finally {
        b.disabled = false;
      }
    };
    async function teamPicker(side) {
      const d = $("#team-dialog");
      let selected = APP.teams.get(Number($("#r-club" + side).value)) || null,
        offset = 0,
        gender = selected?.gender.toLowerCase() || "men",
        nation = "",
        league = "",
        request = 0;
      const result = $("#team-results");
      $("#team-search").value = "";
      $("#team-apply").disabled = !selected;
      const syncGender = () =>
        $$("[data-gender]", d).forEach((b) =>
          b.setAttribute("aria-pressed", b.dataset.gender === gender),
        );
      syncGender();
      async function load() {
        const currentRequest = ++request;
        const r = await APP.api(
          `teams/${APP.slug}?q=${encodeURIComponent($("#team-search")?.value || "")}&limit=50&offset=${offset}&gender=${encodeURIComponent(gender)}&nation=${encodeURIComponent(nation)}&league=${encodeURIComponent(league)}`,
        );
        if (currentRequest !== request) return;
        r.rows.forEach((t) => APP.teams.set(t.id, t));
        result.innerHTML =
          r.rows
            .map(
              (t) =>
                `<button class="team-option" type="button" data-team="${t.id}" aria-pressed="${selected?.id === t.id}" title="${esc([t.name, t.league, t.nation, `${t.overall ?? "Missing"} overall`].filter(Boolean).join(" · "))}"><span class="monogram">${esc(t.code)}</span><span class="team-option-copy"><b>${esc(t.name)}</b>${t.league ? `<span>${esc(t.league)}</span>` : ""}<span>${esc([t.nation, `${t.overall ?? "Missing"} overall`].filter(Boolean).join(" · "))}</span></span></button>`,
            )
            .join("") ||
          '<div class="team-empty">No matching teams. Try another search or filter.</div>';
        result.scrollTop = 0;
        text("#team-count", `${r.total} teams`);
        for (const [id, key, val] of [
          ["#team-nation", "nation", nation],
          ["#team-league", "league", league],
        ])
          $(id).innerHTML =
            '<option value="">All</option>' +
            r.filters[key]
              .map(
                (v) =>
                  `<option ${v === val ? "selected" : ""}>${esc(v)}</option>`,
              )
              .join("");
        $$("[data-team]", result).forEach(
          (b) =>
            (b.onclick = () => {
              selected = APP.teams.get(Number(b.dataset.team));
              $$("[data-team]", result).forEach((x) =>
                x.setAttribute("aria-pressed", x === b),
              );
              $("#team-apply").disabled = false;
            }),
        );
        UI.pager($(".dialog-body", d), r, async (o) => {
          offset = o;
          await load();
        });
      }
      if ($("#team-search"))
        $("#team-search").oninput = () => {
          offset = 0;
          load().catch((e) => UI.toast(e.message));
        };
      $("#team-nation").onchange = (e) => {
        nation = e.target.value;
        offset = 0;
        load().catch((e) => UI.toast(e.message));
      };
      $("#team-league").onchange = (e) => {
        league = e.target.value;
        offset = 0;
        load().catch((e) => UI.toast(e.message));
      };
      $$("[data-gender]", d).forEach(
        (b) =>
          (b.onclick = () => {
            gender = b.dataset.gender;
            syncGender();
            offset = 0;
            load().catch((e) => UI.toast(e.message));
          }),
      );
      $("#team-apply").onclick = () => {
        if (!selected) return;
        $("#r-club" + side).value = selected.id;
        text("#team-btn" + side + "-name", selected.name);
        text(
          "#team-btn" + side + "-meta",
          `${selected.league} · ${selected.overall ?? "Missing"} overall`,
        );
        $("#team-btn" + side + " .monogram").textContent = selected.code;
        d.close();
        preview();
      };
      await load();
      d.showModal();
    }
  }
});
