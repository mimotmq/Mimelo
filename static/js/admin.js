APP.run(async () => {
  const { $, $$, esc, text, button, field, select } = UI;
  if (!APP.me) return APP.login();
  if (!APP.me.site_admin && !APP.me.admin_of.length)
    throw new Error("Admin access is required.");
  $("#adt-themes").remove();
  $("#adp-themes").remove();
  $("#adp-games .form-actions").remove();
  text(
    ".page-head .sub",
    "Manage players, game roles, team catalogs, and Elo rules.",
  );
  text(
    "#adp-games > .sub",
    "Five independent game books. Adding a game or changing its appearance requires a code change.",
  );
  text(
    ".settings-side .notice-card p",
    "Accepted results and admin Elo checkoff are separate. Downstream submissions lock earlier tournament results.",
  );
  const danger = $$(".settings-side .notice-card").at(-1);
  danger.innerHTML =
    "<h3>Record book export</h3><p>Export public records for an offline copy. Passwords, sessions and private links are excluded.</p>" +
    (APP.me.site_admin
      ? button("Export records", "export")
      : "<p>Site admins can export the record book.</p>");
  $("[data-action=export]")?.addEventListener("click", async () => {
    try {
      const data = await APP.api("admin/export"),
        blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        }),
        a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "mimelo-records.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (e) {
      UI.toast(e.message);
    }
  });
  const games = await APP.api("games");
  $("#admin-games-body").innerHTML = games
    .map(
      (g) =>
        `<tr><td><b>${esc(g.name)}</b></td><td>${esc(g.kind)}</td><td>Template</td><td>${g.players}</td><td>${g.matches}</td><td><span class="status status-live">Live</span></td><td><a class="btn btn-outline btn-sm" href="game.html?game=${g.slug}">Open</a>${APP.me.site_admin || APP.me.admin_of.includes(g.slug) ? button("Administer", "game-admin", `data-game="${g.slug}"`) : ""}</td></tr>`,
    )
    .join("");
  $$("[data-action=game-admin]").forEach(
    (b) => (b.onclick = () => gameAdmin(b.dataset.game)),
  );
  $("#adp-people .form-actions").innerHTML = button(
    "Create fill-in player",
    "fill-in",
  );
  $("[data-action=fill-in]").onclick = () =>
    UI.formDialog(
      "Create shared fill-in profile",
      field("Display name", "name", "", "text", "required") +
        "<p>This player can participate across all games before claiming an account.</p>",
      async (f) => {
        const p = await APP.api("players", { name: f.get("name") });
        showLink(p.url);
        await people();
      },
    );
  const search = document.createElement("input");
  search.className = "input";
  search.type = "search";
  search.placeholder = "Search people";
  search.setAttribute("aria-label", "Search people");
  $("#adp-people .table-wrap").before(search);
  let timer;
  search.oninput = () => {
    clearTimeout(timer);
    timer = setTimeout(() => people().catch((e) => UI.toast(e.message)), 200);
  };
  function showLink(url) {
    const d = UI.dialog(
      "Private account link",
      field(
        "Copy this link",
        "private-link",
        location.origin + url,
        "text",
        "readonly",
      ) +
        "<p>Share it directly with the intended person. It expires and can only be used once.</p>" +
        button("Copy link", "copy"),
    );
    $("[data-action=copy]", d).onclick = async () => {
      try {
        await navigator.clipboard.writeText(location.origin + url);
        UI.toast("Copied.");
      } catch {
        $("input", d).select();
        UI.toast("Select and copy the link.");
      }
    };
  }
  async function people(offset = 0) {
    const r = await APP.api(
      "admin/people?offset=" +
        offset +
        "&q=" +
        encodeURIComponent(search.value),
    );
    $("#admin-people-body").innerHTML = r.rows
      .map(
        (p) =>
          `<tr><td>${UI.playerLink(p)}</td><td>${esc(p.handle ? "@" + p.handle : "Fill-in")}</td><td>${p.site_admin ? "Site admin" : p.admin_of.map((g) => esc(games.find((x) => x.slug === g)?.name)).join(", ") || "Player"}</td><td>${UI.date(p.created)}</td><td>${button("Manage", "person", `data-person="${p.id}"`)}</td></tr>`,
      )
      .join("");
    UI.pager($("#adp-people"), r, people);
    $$("[data-person]").forEach(
      (b) =>
        (b.onclick = () =>
          manage(r.rows.find((p) => p.id === Number(b.dataset.person)))),
    );
    $(".settings-side .summary-meta").innerHTML =
      `<div><span>Players</span><b>${r.total}</b></div><div><span>Games</span><b>5</b></div><div><span>Starting Elo</span><b>1000</b></div><div><span>K factor</span><b>24</b></div>`;
  }
  function manage(p) {
    const d = UI.dialog(
      "Manage " + p.name,
      `<p>${esc(p.handle ? "@" + p.handle : "Unclaimed fill-in profile")}</p><div class="form-actions">${!p.account_id ? button("Generate claim link", "claim") : APP.me.site_admin ? button("Generate password-reset link", "reset") : ""}</div>${APP.me.site_admin && p.account_id ? "<h3>Game admin roles</h3>" + games.map((g) => `<label class="check"><input type="checkbox" data-role="${g.slug}" ${p.admin_of.includes(g.slug) ? "checked" : ""}>${esc(g.name)}</label>`).join("") : ""}<p class="hint" role="alert"></p>`,
    );
    for (const kind of ["claim", "reset"])
      $(`[data-action=${kind}]`, d)?.addEventListener("click", async () => {
        try {
          const r = await APP.api("admin/links", {
            kind,
            target: kind === "claim" ? p.id : p.account_id,
          });
          showLink(r.url);
        } catch (e) {
          $(".hint", d).textContent = e.message;
        }
      });
    $$("[data-role]", d).forEach(
      (box) =>
        (box.onchange = async () => {
          try {
            await APP.api("admin/roles", {
              game: box.dataset.role,
              account: p.account_id,
              enabled: box.checked,
            });
            UI.toast("Role saved.");
            await people();
          } catch (e) {
            box.checked = !box.checked;
            $(".hint", d).textContent = e.message;
          }
        }),
    );
  }
  async function gameAdmin(slug) {
    const g = games.find((g) => g.slug === slug),
      d = UI.dialog(
        g.name + " administration",
        `<div class="form-actions"><a class="btn btn-primary" href="game.html?game=${slug}&view=review">Result & Elo review</a>${button("Recalculate Elo", "recalculate")}</div><h3>Elo weights</h3><form id="weight-form" class="settings-form"><div class="form-grid">${Object.entries(
          g.weights,
        )
          .map(([k, v]) =>
            field(k, k, v, "number", 'min="0" max="3" step="0.01"'),
          )
          .join(
            "",
          )}</div><button class="btn btn-outline">Save weights for future competitions</button></form>${g.kind === "fc" ? '<hr><h3>Team catalog</h3><div class="form-actions">' + button("Add team", "add-team") + '<label class="btn btn-outline">Import CSV / XLSX<input type="file" id="catalog-import" accept=".csv,.xlsx" hidden></label></div><p class="hint">Columns: code, name, overall, nation, league, gender. Empty overall values block Elo checkoff until supplied.</p><input class="input" type="search" id="catalog-search" placeholder="Search teams" aria-label="Search team catalog"><div id="catalog-table"></div>' : ""}<p id="admin-message" class="hint" role="alert"></p>`,
      );
    $("[data-action=recalculate]", d).onclick = async () => {
      try {
        await APP.api("games/" + slug + "/recalculate", {});
        $("#admin-message", d).textContent =
          "Checked-off results recalculated in submission order.";
      } catch (e) {
        $("#admin-message", d).textContent = e.message;
      }
    };
    $("#weight-form", d).onsubmit = async (e) => {
      e.preventDefault();
      try {
        g.weights = await APP.api(
          "games/" + slug + "/weights",
          Object.fromEntries(
            [...new FormData(e.target)].map(([k, v]) => [k, Number(v)]),
          ),
          "PATCH",
        );
        UI.toast("Future competition weights saved.");
      } catch (e) {
        $("#admin-message", d).textContent = e.message;
      }
    };
    if (g.kind !== "fc") return;
    const teamForm = (t) =>
      UI.formDialog(
        t ? "Edit team" : "Add team",
        field(
          "Code",
          "code",
          t?.code || "",
          "text",
          t ? "readonly" : "required",
        ) +
          field("Name", "name", t?.name || "", "text", "required") +
          field(
            "Average overall",
            "overall",
            t?.overall ?? "",
            "number",
            'min="0" max="100" step="0.1"',
          ) +
          field("Nation", "nation", t?.nation || "") +
          field("League", "league", t?.league || "") +
          select(
            "Category",
            "gender",
            [
              ["men", "Men"],
              ["women", "Women"],
            ],
            t?.gender || "men",
          ),
        async (f) => {
          await APP.api("teams/" + slug, Object.fromEntries(f));
          await catalog();
        },
      );
    $("[data-action=add-team]", d).onclick = () => teamForm();
    async function catalog(offset = 0) {
      const r = await APP.api(
        "teams/" +
          slug +
          "?offset=" +
          offset +
          "&q=" +
          encodeURIComponent($("#catalog-search", d).value),
      );
      $("#catalog-table", d).innerHTML =
        '<div class="table-wrap"><table><thead><tr><th>Team</th><th>Overall</th><th></th></tr></thead><tbody>' +
        r.rows
          .map(
            (t) =>
              `<tr><td>${esc(t.name)}<small> · ${esc(t.code)}</small></td><td>${t.overall ?? "<b>Needed for Elo</b>"}</td><td>${button("Edit", "edit-team", `data-team="${t.id}"`)}</td></tr>`,
          )
          .join("") +
        "</tbody></table></div>";
      UI.pager($("#catalog-table", d), r, catalog);
      $$("[data-team]", d).forEach(
        (b) =>
          (b.onclick = () =>
            teamForm(r.rows.find((t) => t.id === Number(b.dataset.team)))),
      );
    }
    $("#catalog-search", d).oninput = () => {
      clearTimeout(timer);
      timer = setTimeout(
        () => catalog().catch((e) => UI.toast(e.message)),
        200,
      );
    };
    $("#catalog-import", d).onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const f = new FormData();
        f.append("file", file);
        const r = await APP.api("teams/" + slug + "/import", f);
        $("#admin-message", d).textContent = `Imported ${r.imported} teams.`;
        await catalog();
      } catch (x) {
        $("#admin-message", d).textContent = x.message;
      }
      e.target.value = "";
    };
    await catalog();
  }
  async function requests() {
    if (!APP.me.site_admin) return;
    let panel = $("#requests-panel");
    if (!panel) {
      panel = document.createElement("section");
      panel.className = "panel settings-card";
      panel.id = "requests-panel";
      $("#adp-people").append(panel);
    }
    const rows = await APP.api("admin/requests");
    panel.innerHTML =
      "<h3>Account requests</h3>" +
      rows
        .map(
          (r) =>
            `<article class="flair-item"><div><b>${esc(r.name)} · ${esc(r.kind)}</b><p>${r.kind === "handle" ? "Requested handle: " + esc(r.payload.handle) : "Merge fill-in #" + r.payload.source + " into player #" + r.payload.target}</p></div><div>${button("Approve", "approve", `data-request="${r.id}"`)}${button("Reject", "reject", `data-request="${r.id}"`)}</div></article>`,
        )
        .join("") +
      (rows.length ? "" : UI.empty("No account requests."));
    $$("[data-request]", panel).forEach(
      (b) =>
        (b.onclick = async () => {
          try {
            await APP.api("admin/requests/" + b.dataset.request, {
              approve: b.dataset.action === "approve",
            });
            await requests();
            await people();
          } catch (e) {
            UI.toast(e.message);
          }
        }),
    );
  }
  await people();
  await requests();
});
