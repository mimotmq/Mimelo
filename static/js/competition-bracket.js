const CARD_HEIGHT = 148,
  PITCH = 176,
  TOP = 52;
export function sourceRef(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
export function roundTitle(index, total, pool = "W") {
  if (pool === "G") return index ? "Final reset" : "Grand final";
  if (pool === "L")
    return index === total - 1 ? "Lower final" : `Lower round ${index + 1}`;
  const remaining = total - index;
  return remaining === 1
    ? "Final"
    : remaining === 2
      ? "Semi-finals"
      : remaining === 3
        ? "Quarter-finals"
        : `Round of ${2 ** remaining}`;
}
export function fixtureScoreText(f) {
  const s = typeof f.score === "string" ? sourceRef(f.score) : f.score;
  return f.forfeit
    ? "Walkover"
    : f.match_id
      ? `${f.a_score}–${f.b_score}${s?.pens ? ` (${s.pens.join("–")} pens)` : ""}${s?.aet ? " a.e.t." : ""}`
      : f.status === "bye"
        ? "Bye"
        : "—";
}

// Generated draws retain every slot, including byes. Keep their positions so
// advancement lines follow source fixture IDs rather than a visual approximation.
export function bracketLayout(
  fixtures,
  { mirrored = false, cardWidth = 240, gap = 36, pool = "W" } = {},
) {
  const rounds = [...new Set(fixtures.map((f) => f.round))].sort(
    (a, b) => a - b,
  );
  const groups = rounds.map((r) =>
    fixtures.filter((f) => f.round === r).sort((a, b) => a.id - b.id),
  );
  mirrored =
    mirrored && groups.length > 1 && groups.at(-1).length === 1 && pool === "W";
  const base = Math.max(1, ...groups.map((g) => g.length)) / (mirrored ? 2 : 1);
  const height = TOP + base * PITCH + 12;
  const columns = mirrored ? groups.length * 2 - 1 : groups.length;
  const nodes = groups.flatMap((group, ri) =>
    group.map((f, i) => {
      const final = mirrored && ri === groups.length - 1;
      const half = mirrored && !final ? group.length / 2 : group.length;
      const right = mirrored && !final && i >= half;
      const col = right ? columns - 1 - ri : ri;
      const local = right ? i - half : i;
      const center = final
        ? TOP + (base * PITCH) / 2
        : TOP + (((local + 0.5) * base) / half) * PITCH;
      return {
        f,
        x: col * (cardWidth + gap),
        y: center - CARD_HEIGHT / 2,
        width: cardWidth,
        height: CARD_HEIGHT,
        right,
        round: ri,
        heading: roundTitle(ri, groups.length, pool),
        label:
          pool === "G"
            ? roundTitle(ri, groups.length, pool)
            : `${roundTitle(ri, groups.length, pool)
                .replace(/-finals$/, "-final")
                .replace(
                  /finals$/,
                  "final",
                )} ${group.length > 1 ? i + 1 : ""}`.trim(),
      };
    }),
  );
  const byId = new Map(nodes.map((n) => [n.f.id, n]));
  const edges = nodes.flatMap((target) =>
    ["a", "b"].flatMap((side) => {
      const ref = sourceRef(target.f["source_" + side]),
        source = ref && byId.get(ref.fixture);
      if (!source) return [];
      const dir = target.x > source.x ? 1 : -1;
      const x1 = source.x + (dir === 1 ? cardWidth : 0),
        x2 = target.x + (dir === 1 ? 0 : cardWidth);
      return [
        {
          source: source.f.id,
          target: target.f.id,
          outcome: ref.outcome,
          active:
            source.f.winner != null &&
            !["cancelled", "waiting"].includes(source.f.status),
          x1,
          x2,
          y1: source.y + CARD_HEIGHT / 2,
          y2: target.y + CARD_HEIGHT / 2,
        },
      ];
    }),
  );
  return {
    nodes,
    edges,
    height,
    width: columns * cardWidth + Math.max(0, columns - 1) * gap,
    mirrored,
    groups,
  };
}
function connector(e) {
  const middle = (e.x1 + e.x2) / 2,
    dir = Math.sign(e.x2 - e.x1),
    vertical = Math.sign(e.y2 - e.y1);
  const radius = Math.min(8, Math.abs(e.y2 - e.y1) / 2);
  if (!radius) return `M ${e.x1} ${e.y1} H ${e.x2}`;
  return `M ${e.x1} ${e.y1} H ${middle - dir * radius} Q ${middle} ${e.y1} ${middle} ${e.y1 + vertical * radius} V ${e.y2 - vertical * radius} Q ${middle} ${e.y2} ${middle + dir * radius} ${e.y2} H ${e.x2}`;
}

export function renderBracket(container, c, { UI, APP }) {
  const esc = UI.esc;
  const fixtures = c.fixtures.filter((f) =>
    ["knockout", "semifinal", "final"].includes(f.stage),
  );
  if (!fixtures.length) {
    container.innerHTML = UI.empty(
      c.kind === "league" && !c.settings.playoffs
        ? "This league has no knockout stage."
        : "The bracket appears after registration or qualification is complete.",
    );
    return () => {};
  }
  const entries = new Map(c.entries.map((e) => [e.id, e]));
  const doubles = c.format === "doubles",
    fc = APP.game.kind === "fc",
    racket = ["tennis", "tt", "pickleball"].includes(APP.game.kind);
  const groups =
    c.settings.elimination === "double"
      ? [
          ["W", "Upper bracket"],
          ["L", "Lower bracket"],
          ["G", "Grand finals"],
        ]
      : [["W", ""]];
  const labels = new Map();
  for (const [pool] of groups) {
    const fs = fixtures.filter((f) => (f.pool || "W") === pool);
    for (const n of bracketLayout(fs, { pool }).nodes)
      labels.set(n.f.id, n.label);
  }
  function entrant(f, side) {
    const id = f[side],
      entry = entries.get(id),
      ref = sourceRef(f["source_" + side]);
    if (entry) return entry.players.map((p) => p.name).join(" + ");
    if (ref)
      return `${ref.outcome === "loser" ? "Loser" : "Winner"} of ${labels.get(ref.fixture) || "match " + ref.fixture}`;
    return f.status === "bye" ? "Bye" : "To be decided";
  }
  function sideMarkup(f, side) {
    const n = side === "a" ? 0 : 1,
      entry = entries.get(f[side]);
    const won = f.winner != null && f[side] != null && f.winner === f[side];
    const team = f.teams?.[n],
      score =
        f.match_id && !f.forfeit
          ? n === 0
            ? f.a_score
            : f.b_score
          : f.forfeit
            ? won
              ? "W"
              : "L"
            : "—";
    const photos = entry
      ? entry.players
          .map((p) => UI.avatar(p.name, "avatar-sm", p.photo))
          .join("")
      : '<span class="bt-avatar-placeholder" aria-hidden="true">' +
        (f.status === "bye" ? "–" : "?") +
        "</span>";
    const identity =
      racket && entry
        ? entry.players
            .map(
              (player) =>
                `<span class="bt-racket-person"><span class="bt-racket-name">${esc(player.name)}</span>${UI.nationalityFlags(player)}</span>`,
            )
            .join("")
        : esc(entrant(f, side));
    return `<span class="bt-side ${won ? "bt-winner" : ""} ${entry ? "" : "bt-unresolved"}" data-entry="${f[side] || ""}">
      <span class="bt-player"><span class="bt-avatars ${doubles ? "bt-pair" : ""}" aria-hidden="true">${photos}</span><span class="bt-player-name ${racket && entry ? "bt-racket-identity" : ""}" title="${esc(entrant(f, side))}">${identity}</span></span>
      ${fc ? `<span class="bt-team" title="${esc(team?.name || "Club not recorded")}" aria-label="${esc(team?.name || "Club not recorded")}">${team?.image ? `<img src="${esc(team.image)}" alt="" loading="lazy">` : `<span class="bt-club-code">${esc(team?.code || "—")}</span>`}</span>` : ""}
      <span class="bt-score" aria-label="${esc(f.forfeit ? (won ? "Walkover winner" : "Forfeit") : "Score " + score)}">${esc(score)}${f.score?.pens ? `<small class="bt-penalty" aria-label="${f.score.pens[n]} penalties">${f.score.pens[n]}</small>` : ""}</span></span>`;
  }
  function card(n) {
    const f = n.f;
    const state =
      f.status === "bye"
        ? "Advances · bye"
        : f.status === "completed"
          ? f.forfeit
            ? "Walkover"
            : "Final score"
          : f.status === "cancelled"
            ? "Not required"
            : f.match_id
              ? "Awaiting acceptance"
              : f.status === "ready"
                ? "Ready to play"
                : "Upcoming";
    const detail = [
      f.score?.aet ? "a.e.t." : "",
      f.score?.pens ? "Penalties" : "",
      f.conditional ? "Reset if needed" : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const record = f.status === "ready" && !f.match_id;
    const tag = f.match_id ? "button" : record ? "a" : "article";
    const action = f.match_id
      ? `type="button" data-result-id="${f.match_id}"`
      : record
        ? `href="${esc(APP.url("game", { view: "record", fixture: f.id, competition: c.id }))}"`
        : "";
    const aria = `${n.label}: ${entrant(f, "a")} versus ${entrant(f, "b")}. ${fixtureScoreText(f)}. ${state}${f.match_id ? ". View result" : record ? ". Record result" : ""}`;
    return `<${tag} class="bt-match ${n.right ? "bt-right" : ""} ${f.status === "bye" ? "bt-bye" : ""} ${f.stage === "final" ? "bt-final" : ""} ${f.status === "cancelled" ? "bt-cancelled" : ""}" ${action} data-bracket-fixture="${f.id}" data-match-round="${n.round}" aria-label="${esc(aria)}" style="left:${n.x}px;top:${n.y}px;width:${n.width}px;height:${n.height}px">
      <span class="bt-match-top"><span>${esc(n.label)}</span>${f.match_id || record ? '<span class="bt-open" aria-hidden="true">↗</span>' : ""}</span>
      ${sideMarkup(f, "a")}${sideMarkup(f, "b")}
      <span class="bt-match-bottom"><span>${esc(detail || state)}</span>${detail ? `<span>${f.result_status === "accepted" ? "Final" : "Pending"}</span>` : ""}</span></${tag}>`;
  }
  container.classList.add("bt-root");
  container.innerHTML = `<div class="bt-intro"><span>${c.settings.elimination === "double" ? "Two paths. One champion." : "The road to the final"}</span><span class="bt-hint">Swipe to follow each round <span aria-hidden="true">→</span></span></div><div class="bt-sections"></div>${fc ? '<p class="bt-legend">Club crests show the teams used in each recorded match. Small score numbers show penalties.</p>' : ""}`;
  const sections = container.querySelector(".bt-sections");
  let previousWidth = -1,
    frame;
  const scrollTimers = new Set();
  function draw() {
    const width = container.clientWidth;
    if (!width || width === previousWidth) return;
    previousWidth = width;
    scrollTimers.forEach(clearTimeout);
    scrollTimers.clear();
    const active = document.activeElement?.dataset?.bracketFixture;
    sections.innerHTML = groups
      .map(([pool, title]) => {
        const fs = fixtures.filter((f) => (f.pool || "W") === pool);
        if (!fs.length) return "";
        const mirrored = c.settings.elimination !== "double" && width >= 1000;
        const count = new Set(fs.map((f) => f.round)).size;
        const cardWidth = mirrored
          ? Math.max(
              208,
              Math.min(
                270,
                (width - Math.max(0, count * 2 - 2) * 32) / (count * 2 - 1),
              ),
            )
          : Math.min(300, Math.max(224, width - 32));
        const layout = bracketLayout(fs, {
          mirrored,
          cardWidth,
          gap: mirrored ? 32 : 44,
          pool,
        });
        const headings = [
          ...new Map(layout.nodes.map((n) => [n.x, n])).values(),
        ];
        return `<section class="bt-section" data-bracket-pool="${pool}" data-layout="${layout.mirrored ? "mirrored" : "linear"}">${title ? `<h3 class="bt-section-title">${title}</h3>` : ""}
        <nav class="bt-round-nav" aria-label="${title || "Bracket"} rounds">${layout.groups.map((g, i) => `<button type="button" data-bracket-round="${i}">${esc(roundTitle(i, layout.groups.length, pool))}</button>`).join("")}</nav>
        <div class="bt-viewport" tabindex="0" role="region" aria-label="${title || "Tournament"} bracket. Scroll across rounds." style="--bt-stride:${cardWidth + 44}px">
        <div class="bt-canvas" style="width:${layout.width}px;height:${layout.height}px">
          <svg class="bt-connections" width="${layout.width}" height="${layout.height}" aria-hidden="true">${layout.edges.map((e) => `<path d="${connector(e)}" data-source="${e.source}" data-target="${e.target}" class="${e.active ? "bt-path-active" : ""} ${e.outcome === "loser" ? "bt-path-loser" : ""}"/>`).join("")}</svg>
          ${headings.map((n) => `<div class="bt-round" data-round-index="${n.round}" style="left:${n.x}px;width:${cardWidth}px;height:${layout.height}px"><h4>${esc(n.heading)}</h4></div>`).join("")}
          ${layout.nodes.map(card).join("")}
        </div></div></section>`;
      })
      .join("");
    for (const section of sections.querySelectorAll(
      '.bt-section[data-layout="linear"]',
    )) {
      const viewport = section.querySelector(".bt-viewport"),
        columns = [...section.querySelectorAll(".bt-round")];
      let roundIndex = 0,
        timer;
      section
        .querySelector('[data-bracket-round="0"]')
        ?.setAttribute("aria-current", "step");
      viewport.addEventListener("scroll", () => {
        const next = columns.reduce(
          (best, col, i) =>
            Math.abs(col.offsetLeft - viewport.scrollLeft) <
            Math.abs(columns[best].offsetLeft - viewport.scrollLeft)
              ? i
              : best,
          0,
        );
        if (next === roundIndex) {
          clearTimeout(timer);
          scrollTimers.delete(timer);
          return;
        }
        clearTimeout(timer);
        scrollTimers.delete(timer);
        timer = setTimeout(() => {
          scrollTimers.delete(timer);
          roundIndex = next;
          const match = section.querySelector(
            `[data-match-round="${columns[next].dataset.roundIndex}"]`,
          );
          // A later round can be far down a large draw. Bring its first match
          // into view after a horizontal swipe, preserving manual vertical pans.
          viewport.scrollTo({
            top: Math.max(0, match.offsetTop - TOP),
            behavior: "instant",
          });
          for (const button of section.querySelectorAll(
            "[data-bracket-round]",
          )) {
            if (
              button.dataset.bracketRound === columns[next].dataset.roundIndex
            )
              button.setAttribute("aria-current", "step");
            else button.removeAttribute("aria-current");
          }
        }, 160);
        scrollTimers.add(timer);
      });
    }
    if (active)
      sections
        .querySelector(`[data-bracket-fixture="${Number(active)}"]`)
        ?.focus({ preventScroll: true });
  }
  function click(e) {
    const result = e.target.closest("[data-result-id]");
    if (result)
      UI.matchDialog(result.dataset.resultId).catch((error) =>
        UI.toast(error.message),
      );
    const round = e.target.closest("[data-bracket-round]");
    if (round) {
      const section = round.closest(".bt-section"),
        column = section.querySelector(
          `[data-round-index="${round.dataset.bracketRound}"]`,
        );
      section.querySelector(".bt-viewport").scrollTo({
        left: column.offsetLeft,
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    }
  }
  container.addEventListener("click", click);
  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  });
  observer.observe(container);
  draw();
  return () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
    container.removeEventListener("click", click);
    scrollTimers.forEach(clearTimeout);
    scrollTimers.clear();
  };
}
