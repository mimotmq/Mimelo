export function americanOdds(probability) {
  const amount =
    probability <= 0.5
      ? (100 * (1 - probability)) / probability
      : (100 * probability) / (1 - probability);
  return (
    (probability <= 0.5 ? "+" : "−") +
    Math.round(amount).toLocaleString("en-US")
  );
}
export function renderMatchOverview(
  match,
  { score, status, smashDetails, button },
) {
  const { esc } = UI,
    context = match.context;
  const game = APP.games.find((game) => game.slug === match.game);
  const members = (side) =>
    match.participants.filter((player) => player.side === side);
  const names = (side) =>
    members(side)
      .map((player) => player.name)
      .join(" + ");
  const identity = (side) =>
    `<div class="match-overview-side">${members(side)
      .map(
        (player) =>
          `<a class="match-overview-person" href="player.html?player=${player.id}">${["tennis", "tt", "pickleball"].includes(context.kind) ? UI.avatar(player.name, "avatar-sm", player.photo) : ""}<span>${esc(player.name)}${["tennis", "tt", "pickleball"].includes(context.kind) ? UI.nationalityFlags(player) : ""}</span></a>`,
      )
      .join(
        "",
      )}<span class="match-before-elo">Pre-match Elo <b>${UI.elo(context.sides[side])}</b></span></div>`;
  const form = (side) =>
    `<section class="match-context-card"><h4>${esc(names(side))}</h4><div class="match-form-strip">${context.sides[side].form.map((item) => `<span class="match-form-result" data-result="${item.result}" title="${esc(`${item.result === "W" ? "Win" : item.result === "L" ? "Loss" : "Draw"} · ${item.score.join("–")} vs ${item.opponent} · ${UI.date(item.played_at ?? item.submitted)}`)}">${item.result}</span>`).join("") || '<span class="muted">No earlier accepted results.</span>'}</div><p class="hint">${context.sides[side].form.length ? "Oldest to newest" : "Form starts after the first accepted result."}</p></section>`;
  const standings = context.competition?.standings
    .map(
      ({ pool, rows }) =>
        `<section class="match-standings-table">${pool ? `<h4>Group ${esc(pool)}</h4>` : ""}${UI.standingsTable(
          {
            game: match.game,
            format: match.format,
            settings: { tableColumns: context.competition.tableColumns },
          },
          rows,
          match.participants.map((p) => p.id),
        )}</section>`,
    )
    .join("");
  const competition = context.competition;
  const competitionBlock = competition
    ? `<section class="match-overview-section"><div class="match-section-head"><div><h3>${standings ? "Standings before this match" : "Competition"}</h3><p>${esc(competition.name)}${competition.label ? " · " + esc(competition.label) : ""}</p></div><a class="btn btn-outline btn-sm" href="competition.html?game=${esc(match.game)}&id=${competition.id}">${competition.kind === "knockout" ? "View bracket" : "View competition"}</a></div>${standings || '<p class="muted">Knockout matches are decided by the bracket.</p>'}</section>`
    : `<section class="match-overview-section"><h3>Last five results before this match</h3><div class="match-context-grid">${form(0)}${form(1)}</div></section>`;
  const h2h = context.h2h;
  const odds = context.odds;
  const oddsBlock = `<section class="match-overview-section"><div class="match-section-head"><div><h3>Pre-match odds</h3><p>Elo estimates · American odds${odds.provisional ? " · provisional ratings" : ""}</p></div></div><div class="match-odds-grid" style="--odds-count:${odds.outcomes.length}">${odds.outcomes.map((outcome) => `<div class="match-odds-outcome"><span>${outcome.side == null ? "Draw" : esc(names(outcome.side))}</span><b>${americanOdds(outcome.probability)}</b><small>${(outcome.probability * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%</small></div>`).join("")}</div><details class="match-odds-explainer"><summary>How to read these odds</summary><p>A plus sign shows the profit on a $100 stake: +150 means $150 profit. A minus sign shows the stake needed to win $100: −200 means stake $200 for $100 profit. Your stake is also returned on a win. Percentages show the estimated chance of each outcome.</p><p>These are Elo estimates for comparison; no bets are placed here.</p></details><p class="hint">${context.kind === "fc" ? `Win/draw/win before penalties. Draw likelihood learns from ${UI.count(odds.draw_history, "earlier result")} with a 20% starting assumption.${odds.team_strength_applied ? " Recorded team strength is included." : ""}` : "Based on each side’s Elo before the match."}</p></section>`;
  const changes = match.ledger.length
    ? `<section class="match-overview-section"><h3>Elo change</h3><div class="match-rating-changes">${match.ledger.map((line) => `<div><span>${esc(match.participants.find((player) => player.id === line.player_id)?.name || "Player")}</span><b>${UI.elo({ elo: line.before, provisional: line.provisional_before })} → ${UI.elo({ elo: line.after, provisional: line.provisional })}</b><strong class="${line.delta >= 0 ? "delta-up" : "delta-down"}">${line.delta >= 0 ? "+" : ""}${UI.rating(line.delta)}</strong></div>`).join("")}</div></section>`
    : "";
  return `<section class="match-overview-hero"><div class="match-overview-meta"><span class="chip">${esc(game?.name || match.game)}</span><span class="chip">${match.format === "doubles" ? "Doubles" : "Singles"}</span><span>${competition ? "Competition" : "Friendly"}</span><time datetime="${new Date(match.played_at ?? match.submitted).toISOString()}">${match.played_at ? "Played" : "Entered"} ${UI.date(match.played_at ?? match.submitted)}</time>${match.duration_minutes ? `<span class="match-duration">${UI.count(match.duration_minutes, "minute")} played</span>` : ""}</div><div class="match-overview-identities">${identity(0)}${identity(1)}</div><div class="match-overview-score">${context.kind !== "fc" ? `<div class="match-main-score" aria-label="Match score ${match.a_score} to ${match.b_score}">${match.a_score}<span>–</span>${match.b_score}</div>` : ""}${score(match)}</div><p class="match-overview-status">${esc(status(match))}${match.played_at ? ` · Entered ${UI.date(match.submitted)}` : " · Played date not provided"}</p></section>${match.locked ? '<p class="notice-strip">Locked by a downstream match submission.</p>' : ""}${oddsBlock}${competitionBlock}<section class="match-overview-section"><h3>Head-to-head before this match</h3>${h2h.meetings ? `<div class="match-h2h"><div><span>${esc(names(0))}</span><b>${h2h.a}</b><small>Wins</small></div><div><span>Draws</span><b>${h2h.draws}</b><small>${UI.count(h2h.meetings, "previous meeting")}</small></div><div><span>${esc(names(1))}</span><b>${h2h.b}</b><small>Wins</small></div></div>` : '<p class="muted">First meeting in this game and format.</p>'}</section>${changes}${context.kind === "tennis" && match.score.surface ? `<section class="match-overview-section"><h3>Court surface</h3><p>${esc(match.score.surface)}</p></section>` : ""}${match.score.umpire ? `<section class="match-overview-section"><h3>Umpire</h3><p>${esc(match.score.umpire)}</p></section>` : ""}${match.score.scoreAdjustment ? `<section class="match-overview-section"><h3>Score adjustment</h3><p>${esc(match.score.scoreAdjustment)}</p></section>` : ""}${match.score.note ? `<section class="match-overview-section"><h3>Match note</h3><p>${esc(match.score.note)}</p></section>` : ""}${match.smash_games?.length ? `<details class="match-game-breakdown" open><summary>Fighters and stages by game</summary>${smashDetails(match)}</details>` : ""}<div class="form-actions match-overview-actions">${match.permissions.accept ? button("Accept result", "accept") : ""}${match.permissions.elo ? button("Check off Elo", "elo") : ""}${match.permissions.eloToggle ? button(match.elo_enabled ? "Exclude from Elo" : "Include in Elo", "elo-enabled") : ""}${match.permissions.edit ? button("Correct result", "edit") : ""}${match.permissions.forfeit ? button("Change to forfeit", "forfeit") : ""}${match.permissions.void ? button("Void result", "void") : ""}</div><p class="hint" role="alert"></p>`;
}
