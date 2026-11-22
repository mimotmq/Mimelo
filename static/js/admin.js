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
    `${APP.games.length} independent game books. Adding a game or changing its appearance requires a code change.`,
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
    if (["fc", "smash"].includes(g.kind)) {
      const images = document.createElement("section");
      images.innerHTML = `<hr><h3>Match images</h3><p class="sub">${g.kind === "fc" ? "Upload a badge once and reuse it for any team. Matching team codes and genders share their badge across EA FC editions." : "Upload character stock icons by character ID and stage photos by stage ID. Stage photos also apply to team matches."}</p><div class="form-actions">${button("Manage images", "manage-images")}</div>`;
      $("#weight-form", d).after(images);
      $("[data-action=manage-images]", images).onclick = () => manageImages(g);
    }
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
  async function manageImages(g) {
    const d = UI.dialog(
      g.name + " match images",
      `<p>Choose an entry and upload a PNG, JPEG, or WebP image (up to 5 MB). Transparent PNGs work well for badges and stock icons.</p>${g.kind === "fc" ? "<p>Use an existing badge for teams that share a crest. Uploading or unlinking changes all EA FC editions with this team code and gender; other linked teams keep their badge.</p>" + button("Bulk import crests", "bulk-badges") : ""}${select(
        "Image type",
        "image-kind",
        g.kind === "fc"
          ? [["team", "Team badges"]]
          : [
              ["fighter", "Character stock icons"],
              ["stage", "Stage photos"],
            ],
      )}<div class="field"><label for="image-search">Search by name, code, or ID</label><input id="image-search" class="input" type="search"></div><p id="image-message" class="hint" role="status"></p><div id="image-catalog"></div>`,
    );
    let request = 0,
      searchTimer;
    $("[data-action=bulk-badges]", d)?.addEventListener("click", () =>
      bulkBadges(g, () => load()),
    );
    async function load(offset = 0) {
      const current = ++request,
        kind = $("#field-image-kind", d).value;
      try {
        const r = await APP.api(
          `games/${g.slug}/images?kind=${kind}&offset=${offset}&q=${encodeURIComponent($("#image-search", d).value)}`,
        );
        if (current !== request || !d.isConnected) return;
        const list = $("#image-catalog", d);
        list.innerHTML =
          r.rows
            .map(
              (item, index) =>
                `<article class="catalog-image-row">${UI.catalogVisual(item, kind === "stage")}<div class="catalog-image-copy"><b>${esc(item.name)}</b><p>${kind === "team" ? "Team code" : "ID"}: <code>${esc(item.key)}</code>${kind === "fighter" ? " · " + esc(item.code) : kind === "team" ? " · " + esc(item.gender) : ""}</p><div class="form-actions">${button(kind === "team" ? "Upload new badge" : item.image ? "Replace image" : "Upload image", "choose-image", `data-index="${index}" aria-label="${item.image ? "Replace" : "Upload"} image for ${esc(item.name)}"`)}<input type="file" data-upload="${index}" accept="image/png,image/jpeg,image/webp" aria-label="Upload image for ${esc(item.name)}" hidden>${kind === "team" ? button("Use existing badge", "reuse-badge", `data-index="${index}"`) : ""}${item.image && (kind === "team" || item.custom_image) ? button(kind === "team" ? "Unlink badge" : "Use default image", "remove-image", `data-index="${index}"`) : ""}</div></div></article>`,
            )
            .join("") ||
          UI.empty(
            g.kind === "fc"
              ? "No teams found. Add or import teams in the team catalog first."
              : "No matching entries.",
          );
        UI.pager(list, r, load);
        const save = async (index, file, method) => {
          const item = r.rows[index],
            controls = $$("input,button,select", d);
          controls.forEach((c) => (c.disabled = true));
          try {
            let body = {};
            if (file) {
              if (file.size > 5 * 1024 * 1024)
                throw new Error("Choose an image under 5 MB.");
              body = new FormData();
              body.append("image", file);
            }
            await APP.api(
              `games/${g.slug}/images/${kind}/${encodeURIComponent(item.key)}`,
              body,
              method,
            );
            $("#image-message", d).textContent =
              `${item.name}: image ${method === "DELETE" ? "removed" : "saved"}.`;
          } catch (e) {
            $("#image-message", d).textContent = e.message;
          } finally {
            controls.forEach((c) => (c.disabled = false));
            await load(offset);
          }
        };
        $$("[data-action=reuse-badge]", list).forEach(
          (b) =>
            (b.onclick = () =>
              chooseBadge(g, r.rows[Number(b.dataset.index)], () =>
                load(offset),
              )),
        );
        $$("[data-action=choose-image]", list).forEach(
          (b) =>
            (b.onclick = () =>
              $(`[data-upload="${b.dataset.index}"]`, list).click()),
        );
        $$("[data-upload]", list).forEach(
          (input) =>
            (input.onchange = () => {
              if (input.files[0])
                save(Number(input.dataset.upload), input.files[0], "POST");
            }),
        );
        $$("[data-action=remove-image]", list).forEach(
          (b) =>
            (b.onclick = () => save(Number(b.dataset.index), null, "DELETE")),
        );
      } catch (e) {
        if (current === request) $("#image-message", d).textContent = e.message;
      }
    }
    $("#field-image-kind", d).onchange = () => {
      clearTimeout(searchTimer);
      $("#image-search", d).value = "";
      load();
    };
    $("#image-search", d).oninput = () => {
      clearTimeout(searchTimer);
      request++;
      searchTimer = setTimeout(() => load(), 200);
    };
    await load();
  }
  function bulkBadges(g, saved) {
    const base = `games/${g.slug}/badge-import`,
      d = UI.dialog(
        g.name + " bulk crest import",
        `<p>Import crests for this edition. Matching codes and genders share their badges across EA FC editions. Existing badges are always kept.</p>
        <ol><li><a class="btn btn-outline btn-sm" href="/api/${base}/template" download>Download team mapping CSV</a></li>
        <li><a class="btn btn-outline btn-sm" href="/api/${base}/helper" download>Download browser helper</a> Unzip it, open <code>chrome://extensions</code> or <code>edge://extensions</code>, enable Developer mode, then choose <b>Load unpacked</b> and select the helper folder.</li>
        <li>Open the helper from your browser's extension menu. Load the mapping, enter SoFIFA image IDs or URLs, and download a crest ZIP. Name suggestions from open SoFIFA pages need confirmation. You can also add images already downloaded. Browser access is required; downloads may still be blocked by SoFIFA.</li>
        <li>To reuse an uploaded crest for a women's team, copy its <code>badge_id</code> into that team's mapping row. To share a new crest, use the same URL or image filename for both rows.</li></ol>
        <p>A manual ZIP can contain <code>mapping.csv</code> and the named PNG, JPEG, or WebP files. Match by exact team code and gender. Limits: 25 MB ZIP, 5 MB per image.</p>
        <div class="field"><label for="badge-zip">Crest ZIP</label><input id="badge-zip" type="file" accept=".zip,application/zip"></div>
        <div class="form-actions">${button("Preview ZIP", "preview-badges", "disabled")}${button("Apply ready crests", "apply-badges", "disabled")}</div>
        <p id="bulk-message" class="hint" role="status" aria-live="polite"></p><div id="bulk-preview"></div>`,
      );
    const input = $("#badge-zip", d),
      previewButton = $("[data-action=preview-badges]", d),
      applyButton = $("[data-action=apply-badges]", d),
      message = $("#bulk-message", d);
    d.style.overflowWrap = "anywhere";
    input.style.width = "100%";
    $(".form-actions", d).style.flexWrap = "wrap";
    $$("ol .btn", d).forEach((link) => {
      link.style.whiteSpace = "normal";
    });
    let file, preview;
    input.onchange = () => {
      file = input.files[0];
      preview = null;
      previewButton.disabled = !file;
      applyButton.disabled = true;
      $("#bulk-preview", d).replaceChildren();
      message.textContent = "";
    };
    previewButton.onclick = async () => {
      input.disabled = previewButton.disabled = applyButton.disabled = true;
      preview = null;
      try {
        if (file.size > 25 * 1024 * 1024)
          throw new Error("Choose a ZIP under 25 MB.");
        message.textContent = "Checking team matches and crest images…";
        const body = new FormData();
        body.append("file", file);
        preview = await APP.api(base + "/preview", body);
        message.textContent = `${preview.ready} ready · ${preview.existing} existing badges kept · ${preview.issues} rows need attention. Applying imports only ready rows. Preview has not changed any badges.`;
        $("#bulk-preview", d).innerHTML = preview.rows
          .map(
            (r) =>
              `<article class="catalog-image-row">${r.image ? UI.catalogVisual(r) : ""}<div class="catalog-image-copy"><b>${esc(r.name || r.code)}</b><p>${esc(r.code)} · ${esc(r.gender)}</p><p>${esc(r.message)}</p></div></article>`,
          )
          .join("");
        applyButton.textContent = `Apply ${preview.ready} ready crests`;
      } catch (e) {
        message.textContent = e.message;
      } finally {
        input.disabled = previewButton.disabled = false;
        applyButton.disabled = !preview?.ready;
      }
    };
    applyButton.onclick = async () => {
      input.disabled = previewButton.disabled = applyButton.disabled = true;
      try {
        message.textContent = "Saving crests…";
        const body = new FormData();
        body.append("file", file);
        const result = await APP.api(
          base + "/apply?preview=" + encodeURIComponent(preview.preview),
          body,
        );
        preview = null;
        $("#bulk-preview", d).replaceChildren();
        message.textContent = `${result.imported} crests applied · ${result.existing} existing badges kept · ${result.issues} rows skipped. Shared EA FC editions now use these badges.`;
        await saved();
      } catch (e) {
        preview = null;
        message.textContent =
          e.message + " Preview the ZIP again before applying.";
      } finally {
        input.disabled = previewButton.disabled = false;
      }
    };
  }
  async function chooseBadge(g, team, saved) {
    const d = UI.dialog(
      "Choose a badge for " + team.name,
      `<p>This badge will be used for ${esc(team.code)} · ${esc(team.gender)} in all EA FC editions.</p><div class="field"><label for="badge-search">Search saved badges</label><input id="badge-search" class="input" type="search"></div><p class="hint" role="status"></p><div id="badge-library"></div>`,
    );
    let request = 0,
      timer;
    async function load(offset = 0) {
      const current = ++request;
      try {
        const result = await APP.api(
          `team-badges?offset=${offset}&q=${encodeURIComponent($("#badge-search", d).value)}`,
        );
        if (current !== request || !d.isConnected) return;
        const list = $("#badge-library", d);
        list.innerHTML =
          result.rows
            .map(
              (badge) =>
                `<article class="catalog-image-row">${UI.catalogVisual(badge)}<div class="catalog-image-copy"><b>${esc(badge.name)}</b><div class="form-actions">${button(badge.id === team.badge_id ? "Current badge" : "Use this badge", "select-badge", `data-badge="${badge.id}" ${badge.id === team.badge_id ? "disabled" : ""}`)}</div></div></article>`,
            )
            .join("") ||
          UI.empty(
            "No saved badges found. Upload a badge for any team to add it to this library.",
          );
        UI.pager(list, result, load);
        $$("[data-badge]", list).forEach(
          (b) =>
            (b.onclick = async () => {
              const controls = $$("input,button", d);
              controls.forEach((c) => (c.disabled = true));
              try {
                await APP.api(
                  `games/${g.slug}/images/team/${encodeURIComponent(team.code)}`,
                  { badge_id: Number(b.dataset.badge) },
                  "PATCH",
                );
                await saved();
                d.close();
                UI.toast("Badge linked across EA FC editions.");
              } catch (e) {
                $(".hint", d).textContent = e.message;
                controls.forEach((c) => (c.disabled = false));
              }
            }),
        );
      } catch (e) {
        if (current === request) $(".hint", d).textContent = e.message;
      }
    }
    $("#badge-search", d).oninput = () => {
      clearTimeout(timer);
      request++;
      timer = setTimeout(() => load(), 200);
    };
    await load();
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
