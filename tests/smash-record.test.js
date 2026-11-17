import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { createApp } from "../server/app.js";
import { register, passwordHash } from "../server/auth.js";

test("Smash roster, inherited picks, sudden death, doubles and corrections on desktop and mobile", async (t) => {
  const app = await createApp({ database: ":memory:" });
  t.after(() => app.close());
  await app.listen({ port: 0, host: "127.0.0.1" });
  const base = "http://127.0.0.1:" + app.server.address().port;
  const password = await passwordHash("SmashBrowserPassword!");
  const users = Array.from({ length: 4 }, (_, i) =>
    register(
      app.db,
      { name: "Smash Tester " + i, handle: "smashtester" + i },
      password,
      null,
      i === 0,
    ),
  );
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [],
    broken = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => {
    if (errors.length) console.log("Browser errors:", errors);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !response.url().endsWith("/preview"))
      broken.push(response.url() + " " + response.status());
  });
  const login = await context.request.post(base + "/api/login", {
    headers: { "x-mimelo-request": "1" },
    data: { identity: users[0].handle, password: "SmashBrowserPassword!" },
  });
  assert.equal(login.status(), 200);
  const session = await login.json();
  mkdirSync("artifacts", { recursive: true });
  async function visit(query = "") {
    await page.goto(base + "/game.html?game=smash&view=record" + query);
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    assert.equal(await page.locator("#load-error").count(), 0);
  }
  const pick = (game, key) =>
    page.locator(`[data-game="${game}"][data-pick="${key}"]`);
  async function choose(game, key, name) {
    await pick(game, key).click();
    const d = page.locator("dialog.smash-picker-dialog[open]");
    await d.getByRole("searchbox").fill(name);
    await d.locator("[data-entry]").filter({ hasText: name }).first().click();
  }
  async function choosePlayer(side, index, user) {
    const player = await page.evaluate(
      (id) => APP.api("players/" + id),
      user.player_id,
    );
    await page.locator(`#field-p${side}${index}-search`).fill(player.name);
    await page
      .locator(`#field-p${side}${index}-search-results`)
      .getByRole("option")
      .filter({ hasText: player.name })
      .click();
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await visit();
    await choosePlayer(1, 0, users[1]);
    assert.equal(await page.locator(".smash-sudden-death:visible").count(), 0);
    await pick(0, "fighter0").click();
    const dialog = page.locator("dialog.smash-picker-dialog[open]");
    await dialog.locator("[data-entry]").first().waitFor();
    assert.equal(await dialog.locator("[data-entry]").count(), 86);
    assert(
      (await dialog.locator(".fighter-number").allTextContents()).every(
        (number) => !number.includes("#"),
      ),
    );
    assert(
      await dialog
        .locator(".fighter-number")
        .first()
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize) >= 38),
      "Roster numbers are large background numerals.",
    );
    if (width === 1440) {
      assert(
        await dialog
          .locator(".smash-picker-results")
          .evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
        "The full desktop roster should fit without scrolling.",
      );
    }
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".smash-roster-tile img")].every(
        (img) => img.complete && img.naturalWidth > 0,
      ),
    );
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".roster-name b")].every((name) => {
        const bounds = name.getBoundingClientRect(),
          tile = name.closest("button").getBoundingClientRect();
        return bounds.left >= tile.left && bounds.right <= tile.right + 1;
      }),
    );
    if (width === 1440) {
      assert(
        (await dialog.boundingBox()).width >= 1300,
        "Use the available desktop width.",
      );
      assert.deepEqual(
        await dialog
          .locator(".smash-roster-tile")
          .evaluateAll((tiles) => [
            ...new Set(
              tiles.map((tile) => tile.getBoundingClientRect().height),
            ),
          ]),
        [78],
      );
    }
    await page.screenshot({ path: `artifacts/smash-roster-${width}.png` });
    await dialog.getByRole("searchbox").fill("21ε");
    assert.equal(await dialog.locator("[data-entry]").count(), 1);
    assert.equal(await dialog.locator("sup").innerText(), "ε");
    await dialog.locator("[data-entry]").click();
    await choose(0, "fighter1", "Pokémon Trainer");
    await pick(0, "stage").click();
    const stages = page.locator("dialog.smash-picker-dialog[open]");
    assert.deepEqual(
      await stages
        .locator(".stage-picker-group")
        .first()
        .locator("b")
        .allTextContents(),
      ["Battlefield", "Final Destination", "Smashville"],
    );
    assert.equal(
      await stages
        .locator(".stage-picker-group")
        .nth(1)
        .locator("[data-entry]")
        .count(),
      7,
    );
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".smash-stage-grid img")].every(
        (img) => img.complete && img.naturalWidth > 0,
      ),
    );
    await page.screenshot({ path: `artifacts/smash-stages-${width}.png` });
    await stages
      .getByRole("button", { name: "Battlefield", exact: true })
      .click();
    assert.match(await pick(2, "fighter0").innerText(), /Lucina/);
    assert.match(await pick(2, "stage").innerText(), /Battlefield/);
    await choose(1, "fighter0", "Pyra/Mythra");
    await choose(0, "fighter0", "Mario");
    assert.match(await pick(0, "fighter0").innerText(), /Mario/);
    assert.match(await pick(1, "fighter0").innerText(), /Pyra\/Mythra/);
    assert.match(await pick(2, "fighter0").innerText(), /Pyra\/Mythra/);
    await page.locator("#field-score0a").fill("3");
    await page.locator("#field-score0b").fill("1");
    await page.locator("#field-bestOf").selectOption("5");
    assert.equal(await page.locator("#field-score0a").inputValue(), "3");
    assert.match(await pick(4, "fighter0").innerText(), /Pyra\/Mythra/);
    await page.locator("#field-bestOf").selectOption("3");
    await page.locator("#field-score1a").fill("2");
    await page.locator("#field-score1b").fill("2");
    assert.equal(await page.locator(".smash-sudden-death:visible").count(), 1);
    await page.locator('#record-form button[type="submit"]').click();
    assert.match(
      await page.locator("#record-error").innerText(),
      /sudden-death winner for game 2/,
    );
    await page.locator('[name="sd-winner1"][value="1"]').check();
    await page.locator("#field-score1b").fill("1");
    assert.equal(await page.locator(".smash-sudden-death:visible").count(), 0);
    assert.equal(await page.locator('[name="sd-winner1"]:checked').count(), 0);
    await page.locator("#field-score1b").fill("2");
    await page.locator('[name="sd-winner1"][value="0"]').check();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert(
      await page
        .locator("#field-score0a")
        .evaluate((input) => input.getBoundingClientRect().width <= 50),
    );
    await page.locator("#record-error").evaluate((el) => {
      el.textContent = "";
    });
    await page.evaluate(() => {
      document.activeElement.blur();
      scrollTo({ top: 0, behavior: "instant" });
    });
    await page.waitForFunction(() => scrollY === 0);
    await page.screenshot({
      path: `artifacts/smash-record-${width}.png`,
      fullPage: true,
    });
    await page.locator('#record-form button[type="submit"]').click();
    await page.waitForURL(/match=/);
    const id = new URL(page.url()).searchParams.get("match");
    const saved = JSON.parse(
      app.db.prepare("SELECT score FROM matches WHERE id=?").get(id).score,
    );
    assert.equal(saved.games.length, 2);
    assert.equal(saved.games[1].suddenDeath, true);
    assert.equal(saved.games[1].winner, 0);
    assert.deepEqual(saved.games[1].fighters, [
      "Pyra/Mythra",
      "Pokémon Trainer",
    ]);
    assert.equal(saved.games[1].stage, "Battlefield");
    await visit("&edit=" + id);
    assert.equal(
      await page.locator('[name="sd-winner1"][value="0"]').isChecked(),
      true,
    );
    assert.match(await pick(1, "fighter0").innerText(), /Pyra\/Mythra/);
  }
  await visit();
  await page.locator("#field-record-format").selectOption("doubles");
  await page.locator("#field-p01-search").waitFor();
  for (let side = 0; side < 2; side++)
    for (let j = 0; j < 2; j++)
      await choosePlayer(side, j, users[side * 2 + j]);
  await page.locator("#field-bestOf").selectOption("1");
  for (const [j, name] of ["Mario", "Link", "Kirby", "Fox"].entries())
    await choose(0, "fighter" + j, name);
  await choose(0, "stage", "Smashville");
  await page.locator("#field-score0a").fill("6");
  await page.locator("#field-score0b").fill("4");
  assert.equal(await page.locator("#jv0").count(), 0);
  await page.locator('#record-form button[type="submit"]').click();
  await page.waitForURL(/match=/);
  // Old individual forms retain both their names and their stable uploaded-image IDs.
  const historical = await context.request.post(
    base + "/api/games/smash/matches",
    {
      headers: { "x-mimelo-request": "1", "x-csrf-token": session.csrf },
      data: {
        format: "singles",
        sides: [[users[0].player_id], [users[1].player_id]],
        score: {
          bestOf: 1,
          games: [
            {
              a: 3,
              b: 1,
              fighters: ["Squirtle", "Mythra"],
              stage: "Battlefield",
            },
          ],
        },
      },
    },
  );
  assert.equal(historical.status(), 200, await historical.text());
  const match = await historical.json();
  assert.deepEqual(
    match.smash_games[0].fighters.map((f) => f.id),
    [38, 87],
  );
  await visit("&edit=" + match.id);
  assert.match(await pick(0, "fighter0").innerText(), /Squirtle/);
  await page.locator('#record-form button[type="submit"]').click();
  await page.waitForURL(/match=/);
  assert.deepEqual(
    JSON.parse(
      app.db.prepare("SELECT score FROM matches WHERE id=?").get(match.id)
        .score,
    ).games[0].fighters,
    ["Squirtle", "Mythra"],
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(broken, []);
});
