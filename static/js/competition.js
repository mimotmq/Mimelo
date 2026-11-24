APP.run(async () => {
  const { $, $$, esc, text, button, field, select } = UI,
    id = Number(APP.params.get("id"));
  const { mountTiebreakEditor, mountColumnEditor, tiebreakLabels } =
    await import("./competition-settings.js");
  const { renderBracket, fixtureScoreText } =
    await import("./competition-bracket.js");
  const bracketStyles = document.createElement("link");
  bracketStyles.rel = "stylesheet";
  bracketStyles.href = "css/competition-bracket.css";
  await new Promise((resolve, reject) => {
    bracketStyles.onload = resolve;
    bracketStyles.onerror = () =>
      reject(new Error("Could not load the bracket styles."));
    document.head.append(bracketStyles);
  });
  let c,
    clearBracket,
    initialView = true;
  const name = (e) =>
    c.entries
      .find((x) => x.id === e)
      ?.players.map((p) => p.name)
      .join(" + ") || "To be decided";
  const userEntry = () =>
    c.entries.find((e) => e.players.some((p) => p.id === APP.me?.player_id));
  function bindMatches() {
    $$("[data-match]").forEach(
      (b) =>
        (b.onclick = () =>
          UI.matchDialog(b.dataset.match).catch((e) => UI.toast(e.message))),
    );
  }
  async function load() {
    const [details, projection] = await Promise.all([
      APP.api("competitions/" + id),
      APP.api(`competitions/${id}/projection`),
    ]);
    c = { ...details, projection };
    if (c.game !== APP.slug) {
      location.replace("competition.html?game=" + c.game + "&id=" + id);
      return;
    }
    document.title = c.name + " · " + APP.game.name + " · mimELo";
    text("[data-comp-name]", c.name);
    text(
      "[data-comp-kind]",
      { knockout: "Knockout", league: "League", groups: "Groups & knockout" }[
        c.kind
      ] || c.kind,
    );
    text(
      "[data-comp-format]",
      (c.format === "doubles" ? "Doubles" : "Singles") +
        (c.kind === "knockout"
          ? " · " + c.settings.elimination + " elimination"
          : ""),
    );
    text(
      "[data-comp-status]",
      {
        registration: "Registration",
        closed: "Registration closed",
        active: "In progress",
        completed: "Complete",
      }[c.state] || c.state,
    );
    text(
      "[data-comp-blurb]",
      c.enrollment === "selected"
        ? "Organizer-selected entrants"
        : `Registration ${c.state === "registration" && c.deadline > Date.now() ? "open until" : "closed"} ${UI.date(c.deadline)}`,
    );
    const done = c.fixtures.filter((f) => f.status === "completed").length;
    text("[data-comp-played]", done);
    text(
      ".player-elo .label",
      `of ${UI.count(c.fixtures.filter((f) => !["cancelled", "bye"].includes(f.status)).length, "match", "matches")} completed`,
    );
    const leaders = c.kind === "league" ? c.standings?.[""] || [] : [];
    text(
      "[data-comp-leader]",
      c.champion
        ? name(c.champion)
        : leaders[0]?.played && leaders[1]?.tiedWithPrevious
          ? "Tied"
          : leaders[0]?.played
            ? leaders[0].players.map((p) => p.name).join(" + ")
            : "Undecided",
    );
    text("[data-comp-players]", c.players);
    text(
      "[data-comp-fixtures]",
      c.fixtures.filter((f) => !["cancelled", "bye"].includes(f.status)).length,
    );
    text(
      "[data-comp-played-stat]",
      c.fixtures.filter(
        (f) => f.status === "completed" && f.match_id && !f.forfeit,
      ).length,
    );
    const datedDays = new Set(
      c.fixtures
        .map((f) => f.played_at || f.scheduled)
        .filter(Boolean)
        .map((time) => new Date(time).toLocaleDateString()),
    );
    text(
      "[data-comp-matchdays]",
      datedDays.size || Math.max(0, ...c.fixtures.map((f) => f.round)),
    );
    if (c.kind !== "knockout" && datedDays.size)
      text("[data-comp-matchdays] + span", "Dated days");
    text("[data-comp-rounds]", c.settings.legs);
    if (c.kind === "league") text("[data-comp-rounds] + span", "Meetings");
    if (c.kind === "knockout") {
      text("[data-comp-fixtures] + span", "Matches");
      text("[data-comp-matchdays] + span", "Rounds");
      $("[data-comp-rounds]").closest(".player-stat").hidden = true;
    }
    text("#crumb-game", APP.game.name);
    text("#table-heading", c.name + " standings");
    text(
      "#table-sub",
      c.settings.countNoContestForPct
        ? "A no contest counts as played and half a win for PCT. It awards no win, loss or Elo."
        : "Accepted results · organizer-selected tiebreak rules",
    );
    text("#table-chip", c.format);
    text("#fixtures-sub", "Scheduled fixtures and accepted results");
    $("#ct-bracket").hidden = c.kind === "league" && !c.settings.playoffs;
    text("#fixtures-order", "By day and round");
    text(
      "#bracket-sub",
      c.settings.elimination === "double"
        ? "Upper bracket, lower bracket, and grand finals"
        : "Follow each match through to the final",
    );
    $("#record-link").href = APP.url("game", { view: "record" });
    $("#record-link").hidden = true;
    $("#comp-table-wrap").innerHTML =
      Object.entries(c.standings)
        .map(
          ([pool, rows]) =>
            `<h3 class="panel-body">${pool ? "Group " + esc(pool) : "Table"}</h3>` +
            UI.standingsTable(c, rows),
        )
        .join("") ||
      UI.empty(
        c.kind === "knockout"
          ? "This competition is decided by the bracket."
          : "Standings appear when the draw is generated.",
      );
    if (c.settings.conferenceLayout && c.standings[""]?.length) {
      const wrap = $("#comp-table-wrap");
      const views = [["Overall", c.standings[""]]];
      for (const conf of c.settings.conferenceLayout.conferences) {
        const all = conf.divisions.flatMap((d) => d.entries);
        views.push([
          conf.name,
          c.standings[""].filter((r) => all.includes(r.entry)),
        ]);
        for (const div of conf.divisions)
          views.push([
            conf.name + " · " + div.name,
            c.standings[""].filter((r) => div.entries.includes(r.entry)),
          ]);
      }
      wrap.innerHTML =
        select(
          "Standings",
          "division-table",
          views.map(([label], i) => [i, label]),
          0,
        ) + "<div data-division-table></div>";
      const chooser = $("#field-division-table", wrap);
      chooser.onchange = () => {
        const rows = views[Number(chooser.value)][1].map((row, i) => ({
          ...row,
          position: i + 1,
        }));
        $("[data-division-table]", wrap).innerHTML = UI.standingsTable(c, rows);
      };
      chooser.onchange();
    }
    if (c.canManage && c.kind !== "knockout") {
      const wrap = $("#comp-table-wrap");
      wrap.insertAdjacentHTML(
        "afterbegin",
        button("Customize table", "table-settings"),
      );
      $('[data-action="table-settings"]', wrap).onclick = () => {
        const canRank =
          ["registration", "closed"].includes(c.state) ||
          (c.kind === "league" &&
            !c.settings.playoffs &&
            !c.settings.tieRounds?.length &&
            !Object.keys(c.qualifications || {}).length);
        let columns, ranking;
        const dialog = UI.formDialog(
          "Customize standings",
          "<div data-columns></div>" +
            (canRank
              ? '<div data-order></div><label class="check"><input type="checkbox" name="countNoContest" ' +
                (c.settings.countNoContestForPct ? "checked" : "") +
                ">Count a no contest as played and half a win for PCT only</label>"
              : ""),
          async (data) => {
            await APP.api(
              "competitions/" + id + "/table",
              {
                tableColumns: columns.read(),
                ...(ranking
                  ? {
                      tieBreaks: ranking.read(),
                      countNoContestForPct: data.has("countNoContest"),
                    }
                  : {}),
              },
              "PATCH",
            );
            await load();
          },
        );
        dialog.classList.add("standings-customize-dialog");
        columns = mountColumnEditor(
          $("[data-columns]", dialog),
          c,
          Object.values(c.standings)[0],
        );
        $("details", dialog).open = true;
        if (canRank)
          ranking = mountTiebreakEditor($("[data-order]", dialog), {
            kind: APP.game.kind,
            values: c.settings.tieBreaks,
          });
      };
    }
    let fixtureGroups = $("#fixture-groups");
    if (!fixtureGroups) {
      fixtureGroups = document.createElement("div");
      fixtureGroups.id = "fixture-groups";
      $("#fixtures-body").closest(".table-wrap").replaceWith(fixtureGroups);
    }
    const groups = new Map();
    const orderedFixtures = [...c.fixtures].sort((a, b) => {
      const first = a.played_at || a.scheduled;
      const second = b.played_at || b.scheduled;
      return first && second
        ? first - second
        : first
          ? -1
          : second
            ? 1
            : a.round - b.round || a.id - b.id;
    });
    for (const f of orderedFixtures) {
      const date = f.played_at || f.scheduled;
      const key = date
        ? new Date(date).toLocaleDateString(undefined, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : (f.pool ? `Group ${f.pool} · ` : "") + f.label;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(f);
    }
    fixtureGroups.innerHTML =
      [...groups]
        .map(
          ([label, fixtures]) => `
      <details class="fixture-day">
        <summary><strong>${esc(label)}</strong><span>${UI.count(fixtures.length, "match", "matches")}</span></summary>
        <div class="fixture-day-matches">${fixtures
          .map((f) => {
            const time = f.played_at || f.scheduled;
            const result = f.no_contest
              ? "No contest"
              : f.match_id
                ? fixtureScoreText(f)
                : f.status === "bye"
                  ? "Bye"
                  : "vs";
            const games = ["tt", "tennis", "pickleball"].includes(APP.game.kind)
              ? f.score?.games || []
              : [];
            const breakdown = games.length
              ? `<span class="fixture-games">${games.map((game) => `${esc(game.a)}–${esc(game.b)}`).join(" · ")}</span>`
              : "";
            const lineup = (entry) =>
              f.priorLineups
                ?.filter((p) => p.entry_id === entry)
                .map((p) => p.name)
                .join(" + ") || name(entry);
            const content = `<span class="fixture-side">${esc(lineup(f.a))}</span><strong class="fixture-result">${esc(result)}</strong><span class="fixture-side fixture-away">${esc(lineup(f.b))}</span>${breakdown}`;
            const resultControl = f.match_id
              ? `<button type="button" class="fixture-match" data-match="${f.match_id}">${content}</button>`
              : f.status === "ready"
                ? `<a class="fixture-match" href="${APP.url("game", { view: "record", fixture: f.id, competition: c.id })}">${content}</a>`
                : `<div class="fixture-match">${content}</div>`;
            return `<article class="fixture-card">${resultControl}<div class="fixture-meta"><span>${esc(f.label)}</span><span>${time ? esc(new Date(time).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })) : "Time not set"}</span>${f.no_contest ? "<span>No contest</span>" : ""}${c.canManage && (["ready", "waiting"].includes(f.status) || f.no_contest) ? button("Schedule", "schedule", `data-fixture="${f.id}"`) : ""}${c.canManage && f.status === "ready" && !f.match_id ? button("Substitute", "substitute", `data-fixture="${f.id}"`) + button("Forfeit", "forfeit", `data-fixture="${f.id}"`) + button("No contest", "no-contest", `data-fixture="${f.id}"`) : ""}</div></article>`;
          })
          .join("")}</div>
      </details>`,
        )
        .join("") ||
      '<p class="panel-body">Registration precedes the draw.</p>';
    for (const b of $$("[data-fixture]"))
      b.onclick = () => {
        const f = c.fixtures.find((f) => f.id === Number(b.dataset.fixture));
        if (b.dataset.action === "schedule")
          UI.formDialog(
            "Schedule fixture",
            field(
              "Date and time (local)",
              "scheduled",
              f.scheduled
                ? new Date(
                    f.scheduled -
                      new Date(f.scheduled).getTimezoneOffset() * 60000,
                  )
                    .toISOString()
                    .slice(0, 16)
                : "",
              "datetime-local",
            ),
            async (data) => {
              await APP.api(
                "fixtures/" + f.id + "/schedule",
                {
                  scheduled: data.get("scheduled")
                    ? new Date(data.get("scheduled")).getTime()
                    : null,
                },
                "PATCH",
              );
              await load();
            },
          );
        else if (b.dataset.action === "substitute") {
          const options = [f.a, f.b].flatMap((id) => {
            const saved = f.priorLineups.filter((p) => p.entry_id === id);
            return (
              saved.length ? saved : c.entries.find((e) => e.id === id).players
            ).map((p) => [id + "/" + p.id, p.name]);
          });
          const d = UI.formDialog(
            "One-match substitute",
            select("Player sitting out", "side", options) +
              select("Substitute", "incoming", []),
            async (data) => {
              const [entry, outgoing] = data.get("side").split("/").map(Number);
              await APP.api("fixtures/" + f.id + "/substitute", {
                entry,
                outgoing,
                incoming: Number(data.get("incoming")),
              });
              await load();
            },
          );
          UI.picker(d.querySelector("[name=incoming]")).catch((e) =>
            UI.toast(e.message),
          );
        } else if (b.dataset.action === "no-contest") {
          const knockout = !["league", "group", "tiebreak"].includes(f.stage);
          UI.formDialog(
            "Declare no contest",
            knockout
              ? select(
                  "Replacement entrant",
                  "replacement",
                  [
                    ["", "No replacement · opponent receives a bye"],
                    ...c.entries
                      .filter((e) => e.id !== f.a && e.id !== f.b)
                      .map((e) => [e.id, name(e.id)]),
                  ],
                  "",
                )
              : "<p>Neither side receives a win, loss, points, or Elo.</p>",
            async (data) => {
              await APP.api(`fixtures/${f.id}/no-contest`, {
                replacement: data.get("replacement") || null,
              });
              await load();
            },
          );
        } else
          UI.formDialog(
            "Declare forfeit",
            select(
              "Advancing side",
              "winner",
              [
                [f.a, name(f.a)],
                [f.b, name(f.b)],
              ],
              f.a,
            ) + "<p>No Elo is awarded for a forfeit.</p>",
            async (data) => {
              await APP.api("fixtures/" + f.id + "/forfeit", {
                winner: Number(data.get("winner")),
              });
              await load();
            },
          );
      };
    if (initialView) {
      const view = APP.params.get("view");
      if (
        (view === "bracket" && !$("#ct-bracket").hidden) ||
        (!view && c.kind === "knockout")
      )
        $("#ct-bracket").click();
      else if (["fixtures", "table", "rules"].includes(view))
        $("#ct-" + view).click();
      initialView = false;
    }
    // The bracket measures its panel to lay out the first round.
    clearBracket?.();
    clearBracket = renderBracket($("#bracket-wrap"), c, { UI, APP });
    bindMatches();
    const showLeagueFixtures = () => {
      if (
        c.kind === "league" &&
        $("#ct-table").getAttribute("aria-selected") === "true"
      )
        $("#cp-fixtures").hidden = false;
    };
    $$("[role=tab]", $("[role=tablist]")).forEach((tab) => {
      if (!tab.dataset.leagueFixturesBound) {
        tab.addEventListener("click", () => queueMicrotask(showLeagueFixtures));
        tab.addEventListener("keydown", () =>
          queueMicrotask(showLeagueFixtures),
        );
        tab.dataset.leagueFixturesBound = "1";
      }
    });
    showLeagueFixtures();
    text(
      "#rules-points-title",
      APP.game.kind === "fc" ? "Points" : "Win / loss",
    );
    text(
      "#rules-points-copy",
      (APP.game.kind === "fc"
        ? "Win 3 · Draw 1 · Loss 0. "
        : "Standings are based on wins and losses. ") +
        "Tiebreak order: " +
        (c.settings.tieBreaks
          .map((key) => tiebreakLabels(APP.game.kind)[key])
          .join(" → ") || "No extra rules") +
        ". Unresolved qualifiers: " +
        (c.settings.tieResolution === "match"
          ? "extra tiebreak match"
          : "admin decision with explanation") +
        ".",
    );
    if (c.kind === "groups" && c.settings.extraCount)
      $("#rules-points-copy").textContent +=
        ` Top ${c.settings.advance} per group advance, plus the best ${c.settings.extraCount} from finishing position ${c.settings.extraPlace}. Cross-group comparison: points → ${(c.settings.extraTieBreaks || []).map((key) => tiebreakLabels(APP.game.kind)[key]).join(" → ")}. Raw points are used even for unequal groups. Unresolved cross-group ties require an admin decision. First knockout round avoids same-group opponents.`;
    if (c.settings.conferenceLayout) {
      const { games, wildcards } = c.settings.conferenceLayout;
      $("#rules-points-copy").append(
        ` Each entrant plays ${games.division} division, ${games.conference} other conference and ${games.cross} interconference games. Each division winner and ${wildcards} wild cards per conference advance. Conference champions meet in the final.`,
      );
    }
    text(
      "#rules-elo-copy",
      "Admin checkoff is required for Elo. Competition weights: " +
        Object.entries(c.settings.weights)
          .map(([k, v]) => k + " " + v + "×")
          .join(", "),
    );
    const cards = $$("#cp-rules .format-card p");
    cards.at(-1).textContent =
      "An organizer, admin, or representative from each side may accept results. Only an admin can check off Elo. A downstream submission locks earlier dependent results.";
    const { renderCompetitionOutlook } =
      await import("./competition-outlook.js");
    renderCompetitionOutlook(c);
    await management();
  }
  async function management() {
    let panel = $("#registration-panel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "registration-panel";
      panel.className = "panel settings-card";
      $("#competition-outlook").after(panel);
    }
    const mutable = ["registration", "closed"].includes(c.state),
      open =
        c.state === "registration" &&
        c.deadline > Date.now() &&
        c.enrollment !== "selected";
    panel.innerHTML = `<div class="panel-head"><h2>${mutable ? "Entrants & registration" : "Competition entrants"}</h2><span class="chip">${UI.count(c.entries.length, "entry", "entries")}</span></div><div class="panel-body"><div class="form-actions">${open && !userEntry() ? button("Register", "register") : ""}${c.canManage && mutable ? button("Add entrants", "add-entry") + button("Edit rules", "rules") + button("Set seeds", "seeds") + (c.state === "registration" ? button("Close registration", "close") : "") + button("Generate draw", "draw") : ""}</div><div class="table-wrap"><table><thead><tr><th>Seed</th><th>Entrant</th><th>Action</th></tr></thead><tbody>${c.entries.map((e) => `<tr><td>${e.seed || "—"}</td><td>${esc(name(e.id))}${c.format === "doubles" && e.players.length === 1 ? " · awaiting partner" : ""}</td><td>${mutable && (c.canManage || e.players.some((p) => p.id === APP.me?.player_id)) ? button("Withdraw", "withdraw", `data-entry="${e.id}"`) : ""}</td></tr>`).join("") || '<tr><td colspan="3">No entries yet.</td></tr>'}</tbody></table></div>${c.canManage && mutable && c.format === "doubles" ? button("Pair individual entries", "pair") : ""}</div>`;
    for (const [i, e] of c.entries.entries()) {
      const row = panel.querySelectorAll("tbody tr")[i];
      for (const change of e.changes || []) {
        const detail = document.createElement("small");
        detail.style.display = "block";
        detail.textContent = change.incoming + " replaced " + change.outgoing;
        row.cells[1].append(detail);
      }
      if (
        !c.canManage ||
        c.kind !== "league" ||
        c.state !== "active" ||
        !c.fixtures.some(
          (f) =>
            [f.a, f.b].includes(e.id) && f.status === "ready" && !f.match_id,
        )
      )
        continue;
      row.cells[2].innerHTML = button("Replace player", "replace-player");
      row.cells[2].querySelector("button").onclick = async () => {
        const d = UI.formDialog(
          "Replace a player",
          select(
            "Leaving player",
            "outgoing",
            e.players.map((p) => [p.id, p.name]),
          ) +
            select("Replacement", "incoming", []) +
            field(
              "Transfer effective (optional)",
              "effective",
              "",
              "datetime-local",
            ) +
            "<p>The replacement takes this spot in unplayed fixtures. The entry keeps its standings. Earlier results and Elo stay with the players who played.</p>" +
            `<details><summary>Keep earlier fixtures with the original lineup</summary>${c.fixtures
              .filter(
                (f) =>
                  f.status === "ready" &&
                  !f.match_id &&
                  [f.a, f.b].includes(e.id),
              )
              .map(
                (f) =>
                  `<label class="check"><input type="checkbox" name="keep" value="${f.id}">${esc(f.label)} · vs ${esc(name(f.a === e.id ? f.b : f.a))}</label>`,
              )
              .join("")}</details>`,
          async (data) => {
            await APP.api(`competitions/${id}/entries/${e.id}/replace`, {
              outgoing: Number(data.get("outgoing")),
              incoming: Number(data.get("incoming")),
              keep: data.getAll("keep").map(Number),
              effective: data.get("effective")
                ? new Date(data.get("effective")).getTime()
                : undefined,
            });
            await load();
          },
        );
        await UI.picker(d.querySelector("[name=incoming]"));
      };
    }
    panel.classList.toggle("competition-entrants-compact", !mutable);
    if (c.canManage && mutable && c.kind === "league") {
      const form = $(".form-actions", panel);
      form.insertAdjacentHTML(
        "beforeend",
        button("Conferences and schedule", "conferences"),
      );
      $('[data-action="conferences"]', form).onclick = async () => {
        const { configureConferences } = await import("./conference-setup.js");
        configureConferences(c, load);
      };
    }
    if (!mutable) {
      const table = $(".table-wrap", panel);
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = `Competition entrants · ${UI.count(c.entries.length, "entry", "entries")}`;
      details.append(summary, table);
      panel.replaceChildren(details);
    }
    $("[data-action=register]", panel)?.addEventListener("click", () => {
      if (!APP.me) return APP.login();
      entryDialog(false);
    });
    $("[data-action=add-entry]", panel)?.addEventListener("click", () =>
      entryDialog(true),
    );
    $$("[data-action=withdraw]", panel).forEach(
      (b) =>
        (b.onclick = async () => {
          try {
            await APP.api(
              `competitions/${id}/entries/${b.dataset.entry}`,
              {},
              "DELETE",
            );
            await load();
          } catch (e) {
            UI.toast(e.message);
          }
        }),
    );
    for (const action of ["close", "draw"])
      $(`[data-action=${action}]`, panel)?.addEventListener(
        "click",
        async () => {
          try {
            if (
              action === "draw" &&
              !confirm(
                "Generate the draw? Entries, pairs and scoring rules will be fixed.",
              )
            )
              return;
            await APP.api(`competitions/${id}/${action}`, {});
            await load();
          } catch (e) {
            UI.toast(e.message);
          }
        },
      );
    $("[data-action=pair]", panel)?.addEventListener("click", () => {
      const es = c.entries
        .filter((e) => e.players.length === 1)
        .map((e) => [e.id, name(e.id)]);
      UI.formDialog(
        "Assign doubles partners",
        select("First entry", "a", es) + select("Second entry", "b", es),
        async (f) => {
          await APP.api(`competitions/${id}/pair`, {
            a: Number(f.get("a")),
            b: Number(f.get("b")),
          });
          await load();
        },
      );
    });
    $("[data-action=seeds]", panel)?.addEventListener("click", () => {
      const seedDialog = UI.formDialog(
        "Seed order",
        c.entries
          .map((e, i) =>
            field(
              name(e.id),
              "seed-" + e.id,
              e.seed || i + 1,
              "number",
              'min="1" required',
            ),
          )
          .join(""),
        async (f) => {
          await APP.api(`competitions/${id}/seeds`, {
            seeds: c.entries.map((e) => ({
              id: e.id,
              seed: Number(f.get("seed-" + e.id)),
            })),
          });
          await load();
        },
      );
      seedDialog.classList.add(
        "competition-settings-dialog",
        "competition-seed-dialog",
      );
    });
    $("[data-action=rules]", panel)?.addEventListener("click", async () => {
      const pickleball =
        APP.game.kind === "pickleball" ? await import("./pickleball.js") : null;
      let tieEditor, extraTieEditor;
      const ruleDialog = UI.formDialog(
        "Competition rules",
        field("Name", "name", c.name) +
          select(
            "Competition type",
            "kind",
            [
              ["league", "League / round robin"],
              ["groups", "Groups → knockout"],
              ["knockout", "Knockout"],
            ],
            c.kind,
          ) +
          select(
            "Match format",
            "format",
            ["tennis", "smash", "pickleball"].includes(APP.game.kind)
              ? [
                  ["singles", "Singles"],
                  ["doubles", "Doubles"],
                ]
              : [["singles", "Singles"]],
            c.format,
          ) +
          select(
            "Registration",
            "enrollment",
            [
              ["selected", "Selected"],
              ["open", "Open"],
              ["both", "Selected + open"],
            ],
            c.enrollment,
          ) +
          (c.state === "registration"
            ? field(
                "Signup deadline",
                "deadline",
                c.deadline
                  ? new Date(
                      c.deadline - new Date().getTimezoneOffset() * 60000,
                    )
                      .toISOString()
                      .slice(0, 16)
                  : "",
                "datetime-local",
              )
            : "") +
          select(
            "Elimination",
            "elimination",
            [
              ["single", "Single"],
              ["double", "Double"],
            ],
            c.settings.elimination,
          ) +
          select(
            "Round robin legs",
            "legs",
            [
              [1, "Single"],
              [2, "Home and away"],
            ],
            c.settings.legs,
          ) +
          `<label class="check"><input type="checkbox" name="playoffs" ${c.settings.playoffs ? "checked" : ""}>League playoffs</label>` +
          select(
            "Seeding",
            "seeding",
            [
              ["elo", "Elo"],
              ["random", "Random"],
              ["manual", "Manual order"],
              ["preseeded", "Numbered seeds"],
            ],
            c.settings.seeding,
          ) +
          (pickleball
            ? select(
                "Best of",
                "bestOf",
                [1, 3, 5].map((n) => [n, n]),
                c.settings.bestOf,
              )
            : field(
                "Best of",
                "bestOf",
                c.settings.bestOf,
                "number",
                'min="1" max="7"',
              )) +
          field(
            "Group count",
            "groupCount",
            c.settings.groupCount,
            "number",
            'min="1"',
          ) +
          field(
            "Qualifiers per group",
            "advance",
            c.settings.advance,
            "number",
            'min="1"',
          ) +
          field(
            "Additional best-placed qualifiers",
            "extraCount",
            c.settings.extraCount || 0,
            "number",
            'min="0" max="64"',
          ) +
          field(
            "From finishing position",
            "extraPlace",
            c.settings.extraPlace || 3,
            "number",
            'min="2"',
          ) +
          field(
            "Playoff qualifiers",
            "playoffCount",
            c.settings.playoffCount,
            "number",
            'min="2"',
          ) +
          (["tt", "pickleball"].includes(APP.game.kind)
            ? select(
                "Points per game",
                "target",
                [[11, 11], ...(pickleball ? [[15, 15]] : []), [21, 21]],
                c.settings.target,
              )
            : "") +
          (APP.game.kind === "tennis"
            ? `<label class="check"><input type="checkbox" name="matchTiebreak" ${c.settings.matchTiebreak ? "checked" : ""}>Doubles: final match tiebreak</label>`
            : "") +
          (pickleball ? pickleball.scoringHelp : "") +
          "<div data-tiebreak-editor></div><div data-extra-tiebreak-editor></div>" +
          select(
            "Tie resolution",
            "tieResolution",
            [
              ["admin", "Admin decision"],
              ["match", "Extra match"],
            ],
            c.settings.tieResolution,
          ),
        async (f) => {
          await APP.api(
            `competitions/${id}`,
            {
              name: f.get("name"),
              kind: f.get("kind"),
              format: f.get("format"),
              enrollment: f.get("enrollment"),
              ...(f.get("deadline")
                ? { deadline: new Date(f.get("deadline")).getTime() }
                : {}),
              settings: {
                ...c.settings,
                legs: Number(f.get("legs")),
                elimination: f.get("elimination"),
                playoffs: f.has("playoffs"),
                target: Number(f.get("target") || 11),
                matchTiebreak: f.has("matchTiebreak"),
                seeding: f.get("seeding"),
                bestOf: Number(f.get("bestOf")),
                groupCount: Number(f.get("groupCount")),
                advance: Number(f.get("advance")),
                extraCount:
                  f.get("kind") === "groups" ? Number(f.get("extraCount")) : 0,
                extraPlace: Number(f.get("extraPlace")),
                extraTieBreaks: extraTieEditor.read(),
                playoffCount: Number(f.get("playoffCount")),
                tieBreaks: tieEditor.read(),
                tieResolution: f.get("tieResolution"),
              },
            },
            "PATCH",
          );
          await load();
        },
      );
      ruleDialog.classList.add(
        "competition-settings-dialog",
        "competition-rules-dialog",
      );
      tieEditor = mountTiebreakEditor($("[data-tiebreak-editor]", ruleDialog), {
        kind: APP.game.kind,
        values: c.settings.tieBreaks,
      });
      extraTieEditor = mountTiebreakEditor(
        $("[data-extra-tiebreak-editor]", ruleDialog),
        {
          kind: APP.game.kind,
          values: c.settings.extraTieBreaks || ["difference", "for"],
          crossGroup: true,
        },
      );
      function updateRuleFields() {
        const kind = $("#field-kind", ruleDialog).value;
        const playoffs = $('[name="playoffs"]', ruleDialog);
        for (const key of ["groupCount", "advance", "extraCount", "extraPlace"])
          $("#field-" + key, ruleDialog).closest(".field").hidden =
            kind !== "groups";
        $("[data-extra-tiebreak-editor]", ruleDialog).hidden =
          kind !== "groups" ||
          !Number($("#field-extraCount", ruleDialog).value);
        playoffs.closest("label").hidden = kind !== "league";
        $("#field-playoffCount", ruleDialog).closest(".field").hidden =
          kind !== "league" || !playoffs.checked;
        $("#field-elimination", ruleDialog).closest(".field").hidden =
          kind === "league" && !playoffs.checked;
        $("#field-legs", ruleDialog).closest(".field").hidden =
          kind === "knockout";
        $("[data-tiebreak-editor]", ruleDialog).hidden = kind === "knockout";
        $("#field-tieResolution", ruleDialog).closest(".field").hidden =
          kind === "knockout";
        $("#field-format", ruleDialog).closest(".field").hidden = ![
          "tennis",
          "smash",
          "pickleball",
        ].includes(APP.game.kind);
        $("#field-bestOf", ruleDialog).closest(".field").hidden =
          APP.game.kind === "fc";
        const matchTiebreak = $('[name="matchTiebreak"]', ruleDialog);
        if (matchTiebreak)
          matchTiebreak.closest("label").hidden =
            $("#field-format", ruleDialog).value !== "doubles";
        const deadline = $("#field-deadline", ruleDialog);
        if (deadline)
          deadline.closest(".field").hidden =
            $("#field-enrollment", ruleDialog).value === "selected";
      }
      ruleDialog.addEventListener("change", updateRuleFields);
      if (pickleball)
        pickleball.bindScoring(
          $("#field-bestOf", ruleDialog),
          $("#field-target", ruleDialog),
        );
      updateRuleFields();
    });
    $("#delete-comp").hidden = !(c.canAdmin || (c.canManage && mutable));
    $("#delete-comp").onclick = () => {
      const d = UI.formDialog(
        "Delete competition permanently",
        `<p>This permanently deletes <strong>${esc(c.name)}</strong>, its registrations, fixtures, results, score history and related notifications. Affected Elo ratings will be recalculated. This cannot be undone.</p>` +
          field(
            "Type the competition name to confirm",
            "confirmName",
            "",
            "text",
            'required autocomplete="off"',
          ) +
          `<p>Enter: <strong>${esc(c.name)}</strong></p>`,
        async (data) => {
          const confirmName = data.get("confirmName");
          if (confirmName !== c.name)
            throw new Error(
              "Type the competition name exactly to confirm deletion.",
            );
          await APP.api("competitions/" + id, { confirmName }, "DELETE");
          location.href = APP.url("game", { view: "competitions" });
        },
      );
      const submit = $(".btn-primary", d);
      submit.textContent = "Delete permanently";
      submit.classList.replace("btn-primary", "btn-danger");
      submit.type = "submit";
      $(".form-actions", d).insertAdjacentHTML(
        "afterbegin",
        button("Cancel", "cancel-delete"),
      );
      $("[data-action=cancel-delete]", d).onclick = () => d.close();
    };
    for (const pending of c.qualificationPending || []) {
      if (
        c.fixtures.some((f) =>
          ["knockout", "semifinal", "final"].includes(f.stage),
        )
      )
        continue;
      const { pool, rows, count } = pending;
      const extra = pool.startsWith("@");
      const box = document.createElement("div");
      box.className = "notice-strip";
      box.innerHTML = `<span>${esc(pending.label || `Qualification tie${pool ? ": group " + pool : ""}`)}. ${extra || c.settings.tieResolution === "admin" ? "An admin must select qualifiers with a reason." : "An extra match can settle the boundary."}</span>${c.canAdmin ? button("Resolve", "resolve") : ""}${!extra && c.canManage && c.settings.tieResolution === "match" ? button("Schedule tiebreak", "tiebreak") : ""}`;
      panel.append(box);
      $("[data-action=tiebreak]", box)?.addEventListener("click", async () => {
        try {
          await APP.api(`competitions/${id}/tiebreak`, { pool });
          await load();
        } catch (e) {
          UI.toast(e.message);
        }
      });
      $("[data-action=resolve]", box)?.addEventListener("click", () =>
        UI.formDialog(
          "Resolve qualification",
          rows
            .filter(
              (r) =>
                pending.fixed.includes(r.entry) ||
                pending.allowed.includes(r.entry),
            )
            .map(
              (r, i) =>
                `<label class="check"><input type="checkbox" name="qualifier" value="${r.entry}" ${i < count ? "checked" : ""}>${esc(name(r.entry))}${pending.fixed.includes(r.entry) ? " · already secured" : ""}</label>`,
            )
            .join("") + field("Reason", "reason", "", "text", "required"),
          async (f) => {
            await APP.api(`competitions/${id}/qualify`, {
              pool,
              entries: f.getAll("qualifier").map(Number),
              reason: f.get("reason"),
            });
            await load();
          },
        ),
      );
    }
  }
  async function entryDialog(manager) {
    const pair = c.format === "doubles";
    const d = UI.formDialog(
      manager ? "Add competition entry" : "Register for competition",
      (manager
        ? select("Player", "player", [], null)
        : "<p>" + esc(APP.me.name) + "</p>") +
        (pair
          ? select(
              "Partner (optional)",
              "partner",
              [["", "Register individually"]],
              null,
            )
          : ""),
      async (f) => {
        const ids = [manager ? Number(f.get("player")) : APP.me.player_id];
        if (pair && f.get("partner")) ids.push(Number(f.get("partner")));
        await APP.api(`competitions/${id}/entries`, { players: ids });
        await load();
      },
    );
    if (manager) await UI.picker($("[name=player]", d));
    if (pair) await UI.picker($("[name=partner]", d));
  }
  window.addEventListener("records-changed", () =>
    load().catch((e) => UI.toast(e.message)),
  );
  await load();
});
