import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { createApp } from "../server/app.js";
import { register, passwordHash } from "../server/auth.js";
import { upgradeRatings } from "../server/matches.js";

async function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), "mimelo-profile-"));
  const app = await createApp({ database: ":memory:", uploads: dir });
  t.after(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const hash = await passwordHash("ProfileTestPassword!");
  const users = [0, 1, 2, 3].map((i) =>
    register(
      app.db,
      { name: "Profile Player " + i, handle: "profiletest" + i },
      hash,
      null,
      i === 0,
    ),
  );
  const sessions = [];
  for (const user of users) {
    const login = await app.inject({
      method: "POST",
      url: "/api/login",
      headers: { "x-mimelo-request": "1" },
      payload: { identity: user.handle, password: "ProfileTestPassword!" },
    });
    sessions.push({
      cookie: login.cookies.map((c) => c.name + "=" + c.value).join("; "),
      "x-csrf-token": login.json().csrf,
      "x-mimelo-request": "1",
    });
  }
  async function call(index, method, url, payload, status = 200) {
    const response = await app.inject({
      method,
      url,
      headers: index == null ? {} : sessions[index],
      ...(payload === undefined ? {} : { payload }),
    });
    assert.equal(response.statusCode, status, response.body);
    return response.json();
  }
  const match = () => ({
    format: "singles",
    sides: [[users[1].player_id], [users[2].player_id]],
    score: { bestOf: 1, games: [{ a: 6, b: 2 }] },
  });
  return { app, users, sessions, call, match };
}

test("player summaries contain actual activity and remove voided-only game records", async (t) => {
  const { users, call, match } = await setup(t);
  const path = "/api/players/" + users[1].player_id;
  assert.deepEqual((await call(null, "GET", path)).records, []);
  const m = await call(1, "POST", "/api/games/tennis/matches", {
    ...match(),
    elo_enabled: false,
  });
  let profile = await call(null, "GET", path);
  assert.deepEqual(profile.ratings, []);
  assert.equal(profile.records.length, 1);
  assert.equal(profile.records[0].game, "tennis");
  assert.equal(profile.records[0].pending, 1);
  await call(0, "POST", `/api/matches/${m.id}/accept`, { revision: 1 });
  profile = await call(null, "GET", path);
  assert.equal(profile.records[0].accepted, 1);
  assert.equal(profile.records[0].w, 1);
  assert.deepEqual(profile.ratings, []);
  assert.deepEqual(
    (await call(null, "GET", "/api/players?game=tennis")).rows
      .map((p) => p.id)
      .sort(),
    [users[1].player_id, users[2].player_id].sort(),
  );
  assert.equal(
    (await call(null, "GET", "/api/players?game=pickleball")).total,
    0,
  );
  const directory = await call(null, "GET", "/api/players");
  assert.deepEqual(
    directory.rows.find((p) => p.id === users[1].player_id).records,
    profile.records,
  );
  await call(0, "DELETE", `/api/matches/${m.id}`, { revision: 1 });
  assert.deepEqual((await call(null, "GET", path)).records, []);
});

test("established peaks begin at match eight, exclude earlier highs, and migrate without changing Elo", async (t) => {
  const { app, users, call, match } = await setup(t);
  const matches = [];
  const profile = async () =>
    call(null, "GET", "/api/players/" + users[1].player_id);
  for (let i = 0; i < 9; i++) {
    const input = match();
    if (i >= 7) input.score.games = [{ a: 2, b: 6 }];
    const m = await call(1, "POST", "/api/games/tennis/matches", input);
    matches.push(m);
    await call(0, "POST", `/api/matches/${m.id}/accept`, { revision: 1 });
    await call(0, "POST", `/api/matches/${m.id}/elo`, { revision: 1 });
    const rating = (await profile()).ratings[0];
    if (i < 7) assert.equal(rating.peak, null);
    else if (i === 7) assert.equal(rating.peak, rating.elo);
  }
  const history = app.db
    .prepare("SELECT * FROM ledger WHERE player_id=? ORDER BY match_id")
    .all(users[1].player_id);
  const expected = history[7].after;
  assert(
    history[6].after > expected,
    "The provisional high must exceed the established peak in this scenario.",
  );
  assert.equal((await profile()).ratings[0].peak, expected);
  const ledger = app.db
    .prepare("SELECT * FROM ledger ORDER BY match_id,player_id")
    .all();
  app.db.prepare("UPDATE ratings SET peak=9999").run();
  app.db.prepare("DELETE FROM migrations WHERE version=4").run();
  upgradeRatings(app.db);
  assert.deepEqual(
    app.db.prepare("SELECT * FROM ledger ORDER BY match_id,player_id").all(),
    ledger,
  );
  assert.equal((await profile()).ratings[0].peak, expected);
  await call(0, "DELETE", `/api/matches/${matches[0].id}`, { revision: 1 });
  assert.equal((await profile()).ratings[0].provisional, false);
  await call(0, "DELETE", `/api/matches/${matches[1].id}`, { revision: 1 });
  assert.equal((await profile()).ratings[0].peak, null);
});

