import {
  statCatalog,
  defaultColumns,
  defaultTiebreaks,
  playpassOrder,
} from "./standings-stats.js";

export function tiebreakLabels(kind) {
  const catalog = statCatalog(kind);
  return {
    head_to_head: "Head-to-head",
    points: kind === "fc" ? "Standings points" : "Match wins",
    ...Object.fromEntries(
      Object.entries(catalog).map(([key, [, label]]) => [key, label]),
    ),
    sets_difference: catalog.difference[1],
  };
}

export function mountColumnEditor(root, c, rows = []) {
  const kind = APP.games.find((g) => g.slug === c.game).kind;
  const catalog = statCatalog(kind);
  const defaults = defaultColumns(kind);
  const selected = new Set(c.settings?.tableColumns ?? defaults);
  const order = [...new Set([...defaults, ...Object.keys(catalog)])];
  root.classList.add("standings-table-editor");
  root.innerHTML = `<details><summary>Table columns and preview</summary><div class="standings-column-options">${order.map((key) => `<label><input type="checkbox" value="${key}" ${selected.has(key) ? "checked" : ""}>${catalog[key][1]}</label>`).join("")}</div><div data-table-preview></div></details>`;
  const read = () => order.filter((key) => selected.has(key));
  function preview() {
    const sample = {
      position: 1,
      players: [{ name: "Example entrant" }],
      played: 3,
      w: 2,
      d: 0,
      l: 1,
      points: kind === "fc" ? 6 : 2,
      for: 5,
      against: 3,
      difference: 2,
      points_for: 57,
      points_against: 48,
      points_difference: 9,
    };
    root.querySelector("[data-table-preview]").innerHTML = UI.standingsTable(
      { ...c, settings: { ...c.settings, tableColumns: read() } },
      rows.length ? rows.slice(0, 3) : [sample],
    );
  }
  root.addEventListener("change", (event) => {
    const box = event.target;
    if (!box.matches('input[type="checkbox"]')) return;
    if (box.checked) selected.add(box.value);
    else selected.delete(box.value);
    preview();
  });
  preview();
  return { read };
}

export function bestOfLengths(gameKind, format = "singles") {
  return gameKind === "tt"
    ? [1, 3, 5, 7]
    : gameKind === "tennis" && format === "doubles"
      ? [1, 3]
      : [1, 3, 5];
}

export function mountTiebreakEditor(
  root,
  { kind, values = defaultTiebreaks(kind), crossGroup = false },
) {
  const { esc } = UI;
  const labels = tiebreakLabels(kind);
  const available = [
    ...(crossGroup ? [] : ["head_to_head"]),
    "difference",
    "for",
    ...Object.keys(statCatalog(kind)).filter(
      (key) => !["difference", "for", "points"].includes(key),
    ),
    ...(!crossGroup && (values.includes("points") || kind === "tt")
      ? ["points"]
      : []),
  ];
  // These two stored criteria are equivalent; offer one clear choice.
  let order = [
    ...new Set(
      values.map((value) =>
        value === "sets_difference" ? "difference" : value,
      ),
    ),
  ];
  for (const value of order)
    if (!available.includes(value)) available.push(value);
  root.classList.add("competition-tiebreaks");
  if (crossGroup) root.dataset.crossGroup = "true";
  function render() {
    root.innerHTML = `<h4>${crossGroup ? "Cross-group tiebreak order" : "Tiebreak order"}</h4><p class="hint">${crossGroup ? "Compare raw points (or wins) across groups, including unequal groups, then apply these rules. Remaining ties need an admin decision." : `${order.includes("points") ? "Rank by these statistics in order." : "Apply these rules after equal " + (kind === "fc" ? "points" : "wins") + "."} Fewer losses or scores conceded rank higher.`}</p>${!crossGroup && kind === "tt" ? '<button type="button" class="btn btn-ghost btn-sm" data-playpass>Use Playpass order</button>' : ""}<ol class="tiebreak-list">${order.map((value, index) => `<li class="tiebreak-rule"><span class="tiebreak-position" aria-hidden="true">${index + 1}</span><select class="select" data-tiebreak="${index}" aria-label="Tiebreak ${index + 1}">${available.map((key) => `<option value="${key}" ${key === value ? "selected" : ""} ${key !== value && order.includes(key) ? "disabled" : ""}>${esc(labels[key])}</option>`).join("")}</select><div class="tiebreak-actions"><button type="button" data-move="-1" data-index="${index}" aria-label="Move ${esc(labels[value])} up" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-move="1" data-index="${index}" aria-label="Move ${esc(labels[value])} down" ${index === order.length - 1 ? "disabled" : ""}>↓</button><button type="button" data-remove="${index}" aria-label="Remove ${esc(labels[value])}">×</button></div></li>`).join("")}</ol>${order.length ? "" : '<p class="hint">Equal standings go straight to the tie resolution below.</p>'}<button class="btn btn-ghost btn-sm" type="button" data-add-tiebreak ${order.length === available.length ? "disabled" : ""}>Add tiebreak</button><span class="sr-only" role="status">${order.map((key) => labels[key]).join(" → ") || "No tiebreak rules"}</span>`;
  }
  root.addEventListener("change", (event) => {
    if (!event.target.matches("[data-tiebreak]")) return;
    const index = Number(event.target.dataset.tiebreak);
    order[index] = event.target.value;
    render();
    root.querySelector(`[data-tiebreak="${index}"]`).focus();
  });
  root.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || button.disabled) return;
    let focus = "[data-add-tiebreak]";
    if (button.hasAttribute("data-playpass")) {
      order = [...playpassOrder];
      render();
      root.querySelector("[data-playpass]").focus();
      return;
    }
    if (button.hasAttribute("data-move")) {
      const index = Number(button.dataset.index),
        next = index + Number(button.dataset.move);
      [order[index], order[next]] = [order[next], order[index]];
      focus = `[data-tiebreak="${next}"]`;
    } else if (button.hasAttribute("data-remove"))
      order.splice(Number(button.dataset.remove), 1);
    else if (button.hasAttribute("data-add-tiebreak")) {
      order.push(available.find((key) => !order.includes(key)));
      focus = `[data-tiebreak="${order.length - 1}"]`;
    } else return;
    render();
    root.querySelector(focus)?.focus();
  });
  render();
  return { read: () => [...order] };
}

