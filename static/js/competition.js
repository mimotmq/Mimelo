APP.run(async () => {
  const { $, $$, esc, text, button, field, select } = UI,
    id = Number(APP.params.get("id"));
  let c;
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
    c = await APP.api("competitions/" + id);
    if (c.game !== APP.slug) {
      location.replace("competition.html?game=" + c.game + "&id=" + id);
      return;
    }
    document.title = c.name + " · " + APP.game.name + " · mimELo";
    text("[data-comp-name]", c.name);
    text("[data-comp-kind]", c.kind);
    text(
      "[data-comp-format]",
      c.format + " · " + c.settings.elimination + " elimination",
    );
    text("[data-comp-status]", c.state);
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
      `of ${c.fixtures.filter((f) => f.status !== "cancelled").length} fixtures accepted`,
    );
    text("[data-comp-leader]", c.champion ? name(c.champion) : "Undecided");
    text("[data-comp-players]", c.players);
    text("[data-comp-fixtures]", c.fixtures.length);
    text("[data-comp-played-stat]", done);
    text(
      "[data-comp-matchdays]",
      Math.max(0, ...c.fixtures.map((f) => f.round)),
    );
    text("[data-comp-rounds]", c.settings.legs);
    text("#crumb-game", APP.game.name);
    text("#table-heading", c.name + " standings");
    text("#table-sub", "Accepted results · organizer-selected tiebreak rules");
    text("#table-chip", c.format);
    text("#fixtures-sub", "Scheduled fixtures and accepted results");
    text("#bracket-sub", "Winners, losers, and advancement");
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
    $("#fixtures-body").innerHTML =
      c.fixtures
        .map(
          (f) =>
            `<tr><td>${UI.date(f.scheduled)}${c.canManage && ["ready", "waiting"].includes(f.status) ? button("Schedule", "schedule", `data-fixture="${f.id}"`) : ""}</td><td>${esc(f.pool + " " + f.label)}</td><td>${esc(name(f.a))}</td><td>${f.match_id ? button(f.forfeit ? "Forfeit" : `${f.a_score}–${f.b_score}`, "result", `data-match="${f.match_id}"`) : f.status === "ready" ? `<a class="btn btn-outline btn-sm" href="${APP.url("game", { view: "record", fixture: f.id, competition: c.id })}">Record</a>` : "—"}</td><td>${esc(name(f.b))}</td><td>${esc(f.status)}${c.canManage && f.status === "ready" && !f.match_id ? button("Forfeit", "forfeit", `data-fixture="${f.id}"`) : ""}</td></tr>`,
        )
        .join("") ||
      '<tr><td colspan="6">Registration precedes the draw.</td></tr>';
    for (const b of $$("[data-fixture]"))
      b.onclick = () => {
        const f = c.fixtures.find((f) => f.id === Number(b.dataset.fixture));
        if (b.dataset.action === "schedule")
          UI.formDialog(
            "Schedule fixture",
            field("Date and time (local)", "scheduled", "", "datetime-local"),
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
        else
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
    const knockout = c.fixtures.filter((f) =>
      ["knockout", "semifinal", "final"].includes(f.stage),
    );
    const node = (f) =>
      `<div class="bracket-node ${f.stage === "final" && f.winner ? "champion" : ""}"><p><span class="${f.winner === f.a ? "winner" : ""}">${esc(name(f.a))}</span><span class="score">${f.status === "bye" ? "BYE" : f.status === "cancelled" ? "—" : f.match_id ? (f.forfeit ? "W/O" : `${f.a_score}–${f.b_score}`) : esc(f.status)}</span></p><p><span class="${f.winner === f.b ? "winner" : ""}">${esc(name(f.b))}</span></p>${f.match_id ? button("View result", "result", `data-match="${f.match_id}"`) : ""}${f.conditional ? '<span class="reset-tag">Reset if needed</span>' : ""}</div>`;
    function rounds(fs) {
      return [...new Set(fs.map((f) => f.round))]
        .map(
          (r) =>
            `<div class="bracket-round"><div class="bracket-round-title">Round ${r}</div>${fs
              .filter((f) => f.round === r)
              .map(node)
              .join("")}</div>`,
        )
        .join("");
    }
    $("#bracket-wrap").innerHTML = knockout.length
      ? c.settings.elimination === "double"
        ? `<div class="bracket-scroll"><div class="de-bracket">${[
            ["W", "Winners bracket"],
            ["L", "Losers bracket"],
            ["G", "Grand finals"],
          ]
            .map(
              ([p, l]) =>
                `<div class="de-col"><div class="de-col-title">${l}</div>${rounds(knockout.filter((f) => f.pool === p))}</div>`,
            )
            .join("")}</div></div>`
        : `<div class="bracket-scroll"><div class="bracket">${rounds(knockout)}</div></div>`
      : UI.empty(
          c.kind === "league" && !c.settings.playoffs
            ? "This league has no knockout stage."
            : "The bracket appears after registration or qualification is complete.",
        );
    bindMatches();
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
        c.settings.tieBreaks.join(" → ") +
        ". Unresolved qualifiers: " +
        c.settings.tieResolution +
        ".",
    );
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
    await management();
  }
  async function management() {
    let panel = $("#registration-panel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "registration-panel";
      panel.className = "panel settings-card";
      $(".player-hero").after(panel);
    }
    const mutable = ["registration", "closed"].includes(c.state),
      open =
        c.state === "registration" &&
        c.deadline > Date.now() &&
        c.enrollment !== "selected";
    panel.innerHTML = `<div class="panel-head"><h2>${mutable ? "Entrants & registration" : "Competition entrants"}</h2><span class="chip">${c.entries.length} entries</span></div><div class="panel-body"><div class="form-actions">${open && !userEntry() ? button("Register", "register") : ""}${c.canManage && mutable ? button("Add entrants", "add-entry") + button("Edit rules", "rules") + button("Set seeds", "seeds") + (c.state === "registration" ? button("Close registration", "close") : "") + button("Generate draw", "draw") : ""}</div><div class="table-wrap"><table><thead><tr><th>Seed</th><th>Entrant</th><th>Action</th></tr></thead><tbody>${c.entries.map((e) => `<tr><td>${e.seed || "—"}</td><td>${esc(name(e.id))}${c.format === "doubles" && e.players.length === 1 ? " · awaiting partner" : ""}</td><td>${mutable && (c.canManage || e.players.some((p) => p.id === APP.me?.player_id)) ? button("Withdraw", "withdraw", `data-entry="${e.id}"`) : ""}</td></tr>`).join("") || '<tr><td colspan="3">No entries yet.</td></tr>'}</tbody></table></div>${c.canManage && mutable && c.format === "doubles" ? button("Pair individual entries", "pair") : ""}</div>`;
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
    $("[data-action=seeds]", panel)?.addEventListener("click", () =>
      UI.formDialog(
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
      ),
    );
    $("[data-action=rules]", panel)?.addEventListener("click", () =>
      UI.formDialog(
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
            ["tennis", "smash"].includes(APP.game.kind)
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
          field(
            "Best of",
            "bestOf",
            c.settings.bestOf,
            "number",
            'min="1" max="7"',
          ) +
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
            "Playoff qualifiers",
            "playoffCount",
            c.settings.playoffCount,
            "number",
            'min="2"',
          ) +
          (APP.game.kind === "tt"
            ? select(
                "Points per game",
                "target",
                [
                  [11, 11],
                  [21, 21],
                ],
                c.settings.target,
              )
            : "") +
          (APP.game.kind === "tennis"
            ? `<label class="check"><input type="checkbox" name="matchTiebreak" ${c.settings.matchTiebreak ? "checked" : ""}>Doubles: final match tiebreak</label>`
            : "") +
          field("Tiebreak order", "ties", c.settings.tieBreaks.join(",")) +
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
                playoffCount: Number(f.get("playoffCount")),
                tieBreaks: f
                  .get("ties")
                  .split(",")
                  .map((x) => x.trim()),
                tieResolution: f.get("tieResolution"),
              },
            },
            "PATCH",
          );
          await load();
        },
      ),
    );
    $("#delete-comp").hidden = !c.canManage || !mutable;
    $("#delete-comp").onclick = async () => {
      if (!confirm("Delete this competition and its registrations?")) return;
      try {
        await APP.api("competitions/" + id, {}, "DELETE");
        location.href = APP.url("game", { view: "competitions" });
      } catch (e) {
        UI.toast(e.message);
      }
    };
    for (const [pool, rows] of Object.entries(c.standings)) {
      const count =
        c.kind === "groups"
          ? c.settings.advance
          : c.settings.playoffs
            ? c.settings.playoffCount
            : 1;
      if (
        !c.fixtures.some((f) =>
          ["knockout", "semifinal", "final"].includes(f.stage),
        ) &&
        rows[count]?.tiedWithPrevious
      ) {
        const box = document.createElement("div");
        box.className = "notice-strip";
        box.innerHTML = `<span>Qualification tie ${esc(pool ? ": group " + pool : "")}. ${c.settings.tieResolution === "match" ? "An extra match can settle the boundary." : "An admin must select qualifiers with a reason."}</span>${c.canAdmin ? button("Resolve", "resolve") : ""}${c.canManage && c.settings.tieResolution === "match" ? button("Schedule tiebreak", "tiebreak") : ""}`;
        panel.append(box);
        $("[data-action=tiebreak]", box)?.addEventListener(
          "click",
          async () => {
            try {
              await APP.api(`competitions/${id}/tiebreak`, { pool });
              await load();
            } catch (e) {
              UI.toast(e.message);
            }
          },
        );
        $("[data-action=resolve]", box)?.addEventListener("click", () =>
          UI.formDialog(
            "Resolve qualification",
            rows
              .map(
                (r) =>
                  `<label class="check"><input type="checkbox" name="qualifier" value="${r.entry}" ${r.position <= count ? "checked" : ""}>${esc(name(r.entry))}</label>`,
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
