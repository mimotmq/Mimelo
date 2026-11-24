import { assert, json } from "./db.js";
import {
  isBracketFixture,
  predictionRows,
} from "../static/js/bracket-picks.js";

export function lockBracketPredictions(db, fixture) {
  if (!fixture || !isBracketFixture(fixture)) return;
  db.prepare("INSERT OR IGNORE INTO bracket_prediction_locks VALUES(?,?)").run(
    fixture.competition_id,
    Date.now(),
  );
}

function predictionState(db, competition) {
  const fixtures = db
    .prepare(
      "SELECT * FROM fixtures WHERE competition_id=? AND stage IN('knockout','semifinal','final') ORDER BY id",
    )
    .all(competition.id);
  const deadline = fixtures.reduce(
    (first, f) =>
      f.scheduled && !["bye", "cancelled"].includes(f.status)
        ? Math.min(first ?? f.scheduled, f.scheduled)
        : first,
    null,
  );
  const locked = !!db
    .prepare("SELECT 1 FROM bracket_prediction_locks WHERE competition_id=?")
    .get(competition.id);
  const open =
    competition.state === "active" &&
    !!fixtures.length &&
    (!deadline || deadline > Date.now()) &&
    !locked &&
    !fixtures.some((f) => f.status === "completed") &&
    !db
      .prepare(
        `SELECT 1 FROM matches m JOIN fixtures f ON f.id=m.fixture_id
       WHERE f.competition_id=? AND f.stage IN('knockout','semifinal','final')
       AND m.status<>'voided' LIMIT 1`,
      )
      .get(competition.id);
  return { fixtures, deadline, open };
}

export function bracketPredictions(db, competition, user) {
  const { fixtures, deadline, open } = predictionState(db, competition);
  const mine =
    user &&
    db
      .prepare(
        "SELECT picks FROM bracket_predictions WHERE competition_id=? AND account_id=?",
      )
      .get(competition.id, user.id);
  const leaderboard = [];
  if (!open && fixtures.length) {
    const scored = fixtures.filter(
      (f) => f.status === "completed" && !f.no_contest && f.winner,
    );
    const rows = db
      .prepare(
        `SELECT b.account_id,b.picks,p.name FROM bracket_predictions b
      JOIN accounts a ON a.id=b.account_id JOIN players p ON p.id=a.player_id
      WHERE b.competition_id=? ORDER BY p.name COLLATE NOCASE,b.account_id`,
      )
      .all(competition.id)
      .map((row) => {
        const picks = json(row.picks);
        return {
          name: row.name,
          mine: row.account_id === user?.id,
          points: scored.filter(
            (fixture) => picks[fixture.id] === fixture.winner,
          ).length,
        };
      })
      .sort((a, b) => b.points - a.points);
    for (const [i, row] of rows.entries()) {
      const rank =
        i && rows[i - 1].points === row.points
          ? leaderboard[i - 1].rank
          : i + 1;
      leaderboard.push({ ...row, rank });
    }
  }
  return {
    available: !!fixtures.length,
    open,
    deadline,
    mine: mine ? json(mine.picks) : null,
    leaderboard,
  };
}

export function saveBracketPrediction(db, competition, user, picks) {
  const { fixtures, open } = predictionState(db, competition);
  assert(open, "Bracket predictions are closed.", 409);
  assert(
    picks && typeof picks === "object" && !Array.isArray(picks),
    "Choose each predicted winner.",
  );
  const rows = predictionRows(fixtures, picks);
  const required = rows.filter((row) => row.needsPick);
  assert(
    rows.every(
      (row) => !row.waiting && (!row.needsPick || row.winner !== undefined),
    ),
    "Choose a valid winner in each matchup.",
  );
  assert(
    Object.keys(picks).length === required.length,
    "Only pick winners for matches that will be played.",
  );
  const checked = Object.fromEntries(
    required.map(({ fixture, winner }) => [fixture.id, winner]),
  );
  db.prepare(
    `INSERT INTO bracket_predictions VALUES(?,?,?,?)
     ON CONFLICT(competition_id,account_id) DO UPDATE SET picks=excluded.picks,updated=excluded.updated`,
  ).run(competition.id, user.id, JSON.stringify(checked), Date.now());
  return { mine: checked };
}
