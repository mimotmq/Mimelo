import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { chromium } from "@playwright/test";
import { createApp } from "../server/app.js";
import { register, passwordHash } from "../server/auth.js";

test("global profiles show real game records, nationalities use flags, and admins manage player photos", async (t) => {
  const uploads = mkdtempSync(join(tmpdir(), "mimelo-profile-browser-"));
  const app = await createApp({ database: ":memory:", uploads });
  const hash = await passwordHash("ProfileBrowserPassword!");
  const users = ["Alex Morgan", "Jordan Smith", "No Games Yet"].map((name, i) =>
    register(
      app.db,
      { name, handle: "profilebrowser" + i },
      hash,
      null,
      i === 0,
    ),
  );
  await app.listen({ host: "127.0.0.1", port: 0 });
  const base = "http://127.0.0.1:" + app.server.address().port;
  const browser = await chromium.launch();
  t.after(async () => {
    await browser.close();
    await app.close();
    rmSync(uploads, { recursive: true, force: true });
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const login = await context.request.post(base + "/api/login", {
    headers: { "x-mimelo-request": "1" },
    data: { identity: users[0].handle, password: "ProfileBrowserPassword!" },
  });
  const headers = {
    "x-mimelo-request": "1",
    "x-csrf-token": (await login.json()).csrf,
  };
  async function call(path, data, method = "POST") {
    const response = await context.request.fetch(base + "/api/" + path, {
      method,
      headers,
      ...(data === undefined ? {} : { data }),
    });
    assert.equal(response.status(), 200, await response.text());
    return response.json();
  }
  await call(
    "me",
    {
      profile: {
        nationalities: ["Lebanon", "Syria"],
        favoriteTeam: "Manchester United",
        tag: "ExampleTag",
        mains: "Link, Kirby",
      },
    },
    "PATCH",
  );
  app.db
    .prepare("UPDATE players SET profile=? WHERE id=?")
    .run(
      JSON.stringify({ nationalities: ["Canada"], nationality: "Canada" }),
      users[1].player_id,
    );
  for (const game of ["tennis", "tt", "pickleball"]) {
    const match = await call(`games/${game}/matches`, {
      format: "singles",
      sides: [[users[0].player_id], [users[1].player_id]],
      score: {
        bestOf: 1,
        ...(game === "tennis" ? {} : { target: 11 }),
        games: [{ a: game === "tennis" ? 6 : 11, b: 2 }],
      },
    });
    await call(`matches/${match.id}/accept`, { revision: 1 });
    await call(`matches/${match.id}/elo`, { revision: 1 });
  }
  const fill = await call("players", { name: "Photo Fill-in" });
  mkdirSync("artifacts", { recursive: true });
  async function visit(path) {
    await page.goto(base + path);
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator("#load-error").count(), 0);
  }
  async function fits() {
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      page.url() + " overflows the viewport",
    );
  }
  for (const width of [1440, 900, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await visit("/");
    const geometry = await page
      .locator(".games-grid .game-card")
      .evaluateAll((cards) =>
        cards.map((card) => ({
          width: card.getBoundingClientRect().width,
          height: card.getBoundingClientRect().height,
          cta: card
            .querySelector(".game-card-cta")
            .getBoundingClientRect()
            .toJSON(),
          transform: getComputedStyle(card.querySelector(".game-card-cta"))
            .textTransform,
          arrows: card.querySelectorAll(".game-card-cta svg").length,
        })),
      );
    assert.equal(geometry.length, 6);
    for (const card of geometry) {
      assert(Math.abs(card.width - geometry[0].width) <= 1);
      assert(Math.abs(card.height - geometry[0].height) <= 1);
      assert.equal(card.cta.width, geometry[0].cta.width);
      assert.equal(card.transform, "none");
      assert.equal(card.arrows, 1);
    }
    await fits();
    await page
      .locator(".games-grid")
      .screenshot({ path: `artifacts/uniform-home-games-${width}.png` });
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await visit(`/player.html?player=${users[0].player_id}`);
    assert.equal(await page.locator(".game-identity,.sidebar").count(), 0);
    assert.match(await page.locator(".breadcrumb").innerText(), /Home/);
    assert.equal(await page.locator("[data-profile-game]").count(), 3);
    assert.equal(
      await page.locator('.profile-game-card[href*="eafc"]').count(),
      0,
    );
    assert.equal(await page.locator("#player-flairs .country-flag").count(), 2);
    await fits();
    await page.screenshot({
      path: `artifacts/player-all-games-${width}.png`,
      fullPage: true,
    });
    await page.locator('[data-profile-game="tennis"]').click();
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    assert.equal(
      await page
        .locator(
          '[data-profile-flair="favoriteTeam"],[data-profile-flair="mains"]',
        )
        .count(),
      0,
    );
    assert(!/Peak/.test(await page.locator(".player-hero").innerText()));
    assert.equal(await page.locator("#recent-body .country-flag").count(), 3);
    await fits();
    await page.screenshot({
      path: `artifacts/player-tennis-flags-${width}.png`,
      fullPage: true,
    });
    await visit(`/player.html?player=${users[2].player_id}`);
    assert.match(
      await page.locator("main").innerText(),
      /No recorded games yet/,
    );
    assert(!/1,000|1000|Peak/.test(await page.locator("main").innerText()));
    await visit(`/player.html?player=${users[2].player_id}&game=tennis`);
    assert.match(await page.locator("main").innerText(), /No matches recorded/);
    assert.equal(await page.locator("#spark-wrap").isVisible(), false);
    await visit("/account.html");
    assert.equal(await page.locator(".game-identity,.sidebar").count(), 0);
    assert(!/EA FC 27/.test(await page.locator(".breadcrumb").innerText()));
    assert.equal(await page.locator("#field-nationality option").count(), 250);
    await page
      .locator("#field-nationality-secondary")
      .selectOption("United States");
    assert.equal(
      await page
        .locator('#field-nationality option[value="United States"]')
        .isDisabled(),
      true,
    );
    await page.locator("#profile-form button[type=submit]").click();
    await page.locator("#toast").filter({ hasText: "Profile saved" }).waitFor();
    assert.deepEqual(
      JSON.parse(
        app.db
          .prepare("SELECT profile FROM players WHERE id=?")
          .get(users[0].player_id).profile,
      ).nationalities,
      ["Lebanon", "United States"],
    );
    assert(
      !/EA FC 27|1,000/.test(
        await page.locator(".settings-side .summary-meta").innerText(),
      ),
    );
    await fits();
    await page.evaluate(() => {
      document.activeElement?.blur();
      scrollTo({ top: 0, behavior: "instant" });
    });
    await page.screenshot({
      path: `artifacts/account-global-${width}.png`,
      fullPage: true,
    });
    for (const game of ["tennis", "tt", "pickleball"]) {
      await visit(`/game.html?game=${game}&view=rankings`);
      assert.equal(await page.locator("#elo-body .country-flag").count(), 3);
      assert.deepEqual(
        await page.locator('#elo-body td[data-label="Peak"]').allTextContents(),
        ["—", "—"],
      );
      await visit(`/game.html?game=${game}&view=matches`);
      assert.equal(
        await page.locator("#matches-body .country-flag").count(),
        3,
      );
      await fits();
    }
  }
  await visit("/admin.html");
  await page.locator("#adt-people").click();
  await page.locator(`[data-person="${fill.id}"]`).click();
  const dialog = page.locator("dialog[open]");
  const image = await sharp({
    create: { width: 30, height: 30, channels: 4, background: "#4682b4" },
  })
    .png()
    .toBuffer();
  await dialog.locator("input[type=file]").setInputFiles({
    name: "profile.png",
    mimeType: "image/png",
    buffer: image,
  });
  await dialog
    .locator("[role=alert]")
    .filter({ hasText: "Profile picture saved." })
    .waitFor();
  assert(
    app.db.prepare("SELECT photo FROM players WHERE id=?").get(fill.id).photo,
  );
  await page.screenshot({
    path: "artifacts/admin-player-photo-mobile.png",
    fullPage: true,
  });
  await dialog
    .getByRole("button", { name: "Remove photo", exact: true })
    .click();
  await dialog
    .locator("[role=alert]")
    .filter({ hasText: "Profile picture removed." })
    .waitFor();
  assert.equal(
    app.db.prepare("SELECT photo FROM players WHERE id=?").get(fill.id).photo,
    null,
  );
  assert.deepEqual(errors, []);
});
