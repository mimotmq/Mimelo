import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { createApp } from "../server/app.js";
import { register, passwordHash } from "../server/auth.js";

test("desktop rail and mobile header menu support mouse, keyboard and touch", async (t) => {
  const app = await createApp({ database: ":memory:" });
  t.after(() => app.close());
  const pw = await passwordHash("NavigationPassword!");
  const user = register(
    app.db,
    { name: "Navigation Tester", handle: "navigationtester" },
    pw,
    null,
    true,
  );
  const opponent = register(
    app.db,
    { name: "Navigation Opponent", handle: "navigationopponent" },
    pw,
  );
  const login = await app.inject({
    method: "POST",
    url: "/api/login",
    headers: { "x-mimelo-request": "1" },
    payload: { identity: user.handle, password: "NavigationPassword!" },
  });
  const competition = await app.inject({
    method: "POST",
    url: "/api/competitions",
    headers: {
      "x-mimelo-request": "1",
      "x-csrf-token": login.json().csrf,
      cookie: login.cookies.map((c) => c.name + "=" + c.value).join("; "),
    },
    payload: {
      game: "smash",
      name: "Navigation Cup",
      kind: "knockout",
      format: "singles",
      entries: [[user.player_id], [opponent.player_id]],
      settings: { elimination: "single", seeding: "elo", bestOf: 1 },
    },
  });
  assert.equal(competition.statusCode, 200, competition.body);
  await app.listen({ port: 0, host: "127.0.0.1" });
  const base = "http://127.0.0.1:" + app.server.address().port;
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  mkdirSync("artifacts", { recursive: true });
  async function visit(path) {
    await page.goto(base + path);
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    assert.equal(
      await page.locator("#load-error").count(),
      0,
      await page.locator("body").innerText(),
    );
  }
  const shell = page.locator(".adaptive-navigation"),
    sidebar = page.locator(".sidebar"),
    edge = page.locator(".navigation-edge"),
    menu = page.locator(".navigation-menu");
  await visit("/game.html?game=smash");
  assert.equal(await shell.getAttribute("data-nav-mode"), "drawer");
  assert.equal(await shell.getAttribute("data-nav-open"), "false");
  assert.equal(await page.locator(".navigation-toggle").count(), 0);
  assert.equal(await menu.isVisible(), false);
  assert.equal(await sidebar.getByRole("link", { name: "Matches" }).isVisible(), true);
  const recentName = page.locator("#overview-competition-list strong");
  assert.equal(await recentName.innerText(), "Navigation Cup");
  await recentName.evaluate(el => { el.style.maxWidth = "40px"; });
  await page.waitForFunction(() =>
    document.querySelector("#overview-competition-list [data-name-overflow] .fixture-name-text")?.getAnimations().length > 0,
  );
  await recentName.evaluate(el => el.style.removeProperty("max-width"));
  await page.waitForFunction(() => !document.querySelector("#overview-competition-list [data-name-overflow]"));
  await page.screenshot({ path: "artifacts/navigation-overview-desktop.png" });
  await sidebar.locator('[data-view="matches"]').click();
  assert.equal(await shell.getAttribute("data-nav-mode"), "drawer");
  assert.equal(await shell.getAttribute("data-nav-open"), "false");
  // Measure the layout after the asynchronous matches view has finished rendering.
  await page
    .locator("#matches-body")
    .getByText("No matching results.")
    .waitFor();
  await page.evaluate(() => document.fonts.ready);
  const closedMain = await page.locator("main").boundingBox();
  await page.locator("main").click({ position: { x: 500, y: 100 } });
  const rankingsLink = sidebar.getByRole("link", { name: "Rankings", exact: true });
  const closedIcon = await rankingsLink.locator("svg").boundingBox();
  await page.mouse.move(2, 200);
  await page.waitForFunction(
    () => document.querySelector(".app-body").dataset.navOpen === "true",
  );
  assert.deepEqual(
    await page.locator("main").boundingBox(),
    closedMain,
    "Hover drawer overlays the page without moving content.",
  );
  await rankingsLink.hover();
  await sidebar.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)));
  assert.deepEqual(await rankingsLink.locator("svg").boundingBox(), closedIcon);
  await edge.click();
  await page.mouse.move(700, 400);
  await page.locator("main").click({ position: { x: 500, y: 100 } });
  assert.equal(await edge.getAttribute("aria-label"), "Collapse navigation");
  assert.equal(await shell.getAttribute("data-nav-open"), "true");
  await edge.click();
  assert.equal(await shell.getAttribute("data-nav-open"), "false");
  await page.mouse.move(700, 400);
  await rankingsLink.hover();
  await sidebar.evaluate(el => Promise.all(el.getAnimations({subtree: true}).map(a => a.finished)));
  assert.equal(await sidebar.evaluate(el => el.getBoundingClientRect().bottom), 1000);
  await page.screenshot({ path: "artifacts/navigation-hover-desktop.png" });
  await page.mouse.move(700, 400);
  await page.waitForFunction(
    () => document.querySelector(".app-body").dataset.navOpen === "false",
  );
  await edge.focus();
  assert.equal(await shell.getAttribute("data-nav-open"), "true");
  await page.keyboard.press("Tab");
  assert(await sidebar.evaluate((el) => el.contains(document.activeElement)));
  await page.keyboard.press("Escape");
  assert.equal(await shell.getAttribute("data-nav-open"), "false");
  assert(await edge.evaluate((el) => el === document.activeElement));
  await visit("/competition.html?game=smash&id=" + competition.json().id);
  assert.equal(await shell.getAttribute("data-nav-mode"), "drawer");
  await page.mouse.move(2, 200);
  await sidebar.getByRole("link", { name: "Overview", exact: true }).waitFor();
  assert.match(
    await sidebar
      .getByRole("link", { name: "Overview", exact: true })
      .getAttribute("href"),
    /game=smash/,
  );
  await visit("/player.html?game=smash&player=" + user.player_id);
  assert.equal(
    await shell.count(),
    1,
    "Player profiles use the global site navigation",
  );
  assert.equal(
    await page.locator('.main-nav a[href="players.html"]').count(),
    1,
  );
  for (const width of [320, 390, 820]) {
    await page.emulateMedia({
      reducedMotion: width === 390 ? "reduce" : "no-preference",
    });
    await page.setViewportSize({ width, height: 1000 });
    await visit("/");
    assert.equal(await page.locator(".header-actions button:visible").count(), 1);
    assert.equal(await menu.evaluate(el => getComputedStyle(el).backgroundColor), "rgba(0, 0, 0, 0)");
    await visit("/game.html?game=smash");
    const picker = page.locator(".game-switcher summary");
    await picker.click();
    const options = page.locator(".switcher-menu");
    const bounds = await options.boundingBox();
    assert.equal(bounds.x, 0);
    assert.equal(bounds.width, width);
    await page.keyboard.press("Escape");
    assert.equal(await options.isVisible(), false);
    assert.equal(await shell.getAttribute("data-nav-open"), "false");
    assert.equal(
      await menu.isVisible(),
      true,
      JSON.stringify(
        await page.evaluate(() => ({
          width: innerWidth,
          viewport: document.documentElement.clientWidth,
          rootVisibility: document.documentElement.style.visibility,
          menuStyle: getComputedStyle(
            document.querySelector(".navigation-menu"),
          ).display,
          menuVisibility: getComputedStyle(
            document.querySelector(".navigation-menu"),
          ).visibility,
          headerStyle: getComputedStyle(document.querySelector(".site-header"))
            .display,
          mobile: matchMedia("(max-width:1024px)").matches,
          styles: [...document.styleSheets].map((s) => s.href),
        })),
      ),
    );
    assert(await menu.evaluate((el) => !!el.closest(".site-header")));
    await menu.click();
    assert.equal(await edge.isVisible(), false);
    assert.equal(await sidebar.isVisible(), true);
    assert.equal((await sidebar.boundingBox()).width, width);
    await menu.click();
    assert.equal(await sidebar.isVisible(), false);
    await menu.click();
    await page.keyboard.press("Escape");
    assert.equal(await shell.getAttribute("data-nav-open"), "false");
    assert(await menu.evaluate((el) => el === document.activeElement));
    await menu.click();
    await sidebar.locator('[data-view="record"]').click();
    assert.equal(await shell.getAttribute("data-nav-open"), "false");
    assert.equal(await page.locator("main").evaluate((el) => el.inert), false);
    await page.waitForFunction(
      () =>
        getComputedStyle(document.querySelector(".sidebar")).visibility ===
        "hidden",
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({ path: `artifacts/navigation-header-${width}.png` });
  }
  assert.deepEqual(errors, []);
});