export function mountBestOfEditor(root, { values = {} } = {}) {
  const labels = {
    league: "League rounds",
    group: "Group stage",
    knockout: "Knockout rounds · default",
    knockoutRound1: "Knockout round 1",
    knockoutRound2: "Knockout round 2",
    knockoutRound3: "Knockout round 3",
    knockoutRound4: "Knockout round 4",
    semifinal: "Semifinals",
    final: "Final",
    grandFinal: "Grand final and reset",
  };
  const overrides = { ...values };
  let active = [],
    options = [],
    fallback = 3,
    visible = true,
    signature = "";
  root.classList.add("competition-best-of-editor");
  function sync() {
    for (const control of root.querySelectorAll("[data-best-of-stage]")) {
      const key = control.dataset.bestOfStage;
      if (control.value) overrides[key] = Number(control.value);
      else delete overrides[key];
    }
  }
  function render() {
    root.hidden = !visible;
    root.innerHTML = `<details><summary>Different best-of lengths by stage</summary><p class="hint">Blank stages use the competition default. Specific knockout rounds override the general knockout setting.</p><div class="competition-best-of-grid">${active
      .map(
        (key) =>
          `<label class="field"><span>${labels[key]}</span><select class="select" data-best-of-stage="${key}" aria-label="${labels[key]}"><option value="">Competition default (${fallback})</option>${options
            .map(
              (length) =>
                `<option value="${length}" ${Number(overrides[key]) === length ? "selected" : ""}>Best of ${length}</option>`,
            )
            .join("")}</select></label>`,
      )
      .join("")}</div></details>`;
  }
  root.addEventListener("change", (event) => {
    const control = event.target.closest("[data-best-of-stage]");
    if (!control) return;
    const key = control.dataset.bestOfStage;
    if (control.value) overrides[key] = Number(control.value);
    else delete overrides[key];
  });
  function update({
    gameKind,
    kind = "league",
    playoffs = false,
    elimination = "single",
    format = "singles",
    defaultBestOf = 3,
  }) {
    sync();
    const nextOptions = bestOfLengths(gameKind, format);
    const hasKnockout =
      kind === "groups" ||
      kind === "knockout" ||
      (kind === "league" && playoffs);
    const nextActive = [];
    if (kind === "league") nextActive.push("league");
    if (kind === "groups") nextActive.push("group");
    if (hasKnockout)
      nextActive.push(
        "knockout",
        "knockoutRound1",
        "knockoutRound2",
        "knockoutRound3",
        "knockoutRound4",
        "semifinal",
        "final",
      );
    if (hasKnockout && elimination === "double") nextActive.push("grandFinal");
    const nextVisible = gameKind !== "fc";
    const nextSignature = JSON.stringify([
      nextActive,
      nextOptions,
      Number(defaultBestOf) || 3,
      nextVisible,
    ]);
    active = nextActive;
    options = nextOptions;
    fallback = Number(defaultBestOf) || 3;
    visible = nextVisible;
    if (signature !== nextSignature) {
      signature = nextSignature;
      for (const key of Object.keys(overrides))
        if (!options.includes(Number(overrides[key]))) delete overrides[key];
      render();
    }
  }
  return {
    read() {
      sync();
      return Object.fromEntries(
        Object.entries(overrides).filter(
          ([key, value]) =>
            active.includes(key) && options.includes(Number(value)),
        ),
      );
    },
    update,
  };
}
