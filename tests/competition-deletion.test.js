import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { createApp } from "../server/app.js";
import { register, passwordHash } from "../server/auth.js";

test("admins can delete started tournaments from desktop and mobile with explicit confirmation", async (t) => {
  mkdirSync("artifacts", { recursive: true });
  const app = await createApp({ database: ":memory:" });
  t.after(() => app.close());
  const password = "DeleteBrowserPassword!";
  const hash = await passwordHash(password);
  const users = [true, false, false].map((siteAdmin, i) =>
    register(
      app.db,
      { name: "Deletion Player " + i, handle: "deleteplayer" + i },
      hash,
      null,
      siteAdmin,
    ),
  );
  const login = await app.inject({
    method: "POST",
    url: "/api/login",
    headers: { "x-mimelo-request": "1" },
    payload: { identity: users[0].handle, password },
  });
  const headers = {
    "x-mimelo-request": "1",
    "x-csrf-token": login.json().csrf,
    cookie: login.cookies.map((c) => c.name + "=" + c.value).join("; "),
  };
  async function call(method, url, payload) {
    const response = await app.inject({ method, url, headers, payload });
    assert.equal(response.statusCode, 200, response.body);
    return response.json();
  }
  await app.listen({ host: "127.0.0.1", port: 0 });
  const base = "http://127.0.0.1:" + app.server.address().port;
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page
    .context()
    .addCookies(
      login.cookies.map((c) => ({ name: c.name, value: c.value, url: base })),
    );
  const ownerPage = await browser.newPage();
  await ownerPage.request.post(base + "/api/login", {
    headers: { "x-mimelo-request": "1" },
    data: { identity: users[1].handle, password },
  });
  for (const width of [1440, 390]) {
    const comp = await call("POST", "/api/competitions", {
      game: "tennis",
      name: "Deletion Cup " + width,
      kind: "knockout",
      entries: users.slice(1).map((u) => [u.player_id]),
      settings: { bestOf: 1 },
    });
    const drawn = await call("POST", `/api/competitions/${comp.id}/draw`, {});
    const match = await call("POST", "/api/games/tennis/matches", {
      fixture: drawn.fixtures[0].id,
      score: { games: [{ a: 6, b: 2 }] },
    });
    if (width === 390) {
      await call("POST", `/api/matches/${match.id}/accept`, { revision: 1 });
      await call("POST", `/api/matches/${match.id}/elo`, { revision: 1 });
    }
    await ownerPage.goto(`${base}/competition.html?game=tennis&id=${comp.id}`);
    await ownerPage.waitForFunction(
      () => document.body.dataset.ready === "true",
    );
    assert.equal(await ownerPage.locator("#delete-comp").isVisible(), false);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${base}/competition.html?game=tennis&id=${comp.id}`);
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    assert.equal(await page.locator("#delete-comp").isVisible(), true);
    await page.locator("#delete-comp").click();
    const dialog = page.locator("dialog[open]");
    assert.match(await dialog.innerText(), /fixtures, results, score history/);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.equal(await dialog.count(), 0);
    assert(
      app.db.prepare("SELECT 1 FROM competitions WHERE id=?").get(comp.id),
    );
    await page.locator("#delete-comp").click();
    await dialog
      .getByLabel("Type the competition name to confirm")
      .fill("Wrong name");
    await dialog
      .getByRole("button", { name: "Delete permanently", exact: true })
      .click();
    await dialog
      .getByRole("alert")
      .filter({ hasText: "Type the competition name exactly" })
      .waitFor();
    assert(
      app.db.prepare("SELECT 1 FROM competitions WHERE id=?").get(comp.id),
    );
    assert.equal(
      await dialog
        .getByRole("button", { name: "Delete permanently", exact: true })
        .isEnabled(),
      true,
    );
    await page.screenshot({
      path: `artifacts/competition-delete-${width}.png`,
      fullPage: true,
    });
    await dialog
      .getByLabel("Type the competition name to confirm")
      .fill(comp.name);
    await dialog
      .getByRole("button", { name: "Delete permanently", exact: true })
      .click();
    await page.waitForURL(/game\.html\?game=tennis&view=competitions/);
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    assert.equal(
      app.db
        .prepare("SELECT COUNT(*) n FROM competitions WHERE id=?")
        .get(comp.id).n,
      0,
    );
    assert.equal(
      app.db
        .prepare("SELECT COUNT(*) n FROM matches WHERE competition_id=?")
        .get(comp.id).n,
      0,
    );
    assert.equal(
      await page.getByRole("heading", { name: comp.name, exact: true }).count(),
      0,
    );
  }
  assert.deepEqual(errors, []);
});
