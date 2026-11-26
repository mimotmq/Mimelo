function measureName(name) {
  const text = name.querySelector(".fixture-name-text");
  if (!text) return;
  const distance = Math.ceil(text.getBoundingClientRect().width - name.clientWidth);
  const clipped = name.clientWidth > 0 && distance > 1;
  name.toggleAttribute("data-name-overflow", clipped);
  if (clipped) {
    name.style.setProperty("--name-scroll", `${-distance}px`);
    name.style.setProperty("--name-duration", `${Math.max(4, distance / 20 + 3)}s`);
  }
}

export function watchFixtureNames(root) {
  let frame;
  function refresh() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      for (const name of root.querySelectorAll("[data-scroll-name]")) {
        measureName(name);
      }
    });
  }
  const observer = new ResizeObserver(refresh);
  observer.observe(root);
  root.addEventListener("toggle", refresh, true);
  let active = true;
  document.fonts?.ready.then(() => {
    if (active) refresh();
  });
  refresh();
  return {
    refresh,
    destroy() {
      active = false;
      observer.disconnect();
      root.removeEventListener("toggle", refresh, true);
      cancelAnimationFrame(frame);
    },
  };
}

// These labels are rendered again when tabs, search results and scores change.
export function watchPageNames(root) {
  const selector = [
    ".recent-competition strong", ".competition-card h2", ".player-cell .name",
    ".board-player .nm", ".team-option-copy b", ".team-picker-btn b",
    ".player-option-copy b", ".smash-pick-copy b", ".score-player-identity > span:first-child",
    ".game-switcher [data-game-label]", ".elo-projection-row > span",
  ].join(",");
  const sizes = new ResizeObserver((entries) => {
    for (const { target } of entries) measureName(target);
  });
  function attach(label) {
    if (label.classList.contains("fixture-name-text") || !label.textContent || label.children.length) return;
    const inner = document.createElement("span");
    inner.className = "fixture-name-text";
    inner.textContent = label.textContent;
    label.replaceChildren(inner);
    label.title = inner.textContent;
    label.classList.add("fixture-name-frame");
    sizes.observe(label);
    measureName(label);
  }
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.target.matches?.(selector)) attach(record.target);
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches(selector)) attach(node);
        node.querySelectorAll(selector).forEach(attach);
      }
      for (const node of record.removedNodes) {
        if (node.nodeType !== 1 || node.isConnected) continue;
        sizes.unobserve(node);
        node.querySelectorAll(".fixture-name-frame").forEach(label => sizes.unobserve(label));
      }
    }
  });
  root.querySelectorAll(selector).forEach(attach);
  observer.observe(root, { childList: true, subtree: true });
}
