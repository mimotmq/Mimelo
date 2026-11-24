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
export function roundTitle(index, total, pool = "W", round = index + 1) {
  if (pool === "G") return index ? "Final reset" : "Grand final";
  if (pool === "L")
    return index === total - 1 ? "Losers final" : `Losers round ${round}`;
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
  return f.no_contest
    ? "No contest"
    : f.forfeit
      ? "Forfeit"
      : f.match_id
        ? `${s?.pens ? `${f.a_score}(${s.pens[0]})–(${s.pens[1]})${f.b_score}` : `${f.a_score}–${f.b_score}`}${s?.aet ? " a.e.t." : ""}`
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
        heading: roundTitle(ri, groups.length, pool, f.round),
        label:
          pool === "G"
            ? roundTitle(ri, groups.length, pool, f.round)
            : `${roundTitle(ri, groups.length, pool, f.round)
                .replace(/-finals$/, "-final")
                .replace(
                  /finals$/,
                  "final",
                )} ${group.length > 1 ? (pool === "L" ? `· Match ${i + 1}` : i + 1) : ""}`.trim(),
      };
    }),
  );
  return {
    nodes,
    edges: bracketEdges(nodes),
    height,
    width: columns * cardWidth + Math.max(0, columns - 1) * gap,
    mirrored,
    groups,
  };
}

function bracketEdges(nodes, full = false) {
  const byId = new Map(nodes.map((n) => [n.f.id, n]));
  return nodes.flatMap((target) =>
    ["a", "b"].flatMap((side) => {
      const ref = sourceRef(target.f["source_" + side]),
        source = ref && byId.get(ref.fixture);
      if (
        !source ||
        (full && target.f.pool !== "G" && target.f.pool !== source.f.pool)
      )
        return [];
      const dir = target.x > source.x ? 1 : -1;
      const x1 = source.x + (dir === 1 ? source.width : 0),
        x2 = target.x + (dir === 1 ? 0 : target.width);
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
          y2:
            target.y +
            (full && target.f.pool === "G"
              ? 25 +
                (side === "a" ? 0.5 : 1.5) *
                  (target.f.score?.games?.length || target.f.score?.pens
                    ? 38
                    : 48)
              : CARD_HEIGHT / 2),
        },
      ];
    }),
  );
}

function connectedLayout(fixtures, width) {
  const pools = ["W", "L", "G"];
  const byPool = pools.map((pool) => fixtures.filter((f) => f.pool === pool));
  const roundCounts = byPool.map((fs) => new Set(fs.map((f) => f.round)).size);
  const laneColumns = Math.max(roundCounts[0], roundCounts[1]);
  const columns = laneColumns + roundCounts[2];
  const gap = 44;
  const cardWidth = Math.max(
    204,
    Math.min(330, Math.floor((width - 8 - (columns - 1) * gap) / columns)),
  );
  const stride = cardWidth + gap;
  const nodes = [],
    headings = [],
    lanes = [];
  let offsetY = 0,
    round = 0;
  for (const [i, pool] of pools.entries()) {
    const fs = byPool[i];
    if (!fs.length) continue;
    const layout = bracketLayout(fs, { cardWidth, gap, pool });
    const x =
      (pool === "G" ? laneColumns : laneColumns - roundCounts[i]) * stride;
    const feeders =
      pool === "G"
        ? ["a", "b"]
            .map((side) => sourceRef(fs[0]["source_" + side])?.fixture)
            .map((id) => nodes.find((n) => n.f.id === id))
            .filter(Boolean)
        : [];
    const finalY = feeders.length
      ? Math.max(
          0,
          Math.round(
            feeders.reduce((sum, n) => sum + n.y, 0) / feeders.length,
          ) -
            TOP -
            14,
        )
      : 0;
    const y = pool === "G" ? finalY : offsetY;
    if (pool !== "G")
      lanes.push({ pool, x: 0, y, width: laneColumns * stride - gap });
    for (const n of layout.nodes)
      nodes.push({ ...n, x: n.x + x, y: n.y + y + 28, round: n.round + round });
    for (const [j, group] of layout.groups.entries())
      headings.push({
        x: x + j * stride,
        y: y + 28,
        width: cardWidth,
        round: round + j,
        heading: roundTitle(j, layout.groups.length, pool, group[0].round),
        navLabel:
          pool === "W"
            ? "Winners · " + roundTitle(j, layout.groups.length, pool)
            : roundTitle(j, layout.groups.length, pool, group[0].round),
      });
    round += layout.groups.length;
    if (pool !== "G") offsetY += layout.height + 36;
  }
  return {
    nodes,
    headings,
    lanes,
    edges: bracketEdges(nodes, true),
    width: columns * stride - gap,
    height: Math.max(offsetY, ...nodes.map((n) => n.y + n.height + 16)),
  };
}
function connector(e) {
  const middle = (e.x1 + e.x2) / 2,
    dir = Math.sign(e.x2 - e.x1),
    vertical = Math.sign(e.y2 - e.y1);
  const radius = Math.min(
    8,
    Math.abs(e.y2 - e.y1) / 2,
    Math.abs(e.x2 - e.x1) / 2,
  );
  if (!radius) return `M ${e.x1} ${e.y1} H ${e.x2}`;
  return `M ${e.x1} ${e.y1} H ${middle - dir * radius} Q ${middle} ${e.y1} ${middle} ${e.y1 + vertical * radius} V ${e.y2 - vertical * radius} Q ${middle} ${e.y2} ${middle + dir * radius} ${e.y2} H ${e.x2}`;
}

