export function tiebreakLabels(kind) {
  return {
    head_to_head: "Head-to-head",
    difference:
      kind === "fc"
        ? "Goal difference"
        : kind === "tennis"
          ? "Set difference"
          : "Game difference",
    for:
      kind === "fc"
        ? "Goals scored"
        : kind === "tennis"
          ? "Sets won"
          : "Games won",
    sets_difference: kind === "tennis" ? "Set difference" : "Game difference",
    points_difference:
      kind === "smash"
        ? "Stock difference"
        : kind === "tennis"
          ? "Game difference"
          : "Point difference",
  };
}

export function mountTiebreakEditor(
  root,
  { kind, values = ["head_to_head", "difference", "for"] },
) {
  const { esc } = UI;
  const labels = tiebreakLabels(kind);
  const available = [
    "head_to_head",
    "difference",
    "for",
    ...(kind === "fc" ? [] : ["points_difference"]),
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
  function render() {
    root.innerHTML = `<h4>Tiebreak order</h4><p class="hint">Apply these rules from top to bottom after equal ${kind === "fc" ? "points" : "wins"}.</p><ol class="tiebreak-list">${order.map((value, index) => `<li class="tiebreak-rule"><span class="tiebreak-position" aria-hidden="true">${index + 1}</span><select class="select" data-tiebreak="${index}" aria-label="Tiebreak ${index + 1}">${available.map((key) => `<option value="${key}" ${key === value ? "selected" : ""} ${key !== value && order.includes(key) ? "disabled" : ""}>${esc(labels[key])}</option>`).join("")}</select><div class="tiebreak-actions"><button type="button" data-move="-1" data-index="${index}" aria-label="Move ${esc(labels[value])} up" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-move="1" data-index="${index}" aria-label="Move ${esc(labels[value])} down" ${index === order.length - 1 ? "disabled" : ""}>↓</button><button type="button" data-remove="${index}" aria-label="Remove ${esc(labels[value])}">×</button></div></li>`).join("")}</ol>${order.length ? "" : '<p class="hint">Equal standings go straight to the tie resolution below.</p>'}<button class="btn btn-ghost btn-sm" type="button" data-add-tiebreak ${order.length === available.length ? "disabled" : ""}>Add tiebreak</button><span class="sr-only" role="status">${order.map((key) => labels[key]).join(" → ") || "No tiebreak rules"}</span>`;
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
