import { admin, assert, json, audit, notify, integer } from "./db.js";
import { validateScore, eloDelta } from "./scoring.js";
import { getCompetition, locked, progress, entries } from "./competitions.js";
import { organizer } from "./db.js";
import { catalogImage, smashMedia } from "./catalog-images.js";
export function members(db, id) {
  return db
    .prepare(
      "SELECT mp.player_id AS id,mp.side,p.name FROM match_players mp JOIN players p ON p.id=mp.player_id WHERE match_id=? ORDER BY side,p.id",
    )
    .all(id);
}
export function getMatch(db, id) {
  const m = db.prepare("SELECT * FROM matches WHERE id=?").get(Number(id));
  assert(m, "Match not found.", 404);
  return m;
}
function sideOf(db, m, user) {
  return user
    ? db
        .prepare(
          "SELECT side FROM match_players WHERE match_id=? AND player_id=?",
        )
        .get(m.id, user.player_id)?.side
    : undefined;
}
export function serializeMatch(db, m, user) {
  const c = m.competition_id ? getCompetition(db, m.competition_id) : null,
    side = sideOf(db, m, user),
    isAdmin = admin(db, user, m.game),
    isLocked = locked(db, m.fixture_id);
  return {
    ...m,
    score: json(m.score),
    rules: json(m.rules),
    team_snapshot: m.team_snapshot ? json(m.team_snapshot) : null,
    participants: members(db, m.id),
    smash_games:
      json(m.rules).kind === "smash" ? smashMedia(db, json(m.score)) : [],
    teams:
      json(m.rules).kind === "fc"
        ? [json(m.score).teamA, json(m.score).teamB]
            .map((id) =>
              db
                .prepare("SELECT id,name,code,overall FROM teams WHERE id=?")
                .get(id),
            )
            .filter(Boolean)
            .map((team) => ({
              ...team,
              image: catalogImage(db, m.game, "team", team.code),
            }))
        : [],
    confirmations: db
      .prepare("SELECT side FROM confirmations WHERE match_id=? AND revision=?")
      .all(m.id, m.revision)
      .map((x) => x.side),
    ledger: db
      .prepare(
        "SELECT player_id,before,delta,after FROM ledger WHERE match_id=?",
      )
      .all(m.id),
    competition_name: c?.name || null,
    locked: isLocked,
    permissions: {
      eloToggle:
        !m.forfeit &&
        m.status !== "voided" &&
        (isAdmin || (m.status === "submitted" && side !== undefined)),
      edit:
        !m.forfeit &&
        m.status !== "voided" &&
        !isLocked &&
        (m.status === "submitted" ? isAdmin || side !== undefined : isAdmin),
      accept:
        m.status === "submitted" &&
        (isAdmin || side !== undefined || (c && organizer(db, user, c))),
      elo:
        isAdmin &&
        m.status === "accepted" &&
        !m.forfeit &&
        !!m.elo_enabled &&
        !m.elo_checked,
      void: isAdmin && !isLocked && m.status !== "voided",
    },
  };
}
export function setEloEnabled(db, id, body, user) {
  const m = getMatch(db, id);
  assert(
    m.revision === Number(body.revision),
    "This result changed. Reload first.",
    409,
  );
  assert(
    serializeMatch(db, m, user).permissions.eloToggle,
    "You cannot change Elo eligibility for this result.",
    403,
  );
  assert(typeof body.enabled === "boolean", "Choose whether Elo is enabled.");
  if (!!m.elo_enabled === body.enabled) return serializeMatch(db, m, user);
  db.prepare(
    "UPDATE matches SET elo_enabled=?,elo_checked=NULL,elo_checker=NULL,revision=revision+1 WHERE id=?",
  ).run(body.enabled ? 1 : 0, id);
  // Score confirmations remain valid: only rating eligibility changed.
  db.prepare(
    "INSERT INTO confirmations SELECT match_id,revision+1,side,actor FROM confirmations WHERE match_id=? AND revision=?",
  ).run(id, m.revision);
  remember(db, getMatch(db, id), user);
  rebuild(db, m.game, m.format);
  audit(db, user, "match.elo-enabled", id, { enabled: body.enabled });
  return serializeMatch(db, getMatch(db, id), user);
}
function snapshot(db, m) {
  if (json(m.rules).kind !== "fc") return null;
  if (m.team_snapshot) return json(m.team_snapshot);
  const s = json(m.score);
  return [s.teamA, s.teamB].map((id) => {
    const t = db
      .prepare("SELECT overall FROM teams WHERE id=? AND game=?")
      .get(id, m.game);
    assert(
      t && t.overall !== null,
      "Team overall missing. Update the team catalog before Elo checkoff.",
      409,
    );
    return t.overall;
  });
}
export function rebuild(db, game, format) {
  db.prepare(
    "DELETE FROM ledger WHERE match_id IN(SELECT id FROM matches WHERE game=? AND format=?)",
  ).run(game, format);
  db.prepare("DELETE FROM ratings WHERE game=? AND format=?").run(game, format);
  const rating = (id) =>
    db
      .prepare(
        "SELECT elo,peak FROM ratings WHERE game=? AND format=? AND player_id=?",
      )
      .get(game, format, id) || { elo: 1000, peak: 1000 };
  let cursorTime = -1,
    cursorId = 0;
  while (true) {
    const batch = db
      .prepare(
        "SELECT * FROM matches WHERE game=? AND format=? AND status='accepted' AND elo_enabled=1 AND elo_checked IS NOT NULL AND forfeit=0 AND (submitted>? OR (submitted=? AND id>?)) ORDER BY submitted,id LIMIT 500",
      )
      .all(game, format, cursorTime, cursorTime, cursorId);
    if (!batch.length) break;
    for (const m of batch) {
      cursorTime = m.submitted;
      cursorId = m.id;
      const ps = members(db, m.id);
      const a = ps.filter((p) => p.side === 0),
        b = ps.filter((p) => p.side === 1);
      const avg = (ps) =>
        ps.reduce((sum, p) => sum + rating(p.id).elo, 0) / ps.length;
      const r = json(m.rules),
        sc = validateScore(r.kind, m.format, json(m.score));
      const delta = eloDelta(
        avg(a),
        avg(b),
        sc.outcome,
        sc.margin,
        r.weight,
        snapshot(db, m),
      );
      for (const p of ps) {
        const before = rating(p.id),
          d = p.side === 0 ? delta : -delta,
          after = Math.round((before.elo + d) * 10000) / 10000;
        db.prepare("INSERT INTO ledger VALUES(?,?,?,?,?,?)").run(
          m.id,
          p.id,
          m.revision,
          before.elo,
          d,
          after,
        );
        db.prepare(
          "INSERT INTO ratings VALUES(?,?,?,?,?) ON CONFLICT(game,format,player_id) DO UPDATE SET elo=excluded.elo,peak=excluded.peak",
        ).run(game, format, p.id, after, Math.max(before.peak, after));
      }
    }
  }
}
function remember(db, m, user) {
  db.prepare("INSERT INTO revisions VALUES(?,?,?,?,?)").run(
    m.id,
    m.revision,
    JSON.stringify({ ...m, participants: members(db, m.id) }),
    user.id,
    Date.now(),
  );
}
function resultProgress(db, m) {
  if (!m.fixture_id) return;
  const f = db.prepare("SELECT * FROM fixtures WHERE id=?").get(m.fixture_id);
  db.prepare(
    "UPDATE fixtures SET status='completed',winner=?,loser=? WHERE id=?",
  ).run(
    m.winner === null ? null : m.winner === 0 ? f.a : f.b,
    m.winner === null ? null : m.winner === 0 ? f.b : f.a,
    f.id,
  );
  const c = getCompetition(db, m.competition_id);
  progress(db, c);
}
export function accept(db, id, user, revision) {
  const m = getMatch(db, id);
  assert(
    m.revision === Number(revision),
    "This score changed. Reload before approving.",
    409,
  );
  assert(
    m.status === "submitted",
    "This result is not awaiting acceptance.",
    409,
  );
  const c = m.competition_id ? getCompetition(db, m.competition_id) : null,
    side = sideOf(db, m, user);
  const authority = admin(db, user, m.game) || (c && organizer(db, user, c));
  assert(
    authority || side !== undefined,
    "Only participants, the organizer, or admins can accept.",
    403,
  );
  if (side !== undefined)
    db.prepare("INSERT OR REPLACE INTO confirmations VALUES(?,?,?,?)").run(
      m.id,
      m.revision,
      side,
      user.id,
    );
  const count = db
    .prepare(
      "SELECT COUNT(*) AS n FROM confirmations WHERE match_id=? AND revision=?",
    )
    .get(m.id, m.revision).n;
  if (authority || count === 2) {
    db.prepare(
      "UPDATE matches SET status='accepted',accepted=?,acceptor=? WHERE id=?",
    ).run(Date.now(), user.id, m.id);
    resultProgress(db, getMatch(db, m.id));
    notify(
      db,
      m.game,
      members(db, m.id).map((p) => p.id),
      "accepted",
      "Result accepted · Elo awaiting admin review",
      `/game.html?game=${m.game}&match=${m.id}`,
    );
  }
  audit(db, user, "match.confirm", id, { revision });
  return serializeMatch(db, getMatch(db, id), user);
}
export function checkoff(db, id, user, revision) {
  const m = getMatch(db, id);
  assert(
    admin(db, user, m.game),
    "Only game/site admins can check off Elo.",
    403,
  );
  assert(
    m.revision === Number(revision),
    "This score changed. Reload before checking off Elo.",
    409,
  );
  assert(
    m.status === "accepted" && m.elo_enabled && !m.forfeit,
    "This result is not eligible for Elo.",
  );
  assert(!m.elo_checked, "Elo is already checked off.", 409);
  const values = snapshot(db, m);
  db.prepare(
    "UPDATE matches SET elo_checked=?,elo_checker=?,team_snapshot=? WHERE id=?",
  ).run(Date.now(), user.id, values ? JSON.stringify(values) : null, id);
  rebuild(db, m.game, m.format);
  audit(db, user, "match.elo", id, { revision });
  notify(
    db,
    m.game,
    members(db, m.id).map((p) => p.id),
    "rated",
    "Elo checked off and recalculated",
    `/game.html?game=${m.game}&match=${m.id}`,
  );
  return serializeMatch(db, getMatch(db, id), user);
}
function prepare(db, game, body, user) {
  const g = db.prepare("SELECT * FROM games WHERE slug=?").get(game);
  assert(g, "Game not found.", 404);
  let c = null,
    f = null,
    sides = body.sides,
    format = body.format || "singles";
  assert(
    ["singles", "doubles"].includes(format) &&
      (!(format === "doubles") || ["tennis", "smash"].includes(g.kind)),
    "Unsupported match format.",
  );
  if (body.fixture) {
    f = db
      .prepare("SELECT * FROM fixtures WHERE id=?")
      .get(integer(body.fixture, 1));
    assert(f && f.status === "ready", "This fixture is not ready.", 409);
    c = getCompetition(db, f.competition_id);
    assert(c.game === game, "Wrong game for fixture.");
    assert(
      !db.prepare("SELECT 1 FROM matches WHERE fixture_id=?").get(f.id),
      "This fixture already has a submitted result.",
      409,
    );
    format = c.format;
    sides = [f.a, f.b].map((id) =>
      db
        .prepare(
          "SELECT player_id FROM entrant_players WHERE entry_id=? ORDER BY player_id",
        )
        .all(id)
        .map((p) => p.player_id),
    );
  }
  assert(
    Array.isArray(sides) &&
      sides.length === 2 &&
      sides.every(
        (s) => Array.isArray(s) && s.length === (format === "doubles" ? 2 : 1),
      ),
    "Choose all participants.",
  );
  sides = sides.map((s) => s.map((x) => integer(x, 1)));
  assert(
    new Set(sides.flat()).size === sides.flat().length,
    "Every participant must be different.",
  );
  assert(
    admin(db, user, game) || sides.flat().includes(user.player_id),
    "Only participants or relevant admins may submit.",
    403,
  );
  for (const id of sides.flat())
    assert(
      db.prepare("SELECT 1 FROM players WHERE id=?").get(id),
      "Player not found.",
    );
  const input = { ...body.score };
  if (c) {
    input.bestOf = c.settings.bestOf;
    input.target = c.settings.target;
    input.matchTiebreak = c.settings.matchTiebreak;
  }
  if (g.kind === "smash") input.fighterPlayers = sides.flat();
  const sc = validateScore(
    g.kind,
    format,
    input,
    !!f && !["league", "group"].includes(f.stage),
  );
  if (g.kind === "fc")
    for (const id of [sc.score.teamA, sc.score.teamB])
      assert(
        db.prepare("SELECT 1 FROM teams WHERE id=? AND game=?").get(id, game),
        "Choose teams from this edition.",
      );
  const w = c?.settings.weights || json(g.weights);
  const rules = {
    version: 1,
    kind: g.kind,
    weight: w[f?.stage || "friendly"] ?? 1,
    overallScale: 20,
  };
  return { c, f, format, sides, sc, rules };
}
export function preview(db, game, body, user) {
  const { format, sides, sc, rules } = prepare(db, game, body, user);
  const ratings = sides.map((ps) =>
    ps.map((id) => ({
      id,
      elo:
        db
          .prepare(
            "SELECT elo FROM ratings WHERE game=? AND format=? AND player_id=?",
          )
          .get(game, format, id)?.elo ?? 1000,
    })),
  );
  let overalls = null;
  if (rules.kind === "fc")
    overalls = [sc.score.teamA, sc.score.teamB].map(
      (id) =>
        db.prepare("SELECT overall FROM teams WHERE id=?").get(id)?.overall,
    );
  if (overalls?.some((v) => v == null))
    return {
      pending: true,
      message:
        "Team overall missing. An admin must supply it before Elo checkoff.",
    };
  const avg = (side) => side.reduce((sum, p) => sum + p.elo, 0) / side.length;
  const delta =
    body.elo_enabled === false
      ? 0
      : eloDelta(
          avg(ratings[0]),
          avg(ratings[1]),
          sc.outcome,
          sc.margin,
          rules.weight,
          overalls,
        );
  return {
    a: sc.a,
    b: sc.b,
    weight: rules.weight,
    margin: sc.margin,
    sides: ratings.map((ps, side) =>
      ps.map((p) => ({
        ...p,
        delta: side === 0 ? delta : -delta,
        after: p.elo + (side === 0 ? delta : -delta),
      })),
    ),
  };
}
export function submit(db, game, body, user) {
  const { c, f, format, sides, sc, rules } = prepare(db, game, body, user);
  const id = Number(
    db
      .prepare(
        "INSERT INTO matches(game,competition_id,fixture_id,format,score,a_score,b_score,outcome,winner,submitted,submitter,elo_enabled,rules) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .run(
        game,
        c?.id || null,
        f?.id || null,
        format,
        JSON.stringify(sc.score),
        sc.a,
        sc.b,
        sc.outcome,
        sc.winner,
        Date.now(),
        user.id,
        body.elo_enabled === false ? 0 : 1,
        JSON.stringify(rules),
      ).lastInsertRowid,
  );
  for (let side = 0; side < 2; side++)
    for (const pid of sides[side])
      db.prepare("INSERT INTO match_players VALUES(?,?,?)").run(id, pid, side);
  const m = getMatch(db, id);
  remember(db, m, user);
  const side = sideOf(db, m, user);
  if (side !== undefined)
    db.prepare("INSERT INTO confirmations VALUES(?,?,?,?)").run(
      id,
      1,
      side,
      user.id,
    );
  audit(db, user, "match.submit", id);
  notify(
    db,
    game,
    sides.flat(),
    "submitted",
    "A result needs confirmation",
    `/game.html?game=${game}&match=${id}`,
  );
  return serializeMatch(db, m, user);
}
function rewindFixture(db, m) {
  if (!m.fixture_id) return;
  const descendants = db
    .prepare(
      "WITH RECURSIVE d(id) AS(SELECT child FROM dependencies WHERE parent=? UNION SELECT child FROM dependencies JOIN d ON parent=d.id) SELECT id FROM d",
    )
    .all(m.fixture_id);
  for (const { id } of descendants)
    db.prepare(
      "UPDATE fixtures SET status='waiting',winner=NULL,loser=NULL,a=CASE WHEN source_a IS NULL THEN a ELSE NULL END,b=CASE WHEN source_b IS NULL THEN b ELSE NULL END WHERE id=?",
    ).run(id);
  db.prepare(
    "UPDATE fixtures SET status='ready',winner=NULL,loser=NULL WHERE id=?",
  ).run(m.fixture_id);
  db.prepare(
    "UPDATE competitions SET state='active',champion=NULL WHERE id=?",
  ).run(m.competition_id);
  const f = db.prepare("SELECT * FROM fixtures WHERE id=?").get(m.fixture_id);
  if (["league", "group"].includes(f.stage)) {
    // No dependent submissions are allowed here; discard the stale qualification draw.
    const ids = db
      .prepare(
        "SELECT id FROM fixtures WHERE competition_id=? AND stage NOT IN('league','group')",
      )
      .all(m.competition_id);
    for (const { id } of ids)
      assert(
        !db.prepare("SELECT 1 FROM matches WHERE fixture_id=?").get(id),
        "A dependent fixture has a record and cannot be rebuilt.",
        409,
      );
    db.prepare(
      "DELETE FROM fixtures WHERE competition_id=? AND stage NOT IN('league','group')",
    ).run(m.competition_id);
    db.prepare("DELETE FROM qualifications WHERE competition_id=?").run(
      m.competition_id,
    );
    const c = getCompetition(db, m.competition_id);
    delete c.settings.tieRounds;
    db.prepare("UPDATE competitions SET settings=? WHERE id=?").run(
      JSON.stringify(c.settings),
      c.id,
    );
  }
}
export function edit(db, id, body, user, voided = false) {
  const m = getMatch(db, id),
    isAdmin = admin(db, user, m.game);
  assert(
    m.revision === Number(body.revision),
    "This result changed. Reload before editing.",
    409,
  );
  assert(
    !locked(db, m.fixture_id),
    "This result is locked by a downstream submission.",
    409,
  );
  if (m.forfeit) {
    assert(voided && isAdmin, "Only an admin may void a forfeit.", 403);
    assert(m.status !== "voided", "This forfeit was already voided.");
    rewindFixture(db, m);
    db.prepare(
      "UPDATE matches SET fixture_id=NULL,status='voided',revision=revision+1 WHERE id=?",
    ).run(id);
    remember(db, getMatch(db, id), user);
    audit(db, user, "forfeit.void", id);
    return serializeMatch(db, getMatch(db, id), user);
  }
  assert(
    isAdmin ||
      (!voided &&
        m.status === "submitted" &&
        sideOf(db, m, user) !== undefined),
    "Only admins may correct accepted results.",
    403,
  );
  assert(m.status !== "voided", "This result has been voided.");
  const c = m.competition_id ? getCompetition(db, m.competition_id) : null;
  let score = body.score || json(m.score);
  if (c)
    score = {
      ...score,
      bestOf: c.settings.bestOf,
      target: c.settings.target,
      matchTiebreak: c.settings.matchTiebreak,
    };
  const f = m.fixture_id
    ? db.prepare("SELECT * FROM fixtures WHERE id=?").get(m.fixture_id)
    : null;
  if (json(m.rules).kind === "smash") {
    score.fighterPlayers =
      body.sides?.flat() ||
      json(m.score).fighterPlayers ||
      members(db, m.id).map((p) => p.id);
    const expected = members(db, m.id).map((p) => p.id);
    assert(
      score.fighterPlayers.length === expected.length &&
        new Set(score.fighterPlayers).size === expected.length &&
        score.fighterPlayers.every((id) => expected.includes(id)),
      "Fighter identities must match the participants.",
    );
  }
  const sc = validateScore(
    json(m.rules).kind,
    m.format,
    score,
    !!f && !["league", "group"].includes(f.stage),
  );
  if (json(m.rules).kind === "fc")
    for (const tid of [sc.score.teamA, sc.score.teamB])
      assert(
        db
          .prepare("SELECT 1 FROM teams WHERE id=? AND game=?")
          .get(tid, m.game),
        "Choose teams from this edition.",
      );
  rewindFixture(db, m);
  const old = json(m.score),
    sameTeams = old.teamA === sc.score.teamA && old.teamB === sc.score.teamB;
  db.prepare(
    "UPDATE matches SET score=?,a_score=?,b_score=?,outcome=?,winner=?,revision=revision+1,status=?,accepted=NULL,acceptor=NULL,elo_checked=NULL,elo_checker=NULL,elo_enabled=?,team_snapshot=? WHERE id=?",
  ).run(
    JSON.stringify(sc.score),
    sc.a,
    sc.b,
    sc.outcome,
    sc.winner,
    voided ? "voided" : "submitted",
    body.elo_enabled === undefined ? m.elo_enabled : body.elo_enabled ? 1 : 0,
    sameTeams ? m.team_snapshot : null,
    id,
  );
  if (voided)
    db.prepare("UPDATE matches SET fixture_id=NULL WHERE id=?").run(id);
  db.prepare("DELETE FROM confirmations WHERE match_id=?").run(id);
  remember(db, getMatch(db, id), user);
  rebuild(db, m.game, m.format);
  audit(db, user, voided ? "match.void" : "match.edit", id, {
    revision: m.revision + 1,
  });
  return serializeMatch(db, getMatch(db, id), user);
}
export function forfeit(db, fixtureId, winnerEntry, user) {
  const f = db
    .prepare("SELECT * FROM fixtures WHERE id=?")
    .get(Number(fixtureId));
  assert(f && f.status === "ready", "Choose a ready fixture.");
  const c = getCompetition(db, f.competition_id);
  assert(
    organizer(db, user, c),
    "Only organizer/admin may declare forfeits.",
    403,
  );
  assert(
    [f.a, f.b].includes(Number(winnerEntry)),
    "Choose the advancing side.",
  );
  assert(
    !db.prepare("SELECT 1 FROM matches WHERE fixture_id=?").get(f.id),
    "A submitted result already exists.",
  );
  const side = Number(winnerEntry) === f.a ? 0 : 1;
  const id = Number(
    db
      .prepare(
        "INSERT INTO matches(game,competition_id,fixture_id,format,score,a_score,b_score,outcome,winner,status,submitted,submitter,accepted,acceptor,elo_enabled,rules,forfeit) VALUES(?,?,?,?,?,0,0,?,?,'accepted',?,?,?,?,0,?,1)",
      )
      .run(
        c.game,
        c.id,
        f.id,
        c.format,
        JSON.stringify({ forfeit: true }),
        side === 0 ? 1 : 0,
        side,
        Date.now(),
        user.id,
        Date.now(),
        user.id,
        JSON.stringify({
          weight: 0,
          kind: db.prepare("SELECT kind FROM games WHERE slug=?").get(c.game)
            .kind,
        }),
      ).lastInsertRowid,
  );
  for (let s = 0; s < 2; s++)
    for (const p of db
      .prepare("SELECT player_id FROM entrant_players WHERE entry_id=?")
      .all(s === 0 ? f.a : f.b))
      db.prepare("INSERT INTO match_players VALUES(?,?,?)").run(
        id,
        p.player_id,
        s,
      );
  remember(db, getMatch(db, id), user);
  resultProgress(db, getMatch(db, id));
  audit(db, user, "fixture.forfeit", f.id, { winnerEntry });
  return serializeMatch(db, getMatch(db, id), user);
}