// Lower-bracket slots fed by an upper bye can never have a loser. Follow
// the surviving feeder through those walkovers without changing the draw.
export function visibleBracketFixtures(fixtures) {
  const byId = new Map(fixtures.map((f) => [f.id, f]));
  const bypass = new Map();
  const visible = [];
  for (const fixture of [...fixtures].sort((a, b) => a.id - b.id)) {
    if (fixture.conditional && fixture.status === "cancelled") continue;
    const f = { ...fixture };
    const slots = ["a", "b"].map((side) => {
      let ref = sourceRef(f["source_" + side]);
      let entry = f[side];
      if (ref && bypass.has(ref.fixture)) {
        const prior = ref.outcome === "winner" && bypass.get(ref.fixture);
        entry ??= prior?.entry ?? null;
        ref = prior?.ref || null;
      }
      const source = ref && byId.get(ref.fixture);
      if (source && ["completed", "bye", "cancelled"].includes(source.status)) {
        entry ??= source[ref.outcome];
        if (!entry) ref = null;
      }
      f[side] = entry ?? null;
      f["source_" + side] = ref;
      return entry || ref ? { entry, ref } : null;
    });
    if (
      f.pool === "L" &&
      !f.match_id &&
      !f.forfeit &&
      !f.no_contest &&
      slots.includes(null)
    ) {
      bypass.set(f.id, slots[0] || slots[1]);
    } else visible.push(f);
  }
  return visible;
}

