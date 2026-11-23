const labels = {
  qualified: "Qualified",
  eliminated: "Eliminated",
  champion: "Champion",
  contending: "Still in contention",
};
export function progressionBadge(row) {
  if (!row) return "";
  const state = row.status;
  return `<span class="progression-badges">${state !== "contending" ? `<span class="progression-badge" data-status="${state}">${labels[state]}</span>` : ""}${row.group_winner ? '<span class="progression-badge" data-status="winner">Group winner</span>' : ""}</span>`;
}
function percent(value, confirmed = false) {
  if (value == null) return "—";
  if (value === 0 && !confirmed) return "&lt;0.1%";
  if (value === 1 && !confirmed) return "&gt;99.9%";
  return (
    (value * 100).toLocaleString(undefined, { maximumFractionDigits: 1 }) + "%"
  );
}
export function renderCompetitionOutlook(c) {
  let section = document.querySelector("#competition-outlook");
  if (!section) {
    section = document.createElement("section");
    section.id = "competition-outlook";
    section.className = "panel competition-outlook";
    document.querySelector("#cp-rules").after(section);
  }
  const { esc } = UI,
    projection = c.projection;
  if (!projection?.available) {
    section.innerHTML = `<div class="panel-head"><h2>Competition outlook</h2></div><p class="panel-body muted">${esc(projection?.reason || "Chances will appear after the draw.")}</p>`;
    return;
  }
  const entries = new Map(c.entries.map((e) => [e.id, e]));
  const rows = [...projection.rows].sort(
    (a, b) => b.title - a.title || a.entry - b.entry,
  );
  const qualifier = c.kind === "knockout" ? "Next win" : "Advance";
  const singleStageLeague = c.kind === "league" && !c.settings.playoffs;
  const meter = (value, confirmed) =>
    `<div class="competition-chance"><b>${percent(value, confirmed)}</b><span class="competition-chance-track" aria-hidden="true"><span style="width:${Math.max(0, Math.min(100, (value || 0) * 100))}%"></span></span></div>`;
  section.innerHTML = `<div class="panel-head"><div><h2>Competition outlook</h2><p>Updated from accepted results and current Elo</p></div><span class="chip">Estimated chances</span></div><div class="competition-outlook-scroll"><table><thead><tr><th>${c.format === "doubles" ? "Pair" : "Player"}</th><th>Win title</th>${projection.qualification_label ? `<th>${qualifier}</th>` : ""}</tr></thead><tbody>${rows
    .map(
      (row) =>
        `<tr data-progress="${singleStageLeague && row.status === "eliminated" ? "contending" : row.status}"><td>${entries
          .get(row.entry)
          .players.map((p) => UI.playerLink(p))
          .join(
            " + ",
          )}${singleStageLeague && row.status === "eliminated" ? "" : progressionBadge(singleStageLeague ? { ...row, group_winner: false } : row)}</td><td>${meter(row.title, row.status === "eliminated" || row.status === "champion")}</td>${projection.qualification_label ? `<td>${meter(c.kind === "knockout" ? row.next_round : row.qualification, c.kind === "knockout" ? row.status === "eliminated" : row.status !== "contending")}</td>` : ""}</tr>`,
    )
    .join(
      "",
    )}</tbody></table></div><div class="competition-outlook-note">${singleStageLeague ? (rows.some((row) => row.status === "champion") ? '<span><i data-status="qualified"></i>Champion confirmed</span>' : "") : '<span><i data-status="qualified"></i>Confirmed qualification / group winner</span><span><i data-status="eliminated"></i>Mathematically eliminated</span>'}<p>Percentages are estimates from simulated remaining results and configured tiebreaks. Confirmed labels use mathematical guarantees. Unresolved ties are split in estimates until decided. ${c.kind === "knockout" ? "“Next win” is the chance of winning the next match still to be played." : projection.qualification_label ? "“Advance” is the chance of reaching the knockout stage." : ""}</p></div>`;
  const extra = document.querySelector("#competition-extra-standings");
  extra?.remove();
  if (c.settings.extraCount && c.extraStandings.length) {
    const box = document.createElement("section");
    box.id = "competition-extra-standings";
    box.className = "panel competition-extra-standings";
    box.innerHTML = `<div class="panel-head"><h2>Best-placed qualifiers</h2><span class="chip">${c.settings.extraCount} advance from position ${c.settings.extraPlace}</span></div><p class="panel-body muted">Current candidates · raw points, then ${(c.settings.extraTieBreaks || []).map((key) => ({ difference: "score difference", for: "scores for", points_difference: "point difference", sets_difference: "set difference" })[key]).join(" → ")}. Unresolved boundary ties require an admin decision.</p>${UI.standingsTable(c, c.extraStandings)}`;
    section.after(box);
  }
}
