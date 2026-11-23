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