export function renderBracket(container, c, { UI, APP, declareForfeit }) {
  const esc = UI.esc;
  const fixtures = visibleBracketFixtures(
    c.fixtures.filter((f) =>
      ["knockout", "semifinal", "final"].includes(f.stage),
    ),
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
          ["W", "Winners bracket"],
          ["L", "Losers bracket"],
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
  function sideMarkup(f, side, showScore) {
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
      ${showScore ? `<span class="bt-score" aria-label="${esc(f.forfeit ? (won ? "Walkover winner" : "Forfeit") : "Score " + score)}">${esc(score)}</span>` : ""}</span>`;
  }
  function card(n, stacked = false) {
    const f = n.f;
    const state =
      f.status === "bye"
        ? "Advances · bye"
        : f.no_contest
          ? "No contest"
          : f.status === "completed"
            ? f.forfeit
              ? "Forfeit"
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
      f.conditional && f.status === "waiting" ? "Reset if needed" : "",
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
    const games =
      f.match_id && !f.forfeit && !f.no_contest
        ? (f.score?.games || []).map((g) => `${g.a}–${g.b}`)
        : [];
    const scoreType =
      APP.game.kind === "tennis"
        ? "Set scores"
        : APP.game.kind === "smash"
          ? "Stocks by game"
          : "Game scores";
    const total = fixtureScoreText(f);
    const pens = f.score?.pens;
    const scoreStrip = games.length
      ? `<span class="bt-series"><span class="bt-series-games">${games.map((score) => `<span>${esc(score)}</span>`).join("")}</span><strong class="bt-series-total">${esc(total)}</strong></span>`
      : pens
        ? `<strong class="bt-series bt-shootout"><span>${f.a_score}<small class="bt-penalty">(${pens[0]})</small>–<small class="bt-penalty">(${pens[1]})</small>${f.b_score}</span></strong>`
        : "";
    const scoreLabel = pens
      ? `Match score ${f.a_score} to ${f.b_score}. Penalties ${pens[0]} to ${pens[1]}`
      : games.length
        ? `${scoreType}: ${games.join(", ")}. Series result: ${total}`
        : total;
    const aria = `${n.label}: ${entrant(f, "a")} versus ${entrant(f, "b")}. ${scoreLabel}. ${state}${f.match_id ? ". View result" : record ? ". Record result" : ""}`;
    const position = stacked
      ? ""
      : `left:${n.x}px;top:${n.y}px;width:${n.width}px;`;
    const forfeitPosition = stacked
      ? ""
      : `style="left:${n.x + n.width - 10}px;top:${n.y + n.height - 4}px"`;
    return `<${tag} class="bt-match ${scoreStrip ? "bt-with-series" : ""} ${n.right ? "bt-right" : ""} ${f.status === "bye" ? "bt-bye" : ""} ${f.stage === "final" ? "bt-final" : ""} ${f.status === "cancelled" ? "bt-cancelled" : ""}" ${action} ${tag === "article" ? 'tabindex="-1"' : ""} data-bracket-fixture="${f.id}" data-match-round="${n.round}" aria-label="${esc(aria)}" style="${position}height:${n.height}px">
      <span class="bt-match-top"><span>${esc(n.label)}</span>${f.match_id || record ? '<span class="bt-open" aria-hidden="true">↗</span>' : ""}</span>
      ${sideMarkup(f, "a", !scoreStrip)}${sideMarkup(f, "b", !scoreStrip)}
      ${scoreStrip}
      <span class="bt-match-bottom"><span>${esc(f.forfeit ? state : detail || state)}</span>${detail && !f.forfeit ? `<span>${f.result_status === "accepted" ? "Final" : "Pending"}</span>` : ""}</span></${tag}>${record && c.canManage && declareForfeit ? `<button type="button" class="bt-forfeit" ${forfeitPosition} data-bracket-forfeit="${f.id}" aria-label="Declare forfeit for ${esc(entrant(f, "a"))} versus ${esc(entrant(f, "b"))}">Forfeit</button>` : ""}`;
  }
  container.classList.add("bt-root");
  const views = [
    ["all", "Full bracket"],
    ["W", "Winners only"],
    ["L", "Losers only"],
  ].filter(([pool]) => pool === "all" || fixtures.some((f) => f.pool === pool));
  const showViews = c.settings.elimination === "double" && views.length > 1;
  container.innerHTML = `${showViews ? `<nav class="bt-round-nav bt-view-nav" aria-label="Bracket view">${views.map(([pool, label]) => `<button type="button" data-bracket-view="${pool}" aria-pressed="${pool === "all"}">${label}</button>`).join("")}</nav>` : ""}<div class="bt-sections"></div>`;
  const sections = container.querySelector(".bt-sections");
  let selectedView = "all";
  function updateView() {
    for (const button of container.querySelectorAll("[data-bracket-view]"))
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.bracketView === selectedView),
      );
  }
  let previousWidth = -1,
    previousView,
    frame;
  const scrollTimers = new Set();
  const roundNav = (headings, title) =>
    `<nav class="bt-round-nav" aria-label="${title} rounds">${headings.map((n) => `<button type="button" data-bracket-round="${n.round}">${esc(n.navLabel || n.heading)}</button>`).join("")}</nav>`;
  const canvas = (layout, headings = layout.headings) =>
    `<div class="bt-canvas" style="width:${layout.width}px;height:${layout.height}px">
      <svg class="bt-connections" width="${layout.width}" height="${layout.height}" aria-hidden="true">${layout.edges.map((e) => `<path d="${connector(e)}" data-source="${e.source}" data-target="${e.target}" class="${e.active ? "bt-path-active" : ""} ${e.outcome === "loser" ? "bt-path-loser" : ""}"/>`).join("")}</svg>
      ${(layout.lanes || []).map((lane) => `<h3 class="bt-lane-title" style="left:${lane.x}px;top:${lane.y}px;width:${lane.width}px">${lane.pool === "W" ? "Winners bracket" : "Losers bracket"}</h3>`).join("")}
      ${headings.map((n) => `<div class="bt-round" data-round-index="${n.round}" style="left:${n.x}px;top:${n.y || 0}px;width:${n.width}px"><h4>${esc(n.heading)}</h4></div>`).join("")}
      ${layout.nodes.map((n) => card(n)).join("")}
    </div>`;
  function draw() {
    const width = container.clientWidth;
    if (!width || (width === previousWidth && selectedView === previousView))
      return;
    previousWidth = width;
    previousView = selectedView;
    scrollTimers.forEach(clearTimeout);
    scrollTimers.clear();
    const active = document.activeElement?.dataset?.bracketFixture;
    const connected =
      c.settings.elimination === "double" && selectedView === "all";
    if (connected) {
      const layout = connectedLayout(fixtures, width);
      sections.innerHTML = `<section class="bt-section" data-layout="connected">
        ${roundNav(layout.headings, "Full bracket")}
        <div class="bt-viewport" tabindex="0" role="region" aria-label="Full bracket. Scroll across rounds.">${canvas(layout)}</div>
      </section>`;
    } else
      sections.innerHTML = groups
        .filter(([pool]) => selectedView === "all" || selectedView === pool)
        .map(([pool, title]) => {
          const fs = fixtures.filter((f) => (f.pool || "W") === pool);
          if (!fs.length) return "";
          const mirrored = c.settings.elimination !== "double" && width >= 1000;
          const count = new Set(fs.map((f) => f.round)).size;
          const focused = selectedView !== "all";
          const gap = mirrored ? 32 : 44;
          const fitWidth = Math.floor((width - 8 - (count - 1) * gap) / count);
          const stacked = focused && fitWidth < 202;
          const cardWidth = focused
            ? Math.max(202, Math.min(380, fitWidth))
            : mirrored
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
            gap,
            pool,
          });
          const headings = [
            ...new Map(layout.nodes.map((n) => [n.x, { ...n, y: 0 }])).values(),
          ];
          const nav = layout.groups.map((g, i) => ({
            round: i,
            heading: roundTitle(i, layout.groups.length, pool, g[0].round),
          }));
          const view = stacked
            ? "stacked"
            : focused
              ? "expanded"
              : layout.mirrored
                ? "mirrored"
                : "linear";
          return `<section class="bt-section" data-bracket-pool="${pool}" data-layout="${view}">${title ? `<h3 class="bt-section-title">${title}</h3>` : ""}
        ${roundNav(nav, title || "Bracket")}
        <div class="bt-viewport" tabindex="0" role="region" aria-label="${title || "Tournament"} bracket">
          ${
            stacked
              ? `<div class="bt-stacked-rounds">${nav
                  .map(
                    ({ round, heading }) =>
                      `<section><h4>${esc(heading)}</h4><div>${layout.nodes
                        .filter((n) => n.round === round)
                        .map(
                          (n) =>
                            `<div class="bt-stack-slot">${card(n, true)}</div>`,
                        )
                        .join("")}</div></section>`,
                  )
                  .join("")}</div>`
              : canvas(layout, headings)
          }
        </div></section>`;
        })
        .join("");
    updateView();
    for (const section of sections.querySelectorAll(".bt-section")) {
      const viewport = section.querySelector(".bt-viewport"),
        columns = [...section.querySelectorAll(".bt-round")];
      let roundIndex = 0,
        timer;
      const buttons = [...section.querySelectorAll("[data-bracket-round]")];
      function selectRound(index) {
        roundIndex = index;
        for (const button of buttons) {
          if (Number(button.dataset.bracketRound) === index)
            button.setAttribute("aria-current", "step");
          else button.removeAttribute("aria-current");
        }
      }
      selectRound(0);
      let lastLeft = 0;
      for (const button of buttons)
        button.onclick = () => {
          clearTimeout(timer);
          scrollTimers.delete(timer);
          const index = Number(button.dataset.bracketRound);
          const matches = [
            ...section.querySelectorAll(`[data-match-round="${index}"]`),
          ];
          const match = matches.reduce((first, candidate) =>
            candidate.offsetTop < first.offsetTop ? candidate : first,
          );
          if (
            ["stacked", "expanded", "connected"].includes(
              section.dataset.layout,
            )
          )
            match.scrollIntoView({ block: "nearest", inline: "nearest" });
          else
            viewport.scrollTo({
              left: match.offsetLeft,
              top: Math.max(0, match.offsetTop - TOP),
              behavior: "instant",
            });
          lastLeft = viewport.scrollLeft;
          selectRound(index);
          section
            .querySelector("[data-round-target]")
            ?.removeAttribute("data-round-target");
          match.setAttribute("data-round-target", "");
          match.focus({ preventScroll: true });
        };
      if (section.dataset.layout !== "linear") continue;
      viewport.addEventListener("scroll", () => {
        if (lastLeft === viewport.scrollLeft) return;
        lastLeft = viewport.scrollLeft;
        const maxLeft = viewport.scrollWidth - viewport.clientWidth;
        const distance = (col) =>
          Math.abs(Math.min(col.offsetLeft, maxLeft) - lastLeft);
        const next = columns.reduce(
          (best, col, i) =>
            distance(col) < distance(columns[best]) ? i : best,
          roundIndex,
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
          selectRound(next);
          const match = section.querySelector(
            `[data-match-round="${columns[next].dataset.roundIndex}"]`,
          );
          // A later round can be far down a large draw. Bring its first match
          // into view after a horizontal swipe, preserving manual vertical pans.
          viewport.scrollTo({
            top: Math.max(0, match.offsetTop - TOP),
            behavior: "instant",
          });
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
    const view = e.target.closest("[data-bracket-view]");
    if (view) {
      selectedView = view.dataset.bracketView;
      draw();
    }
    const forfeit = e.target.closest("[data-bracket-forfeit]");
    if (forfeit)
      declareForfeit(
        fixtures.find((f) => f.id === Number(forfeit.dataset.bracketForfeit)),
      );
    const result = e.target.closest("[data-result-id]");
    if (result)
      UI.matchDialog(result.dataset.resultId).catch((error) =>
        UI.toast(error.message),
      );
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
