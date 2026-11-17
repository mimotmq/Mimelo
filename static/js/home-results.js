export function renderHomeResults(band, matches) {
  if (!band) return;
  const { $, $$, esc, icon } = UI;
  band.setAttribute("aria-label", "Recently accepted results across all games");
  const panel = $(".hero-result", band);
  panel.classList.add("recent-results-panel");
  const acceptedDate = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  panel.innerHTML = `<div class="recent-results-heading"><div><h2>Recently accepted</h2><p>Across all games · Latest ${matches.length}</p></div><button class="recent-results-pause" type="button" aria-label="Pause automatic scrolling"><span>Pause</span></button></div><div class="recent-results-viewport" tabindex="0" role="region" aria-label="Latest accepted results"><ol class="recent-results-list">${matches
    .map((match) => {
      const game = APP.games.find((game) => game.slug === match.game);
      const side = (n) =>
        match.participants
          .filter((player) => player.side === n)
          .map((player) => player.name)
          .join(" + ");
      const details = [
        match.format === "doubles" ? "Doubles" : "Singles",
        match.competition_name,
        match.forfeit ? "Forfeit" : "",
        match.score.aet ? "a.e.t." : "",
        match.score.pens ? match.score.pens.join("–") + " pens" : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return `<li class="recent-result" data-match="${match.id}" data-game="${esc(match.game)}"><a href="${esc(APP.url("game", { game: match.game, view: "matches", match: match.id }))}"><img class="recent-result-logo" src="assets/brand/${esc(game.logo)}" alt=""><div class="recent-result-copy"><div class="recent-result-meta"><b>${esc(game.name)}</b><time datetime="${new Date(match.accepted).toISOString()}" title="Accepted ${esc(acceptedDate.format(match.accepted))}">${esc(acceptedDate.format(match.accepted))}</time></div><div class="recent-result-score"><span>${esc(side(0))}</span><strong>${match.forfeit ? (match.winner === 0 ? "W–L" : "L–W") : `${match.a_score}–${match.b_score}`}</strong><span>${esc(side(1))}</span></div><small>${esc(details)}</small></div><span class="recent-result-arrow" aria-hidden="true">${icon("arrow", 16)}</span></a></li>`;
    })
    .join(
      "",
    )}</ol>${matches.length ? "" : '<p class="recent-results-empty">No accepted results yet. Start the record book.</p>'}</div>`;
  const viewport = $(".recent-results-viewport", panel),
    list = $(".recent-results-list", panel),
    pause = $(".recent-results-pause", panel),
    reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let timer,
    manualPause = false,
    hovered = false,
    focused = false,
    onScreen = false;
  function advance() {
    const maximum = viewport.scrollHeight - viewport.clientHeight;
    const next = $$(".recent-result", list)
      .map((row) => row.offsetTop)
      .find((top) => top > viewport.scrollTop + 2 && top <= maximum);
    const top = next ?? (viewport.scrollTop < maximum - 2 ? maximum : 0);
    viewport.scrollTo({ top, behavior: "smooth" });
  }
  function sync() {
    clearInterval(timer);
    pause.hidden = matches.length < 3 || reducedMotion.matches;
    $("span", pause).textContent = manualPause ? "Resume" : "Pause";
    pause.setAttribute(
      "aria-label",
      (manualPause ? "Resume" : "Pause") + " automatic scrolling",
    );
    if (
      matches.length > 2 &&
      !manualPause &&
      !hovered &&
      !focused &&
      onScreen &&
      !document.hidden &&
      !reducedMotion.matches
    )
      timer = setInterval(advance, 4500);
  }
  pause.onclick = () => {
    manualPause = !manualPause;
    sync();
  };
  panel.addEventListener("pointerenter", () => {
    hovered = true;
    sync();
  });
  panel.addEventListener("pointerleave", () => {
    hovered = false;
    sync();
  });
  panel.addEventListener("focusin", () => {
    focused = true;
    sync();
  });
  panel.addEventListener("focusout", () =>
    requestAnimationFrame(() => {
      focused = panel.contains(document.activeElement);
      sync();
    }),
  );
  viewport.addEventListener(
    "touchstart",
    () => {
      manualPause = true;
      sync();
    },
    { passive: true },
  );
  reducedMotion.addEventListener("change", sync);
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("pagehide", () => clearInterval(timer));
  window.addEventListener("pageshow", sync);
  new IntersectionObserver(
    ([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    },
    { threshold: 0.2 },
  ).observe(viewport);
  sync();
}
