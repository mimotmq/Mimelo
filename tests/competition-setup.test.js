import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { createApp } from "../server/app.js";
import { register, passwordHash } from "../server/auth.js";

test("compact tournament setup and editing save ordered tiebreak rules without demo notices", async (t) => {
  const app = await createApp({ database: ":memory:" });
  t.after(() => app.close());
  const hash = await passwordHash("SetupBrowserPassword!");
  for (let i = 0; i < 4; i++)
    register(
      app.db,
      { name: "Setup Player " + i, handle: "setupplayer" + i },
      hash,
      null,
      i === 0,
    );
  await app.listen({ host: "127.0.0.1", port: 0 });
  const base = "http://127.0.0.1:" + app.server.address().port;
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.request.post(base + "/api/login", {
    headers: { "x-mimelo-request": "1" },
    data: { identity: "setupplayer0", password: "SetupBrowserPassword!" },
  });
  mkdirSync("artifacts", { recursive: true });
  for (const width of [1440, 390])
    for (const game of ["eafc27", "tennis", "smash", "tt"]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(base + "/game.html?game=" + game + "&view=competitions");
      await page.waitForFunction(() => document.body.dataset.ready === "true");
      await page.locator("#comp-new").click();
      const dialog = page.locator("#comp-dialog[open]");
      if (width === 1440)
        assert(
          (await dialog.boundingBox()).width >= 1100,
          "Setup uses desktop page width.",
        );
      assert(
        !/demo|mockup|comma-separated|head_to_head/.test(
          await dialog.innerText(),
        ),
      );
      await dialog.locator("#comp-next").click();
      assert.match(
        await dialog.locator("#comp-name-error").innerText(),
        /Enter a competition name/,
      );
      await dialog.locator("#comp-name").fill(`Compact ${game} ${width}`);
      assert.equal(await dialog.locator("#field-deadline").isVisible(), false);
      await dialog.locator("#field-enrollment").selectOption("both");
      await dialog.locator("#comp-next").click();
      assert.match(
        await dialog.locator("#comp-step1-error").innerText(),
        /future deadline/,
      );
      await dialog
        .locator("#field-deadline")
        .fill(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
      await dialog.locator('[name="comp-format"][value="knockout"]').check();
      assert.equal(
        await dialog
          .locator(".competition-tiebreaks:not([data-cross-group])")
          .isVisible(),
        false,
      );
      assert.equal(await dialog.locator("#comp-legs").isVisible(), false);
      await dialog.locator('[name="comp-format"][value="groups"]').check();
      await dialog.locator("#comp-group-count").fill("2");
      await dialog.locator("#comp-advance").fill("1");
      await dialog.locator("#comp-legs").check();
      if (game === "tt" && width === 1440) {
        await dialog.locator("[data-best-of-stage-editor] summary").click();
        await dialog.locator('[data-best-of-stage="group"]').selectOption("5");
        await dialog
          .locator('[data-best-of-stage="knockoutRound1"]')
          .selectOption("7");
        await dialog
          .locator('[data-best-of-stage="semifinal"]')
          .selectOption("5");
        await dialog.locator('[data-best-of-stage="final"]').selectOption("7");
      }
      for (const input of await dialog
        .locator('input[type="number"]:visible')
        .all())
        assert(
          (await input.boundingBox()).width <= 76,
          "Numeric entries stay compact.",
        );
      assert(
        (await dialog.locator("#comp-round-robin").boundingBox()).height <= 36,
        "Checkbox rows stay compact.",
      );
      if (game === "tennis") {
        assert.equal(
          await dialog.locator("#competition-match-tb").isVisible(),
          false,
        );
        await dialog
          .locator("#field-competition-format")
          .selectOption("doubles");
        await dialog.locator("#competition-match-tb").check();
      }
      assert.equal(
        await dialog.locator("#field-competition-best").isVisible(),
        game !== "eafc27",
      );
      const ties = dialog.locator(
        ".competition-tiebreaks:not([data-cross-group])",
      );
      // Start with an explicit custom order, independently of each sport's defaults.
      while (await ties.locator("[data-remove]").count())
        await ties.locator("[data-remove]").first().click();
      for (const key of ["head_to_head", "difference", "for"]) {
        await ties
          .getByRole("button", { name: "Add tiebreak", exact: true })
          .click();
        await ties.locator("select").last().selectOption(key);
      }
      await ties.locator('[data-move="-1"][data-index="1"]').click();
      await ties
        .getByRole("button", { name: "Remove Head-to-head", exact: true })
        .click();
      await ties
        .getByRole("button", { name: "Add tiebreak", exact: true })
        .click();
      assert.deepEqual(
        await ties
          .locator("select")
          .evaluateAll((es) => es.map((e) => e.value)),
        ["difference", "for", "head_to_head"],
      );
      assert.equal(
        await ties
          .locator("select")
          .first()
          .locator('option[value="for"]')
          .isDisabled(),
        true,
        "Duplicate rules cannot be selected.",
      );
      assert(
        await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        "Setup fits within its dialog at every width.",
      );
      await page.screenshot({
        path: `artifacts/competition-setup-${game}-${width}.png`,
      });
      await dialog.locator("#comp-next").click();
      assert(!/demo|mockup/.test(await dialog.innerText()));
      await dialog.locator("#comp-select-all").click();
      await dialog.locator("#comp-seeding").selectOption("preseeded");
      assert.equal(await dialog.locator("[data-seed]").count(), 4);
      assert(
        (await dialog.locator("[data-seed]").first().boundingBox()).width <= 76,
      );
      if (game === "tt")
        await page.screenshot({
          path: `artifacts/competition-entrants-${width}.png`,
        });
      await dialog.locator("#comp-create").click();
      await page.waitForURL(/competition.html/);
      await page.waitForFunction(() => document.body.dataset.ready === "true");
      const id = Number(new URL(page.url()).searchParams.get("id"));
      const saved = JSON.parse(
        app.db.prepare("SELECT settings FROM competitions WHERE id=?").get(id)
          .settings,
      );
      assert.deepEqual(saved.tieBreaks, ["difference", "for", "head_to_head"]);
      assert.equal(saved.legs, 2);
      assert.equal(saved.groupCount, 2);
      assert.equal(saved.advance, 1);
      if (game === "tt" && width === 1440)
        assert.deepEqual(saved.bestOfByStage, {
          group: 5,
          knockoutRound1: 7,
          semifinal: 5,
          final: 7,
        });
      if (game === "tennis") assert.equal(saved.matchTiebreak, true);
      if (game === "tt") {
        await page
          .getByRole("button", { name: "Set seeds", exact: true })
          .click();
        const seedDialog = page.locator("dialog.competition-seed-dialog[open]");
        const seedInputs = seedDialog.locator('input[type="number"]');
        for (let i = 0; i < (await seedInputs.count()); i++) {
          assert((await seedInputs.nth(i).boundingBox()).width <= 76);
          await seedInputs.nth(i).fill(String(i + 11));
        }
        await seedDialog
          .getByRole("button", { name: "Save", exact: true })
          .click();
        await seedDialog.waitFor({ state: "detached" });
        assert.equal(
          app.db
            .prepare(
              "SELECT MIN(seed) seed FROM entrants WHERE competition_id=?",
            )
            .get(id).seed,
          11,
        );
        await page
          .getByRole("button", { name: "Edit rules", exact: true })
          .click();
        const edit = page.locator("dialog.competition-rules-dialog[open]");
        assert.deepEqual(
          await edit
            .locator("[data-tiebreak-editor] [data-tiebreak]")
            .evaluateAll((es) => es.map((e) => e.value)),
          saved.tieBreaks,
        );
        await edit.locator("#field-kind").selectOption("knockout");
        assert.equal(
          await edit
            .locator(".competition-tiebreaks:not([data-cross-group])")
            .isVisible(),
          false,
        );
        await edit.locator("#field-kind").selectOption("groups");
        while (
          await edit.locator("[data-tiebreak-editor] [data-remove]").count()
        )
          await edit
            .locator("[data-tiebreak-editor] [data-remove]")
            .first()
            .click();
        assert.match(
          await edit
            .locator(".competition-tiebreaks:not([data-cross-group])")
            .innerText(),
          /straight to the tie resolution/,
        );
        await edit.locator("#field-tieResolution").selectOption("match");
        await page.screenshot({
          path: `artifacts/competition-edit-${width}.png`,
        });
        await edit.getByRole("button", { name: "Save", exact: true }).click();
        await edit.waitFor({ state: "detached" });
        const updated = JSON.parse(
          app.db.prepare("SELECT settings FROM competitions WHERE id=?").get(id)
            .settings,
        );
        assert.deepEqual(updated.tieBreaks, []);
        assert.equal(updated.tieResolution, "match");
      }
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
    }
  assert.deepEqual(errors, []);
});
