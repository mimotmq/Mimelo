export function renderHomeResults(band, matches) {
  if (!band) return;
  const { $, esc, score } = UI;
  band.setAttribute("aria-label", "Recently played results across all games");
  const panel = $(".hero-result", band);
  panel.classList.add("recent-results-panel");
  const playedDate = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  panel.innerHTML = `<div class="recent-results-heading"><div><h2>Recently played</h2><p>Across all games · Latest ${matches.length}</p></div><button class="recent-results-pause" type="button" aria-label="Pause automatic scrolling"><span>Pause</span></button></div><div class="recent-results-viewport" tabindex="0" role="region" aria-label="Latest played results"><div class="recent-results-track"><ol class="recent-results-list">${matches
    .map((match) => {
      const game = APP.games.find((game) => game.slug === match.game);
      const played = match.played_at ?? match.submitted;
      return `<li class="recent-result" data-match="${match.id}" data-game="${esc(match.game)}"><a href="${esc(APP.url("game", { game: match.game, view: "matches", match: match.id }))}"><div class="recent-result-meta"><b>${esc(game.name)}</b><time datetime="${new Date(played).toISOString()}" title="${match.played_at != null ? "Played" : "Entered"} ${esc(playedDate.format(played))}">${esc(playedDate.format(played))}</time></div><div class="recent-result-score"><img class="recent-result-watermark" src="assets/brand/${esc(game.logo)}" alt="" aria-hidden="true">${score(match)}</div>${match.competition_name ? `<small class="recent-result-competition">${esc(match.competition_name)}</small>` : ""}</a></li>`;
    })
    .join(
      "",
    )}</ol></div>${matches.length ? "" : '<p class="recent-results-empty">No accepted results yet. Start the record book.</p>'}</div>`;
  const viewport = $(".recent-results-viewport", panel),
    track = $(".recent-results-track", panel),
    list = $(".recent-results-list", panel),
    pause = $(".recent-results-pause", panel),
    reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let manualPause = false,
    hovered = false,
    focused = false,
    onScreen = false;
  function measure() {
    const distance = list.getBoundingClientRect().width;
    // Fill even wide viewports when only two recent results are available.
    const copies =
      matches.length > 1 ? Math.ceil(viewport.clientWidth / distance) : 0;
    if (track.children.length !== copies + 1) {
      track
        .querySelectorAll(".recent-results-copy")
        .forEach((copy) => copy.remove());
      for (let i = 0; i < copies; i++) {
        const copy = list.cloneNode(true);
        copy.classList.add("recent-results-copy");
        copy.setAttribute("aria-hidden", "true");
        copy.querySelectorAll("a").forEach((link) => (link.tabIndex = -1));
        track.append(copy);
      }
    }
    track.style.setProperty("--ticker-distance", `${-distance}px`);
    track.style.setProperty("--ticker-duration", `${distance / 32}s`);
  }
  function sync() {
    pause.hidden = matches.length < 2 || reducedMotion.matches;
    $("span", pause).textContent = manualPause ? "Resume" : "Pause";
    pause.setAttribute(
      "aria-label",
      (manualPause ? "Resume" : "Pause") + " automatic scrolling",
    );
    panel.classList.toggle("is-browsing-results", focused);
    panel.classList.toggle(
      "is-scrolling-results",
      matches.length > 1 &&
        !manualPause &&
        !hovered &&
        !focused &&
        onScreen &&
        !document.hidden &&
        !reducedMotion.matches,
    );
  }
  pause.onclick = () => {
    manualPause = !manualPause;
    sync();
  };
  viewport.addEventListener("pointerenter", (event) => {
    if (event.pointerType !== "mouse") return;
    hovered = true;
    sync();
  });
  viewport.addEventListener("pointerleave", () => {
    hovered = false;
    sync();
  });
  // Clicking a moving link must not reset the strip into keyboard browsing
  // mode between pointerdown and click. Keyboard focus still pauses it.
  viewport.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".recent-result a")) event.preventDefault();
  });
  viewport.addEventListener("focusin", () => {
    focused = true;
    sync();
  });
  viewport.addEventListener("focusout", () =>
    requestAnimationFrame(() => {
      focused = viewport.contains(document.activeElement);
      if (!focused) viewport.scrollLeft = 0;
      sync();
    }),
  );
  reducedMotion.addEventListener("change", sync);
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("pagehide", () =>
    panel.classList.remove("is-scrolling-results"),
  );
  window.addEventListener("pageshow", sync);
  const resize = new ResizeObserver(measure);
  resize.observe(list);
  resize.observe(viewport);
  new IntersectionObserver(
    ([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    },
    { threshold: 0.2 },
  ).observe(viewport);
  measure();
  sync();
}
