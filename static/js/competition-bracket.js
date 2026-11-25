import { bracketSeeds } from "./bracket-picks.js";
import { bindFixtureScorePopover } from "./fixture-score-popover.js";
import { watchFixtureNames } from "./fixture-names.js";

const CARD_HEIGHT = 148,
  PITCH = 176,
  TOP = 52;
export const seedBadge = (seed) =>
  `<span class="bt-seed" aria-label="Seed ${seed}" title="Seed ${seed}">${seed}</span>`;
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
  if (pool === "P") return "Third-place match";
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
      ? s?.games?.length
        ? `${f.a_score}–${f.b_score} · Forfeit`
        : "Forfeit"
      : f.match_id
        ? `${s?.pens ? `${f.a_score} (${s.pens[0]})–${f.b_score} (${s.pens[1]})` : `${f.a_score}–${f.b_score}${s?.aet ? " a.e.t." : ""}`}${s?.legScores ? " agg." : ""}`
        : f.status === "bye"
          ? "Bye"
          : "—";
}

// Keep fixture order and source IDs when compressing the spaces left by byes.
export function bracketLayout(
  fixtures,
  {
    mirrored = false,
    cardWidth = 240,
    gap = 36,
    pool = "W",
    compact = false,
  } = {},
) {
  const rounds = [...new Set(fixtures.map((f) => f.round))].sort(
    (a, b) => a - b,
  );
  const groups = rounds.map((r) =>
    fixtures.filter((f) => f.round === r).sort((a, b) => a.id - b.id),
  );
  mirrored =
    mirrored && groups.length > 1 && groups.at(-1).length === 1 && pool === "W";
  const visibleSlots = compact
    ? groups.map((group) => {
        const half = Math.ceil(group.length / 2);
        const lanes = mirrored
          ? [group.slice(0, half), group.slice(half)]
          : [group];
        return lanes.map(
          (lane) => new Map(
            lane.filter((f) => f.status !== "bye").map((f, i) => [f.id, i]),
          ),
        );
      })
    : null;
  const base = visibleSlots
    ? Math.max(1, ...visibleSlots.flat().map((lane) => lane.size))
    : Math.max(1, ...groups.map((g) => g.length)) / (mirrored ? 2 : 1);
  const pitch = compact ? 136 : PITCH;
  const cardHeight = compact ? 122 : CARD_HEIGHT;
  const height = TOP + base * pitch + 12;
  const columns = mirrored ? groups.length * 2 - 1 : groups.length;
  const nodes = groups.flatMap((group, ri) =>
    group.map((f, i) => {
      const final = mirrored && ri === groups.length - 1;
      const half = mirrored && !final ? group.length / 2 : group.length;
      const right = mirrored && !final && i >= half;
      const col = right ? columns - 1 - ri : ri;
      const local = right ? i - half : i;
      const slots = visibleSlots?.[ri][right ? 1 : 0];
      const position = slots ? slots.get(f.id) ?? 0 : local;
      const laneSize = slots ? Math.max(1, slots.size) : half;
      const center = final
        ? TOP + (base * pitch) / 2
        : TOP + (((position + 0.5) * base) / laneSize) * pitch;
      return {
        f,
        x: col * (cardWidth + gap),
        y: center - cardHeight / 2,
        width: cardWidth,
        height: cardHeight,
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
      const sideHeight = target.height === CARD_HEIGHT ? 48 : 38;
      const entryOffset = full && target.f.pool === "G"
        ? (side === "a" ? -0.5 : 0.5) * sideHeight
        : 0;
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
          y1: source.y + source.height / 2,
          y2: target.y + target.height / 2 + entryOffset,
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
  const compact = laneColumns >= 3 || fixtures.some((f) => f.status === "bye");
  const availableGap = (width - 8 - columns * 190) / Math.max(1, columns - 1);
  const gap = Math.max(12, Math.min(26, Math.floor(availableGap)));
  const cardWidth = Math.max(
    190,
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
    const layout = bracketLayout(fs, { cardWidth, gap, pool, compact });
    const x =
      (pool === "G" ? laneColumns : laneColumns - roundCounts[i]) * stride;
    const feeders =
      pool === "G"
        ? ["a", "b"]
            .map((side) => sourceRef(fs[0]["source_" + side])?.fixture)
            .map((id) => nodes.find((n) => n.f.id === id))
            .filter(Boolean)
        : [];
    const y = feeders.length
      ? feeders.reduce((sum, n) => sum + n.y, 0) / feeders.length - layout.nodes[0].y
      : offsetY + 28;
    if (pool !== "G")
      lanes.push({ pool, x: 0, y: offsetY, width: laneColumns * stride - gap });
    for (const n of layout.nodes)
      nodes.push({ ...n, x: n.x + x, y: n.y + y, round: n.round + round });
    for (const [j, group] of layout.groups.entries())
      headings.push({
        x: x + j * stride,
        y,
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
    compact,
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
  const seeds = bracketSeeds(c);
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
      : [
          ["W", ""],
          ["P", ""],
        ];
  const labels = new Map();
  for (const [pool] of groups) {
    const fs = fixtures.filter((f) => (f.pool || "W") === pool);
    for (const n of bracketLayout(fs, { pool }).nodes)
      labels.set(n.f.id, n.label);
  }
  function entrant(f, side, includeSeed = false) {
    const id = f[side],
      entry = entries.get(id),
      ref = sourceRef(f["source_" + side]);
    if (entry) {
      const names = entry.players.map((p) => p.name).join(" + ");
      return includeSeed && seeds.has(id)
        ? `${names}, seed ${seeds.get(id)}`
        : names;
    }
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
            : "";
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
                `<span class="bt-racket-person"><span class="bt-racket-name fixture-name-frame" data-scroll-name><span class="fixture-name-text">${esc(player.name)}</span></span>${UI.nationalityFlags(player)}</span>`,
            )
            .join("")
        : `<span class="fixture-name-text">${esc(entrant(f, side))}</span>`;
    return `<span class="bt-side ${won ? "bt-winner" : ""} ${entry ? "" : "bt-unresolved"}" data-entry="${f[side] || ""}">
      <span class="bt-player">${seeds.has(f[side]) ? seedBadge(seeds.get(f[side])) : ""}<span class="bt-avatars ${doubles ? "bt-pair" : ""}" aria-hidden="true">${photos}</span><span class="bt-player-name ${racket && entry ? "bt-racket-identity" : "fixture-name-frame"}" ${racket && entry ? "" : "data-scroll-name"} title="${esc(entrant(f, side))}">${identity}</span></span>
      ${fc ? `<span class="bt-team" title="${esc(team?.name || "Club not recorded")}" aria-label="${esc(team?.name || "Club not recorded")}">${team?.image ? `<img src="${esc(team.image)}" alt="" loading="lazy">` : `<span class="bt-club-code">${esc(team?.code || "—")}</span>`}</span>` : ""}
      <span class="bt-score"${score === "" ? ' aria-hidden="true"' : ""}>${esc(score)}${score !== "" && f.score?.pens ? ` <small class="bt-penalty">(${f.score.pens[n]})</small>` : ""}</span></span>`;
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
      f.score?.legScores ? "Aggregate" : f.aggregate ? "Two-leg aggregate" : "",
      f.score?.aet && !f.score?.pens ? "a.e.t." : "",
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
        ? (fc ? f.score?.legScores : f.score?.games) || []
        : [];
    const scoreType = fc
      ? "Leg scores"
      : APP.game.kind === "tennis"
        ? "Set scores"
        : APP.game.kind === "smash"
          ? "Stocks by game"
          : "Game scores";
    const total = fixtureScoreText(f);
    const pens = f.score?.pens;
    const scoreLabel = pens
      ? `Match score ${f.a_score} to ${f.b_score}. Penalties ${pens[0]} to ${pens[1]}`
      : games.length
        ? `${scoreType}: ${games.map((g) => `${g.a}–${g.b}`).join(", ")}. Series result: ${total}`
        : total;
    const aria = `${n.label}: ${entrant(f, "a", true)} versus ${entrant(f, "b", true)}. ${scoreLabel}. ${state}${f.match_id ? ". View result" : record ? ". Record result" : ""}`;
    const position = stacked
      ? ""
      : `left:${n.x}px;top:${n.y}px;width:${n.width}px;`;
    const forfeitPosition = stacked
      ? ""
      : `style="left:${n.x + n.width - 10}px;top:${n.y + n.height - 4}px"`;
    const scoresButton = games.length
      ? `<button type="button" class="bt-score-preview-button" ${forfeitPosition} data-score-button="${f.id}" aria-expanded="false" aria-controls="${container.id}-score-popover" aria-label="${esc(scoreType + " for " + entrant(f, "a") + " versus " + entrant(f, "b"))}">${scoreType}</button>`
      : "";
    return `<${tag} class="bt-match ${pens ? "bt-has-penalties" : ""} ${n.right ? "bt-right" : ""} ${f.status === "bye" ? "bt-bye" : ""} ${f.stage === "final" ? "bt-final" : ""} ${f.status === "cancelled" ? "bt-cancelled" : ""}" ${action} ${tag === "article" ? 'tabindex="-1"' : ""} data-bracket-fixture="${f.id}" data-match-round="${n.round}" ${games.length ? `data-score-preview="${f.id}"` : ""} aria-label="${esc(aria)}" style="${position}height:${n.height}px">
      <span class="bt-match-top"><span>${esc(n.label)}</span>${f.match_id || record ? '<span class="bt-open" aria-hidden="true">↗</span>' : ""}</span>
      ${sideMarkup(f, "a")}${sideMarkup(f, "b")}
      <span class="bt-match-bottom"><span>${esc(f.forfeit ? state : detail || state)}</span>${detail && f.match_id && !f.forfeit && !f.score?.legScores ? `<span>${f.result_status === "accepted" ? "Final" : "Pending"}</span>` : ""}</span></${tag}>${scoresButton}${record && c.canManage && declareForfeit ? `<button type="button" class="bt-forfeit" ${forfeitPosition} data-bracket-forfeit="${f.id}" aria-label="Declare forfeit for ${esc(entrant(f, "a"))} versus ${esc(entrant(f, "b"))}">Forfeit</button>` : ""}`;
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
  const names = watchFixtureNames(container);
  const scorePreview = bindFixtureScorePopover(container, {
    findFixture: (id) => fixtures.find((f) => f.id === id),
    names: entrant,
    kind: APP.game.kind,
    esc,
  });
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
  const rendered = (node) => node.f.status !== "bye";
  const canvas = (layout, headings = layout.headings) => {
    const nodes = layout.nodes.filter(rendered);
    const ids = new Set(nodes.map((n) => n.f.id));
    const edges = layout.edges.filter(
      (e) => ids.has(e.source) && ids.has(e.target),
    );
    return `<div class="bt-canvas" style="width:${layout.width}px;height:${layout.height}px">
      <svg class="bt-connections" width="${layout.width}" height="${layout.height}" aria-hidden="true">${edges.map((e) => `<path d="${connector(e)}" data-source="${e.source}" data-target="${e.target}" class="${e.active ? "bt-path-active" : ""} ${e.outcome === "loser" ? "bt-path-loser" : ""}"/>`).join("")}</svg>
      ${(layout.lanes || []).map((lane) => `<h3 class="bt-lane-title" style="left:${lane.x}px;top:${lane.y}px;width:${lane.width}px">${lane.pool === "W" ? "Winners bracket" : "Losers bracket"}</h3>`).join("")}
      ${headings.map((n) => `<div class="bt-round" data-round-index="${n.round}" style="left:${n.x}px;top:${n.y || 0}px;width:${n.width}px"><h4>${esc(n.heading)}</h4></div>`).join("")}
      ${nodes.map((n) => card(n)).join("")}
    </div>`;
  };
  function draw() {
    const width = container.clientWidth;
    if (!width || (width === previousWidth && selectedView === previousView))
      return;
    previousWidth = width;
    previousView = selectedView;
    scorePreview.close();
    scrollTimers.forEach(clearTimeout);
    scrollTimers.clear();
    const active = document.activeElement?.dataset?.bracketFixture;
    const connected =
      c.settings.elimination === "double" && selectedView === "all";
    if (connected) {
      const layout = connectedLayout(fixtures, width);
      sections.innerHTML = `<section class="bt-section" data-layout="connected" data-compact="${layout.compact}">
        ${roundNav(
          layout.headings.filter((heading) =>
            layout.nodes.some((n) => n.round === heading.round && rendered(n)),
          ),
          "Full bracket",
        )}
        <div class="bt-viewport" tabindex="0" role="region" aria-label="Full bracket. Scroll across rounds.">${canvas(layout)}</div>
      </section>`;
    } else {
      const winnersRounds = new Set(
        fixtures.filter((f) => f.pool === "W").map((f) => f.round),
      );
      const thirdPlace =
        selectedView === "all" &&
        c.settings.elimination !== "double" &&
        width >= 1000 &&
        winnersRounds.size >= 2 &&
        winnersRounds.size <= 4
          ? fixtures.find((f) => f.pool === "P")
          : null;
      sections.innerHTML = groups
        .filter(
          ([pool]) =>
            (selectedView === "all" || selectedView === pool) &&
            !(thirdPlace && pool === "P"),
        )
        .map(([pool, title]) => {
          const fs = fixtures.filter((f) => (f.pool || "W") === pool);
          if (!fs.length) return "";
          const rounds = new Set(fs.map((f) => f.round));
          const count = rounds.size;
          const focused = selectedView !== "all";
          const mirrorColumns = count * 2 - 1;
          const gap = width >= 700 ? 26 : 44;
          const mirrorFit = Math.floor(
            (width - 8 - (mirrorColumns - 1) * gap) / mirrorColumns,
          );
          const mirrored =
            c.settings.elimination !== "double" &&
            pool === "W" &&
            width >= 1000 &&
            mirrorFit >= 190;
          const fitWidth = Math.floor((width - 8 - (count - 1) * gap) / count);
          const stacked = focused && fitWidth < 202;
          const fitted = !focused && (mirrored || fitWidth >= 190);
          const hasByes = fs.some((f) => f.status === "bye");
          const sparseMobileDraw =
            width < 700 &&
            hasByes &&
            [...rounds].every(
              (round) =>
                fs.filter((f) => f.round === round && f.status !== "bye")
                  .length <= 4,
            );
          const compact =
            sparseMobileDraw || (focused && hasByes) || (fitted && (hasByes || count >= 4));
          const cardWidth = focused
            ? Math.max(202, Math.min(380, fitWidth))
            : fitted
              ? Math.min(mirrored ? 270 : 300, mirrored ? mirrorFit : fitWidth)
              : Math.min(300, Math.max(224, width - 32));
          const layout = bracketLayout(fs, {
            mirrored,
            cardWidth,
            gap,
            pool,
            compact,
          });
          const headings = [
            ...new Map(layout.nodes.map((n) => [n.x, { ...n, y: 0 }])).values(),
          ];
          const nav = layout.groups
            .map((g, i) => ({
              round: i,
              heading: roundTitle(i, layout.groups.length, pool, g[0].round),
            }))
            .filter(({ round }) =>
              layout.groups[round].some((f) => f.status !== "bye"),
            );
          if (thirdPlace && pool === "W") {
            const final = layout.nodes.at(-1);
            const round = layout.groups.length;
            const y = final.y + final.height + 44;
            layout.nodes.push({
              f: thirdPlace,
              x: final.x,
              y,
              width: final.width,
              height: final.height,
              round,
              label: "Third-place match",
            });
            layout.height = Math.max(layout.height, y + final.height + 12);
            nav.push({ round, heading: "Third-place match" });
          }
          const view = stacked
            ? "stacked"
            : focused
              ? "expanded"
              : layout.mirrored
                ? "mirrored"
                : "linear";
          return `<section class="bt-section" data-bracket-pool="${pool}" data-layout="${view}" data-fitted="${fitted}" data-compact="${compact}">${title ? `<h3 class="bt-section-title">${title}</h3>` : ""}
        ${roundNav(nav, title || "Bracket")}
        <div class="bt-viewport" tabindex="0" role="region" aria-label="${title || "Tournament"} bracket">
          ${
            stacked
              ? `<div class="bt-stacked-rounds">${nav
                  .map(
                    ({ round, heading }) =>
                      `<section><h4>${esc(heading)}</h4><div>${layout.nodes
                        .filter((n) => n.round === round && rendered(n))
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
    }
    updateView();
    names.refresh();
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
      if (buttons.length) selectRound(Number(buttons[0].dataset.bracketRound));
      let lastLeft = 0;
      for (const button of buttons)
        button.onclick = () => {
          clearTimeout(timer);
          scrollTimers.delete(timer);
          const index = Number(button.dataset.bracketRound);
          const matches = [
            ...section.querySelectorAll(`[data-match-round="${index}"]`),
          ];
          if (!matches.length) return;
          const match = matches.reduce((first, candidate) =>
            candidate.offsetTop < first.offsetTop ? candidate : first,
          );
          if (
            section.dataset.fitted === "true" ||
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
      const visibleColumns = columns.filter((col) =>
        buttons.some((b) => b.dataset.bracketRound === col.dataset.roundIndex),
      );
      if (!visibleColumns.length) continue;
      viewport.addEventListener("scroll", () => {
        if (lastLeft === viewport.scrollLeft) return;
        lastLeft = viewport.scrollLeft;
        const maxLeft = viewport.scrollWidth - viewport.clientWidth;
        const distance = (col) =>
          Math.abs(Math.min(col.offsetLeft, maxLeft) - lastLeft);
        const column = visibleColumns.reduce(
          (best, col) => (distance(col) < distance(best) ? col : best),
          visibleColumns.find(
            (col) => Number(col.dataset.roundIndex) === roundIndex,
          ) || visibleColumns[0],
        );
        const next = Number(column.dataset.roundIndex);
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
          const match = section.querySelector(`[data-match-round="${next}"]`);
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
    names.destroy();
    scorePreview.destroy();
    observer.disconnect();
    cancelAnimationFrame(frame);
    container.removeEventListener("click", click);
    scrollTimers.forEach(clearTimeout);
    scrollTimers.clear();
  };
}
