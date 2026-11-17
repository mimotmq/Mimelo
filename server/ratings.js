import { ratingK } from "./scoring.js";
// A rated match is represented by a ledger entry. Deriving progress from the
// ledger keeps corrections, eligibility changes, merges, and replay in sync.
export const ESTABLISHED_MATCHES = 8;

export function ratingProgress(db, game, format, playerId, through = null) {
  const timeline = through
    ? " AND (m.submitted < ? OR (m.submitted = ? AND m.id <= ?))"
    : "";
  const { n } = db
    .prepare(
      "SELECT COUNT(*) n FROM ledger l JOIN matches m ON m.id=l.match_id WHERE l.player_id=? AND m.game=? AND m.format=?" +
        timeline,
    )
    .get(
      playerId,
      game,
      format,
      ...(through ? [through.submitted, through.submitted, through.id] : []),
    );
  return {
    rated_matches: n,
    k: ratingK(n),
    provisional: n < ESTABLISHED_MATCHES,
    provisional_matches: ESTABLISHED_MATCHES,
  };
}

export function ratedRating(db, row) {
  return row
    ? { ...row, ...ratingProgress(db, row.game, row.format, row.player_id) }
    : null;
}
