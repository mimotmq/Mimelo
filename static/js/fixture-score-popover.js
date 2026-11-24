export function bindFixtureScorePopover(
  root,
  { findFixture, names, kind, esc },
) {
  const panel = document.createElement("div");
  panel.className = "fixture-score-popover";
  panel.setAttribute("popover", "manual");
  panel.id = `${root.id}-score-popover`;
  panel.hidden = true;
  root.append(panel);
  const abort = new AbortController();
  const { signal } = abort;
  let active, pinned, hideTimer, scrollFrame;
  const title =
    kind === "tennis"
      ? "Set scores"
      : kind === "smash"
        ? "Stocks by game"
        : "Game scores";

  function close() {
    clearTimeout(hideTimer);
    cancelAnimationFrame(scrollFrame);
    active?.button?.setAttribute("aria-expanded", "false");
    if (!panel.hidden) panel.hidePopover();
    panel.hidden = true;
    active = null;
    pinned = false;
  }
  function open(trigger, pin = false) {
    const id = Number(
      trigger.dataset.scorePreview || trigger.dataset.scoreButton,
    );
    const fixture = findFixture(id);
    const games = fixture?.score?.games;
    if (!games?.length) return;
    clearTimeout(hideTimer);
    if (active?.id === id && !pin) return;
    close();
    const card = root.querySelector(`[data-score-preview="${id}"]`);
    if (!card) return;
    const button = root.querySelector(`[data-score-button="${id}"]`);
    active = { id, card, button };
    pinned = pin;
    button?.setAttribute("aria-expanded", "true");
    panel.innerHTML = `<p class="fixture-score-title">${title}</p><table aria-label="${title}"><thead>
      <tr><th scope="col"><span class="sr-only">Entrant</span></th>${games.map((_, i) => `<th scope="col">${i + 1}</th>`).join("")}<th scope="col" class="fixture-score-total">Total</th></tr>
      </thead><tbody>${["a", "b"].map((side, i) => `<tr><th scope="row">${esc(names(fixture, side))}</th>${games.map((game) => `<td${game.winner === i ? ' class="fixture-game-winner"' : ""}>${esc(game[side])}</td>`).join("")}<td class="fixture-score-total">${esc(fixture[side + "_score"])}</td></tr>`).join("")}</tbody></table>`;
    panel.hidden = false;
    panel.showPopover();
    place();
  }
  function place() {
    if (!active) return;
    const { card } = active;
    const anchor = card.getBoundingClientRect();
    const { width, height } = panel.getBoundingClientRect();
    const pageWidth = document.documentElement.clientWidth;
    const pageHeight = document.documentElement.clientHeight;
    const area = card.closest(".bt-viewport")?.getBoundingClientRect();
    if (
      !anchor.width ||
      anchor.right <= Math.max(0, area?.left ?? 0) ||
      anchor.left >= Math.min(pageWidth, area?.right ?? pageWidth) ||
      anchor.bottom <= 0 ||
      anchor.top >= pageHeight
    ) {
      close();
      return;
    }
    const clamp = (value, max) => Math.max(8, Math.min(value, max - 8));
    const gap = 7;
    const placement =
      pageWidth > 640 && anchor.right + gap + width <= pageWidth - 8
        ? "right"
        : pageWidth > 640 && anchor.left - gap - width >= 8
          ? "left"
          : anchor.bottom + gap + height <= pageHeight - 8
            ? "below"
            : "above";
    const beside = placement === "right" || placement === "left";
    const centerX = anchor.left + anchor.width / 2;
    const left = clamp(
      placement === "right"
        ? anchor.right + gap
        : placement === "left"
          ? anchor.left - gap - width
          : centerX - width / 2,
      pageWidth - width,
    );
    const top = clamp(
      beside
        ? anchor.top
        : placement === "below"
          ? anchor.bottom + gap
          : anchor.top - gap - height,
      pageHeight - height,
    );
    panel.dataset.placement = placement;
    panel.style.left = left + "px";
    panel.style.top = top + "px";
    panel.style.setProperty(
      "--score-tip-offset",
      `${Math.max(12, Math.min(centerX - left, width - 12))}px`,
    );
  }
  function hideSoon() {
    if (pinned) return;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(close, 180);
  }
  function activeContains(target) {
    return (
      target instanceof Node &&
      (panel.contains(target) ||
        active?.card.contains(target) ||
        active?.button?.contains(target))
    );
  }
  const control = (target) =>
    target.closest("[data-score-preview], [data-score-button]");
  root.addEventListener(
    "pointerover",
    (e) => {
      if (e.pointerType !== "mouse") return;
      const trigger = control(e.target);
      if (trigger && !pinned) open(trigger);
      if (panel.contains(e.target)) clearTimeout(hideTimer);
    },
    { signal },
  );
  root.addEventListener(
    "pointerout",
    (e) => {
      if (
        e.pointerType === "mouse" &&
        activeContains(e.target) &&
        !activeContains(e.relatedTarget)
      )
        hideSoon();
    },
    { signal },
  );
  root.addEventListener(
    "focusin",
    (e) => {
      if (
        e.target.matches("[data-score-preview]") &&
        e.target.matches(":focus-visible")
      )
        open(e.target);
    },
    { signal },
  );
  root.addEventListener(
    "focusout",
    (e) => {
      if (activeContains(e.target) && !activeContains(e.relatedTarget))
        hideSoon();
    },
    { signal },
  );
  root.addEventListener(
    "click",
    (e) => {
      const button = e.target.closest("[data-score-button]");
      if (button) {
        if (pinned && active?.button === button) close();
        else open(button, true);
      } else if (e.target.closest("[data-score-preview]")) close();
    },
    { signal },
  );
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (active && !activeContains(e.target)) close();
    },
    { signal },
  );
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" && active) close();
    },
    { signal },
  );
  function placeAfterScroll() {
    if (!active) return;
    cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(place);
  }
  window.addEventListener("scroll", placeAfterScroll, {
    capture: true,
    signal,
  });
  window.addEventListener("resize", placeAfterScroll, { signal });
  return {
    close,
    destroy() {
      close();
      abort.abort();
      panel.remove();
    },
  };
}
