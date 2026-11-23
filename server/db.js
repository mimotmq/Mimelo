import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
export const games = [
  ["eafc27", "EA FC 27", "fc", "ea-fc-27.png"],
  ["eafc26", "EA FC 26", "fc", "ea-fc-26.png"],
  ["tennis", "Tennis", "tennis", "tennis-logo.png"],
  ["tt", "Table tennis", "tt", "tt-logo.png"],
  ["smash", "Super Smash Bros.", "smash", "smash-logo.png"],
  ["pickleball", "Pickleball", "pickleball", "pickleball.svg"],
];
export const weights = {
  friendly: 0.8,
  league: 1,
  group: 1,
  knockout: 1.1,
  semifinal: 1.1,
  final: 1.2,
};
export function openDb(path) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.exec(`
 CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY);
 CREATE TABLE IF NOT EXISTS players(id INTEGER PRIMARY KEY,name TEXT NOT NULL,profile TEXT NOT NULL DEFAULT '{}',photo TEXT,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS accounts(id INTEGER PRIMARY KEY,player_id INTEGER NOT NULL UNIQUE REFERENCES players(id),handle TEXT NOT NULL UNIQUE COLLATE NOCASE,email TEXT UNIQUE COLLATE NOCASE,password TEXT NOT NULL,site_admin INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1,preferences TEXT NOT NULL DEFAULT '{}',created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS games(slug TEXT PRIMARY KEY,name TEXT NOT NULL,kind TEXT NOT NULL,logo TEXT NOT NULL,weights TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS game_admins(account_id INTEGER REFERENCES accounts(id),game TEXT REFERENCES games(slug),PRIMARY KEY(account_id,game));
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,account_id INTEGER NOT NULL REFERENCES accounts(id),csrf TEXT NOT NULL,created INTEGER NOT NULL,expires INTEGER NOT NULL,agent TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS sessions_account ON sessions(account_id);
 CREATE TABLE IF NOT EXISTS links(token TEXT PRIMARY KEY,kind TEXT NOT NULL,target INTEGER NOT NULL,issuer INTEGER NOT NULL REFERENCES accounts(id),expires INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS requests(id INTEGER PRIMARY KEY,kind TEXT NOT NULL,account_id INTEGER NOT NULL REFERENCES accounts(id),payload TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS teams(id INTEGER PRIMARY KEY,game TEXT NOT NULL REFERENCES games(slug),code TEXT NOT NULL,name TEXT NOT NULL,overall REAL CHECK(overall IS NULL OR overall BETWEEN 0 AND 100),nation TEXT NOT NULL DEFAULT '',league TEXT NOT NULL DEFAULT '',gender TEXT NOT NULL DEFAULT 'men',updated INTEGER NOT NULL,UNIQUE(game,code));
 CREATE TABLE IF NOT EXISTS catalog_images(game TEXT NOT NULL REFERENCES games(slug),kind TEXT NOT NULL CHECK(kind IN ('team','fighter','stage')),key TEXT NOT NULL,image TEXT NOT NULL,updated INTEGER NOT NULL,PRIMARY KEY(game,kind,key));
 CREATE TABLE IF NOT EXISTS team_badges(id INTEGER PRIMARY KEY,name TEXT NOT NULL,image TEXT NOT NULL UNIQUE,updated INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS team_badge_links(code TEXT NOT NULL,gender TEXT NOT NULL,badge_id INTEGER NOT NULL REFERENCES team_badges(id),PRIMARY KEY(code,gender));
 CREATE TABLE IF NOT EXISTS competitions(id INTEGER PRIMARY KEY,game TEXT NOT NULL REFERENCES games(slug),owner INTEGER NOT NULL REFERENCES accounts(id),name TEXT NOT NULL,kind TEXT NOT NULL,format TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'registration',enrollment TEXT NOT NULL,deadline INTEGER,settings TEXT NOT NULL,created INTEGER NOT NULL,champion INTEGER);
 CREATE INDEX IF NOT EXISTS competitions_game ON competitions(game,id);
 CREATE TABLE IF NOT EXISTS entrants(id INTEGER PRIMARY KEY,competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,seed INTEGER,withdrawn INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS entrant_players(entry_id INTEGER NOT NULL REFERENCES entrants(id) ON DELETE CASCADE,competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,player_id INTEGER NOT NULL REFERENCES players(id),PRIMARY KEY(entry_id,player_id),UNIQUE(competition_id,player_id));
 CREATE TABLE IF NOT EXISTS fixtures(id INTEGER PRIMARY KEY,competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,stage TEXT NOT NULL,pool TEXT NOT NULL DEFAULT '',round INTEGER NOT NULL,label TEXT NOT NULL,a INTEGER REFERENCES entrants(id),b INTEGER REFERENCES entrants(id),source_a TEXT,source_b TEXT,status TEXT NOT NULL DEFAULT 'waiting',winner INTEGER REFERENCES entrants(id),loser INTEGER REFERENCES entrants(id),scheduled INTEGER,conditional INTEGER NOT NULL DEFAULT 0);
 CREATE INDEX IF NOT EXISTS fixtures_comp ON fixtures(competition_id,stage,round);
 CREATE TABLE IF NOT EXISTS dependencies(parent INTEGER NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,child INTEGER NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,PRIMARY KEY(parent,child));
 CREATE TABLE IF NOT EXISTS qualifications(id INTEGER PRIMARY KEY,competition_id INTEGER NOT NULL REFERENCES competitions(id),pool TEXT NOT NULL,entries TEXT NOT NULL,reason TEXT NOT NULL,actor INTEGER NOT NULL REFERENCES accounts(id),created INTEGER NOT NULL,UNIQUE(competition_id,pool));
 CREATE TABLE IF NOT EXISTS matches(id INTEGER PRIMARY KEY,game TEXT NOT NULL REFERENCES games(slug),competition_id INTEGER REFERENCES competitions(id),fixture_id INTEGER UNIQUE REFERENCES fixtures(id),format TEXT NOT NULL,score TEXT NOT NULL,a_score REAL NOT NULL,b_score REAL NOT NULL,outcome REAL NOT NULL,winner INTEGER,status TEXT NOT NULL DEFAULT 'submitted',revision INTEGER NOT NULL DEFAULT 1,submitted INTEGER NOT NULL,submitter INTEGER NOT NULL REFERENCES accounts(id),accepted INTEGER,acceptor INTEGER REFERENCES accounts(id),elo_enabled INTEGER NOT NULL DEFAULT 1,elo_checked INTEGER,elo_checker INTEGER REFERENCES accounts(id),rules TEXT NOT NULL,team_snapshot TEXT,forfeit INTEGER NOT NULL DEFAULT 0);
 CREATE INDEX IF NOT EXISTS matches_timeline ON matches(game,format,submitted,id);
 CREATE INDEX IF NOT EXISTS matches_review ON matches(game,status,elo_checked);
 CREATE TABLE IF NOT EXISTS match_players(match_id INTEGER NOT NULL REFERENCES matches(id),player_id INTEGER NOT NULL REFERENCES players(id),side INTEGER NOT NULL CHECK(side IN(0,1)),PRIMARY KEY(match_id,player_id));
 CREATE INDEX IF NOT EXISTS match_players_player ON match_players(player_id,match_id);
 CREATE TABLE IF NOT EXISTS confirmations(match_id INTEGER NOT NULL REFERENCES matches(id),revision INTEGER NOT NULL,side INTEGER NOT NULL,actor INTEGER NOT NULL REFERENCES accounts(id),PRIMARY KEY(match_id,revision,side));
 CREATE TABLE IF NOT EXISTS revisions(match_id INTEGER NOT NULL REFERENCES matches(id),revision INTEGER NOT NULL,payload TEXT NOT NULL,actor INTEGER NOT NULL REFERENCES accounts(id),created INTEGER NOT NULL,PRIMARY KEY(match_id,revision));
 CREATE TABLE IF NOT EXISTS ratings(game TEXT NOT NULL REFERENCES games(slug),format TEXT NOT NULL,player_id INTEGER NOT NULL REFERENCES players(id),elo REAL NOT NULL,peak REAL NOT NULL,PRIMARY KEY(game,format,player_id));
 CREATE TABLE IF NOT EXISTS ledger(match_id INTEGER NOT NULL REFERENCES matches(id),player_id INTEGER NOT NULL REFERENCES players(id),revision INTEGER NOT NULL,before REAL NOT NULL,delta REAL NOT NULL,after REAL NOT NULL,PRIMARY KEY(match_id,player_id));
 CREATE INDEX IF NOT EXISTS ledger_player ON ledger(player_id,match_id);
 CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY,account_id INTEGER NOT NULL REFERENCES accounts(id),kind TEXT NOT NULL,message TEXT NOT NULL,href TEXT NOT NULL,created INTEGER NOT NULL,seen INTEGER NOT NULL DEFAULT 0);
 CREATE INDEX IF NOT EXISTS notifications_account ON notifications(account_id,seen,id);
 CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,actor INTEGER REFERENCES accounts(id),action TEXT NOT NULL,subject TEXT NOT NULL,detail TEXT NOT NULL,created INTEGER NOT NULL);
 INSERT OR IGNORE INTO migrations VALUES(1);
 `);
  const insert = db.prepare("INSERT OR IGNORE INTO games VALUES(?,?,?,?,?)");
  for (const g of games) insert.run(...g, JSON.stringify(weights));
  db.transaction(() => {
    if (db.prepare("SELECT 1 FROM migrations WHERE version=2").get()) return;
    // Preserve old uploads in the library. If editions disagree, the newest
    // upload becomes the shared default; all older badges remain selectable.
    const legacy = db
      .prepare(
        `SELECT c.*,t.name,t.gender FROM catalog_images c
      JOIN teams t ON t.game=c.game AND t.code=c.key
      JOIN games g ON g.slug=t.game AND g.kind='fc'
      WHERE c.kind='team' ORDER BY c.updated DESC,c.game DESC`,
      )
      .all();
    for (const row of legacy) {
      db.prepare(
        "INSERT OR IGNORE INTO team_badges(name,image,updated) VALUES(?,?,?)",
      ).run(row.name + " · " + row.gender, row.image, row.updated);
      const badge = db
        .prepare("SELECT id FROM team_badges WHERE image=?")
        .get(row.image);
      db.prepare(
        "INSERT OR IGNORE INTO team_badge_links(code,gender,badge_id) VALUES(?,?,?)",
      ).run(row.key, row.gender, badge.id);
    }
    db.prepare("DELETE FROM catalog_images WHERE kind='team'").run();
    db.prepare("INSERT INTO migrations VALUES(2)").run();
  })();
  db.transaction(() => {
    if (db.prepare("SELECT 1 FROM migrations WHERE version=5").get()) return;
    db.exec(
      "ALTER TABLE matches ADD COLUMN played_at INTEGER; ALTER TABLE matches ADD COLUMN duration_minutes INTEGER",
    );
    db.exec(
      "CREATE INDEX matches_played_timeline ON matches(game,format,COALESCE(played_at,submitted),id)",
    );
    db.prepare("INSERT INTO migrations VALUES(5)").run();
  })();
  return db;
}
export const json = (v, fallback = {}) => {
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
};
export const fail = (message, statusCode = 400) => {
  throw Object.assign(new Error(message), { statusCode });
};
export const assert = (condition, message, status = 400) => {
  if (!condition) fail(message, status);
};
export const textValue = (v, max = 120) => {
  assert(
    typeof v === "string" && v.trim().length && v.trim().length <= max,
    `Enter text between 1 and ${max} characters.`,
  );
  return v.trim();
};
export const integer = (v, min = 0, max = 1000000000) => {
  assert(
    Number.isSafeInteger(Number(v)) && Number(v) >= min && Number(v) <= max,
    `Enter a whole number between ${min} and ${max}.`,
  );
  return Number(v);
};
export const page = (q = {}) => ({
  limit: Math.min(100, integer(q.limit ?? 25, 1)),
  offset: integer(q.offset ?? 0, 0),
});
export function audit(db, actor, action, subject, detail = {}) {
  db.prepare(
    "INSERT INTO audit(actor,action,subject,detail,created) VALUES(?,?,?,?,?)",
  ).run(
    actor?.id || null,
    action,
    String(subject),
    JSON.stringify(detail),
    Date.now(),
  );
}
export function admin(db, user, game) {
  return (
    !!user &&
    (!!user.site_admin ||
      !!db
        .prepare("SELECT 1 FROM game_admins WHERE account_id=? AND game=?")
        .get(user.id, game))
  );
}
export function organizer(db, user, comp) {
  return !!user && (user.id === comp.owner || admin(db, user, comp.game));
}
export function notify(db, game, players, kind, message, href) {
  const recipients = db
    .prepare(
      `SELECT DISTINCT a.id,a.preferences FROM accounts a WHERE a.active=1 AND (a.player_id IN (SELECT value FROM json_each(?)) OR a.site_admin=1 OR EXISTS(SELECT 1 FROM game_admins g WHERE g.account_id=a.id AND g.game=?))`,
    )
    .all(JSON.stringify(players), game);
  for (const a of recipients)
    if (json(a.preferences)[kind] !== false)
      db.prepare(
        "INSERT INTO notifications(account_id,kind,message,href,created) VALUES(?,?,?,?,?)",
      ).run(a.id, kind, message, href, Date.now());
}
