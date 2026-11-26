import { json } from "./db.js";
import { getCompetition, standings } from "./competitions.js";
import { ESTABLISHED_MATCHES } from "./ratings.js";

const earlier =
  "(SELECT position FROM match_chronology WHERE id=m.id) < (SELECT position FROM match_chronology WHERE id=?)";
const cutoff = (match) => [match.id];

function sideCondition(ids, params) {
  params.push(ids[0]);
  let condition =
    "EXISTS(SELECT 1 FROM match_players p WHERE p.match_id=m.id AND p.player_id=?)";
  for (const id of ids.slice(1)) {
    condition +=
      " AND EXISTS(SELECT 1 FROM match_players p JOIN match_players first ON first.match_id=p.match_id WHERE p.match_id=m.id AND first.player_id=? AND p.player_id=? AND p.side=first.side)";
    params.push(ids[0], id);
  }
  return condition;
}
function previousMatches(db, match, sides) {
  const params = [match.game, match.format, ...cutoff(match)];
  const conditions = sides.map((ids) => sideCondition(ids, params));
  return {
    sql: `FROM matches m WHERE m.game=? AND m.format=? AND m.status='accepted' AND m.forfeit=0 AND ${earlier} AND ${conditions.join(" AND ")}`,
    params,
  };
}
function ratingBefore(db, match, playerId) {
  const current = db
    .prepare("SELECT before FROM ledger WHERE match_id=? AND player_id=?")
    .get(match.id, playerId);
  const latest = current
    ? null
    : db
        .prepare(
          `SELECT l.after FROM ledger l JOIN matches m ON m.id=l.match_id WHERE l.player_id=? AND m.game=? AND m.format=? AND ${earlier} ORDER BY (SELECT position FROM match_chronology WHERE id=m.id) DESC LIMIT 1`,
        )
        .get(playerId, match.game, match.format, ...cutoff(match));
  const count = db
    .prepare(
      `SELECT COUNT(*) n FROM ledger l JOIN matches m ON m.id=l.match_id WHERE l.player_id=? AND m.game=? AND m.format=? AND ${earlier}`,
    )
    .get(playerId, match.game, match.format, ...cutoff(match)).n;
  return {
    elo: current?.before ?? latest?.after ?? 1000,
    rated_matches: count,
    provisional: count < ESTABLISHED_MATCHES,
  };
}
function form(db, match, ids) {
  const query = previousMatches(db, match, [ids]);
  return db
    .prepare(
      `SELECT m.*, (SELECT side FROM match_players WHERE match_id=m.id AND player_id=?) player_side ${query.sql} ORDER BY (SELECT position FROM match_chronology WHERE id=m.id) DESC LIMIT 5`,
    )
    .all(ids[0], ...query.params)
    .map((m) => {
      const opponents = db
        .prepare(
          "SELECT p.name FROM match_players mp JOIN players p ON p.id=mp.player_id WHERE mp.match_id=? AND mp.side<>? ORDER BY p.id",
        )
        .all(m.id, m.player_side);
      return {
        id: m.id,
        submitted: m.submitted,
        played_at: m.played_at,
        result: m.winner == null ? "D" : m.winner === m.player_side ? "W" : "L",
        opponent: opponents.map((p) => p.name).join(" + "),
        score:
          m.player_side === 0 ? [m.a_score, m.b_score] : [m.b_score, m.a_score],
      };
    })
    .reverse();
}
function odds(db, match, sides, overalls, kind) {
  const strength =
    kind === "fc" && overalls ? (overalls[0] - overalls[1]) * 20 : 0;
  const difference = sides[0].elo - sides[1].elo + strength;
  const x = Math.max(-60, Math.min(60, (difference * Math.LN10) / 400));
  if (kind !== "fc") {
    const a = Math.exp(x / 2),
      b = Math.exp(-x / 2),
      total = a + b;
    return {
      outcomes: [
        { side: 0, probability: a / total, decimal: total / a },
        { side: 1, probability: b / total, decimal: total / b },
      ],
      provisional: sides.some((s) => s.provisional),
      model: "elo",
      team_strength_applied: false,
    };
  }
  const history = db
    .prepare(
      `SELECT COUNT(*) total,COALESCE(SUM(m.outcome=0.5),0) draws FROM matches m WHERE m.game=? AND m.status='accepted' AND m.forfeit=0 AND ${earlier}`,
    )
    .get(match.game, ...cutoff(match));
  // Ten equivalent prior matches anchor a new book at the chosen 20% draw rate.
  const drawRate = (history.draws + 2) / (history.total + 10);
  const tieWeight = (2 * drawRate) / (1 - drawRate);
  const a = Math.exp(x / 2),
    b = Math.exp(-x / 2),
    total = a + tieWeight + b;
  const outcomes = [
    { side: 0, probability: a / total },
    { side: null, probability: tieWeight / total },
    { side: 1, probability: b / total },
  ].map((outcome) => ({ ...outcome, decimal: 1 / outcome.probability }));
  return {
    outcomes,
    provisional: sides.some((s) => s.provisional),
    model: "elo-with-draws",
    draw_history: history.total,
    draw_rate: drawRate,
    team_strength_applied: !!overalls,
  };
}
export function matchContext(db, match, participants) {
  const ids = [0, 1].map((side) =>
    participants.filter((p) => p.side === side).map((p) => p.id),
  );
  const sides = ids.map((players, side) => {
    const ratings = players.map((id) => ratingBefore(db, match, id));
    return {
      side,
      name: participants
        .filter((p) => p.side === side)
        .map((p) => p.name)
        .join(" + "),
      elo: ratings.reduce((sum, r) => sum + r.elo, 0) / ratings.length,
      provisional: ratings.some((r) => r.provisional),
      ratings,
      form: form(db, match, players),
    };
  });
  const query = previousMatches(db, match, ids);
  const h2h = db
    .prepare(
      `SELECT COUNT(*) meetings,COALESCE(SUM(m.winner=(SELECT side FROM match_players WHERE match_id=m.id AND player_id=?)),0) a,COALESCE(SUM(m.winner IS NULL),0) draws,COALESCE(SUM(m.winner IS NOT NULL AND m.winner<>(SELECT side FROM match_players WHERE match_id=m.id AND player_id=?)),0) b ${query.sql}`,
    )
    .get(ids[0][0], ids[0][0], ...query.params);
  let competition = null;
  if (match.competition_id) {
    const c = getCompetition(db, match.competition_id);
    const fixture = db
      .prepare("SELECT * FROM fixtures WHERE id=?")
      .get(match.fixture_id);
    let pools = [];
    if (c.kind === "league") pools = [""];
    else if (c.kind === "groups") {
      const playerIds = ids.flat();
      const entries = db
        .prepare(
          `SELECT DISTINCT entry_id FROM entrant_players WHERE competition_id=? AND player_id IN(${playerIds.map(() => "?").join(",")})`,
        )
        .all(c.id, ...playerIds)
        .map((row) => row.entry_id);
      if (entries.length)
        pools = db
          .prepare(
            `SELECT DISTINCT pool FROM fixtures WHERE competition_id=? AND stage='group' AND (a IN(${entries.map(() => "?").join(",")}) OR b IN(${entries.map(() => "?").join(",")})) ORDER BY pool`,
          )
          .all(c.id, ...entries, ...entries)
          .map((row) => row.pool);
    }
    competition = {
      id: c.id,
      name: c.name,
      kind: c.kind,
      stage: fixture?.stage || "",
      label: fixture?.label || "",
      round: fixture?.round,
      tableColumns: c.settings.tableColumns,
      standings: pools.map((pool) => ({
        pool,
        rows: standings(db, c, pool, null, match),
      })),
    };
  }
  const kind = json(match.rules).kind;
  const overalls = match.team_snapshot ? json(match.team_snapshot) : null;
  return {
    as_of: match.played_at ?? match.submitted,
    sides,
    h2h,
    competition,
    odds: odds(db, match, sides, overalls, kind),
    kind,
  };
}
