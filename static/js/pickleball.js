export const scoringHelp = `<p class="hint pickleball-scoring-help">Standard side-out scoring: only the serving side scores. Win each game by two. Play best of 3 or 5 to 11, or one game to 11, 15, or 21. Enter final points for each game, with no server number. <a href="https://usapickleball.org/docs/rules/USAP-Official-Rulebook.pdf?court=2026" target="_blank" rel="noopener">USA Pickleball rules</a></p>`;

export function bindScoring(best, target, changed = () => {}) {
  best.addEventListener("change", () => {
    if (Number(best.value) > 1) target.value = "11";
    changed();
  });
  target.addEventListener("change", () => {
    if (Number(target.value) !== 11) best.value = "1";
    changed();
  });
}
