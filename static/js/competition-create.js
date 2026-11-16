APP.run(async () => {
  const { $, $$, esc, text, select, field } = UI,
    d = $("#comp-dialog");
  if (!d) return;
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
      ["tennis", "smash"].includes(APP.game.kind)
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
    (APP.game.kind === "tt"
      ? select(
          "Points per game",
          "competition-target",
          [
            [11, 11],
            [21, 21],
          ],
          11,
        )
      : "") +
    (APP.game.kind === "tennis"
      ? '<label class="check"><input id="competition-match-tb" type="checkbox">Doubles: deciding match tiebreak</label>'
      : "") +
    field(
      "Tiebreak order (comma-separated)",
      "tie-order",
      "head_to_head,difference,for",
    ) +
    '<p class="hint">Available: head_to_head, difference, for, sets_difference, points_difference. Order is frozen when play starts.</p>' +
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
  $("#comp-elo").closest("label").remove();
  text("#comp-preview-elo", "On by default");
  text(
    "#comp-players-hint",
    "Select entrants now or accept signups after creating the competition. Doubles pairs can be assigned before drawing.",
  );
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
      ko = (k) => (k < 2 ? 0 : de ? 2 * k - 1 : k - 1);
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
      const k = groups * Number($("#comp-advance").value);
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
    $("#comp-league-options").hidden = kind() !== "league";
    $("#comp-knockout-options").hidden =
      kind() === "league" && !$("#comp-playoffs").checked;
    $("#comp-playoff-options").hidden = !$("#comp-playoffs").checked;
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
    $("#comp-players-error").textContent = "";
    setStep(1);
    await loadPlayers();
    d.showModal();
  };
  $("#comp-next").onclick = () => {
    if (!$("#comp-name").value.trim()) {
      text("#comp-name-error", "Enter a competition name.");
      return;
    }
    setStep(2);
  };
  $("#comp-back").onclick = () => setStep(1);
  $$(
    "input[name=comp-format],#comp-playoffs,#comp-seeding,#comp-legs,#comp-elimination,#comp-group-count,#comp-advance,#comp-playoff-count",
    d,
  ).forEach((e) => (e.onchange = preview));
  $("#field-competition-format").onchange = () => {
    const doubles = $("#field-competition-format").value === "doubles";
    if (APP.game.kind === "tennis")
      $("#field-competition-best").innerHTML = (doubles ? [1, 3] : [1, 3, 5])
        .map((n) => `<option>${n}</option>`)
        .join("");
  };
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
          legs: $("#comp-legs").checked ? 2 : 1,
          elimination: $("#comp-elimination").value,
          groupCount: Number($("#comp-group-count").value),
          advance: Number($("#comp-advance").value),
          playoffs: $("#comp-playoffs").checked,
          playoffCount: Number($("#comp-playoff-count").value),
          seeding: $("#comp-seeding").value,
          bestOf: Number($("#field-competition-best").value),
          target: Number($("#field-competition-target")?.value || 11),
          matchTiebreak: !!$("#competition-match-tb")?.checked,
          tieBreaks: $("#field-tie-order")
            .value.split(",")
            .map((x) => x.trim())
            .filter(Boolean),
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