test("nationalities are optional, limited to two different countries, and included with match participants", async (t) => {
  const { users, call, match } = await setup(t);
  const saved = await call(1, "PATCH", "/api/me", {
    profile: { nationalities: ["Lebanon", "Syria"] },
  });
  assert.deepEqual(saved.profile.nationalities, ["Lebanon", "Syria"]);
  assert.equal(saved.profile.nationality, "Lebanon");
  for (const nationalities of [
    ["Lebanon", "Syria", "France"],
    ["Lebanon", "Lebanon"],
    ["Not a country"],
  ])
    await call(1, "PATCH", "/api/me", { profile: { nationalities } }, 400);
  const m = await call(1, "POST", "/api/games/tennis/matches", match());
  assert.deepEqual(
    m.participants.find((p) => p.id === users[1].player_id).nationalities,
    ["Lebanon", "Syria"],
  );
  const cleared = await call(1, "PATCH", "/api/me", {
    profile: { nationalities: [] },
  });
  assert.equal(cleared.profile.nationality, "");
  assert.deepEqual(cleared.profile.nationalities, []);
});

test("admins upload and remove player photos while ordinary accounts cannot", async (t) => {
  const { app, users, sessions, call } = await setup(t);
  const fill = await call(0, "POST", "/api/players", { name: "Photo Fill-in" });
  const png = await sharp({
    create: { width: 12, height: 12, channels: 4, background: "#5daaff" },
  })
    .png()
    .toBuffer();
  async function upload(index, id, data = png) {
    const boundary = "profile-photo-test";
    return app.inject({
      method: "POST",
      url: `/api/admin/players/${id}/photo`,
      headers: {
        ...sessions[index],
        "content-type": "multipart/form-data; boundary=" + boundary,
      },
      payload: Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="photo.png"\r\nContent-Type: image/png\r\n\r\n`,
        ),
        data,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]),
    });
  }
  assert.equal((await upload(1, fill.id)).statusCode, 403);
  const response = await upload(0, fill.id);
  assert.equal(response.statusCode, 200, response.body);
  const { photo } = response.json();
  assert.equal(
    (await call(null, "GET", "/api/players/" + fill.id)).photo,
    photo,
  );
  const image = await app.inject(photo);
  assert.equal(image.statusCode, 200);
  assert.equal((await sharp(image.rawPayload).metadata()).format, "webp");
  assert.equal(
    (await upload(0, fill.id, Buffer.from("not an image"))).statusCode,
    400,
  );
  assert.equal(
    (await call(null, "GET", "/api/players/" + fill.id)).photo,
    photo,
  );
  await call(
    1,
    "DELETE",
    `/api/admin/players/${fill.id}/photo`,
    undefined,
    403,
  );
  await call(0, "DELETE", `/api/admin/players/${fill.id}/photo`);
  assert.equal(
    (await call(null, "GET", "/api/players/" + fill.id)).photo,
    null,
  );
  await call(0, "POST", "/api/admin/roles", {
    account: users[3].id,
    game: "tennis",
    enabled: true,
  });
  assert.equal((await upload(3, users[1].player_id)).statusCode, 200);
});
