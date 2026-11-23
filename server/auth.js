import {
  randomBytes,
  createHash,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { assert, textValue, audit, json, admin } from "./db.js";
import { rebuild } from "./matches.js";
const scrypt = promisify(scryptCallback);
export const token = () => randomBytes(32).toString("base64url");
export const hash = (s) => createHash("sha256").update(s).digest("hex");
export async function passwordHash(value) {
  assert(
    typeof value === "string" && value.length >= 8 && value.length <= 256,
    "Use a password of 8–256 characters.",
  );
  const salt = randomBytes(16).toString("hex"),
    key = await scrypt(value, salt, 64);
  return salt + ":" + key.toString("hex");
}
export async function passwordValid(value, stored) {
  if (typeof value !== "string" || value.length > 256) return false;
  const [salt, hex] = stored.split(":");
  const key = await scrypt(value, salt, 64);
  return timingSafeEqual(Buffer.from(hex, "hex"), key);
}
export function handleValue(v) {
  const handle = textValue(v, 24).replace(/^@/, "");
  assert(
    /^[a-zA-Z0-9_]{3,24}$/.test(handle),
    "Handle: 3–24 letters, numbers, or underscores.",
  );
  return handle;
}
export function emailValue(v) {
  if (!v) return null;
  const e = textValue(v, 254).toLowerCase();
  assert(
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),
    "Enter a valid email or leave it empty.",
  );
  return e;
}
export function publicUser(db, u) {
  if (!u) return null;
  const p = db.prepare("SELECT * FROM players WHERE id=?").get(u.player_id);
  return {
    id: u.id,
    player_id: u.player_id,
    handle: u.handle,
    email: u.email || "",
    site_admin: !!u.site_admin,
    approved: !!u.approved,
    name: p.name,
    profile: json(p.profile),
    photo: p.photo,
    preferences: json(u.preferences),
    admin_of: db
      .prepare("SELECT game FROM game_admins WHERE account_id=?")
      .all(u.id)
      .map((x) => x.game),
  };
}
export function register(db, body, hashed, playerId = null, siteAdmin = false) {
  const handle = handleValue(body.handle),
    email = emailValue(body.email),
    name = textValue(body.name, 80);
  assert(
    !db
      .prepare(
        "SELECT 1 FROM accounts WHERE handle=? OR (email IS NOT NULL AND email=?)",
      )
      .get(handle, email),
    "Handle or email is already in use.",
    409,
  );
  if (playerId)
    assert(
      !json(
        db.prepare("SELECT profile FROM players WHERE id=?").get(playerId)
          ?.profile,
      ).merged_into,
      "This fill-in was already merged.",
      409,
    );
  if (playerId)
    assert(
      !db.prepare("SELECT 1 FROM accounts WHERE player_id=?").get(playerId),
      "This profile is already claimed.",
      409,
    );
  else
    playerId = Number(
      db
        .prepare("INSERT INTO players(name,created) VALUES(?,?)")
        .run(name, Date.now()).lastInsertRowid,
    );
  db.prepare("UPDATE players SET name=? WHERE id=?").run(name, playerId);
  const id = Number(
    db
      .prepare(
        "INSERT INTO accounts(player_id,handle,email,password,site_admin,created) VALUES(?,?,?,?,?,?)",
      )
      .run(playerId, handle, email, hashed, siteAdmin ? 1 : 0, Date.now())
      .lastInsertRowid,
  );
  return db.prepare("SELECT * FROM accounts WHERE id=?").get(id);
}
export function issueLink(db, kind, target, user) {
  assert(kind === "claim" || kind === "reset", "Invalid link type.");
  if (kind === "reset")
    assert(
      user.site_admin,
      "Only site admins issue password-reset links.",
      403,
    );
  else
    assert(
      user.site_admin ||
        db.prepare("SELECT 1 FROM game_admins WHERE account_id=?").get(user.id),
      "Only admins issue claim links.",
      403,
    );
  assert(
    db
      .prepare(
        `SELECT 1 FROM ${kind === "claim" ? "players" : "accounts"} WHERE id=?`,
      )
      .get(target),
    "Target not found.",
    404,
  );
  if (kind === "claim")
    assert(
      !json(
        db.prepare("SELECT profile FROM players WHERE id=?").get(target)
          ?.profile,
      ).merged_into,
      "This fill-in was already merged.",
      409,
    );
  if (kind === "claim")
    assert(
      !db.prepare("SELECT 1 FROM accounts WHERE player_id=?").get(target),
      "This player already has an account.",
    );
  db.prepare("UPDATE links SET used=1 WHERE kind=? AND target=?").run(
    kind,
    target,
  );
  const raw = token();
  db.prepare("INSERT INTO links VALUES(?,?,?,?,?,0)").run(
    hash(raw),
    kind,
    target,
    user.id,
    Date.now() + (kind === "claim" ? 7 * 864e5 : 36e5),
  );
  audit(db, user, "link.issue", target, { kind });
  return { url: `/login.html?${kind}=${raw}` };
}
export function getLink(db, raw, kind) {
  assert(typeof raw === "string", "Missing link.");
  const l = db
    .prepare(
      "SELECT * FROM links WHERE token=? AND kind=? AND used=0 AND expires>?",
    )
    .get(hash(raw), kind, Date.now());
  assert(l, "This link has expired or has already been used.", 410);
  return l;
}
export function mergePlayer(db, source, target, user) {
  assert(source !== target, "These profiles are already the same.");
  assert(
    !json(
      db.prepare("SELECT profile FROM players WHERE id=?").get(source)?.profile,
    ).merged_into,
    "This profile was already merged.",
    409,
  );
  assert(
    !db.prepare("SELECT 1 FROM accounts WHERE player_id=?").get(source),
    "Only unclaimed fill-ins can be merged.",
  );
  assert(
    !db
      .prepare(
        "SELECT 1 FROM match_players a JOIN match_players b ON a.match_id=b.match_id WHERE a.player_id=? AND b.player_id=?",
      )
      .get(source, target),
    "Both profiles occur in the same match. Resolve this conflict before merging.",
    409,
  );
  assert(
    !db
      .prepare(
        "SELECT 1 FROM entrant_players a JOIN entrant_players b ON a.competition_id=b.competition_id WHERE a.player_id=? AND b.player_id=?",
      )
      .get(source, target),
    "Both profiles are entered in the same competition. Resolve this conflict before merging.",
    409,
  );
  for (const m of db
    .prepare(
      "SELECT id,score FROM matches WHERE id IN(SELECT match_id FROM match_players WHERE player_id=?)",
    )
    .all(source)) {
    const s = json(m.score);
    if (s.fighterPlayers) {
      s.fighterPlayers = s.fighterPlayers.map((id) =>
        id === source ? target : id,
      );
      db.prepare("UPDATE matches SET score=? WHERE id=?").run(
        JSON.stringify(s),
        m.id,
      );
    }
  }
  db.prepare("UPDATE match_players SET player_id=? WHERE player_id=?").run(
    target,
    source,
  );
  db.prepare("UPDATE entrant_players SET player_id=? WHERE player_id=?").run(
    target,
    source,
  );
  const pools = db
    .prepare(
      "SELECT DISTINCT game,format FROM matches WHERE id IN(SELECT match_id FROM match_players WHERE player_id=?)",
    )
    .all(target);
  db.prepare("DELETE FROM ledger WHERE player_id=?").run(source);
  db.prepare("DELETE FROM ratings WHERE player_id=?").run(source);
  // Retain the old identity and immutable revision snapshots for the audit trail.
  db.prepare("UPDATE players SET profile=? WHERE id=?").run(
    JSON.stringify({ merged_into: target }),
    source,
  );
  db.prepare("UPDATE links SET used=1 WHERE kind='claim' AND target=?").run(
    source,
  );
  for (const p of pools) rebuild(db, p.game, p.format);
  audit(db, user, "player.merge", source, { into: target });
}
