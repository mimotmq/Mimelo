import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { createApp } from "../server/app.js";
import { register, passwordHash } from "../server/auth.js";
import { mkdirSync } from "node:fs";

test("competition chances, confirmed overlays, extra qualifiers and separate cross-group tiebreaks work on desktop and mobile", async (t) => {
  const app = await createApp({ database: ":memory:" });
  const hash = await passwordHash("OutlookBrowser!");
  const user = register(
    app.db,
    { name: "Outlook Admin", handle: "outlookbrowser" },
    hash,
    null,
    true,
  );
  const ids = [user.player_id];
  for (const name of [
    "Bashar Fakhreddin",
    "Jordan Smith",
    "Taylor Lee",
    "Alex Morgan",
    "Robin Casey",
    "Sam Jones",
    "Devin Parker",
  ])
    ids.push(
      Number(
        app.db
          .prepare("INSERT INTO players(name,created) VALUES(?,?)")
          .run(name, Date.now()).lastInsertRowid,
      ),
    );
  await app.listen({ host: "127.0.0.1", port: 0 });
  const base = "http://127.0.0.1:" + app.server.address().port;
  const browser = await chromium.launch();
  t.after(async () => {
    await browser.close();
    await app.close();
  });
  const context = await browser.newContext(),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const login = await context.request.post(base + "/api/login", {
    headers: { "x-mimelo-request": "1" },
    data: { identity: "outlookbrowser", password: "OutlookBrowser!" },
  });
  const headers = {
    "x-mimelo-request": "1",
    "x-csrf-token": (await login.json()).csrf,
  };
  async function call(path, data, method = "POST") {
    const r = await context.request.fetch(base + "/api/" + path, {
      method,
      headers,
      ...(data === undefined ? {} : { data }),
    });
    assert.equal(r.status(), 200, await r.text());
    return r.json();
  }
  for (const [code, name] of [
    ["OBA", "Club A"],
    ["OBB", "Club B"],
  ])
    await call("teams/eafc27", { code, name, overall: 80 });
  const teams = (await call("teams/eafc27", undefined, "GET")).rows;
  const league = await call("competitions", {
    game: "eafc27",
    name: "Decisive group",
    kind: "groups",
    entries: ids.slice(0, 4).map((id) => [id]),
    settings: {
      groupCount: 1,
      advance: 2,
      tieBreaks: ["head_to_head", "difference", "for"],
    },
  });
  const drawn = await call(`competitions/${league.id}/draw`, {}),
    [a, b] = drawn.entries.map((e) => e.id).sort((x, y) => x - y);
  for (const f of drawn.fixtures) {
    const winner = [f.a, f.b].includes(a)
      ? a
      : [f.a, f.b].includes(b)
        ? b
        : null;
    if (!winner) continue;
    const m = await call("games/eafc27/matches", {
      fixture: f.id,
      score: {
        a: f.a === winner ? 3 : 0,
        b: f.b === winner ? 3 : 0,
        teamA: teams[0].id,
        teamB: teams[1].id,
      },
    });
    await call(`matches/${m.id}/accept`, { revision: 1 });
  }
  const extra = await call("competitions", {
    game: "eafc27",
    name: "Best thirds",
    kind: "groups",
    entries: ids.map((id) => [id]),
    settings: {
      groupCount: 2,
      advance: 2,
      extraCount: 1,
      extraPlace: 3,
      extraTieBreaks: ["difference", "for"],
    },
  });
  await call(`competitions/${extra.id}/draw`, {});
  async function visit(route) {
    await page.goto(base + route);
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    assert.equal(await page.locator("#load-error").count(), 0);
    await page.evaluate(() => document.fonts.ready);
  }
  mkdirSync("artifacts", { recursive: true });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await visit(`/competition.html?game=eafc27&id=${league.id}&view=table`);
    const outlook = page.locator("#competition-outlook");
    assert.equal(await outlook.locator("tbody tr").count(), 4);
    assert.equal(
      await outlook.locator('[data-progress="qualified"]').count(),
      2,
    );
    assert.equal(
      await outlook.locator('[data-progress="eliminated"]').count(),
      2,
    );
    assert.equal(
      await page.locator('#comp-table-wrap [data-group-winner="true"]').count(),
      1,
    );
    assert.equal(
      await page
        .locator('#comp-table-wrap [data-progress="eliminated"]')
        .count(),
      2,
    );
    assert.match(await outlook.innerText(), /100%/);
    assert.match(await outlook.innerText(), /Win title/i);
    assert.match(await outlook.innerText(), /Advance/i);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    assert(
      await page
        .locator("#comp-table-wrap .table-wrap")
        .evaluateAll((els) =>
          els.every(
            (el) =>
              el.scrollWidth <= el.clientWidth + 1 ||
              (innerWidth <= 700 && getComputedStyle(el).overflowX === "auto"),
          ),
        ),
      "Standings fit desktop and keep all selected statistics reachable on mobile",
    );
    await outlook.screenshot({
      path: `artifacts/competition-outlook-${width}.png`,
    });
    await page.locator("#comp-table-wrap").screenshot({
      path: `artifacts/competition-confirmed-table-${width}.png`,
    });
    await visit(`/competition.html?game=eafc27&id=${extra.id}&view=table`);
    assert.equal(
      await page.locator("#competition-extra-standings tbody tr").count(),
      2,
    );
    assert.match(
      await page.locator("#competition-extra-standings").innerText(),
      /1 advance from position 3/,
    );
    await visit("/game.html?game=eafc27&view=competitions");
    await page
      .getByRole("button", { name: "New competition", exact: true })
      .click();
    const dialog = page.locator("#comp-dialog[open]");
    await dialog.locator('[name="comp-format"][value="groups"]').check();
    await dialog.locator("#comp-name").fill("World Cup-style");
    await dialog.locator("#comp-group-count").fill("12");
    await dialog.locator("#comp-advance").fill("2");
    await dialog.locator("#field-extra-count").fill("8");
    await dialog.locator("#field-extra-place").fill("3");
    const cross = dialog.locator("[data-cross-group]");
    await cross.waitFor({ state: "visible" });
    assert.equal(
      await cross.locator('option[value="head_to_head"]').count(),
      0,
    );
    assert.deepEqual(
      await cross.locator("select").evaluateAll((es) => es.map((e) => e.value)),
      ["difference", "for"],
    );
    assert.equal(
      await dialog
        .locator(
          '.competition-tiebreaks:not([data-cross-group]) option[value="head_to_head"]',
        )
        .count(),
      3,
    );
    assert(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
    await dialog.screenshot({ path: `artifacts/world-cup-setup-${width}.png` });
    await page.keyboard.press("Escape");
  }
  await visit("/game.html?game=eafc27&view=competitions");
  await page.locator("#comp-new").click();
  const createDialog = page.locator("#comp-dialog[open]");
  await createDialog.locator('[name="comp-format"][value="groups"]').check();
  await createDialog.locator("#comp-name").fill("Saved extra qualifiers");
  await createDialog.locator("#comp-group-count").fill("2");
  await createDialog.locator("#comp-advance").fill("2");
  await createDialog.locator("#field-extra-count").fill("1");
  await createDialog
    .locator("[data-cross-group]")
    .getByRole("button", { name: "Move Goals scored up", exact: true })
    .click();
  await createDialog.locator("#comp-next").click();
  await createDialog.locator("#comp-select-all").click();
  await createDialog.locator("#comp-create").click();
  await page.waitForURL(/competition.html/);
  await page.waitForFunction(() => document.body.dataset.ready === "true");
  const createdId = Number(new URL(page.url()).searchParams.get("id"));
  let saved = JSON.parse(
    app.db
      .prepare("SELECT settings FROM competitions WHERE id=?")
      .get(createdId).settings,
  );
  assert.equal(saved.extraCount, 1);
  assert.equal(saved.extraPlace, 3);
  assert.deepEqual(saved.extraTieBreaks, ["for", "difference"]);
  await page.getByRole("button", { name: "Edit rules", exact: true }).click();
  const edit = page.locator("dialog.competition-rules-dialog[open]");
  assert.deepEqual(
    await edit
      .locator("[data-extra-tiebreak-editor] select")
      .evaluateAll((es) => es.map((e) => e.value)),
    ["for", "difference"],
  );
  await edit.locator("#field-extraCount").fill("2");
  await edit.getByRole("button", { name: "Save", exact: true }).click();
  await edit.waitFor({ state: "detached" });
  saved = JSON.parse(
    app.db
      .prepare("SELECT settings FROM competitions WHERE id=?")
      .get(createdId).settings,
  );
  assert.equal(saved.extraCount, 2);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Generate draw", exact: true })
    .click();
  await page.locator("#competition-outlook tbody tr").first().waitFor();
  assert.equal(await page.locator("#competition-outlook tbody tr").count(), 8);
  assert.deepEqual(errors, []);
});
