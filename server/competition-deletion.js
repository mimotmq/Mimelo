import { admin, organizer, assert, audit } from "./db.js";
import { rebuild } from "./matches.js";

// The caller wraps removal and rating replay in one transaction.
export function deleteCompetition(db, competition, user, body = {}) {
  const c = competition,
    isAdmin = admin(db, user, c.game),
    unstarted = ["registration", "closed"].includes(c.state);
  assert(
    isAdmin || (unstarted && organizer(db, user, c)),
    "Only game/site admins can delete a started competition.",
    403,
  );
  if (isAdmin)
    assert(
      body?.confirmName === c.name,
      "Type the competition name exactly to confirm permanent deletion.",
    );
  const formats = db
    .prepare("SELECT DISTINCT format FROM matches WHERE competition_id=?")
    .all(c.id);
  const { n: matchCount } = db
    .prepare("SELECT COUNT(*) n FROM matches WHERE competition_id=?")
    .get(c.id);
  db.prepare(
    `DELETE FROM notifications WHERE href=? OR href IN (
      SELECT '/game.html?game=' || game || '&match=' || id
      FROM matches WHERE competition_id=?)`,
  ).run(`/competition.html?game=${c.game}&id=${c.id}`, c.id);
  for (const table of ["ledger", "confirmations", "revisions", "match_players"])
    db.prepare(
      `DELETE FROM ${table} WHERE match_id IN (SELECT id FROM matches WHERE competition_id=?)`,
    ).run(c.id);
  db.prepare("DELETE FROM matches WHERE competition_id=?").run(c.id);
  db.prepare("DELETE FROM qualifications WHERE competition_id=?").run(c.id);
  // Remove fixture references before the entrant cascade (including bracket
  // dependencies, forfeits, byes and completed downstream fixtures).
  db.prepare("DELETE FROM fixtures WHERE competition_id=?").run(c.id);
  db.prepare("DELETE FROM competitions WHERE id=?").run(c.id);
  for (const { format } of formats) rebuild(db, c.game, format);
  audit(db, user, "competition.delete", c.id, {
    name: c.name,
    game: c.game,
    matches: matchCount,
  });
  return { ok: true };
}
