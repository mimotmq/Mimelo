APP.run(async () => {
  const { $, $$, esc, text, select, field } = UI,
    d = $("#comp-dialog");
  if (!d) return;
  const pickleball =
    APP.game.kind === "pickleball" ? await import("./pickleball.js") : null;
  const {
    mountTiebreakEditor,
    mountColumnEditor,
    mountBestOfEditor,
    mountAggregateRounds,
  } = await import("./competition-settings.js");
  let selected = new Map(),
    order = [],
    seeds = new Map(),
    step = 1;
  const extra = document.createElement("div");
  extra.className = "form-section";
  extra.innerHTML =
    select(
      "Match format",
      "competition-format",
      ["tennis", "smash", "pickleball"].includes(APP.game.kind)
        ? [
            ["singles", "Singles"],
            ["doubles", "Doubles"],
          ]
        : [["singles", "Singles"]],
      "singles",
    ) +
    select(
      "Registration",
      "enrollment",
      [
        ["selected", "Organizer-selected"],
        ["open", "Open signup"],
        ["both", "Selected + open signup"],
      ],
      "selected",
    ) +
    field(
      "Signup deadline (your local time)",
      "deadline",
      "",
      "datetime-local",
    ) +
    select(
      "Best of",
      "competition-best",
      APP.game.kind === "tt"
        ? [1, 3, 5, 7].map((n) => [n, n])
        : [1, 3, 5].map((n) => [n, n]),
      3,
    ) +
    (["tt", "pickleball"].includes(APP.game.kind)
      ? select(
          "Points per game",
          "competition-target",
          [[11, 11], ...(pickleball ? [[15, 15]] : []), [21, 21]],
          11,
        )
      : "") +
    (APP.game.kind === "tennis"
      ? '<label class="check"><input id="competition-match-tb" type="checkbox">Doubles: deciding match tiebreak</label>'
      : "") +
    select(
      "Unresolved qualification tie",
      "tie-resolution",
      [
        ["admin", "Admin decision with explanation"],
        ["match", "Extra tiebreak match"],
      ],
      "admin",
    );
  $("#comp-stage-1").append(extra);
  $("#comp-seeding").insertAdjacentHTML(
    "beforeend",
    '<option value="random">Random</option>',
  );
  $("#comp-elo").closest(".field").remove();
  text("#comp-preview-elo", "On by default");
  text(
    "#comp-players-hint",
    "Select entrants now or accept signups after creating the competition. Doubles pairs can be assigned before drawing.",
  );
  d.classList.add("competition-settings-dialog");
  const stage = $("#comp-stage-1");
  const grid = document.createElement("div");
  grid.className = "comp-setup-grid";
  stage.append(grid);
  function section(title, className = "") {
    const section = document.createElement("section");
    section.className = "comp-setup-section " + className;
    section.innerHTML = `<h3>${esc(title)}</h3><div class="comp-setup-fields"></div>`;
    grid.append(section);
    return $(".comp-setup-fields", section);
  }
  const basics = section("Competition", "comp-setup-basics"),
    schedule = section("Schedule", "comp-setup-schedule"),
    scoring = section("Match rules"),
    signup = section("Registration"),
    standings = section("Standings", "comp-setup-standings");
  const moveField = (selector, target) =>
    target.append($(selector).closest(".field"));
  moveField("#comp-name", basics);
  $("#comp-name-hint").textContent = "";
  $("#comp-name").maxLength = 120;
  moveField("#comp-format-label", basics);
  $("#comp-format-label").textContent = "Tournament type";
  $$(".format-option .monogram,.format-option-copy > span", basics).forEach(
    (el) => el.remove(),
  );
  moveField("#field-competition-format", basics);
  $("#field-competition-format").closest(".field").hidden = ![
    "tennis",
    "smash",
    "pickleball",
  ].includes(APP.game.kind);
  $("#comp-league-options").insertAdjacentHTML(
    "beforeend",
    '<p class="hint">For conferences, divisions and crossover games, choose Conferences and schedule on the league page before generating the draw.</p>',
  );
  schedule.append(
    $("#comp-group-options"),
    $("#comp-league-options"),
    $("#comp-knockout-options"),
  );
  $("#comp-group-options").innerHTML =
    field("Groups", "group-count", 2, "number", 'min="1" max="64" step="1"') +
    field(
      "Advance per group",
      "advance-count",
      2,
      "number",
      'min="1" max="128" step="1"',
    ) +
    field(
      "Additional best-placed qualifiers",
      "extra-count",
      0,
      "number",
      'min="0" max="64" step="1"',
    ) +
    field(
      "From finishing position",
      "extra-place",
      3,
      "number",
      'min="2" max="256" step="1"',
    ) +
    '<p class="hint">For a 48-team World Cup format: 12 groups, 2 automatic qualifiers per group, plus the best 8 third-place teams. First-round knockout opponents come from different groups.</p>';
  $("#field-group-count").id = "comp-group-count";
  $('label[for="field-group-count"]').htmlFor = "comp-group-count";
  $("#field-advance-count").id = "comp-advance";
  $('label[for="field-advance-count"]').htmlFor = "comp-advance";
  $("#comp-group-options").className = "comp-number-row";
  const legs = $("#comp-legs").closest("label");
  $(".check-copy", legs).textContent = "Home and away";
  legs.id = "comp-round-robin";
  legs.title = "Play every opponent twice.";
  schedule.prepend(legs);
  $("#comp-league-options > .field-label").remove();
  $("#comp-league-options label.check span").textContent = "League playoffs";
  $("#comp-playoffs").setAttribute("aria-controls", "comp-playoff-options");
  $("#comp-knockout-options").insertAdjacentHTML(
    "beforeend",
    '<label class="check"><input type="checkbox" id="comp-third-place">Third-place match</label>',
  );
  moveField("#field-competition-best", scoring);
  $("#field-competition-best").closest(".field").hidden =
    APP.game.kind === "fc";
  if ($("#field-competition-target"))
    moveField("#field-competition-target", scoring);
  if (pickleball) {
    scoring.insertAdjacentHTML("beforeend", pickleball.scoringHelp);
    pickleball.bindScoring(
      $("#field-competition-best"),
      $("#field-competition-target"),
    );
  }
  if ($("#competition-match-tb"))
    scoring.append($("#competition-match-tb").closest("label"));
  const bestOfStagesRoot = document.createElement("div");
  bestOfStagesRoot.dataset.bestOfStageEditor = "";
  scoring.append(bestOfStagesRoot);
  const bestOfStages = mountBestOfEditor(bestOfStagesRoot);
  const aggregateRoot = document.createElement("div");
  scoring.append(aggregateRoot);
  const aggregate = mountAggregateRounds(aggregateRoot);
  scoring.insertAdjacentHTML(
    "beforeend",
    '<p class="hint">Results count after acceptance. Elo needs a separate admin checkoff.</p>',
  );
  moveField("#field-enrollment", signup);
  moveField("#field-deadline", signup);
  const columnRoot = document.createElement("div");
  standings.append(columnRoot);
  const columns = mountColumnEditor(columnRoot, {
    game: APP.slug,
    settings: {},
  });
  const tieRoot = document.createElement("div");
  standings.append(tieRoot);
  const tieEditor = mountTiebreakEditor(tieRoot, { kind: APP.game.kind });
  const crossRoot = document.createElement("div");
  standings.append(crossRoot);
  const crossEditor = mountTiebreakEditor(crossRoot, {
    kind: APP.game.kind,
    values: ["difference", "for"],
    crossGroup: true,
  });
  moveField("#field-tie-resolution", standings);
  const error = $("#comp-step1-error");
  stage.replaceChildren(grid, error);
  extra.remove();
  $("#comp-stage-2").classList.add("comp-entrants-step");
  $("#comp-stage-2 > .form-section").classList.add("comp-entrants-grid");
  $("#comp-stage-2 .field:has(#comp-players)").classList.add(
    "comp-entrants-players",
  );
  $("#comp-stage-2 .field:has(#comp-seeding)").classList.add(
    "comp-entrants-seeding",
  );
  $$(".demo-note", d).forEach((el) => el.remove());
  const search = document.createElement("input");
  search.className = "input";
  search.type = "search";
  search.placeholder = "Find players by name or handle";
  search.setAttribute("aria-label", "Find competition entrants");
  $("#comp-players").before(search);
  async function loadPlayers(offset = 0) {
    const p = await APP.api(
      "players?offset=" +
        offset +
        "&limit=50&q=" +
        encodeURIComponent(search.value),
    );
    $("#comp-players").innerHTML = p.rows
      .map(
        (p) =>
          `<label class="player-option"><input type="checkbox" value="${p.id}" ${selected.has(p.id) ? "checked" : ""}>${UI.avatar(p.name)}<span class="player-option-copy"><b>${esc(p.name)}</b><span>${p.handle ? "@" + esc(p.handle) : "Fill-in player"}</span></span></label>`,
      )
      .join("");
    $$("input", $("#comp-players")).forEach(
      (box) =>
        (box.onchange = () => {
          const p1 = p.rows.find((p) => p.id === Number(box.value));
          if (box.checked) {
            selected.set(p1.id, p1);
            if (!order.includes(p1.id)) order.push(p1.id);
          } else selected.delete(p1.id);
          preview();
        }),
    );
    let nav = $("#entrant-pager");
    if (!nav) {
      nav = document.createElement("div");
      nav.id = "entrant-pager";
      $("#comp-players").after(nav);
    }
    UI.pager(nav, p, loadPlayers);
  }
  let timer;
  search.oninput = () => {
    clearTimeout(timer);
    timer = setTimeout(
      () => loadPlayers().catch((e) => UI.toast(e.message)),
      200,
    );
  };
  function kind() {
    return $("input[name=comp-format]:checked", d)?.value || "league";
  }
  function preview() {
    const es = order.filter((id) => selected.has(id));
    $("#comp-seed-list").innerHTML = es
      .map(
        (id, i) =>
          `<div class="comp-seed-row"><span>${i + 1}. ${esc(selected.get(id).name)}</span><div>${$("#comp-seeding").value === "manual" ? UI.button("Up", "up", `data-index="${i}" ${i === 0 ? "disabled" : ""}`) + UI.button("Down", "down", `data-index="${i}" ${i === es.length - 1 ? "disabled" : ""}`) : $("#comp-seeding").value === "preseeded" ? `<input class="input" type="number" data-seed="${id}" min="1" value="${seeds.get(id) || i + 1}" aria-label="Seed for ${esc(selected.get(id).name)}">` : ""}</div></div>`,
      )
      .join("");
    $$("[data-index]", d).forEach(
      (b) =>
        (b.onclick = () => {
          const i = Number(b.dataset.index),
            j = i + (b.dataset.action === "up" ? -1 : 1);
          [es[i], es[j]] = [es[j], es[i]];
          order = es;
          preview();
        }),
    );
    text("#comp-preview-format", kind());
    text("#comp-preview-players", selected.size);
    const n = Math.floor(
        selected.size /
          ($("#field-competition-format").value === "doubles" ? 2 : 1),
      ),
      legs = $("#comp-legs").checked ? 2 : 1,
      de = $("#comp-elimination").value === "double",
      thirdPlace = $("#comp-third-place"),
      ko = (k) =>
        k < 2
          ? 0
          : de
            ? 2 * k - 1
            : k - 1 + Number(k >= 4 && thirdPlace.checked);
    thirdPlace.disabled =
      de || (kind() === "league" && !$("#comp-playoffs").checked);
    thirdPlace.closest("label").hidden = thirdPlace.disabled;
    const scoringSettings = {
      gameKind: APP.game.kind,
      kind: kind(),
      playoffs: $("#comp-playoffs").checked,
      elimination: $("#comp-elimination").value,
      format: $("#field-competition-format").value,
      defaultBestOf: Number($("#field-competition-best").value),
    };
    bestOfStages.update(scoringSettings);
    aggregate.update(scoringSettings);
    let fixtures = 0,
      days = 0;
    if (kind() === "knockout") {
      fixtures = ko(n);
      days = n > 1 ? Math.ceil(Math.log2(n)) * (de ? 2 : 1) + (de ? 1 : 0) : 0;
    } else if (kind() === "league") {
      fixtures = ((n * (n - 1)) / 2) * legs;
      days = (n % 2 ? n : n - 1) * legs;
      if ($("#comp-playoffs").checked) {
        const k = Number($("#comp-playoff-count").value);
        fixtures += ko(k);
        days += Math.ceil(Math.log2(k));
      }
    } else {
      const groups = Number($("#comp-group-count").value) || 2;
      for (let i = 0; i < groups; i++) {
        const size = Math.floor(n / groups) + (i < n % groups ? 1 : 0);
        fixtures += ((size * (size - 1)) / 2) * legs;
      }
      const k =
        groups * Number($("#comp-advance").value) +
        Number($("#field-extra-count").value || 0);
      fixtures += ko(k);
      days = Math.ceil(n / groups) * legs + Math.ceil(Math.log2(k));
    }
    text(
      "#comp-preview-fixtures",
      n >= 2 ? fixtures + (de ? " maximum" : " estimated") : "Choose entrants",
    );
    text(
      "#comp-preview-matchdays",
      n >= 2 ? Math.max(0, days) + " rounds estimated" : "After draw",
    );
    $$("[data-seed]", d).forEach(
      (e) =>
        (e.oninput = () => seeds.set(Number(e.dataset.seed), Number(e.value))),
    );
    text(
      "#comp-preview-note",
      "Rules and pairings stay editable until the organizer generates the draw.",
    );
    $("#comp-group-options").hidden = kind() !== "groups";
    crossRoot.hidden =
      kind() !== "groups" || !Number($("#field-extra-count").value);
    $("#field-extra-place").closest(".field").hidden = !Number(
      $("#field-extra-count").value,
    );
    $("#comp-league-options").hidden = kind() !== "league";
    $("#comp-knockout-options").hidden =
      kind() === "league" && !$("#comp-playoffs").checked;
    $("#comp-playoff-options").hidden =
      kind() !== "league" || !$("#comp-playoffs").checked;
    $("#comp-playoffs").setAttribute(
      "aria-expanded",
      String(!$("#comp-playoff-options").hidden),
    );
    text(
      "#comp-knockout-options .field-label",
      kind() === "league" ? "Playoff format" : "Knockout format",
    );
    text(
      "#comp-knockout-options .hint",
      de
        ? "Two losses to go out. The final resets if needed."
        : "One loss to go out.",
    );
    $("#comp-round-robin").hidden = kind() === "knockout";
    standings.closest("section").hidden = kind() === "knockout";
    $("#field-deadline").closest(".field").hidden =
      $("#field-enrollment").value === "selected";
    if ($("#competition-match-tb"))
      $("#competition-match-tb").closest("label").hidden =
        $("#field-competition-format").value !== "doubles";
    text(
      "#comp-format-hint",
      {
        league: "Every entrant plays every other entrant.",
        groups: "Group standings decide who reaches the bracket.",
        knockout: "Winners advance through the bracket.",
      }[kind()],
    );
  }
  function setStep(n) {
    step = n;
    $("#comp-stage-1").hidden = n !== 1;
    $("#comp-stage-2").hidden = n !== 2;
    $("#comp-next").hidden = n !== 1;
    $("#comp-back").hidden = n !== 2;
    $("#comp-create").hidden = n !== 2;
    text(
      "#comp-dialog-sub",
      `Step ${n} of 2 · ${n === 1 ? "Name and rules" : "Entrants and seeding"}`,
    );
    $("#comp-step-1").dataset.state = n === 1 ? "active" : "done";
    $("#comp-step-2").dataset.state = n === 2 ? "active" : "pending";
    preview();
  }
  $("#comp-new").onclick = async () => {
    if (!APP.me) return APP.login();
    selected = new Map();
    order = [];
    seeds = new Map();
    $("#comp-name").value = "";
    $("#comp-name-error").textContent = "";
    $("#comp-step1-error").textContent = "";
    $("#comp-players-error").textContent = "";
    setStep(1);
    await loadPlayers();
    d.showModal();
  };
  $("#comp-name").addEventListener("input", () => text("#comp-name-error", ""));
  $("#comp-next").onclick = () => {
    if (!$("#comp-name").value.trim()) {
      text("#comp-name-error", "Enter a competition name.");
      return;
    }
    text("#comp-name-error", "");
    const deadline = new Date($("#field-deadline").value).getTime();
    if (
      $("#field-enrollment").value !== "selected" &&
      !(deadline > Date.now())
    ) {
      text("#comp-step1-error", "Open signup needs a future deadline.");
      $("#field-deadline").focus();
      return;
    }
    text("#comp-step1-error", "");
    setStep(2);
  };
  $("#comp-back").onclick = () => setStep(1);
  $$(
    "input[name=comp-format],#comp-playoffs,#comp-seeding,#comp-legs,#comp-elimination,#comp-third-place,#comp-group-count,#comp-advance,#comp-playoff-count",
    d,
  ).forEach((e) => (e.onchange = preview));
  $("#field-competition-format").onchange = () => {
    const doubles = $("#field-competition-format").value === "doubles";
    if (APP.game.kind === "tennis") {
      const best = $("#field-competition-best");
      const previous = Number(best.value),
        lengths = doubles ? [1, 3] : [1, 3, 5];
      best.innerHTML = lengths.map((n) => `<option>${n}</option>`).join("");
      best.value = lengths.includes(previous) ? previous : 3;
    }
    preview();
  };
  $("#field-competition-best").addEventListener("change", preview);
  $("#field-enrollment").onchange = preview;
  for (const selector of ["#field-extra-count", "#field-extra-place"]) {
    $(selector).oninput = preview;
    $(selector).onchange = preview;
  }
  $("#comp-select-all").onclick = () => {
    $$("input[type=checkbox]", $("#comp-players")).forEach((x) => {
      if (!x.checked) {
        x.checked = true;
        x.onchange();
      }
    });
  };
  $("#comp-select-none").onclick = () => {
    selected.clear();
    $$("input[type=checkbox]", $("#comp-players")).forEach(
      (x) => (x.checked = false),
    );
    preview();
  };
  async function create() {
    const b = $("#comp-create");
    b.disabled = true;
    try {
      const enrollment = $("#field-enrollment").value,
        deadline = $("#field-deadline").value
          ? new Date($("#field-deadline").value).getTime()
          : null;
      const ids = order.filter((id) => selected.has(id));
      if ($("#comp-seeding").value === "preseeded") {
        const values = ids.map((id, i) => seeds.get(id) || i + 1);
        if (
          new Set(values).size !== values.length ||
          values.some((n) => !Number.isInteger(n) || n < 1)
        )
          throw new Error("Choose distinct positive seed numbers.");
      }
      const c = await APP.api("competitions", {
        game: APP.slug,
        name: $("#comp-name").value,
        kind: kind(),
        format: $("#field-competition-format").value,
        enrollment,
        deadline,
        entries: ids.map((id) => [id]),
        seeds: ids.map((id, i) => seeds.get(id) || i + 1),
        settings: {
          legs: kind() !== "knockout" && $("#comp-legs").checked ? 2 : 1,
          elimination: $("#comp-elimination").value,
          thirdPlace:
            !$("#comp-third-place").disabled && $("#comp-third-place").checked,
          groupCount: Number($("#comp-group-count").value),
          advance: Number($("#comp-advance").value),
          extraCount:
            kind() === "groups" ? Number($("#field-extra-count").value) : 0,
          extraPlace: Number($("#field-extra-place").value),
          extraTieBreaks: crossEditor.read(),
          playoffs: kind() === "league" && $("#comp-playoffs").checked,
          playoffCount: Number($("#comp-playoff-count").value),
          seeding: $("#comp-seeding").value,
          bestOf: Number($("#field-competition-best").value),
          bestOfByStage: bestOfStages.read(),
          aggregateRounds: aggregate.read(),
          target: Number($("#field-competition-target")?.value || 11),
          matchTiebreak:
            $("#field-competition-format").value === "doubles" &&
            !!$("#competition-match-tb")?.checked,
          tableColumns: columns.read(),
          tieBreaks: tieEditor.read(),
          tieResolution: $("#field-tie-resolution").value,
        },
      });
      location.href = APP.url("competition", { id: c.id });
    } catch (e) {
      text("#comp-players-error", e.message);
    } finally {
      b.disabled = false;
    }
  }
  $("#comp-create").onclick = create;
  $("#comp-form").onsubmit = (e) => {
    e.preventDefault();
    if (step === 1) $("#comp-next").click();
    else create();
  };
});
