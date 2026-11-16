(function () {
  const dialog = document.getElementById("comp-dialog");
  if (!dialog || !window.COMP_STORE) return;

  const params = new URLSearchParams(location.search);
  const ctx = window.resolveGame(params);
  const gameSlug = ctx.slug;
  const M = ctx.M;
  const isTennis = ctx.isTennis;
  const isTableTennis = ctx.isTableTennis;
  const isSmash = ctx.isSmash;
  const gameQuery = ctx.query;

  const $ = UI.$;
  const $$ = UI.$$;
  const esc = UI.esc;

  const nameInput = $("#comp-name");
  const playerWrap = $("#comp-players");
  const nextBtn = $("#comp-next");
  const backBtn = $("#comp-back");
  const createBtn = $("#comp-create");
  const stage1 = $("#comp-stage-1");
  const stage2 = $("#comp-stage-2");
  const step1 = $("#comp-step-1");
  const step2 = $("#comp-step-2");
  const nameError = $("#comp-name-error");
  const playersError = $("#comp-players-error");
  const formatHint = $("#comp-format-hint");
  const playersHint = $("#comp-players-hint");
  const leagueOptions = $("#comp-league-options");
  const eloInput = $("#comp-elo");
  const legsInput = $("#comp-legs");

  const allPlayers = M.players || [];
  const selected = new Set(allPlayers.map((p) => String(p.id)));
  let seedOrder = allPlayers.map(p => String(p.id));
  let seeds = Object.fromEntries(seedOrder.map((id, i) => [id, i + 1]));
  let step = 1;
  let saving = false;

  const formatHints = {
    league: "Everyone meets once, or twice with home-and-away legs.",
    knockout: "Choose single or double elimination. Any field size is supported with automatic byes.",
    groups: "Choose group count and qualifiers. Balanced groups feed your chosen knockout format."
  };

  const formatLabels = { league: "League", knockout: "Knockout", groups: "Groups + KO" };

  function formatValue() {
    const checked = dialog.querySelector('input[name="comp-format"]:checked');
    return checked ? checked.value : "league";
  }

  function chosenPlayers() {
    return allPlayers.filter((p) => selected.has(String(p.id)));
  }

  function opts() {
    return {
      name: nameInput.value.trim(),
      format: formatValue(),
      legs: legsInput.checked ? 2 : 1,
      elimination: $("#comp-elimination").value,
      groupCount: Number($("#comp-group-count").value),
      advance: Number($("#comp-advance").value),
      seeding: $("#comp-seeding").value,
      seedOrder, seeds,
      playoffs: formatValue() === "league" && $("#comp-playoffs").checked,
      playoffCount: Number($("#comp-playoff-count").value),
      elo: eloInput.checked
    };
  }

  function setNameError(message) {
    nameError.textContent = message || "";
    nameInput.setAttribute("aria-invalid", message ? "true" : "false");
  }

  function setPlayersError(message) {
    playersError.textContent = message || "";
  }

  function validateName() {
    const name = nameInput.value.trim();
    if (!name) {
      setNameError("Give the competition a name.");
      return false;
    }
    if (name.length < 3) {
      setNameError("Use at least 3 characters for the name.");
      return false;
    }
    const duplicate = (M.competitions || []).some((c) => c.name.trim().toLowerCase() === name.toLowerCase());
    if (duplicate) {
      setNameError("That name is already in use in this game.");
      return false;
    }
    setNameError("");
    return true;
  }

  function renderPlayers() {
    playerWrap.innerHTML = allPlayers.map((p) => {
      const checked = selected.has(String(p.id));
      const meta = isTennis
        ? "Singles " + p.elo + " · Doubles " + p.eloD
        : isSmash ? "Smash " + p.elo + " · Doubles " + p.eloD : isTableTennis ? "Table Tennis Elo " + p.elo : "Elo " + p.elo;
      return '<label class="player-option">' +
        '<input type="checkbox" value="' + p.id + '"' + (checked ? " checked" : "") + '>' +
        UI.avatar(p.name, "avatar-sm") +
        '<span class="player-option-copy"><b>' + esc(p.name) + "</b><span>" + esc(meta) + "</span></span>" +
        '<span class="player-option-check">' + UI.icon("check", 13) + "</span>" +
        "</label>";
    }).join("");
    syncPreview();
  }

  function renderSeeds() {
    const mode = $("#comp-seeding").value;
    let players = chosenPlayers();
    if (mode === "elo") players.sort((a, b) => b.elo - a.elo);
    else players.sort((a, b) => seedOrder.indexOf(String(a.id)) - seedOrder.indexOf(String(b.id)));
    $("#comp-seed-list").innerHTML = players.map((p, i) => {
      const id = String(p.id);
      const control = mode === "manual"
        ? `<button type="button" class="btn btn-outline btn-sm" data-seed-id="${id}" data-move="-1" ${i === 0 ? "disabled" : ""} aria-label="Move ${esc(p.name)} up">Up</button> <button type="button" class="btn btn-outline btn-sm" data-seed-id="${id}" data-move="1" ${i === players.length - 1 ? "disabled" : ""} aria-label="Move ${esc(p.name)} down">Down</button>`
        : mode === "preseeded" ? `<input class="input" type="number" min="1" step="1" data-seed-number="${id}" value="${seeds[id] || ""}" aria-label="Seed for ${esc(p.name)}">` : `<span>Elo ${p.elo}</span>`;
      return `<div class="comp-seed-row"><span>${i + 1}. ${esc(p.name)}</span><div>${control}</div></div>`;
    }).join("");
  }

  function syncPreview() {
    renderSeeds();
    const format = formatValue();
    const current = chosenPlayers();
    let preview = null;
    let issue = "";
    try {
      preview = COMP_STORE.generate(opts(), current);
    } catch (err) {
      preview = null;
      issue = err.message;
    }

    $("#comp-preview-format").textContent = formatLabels[format] || "Competition";
    $("#comp-preview-players").textContent = current.length;
    $("#comp-preview-fixtures").textContent = preview ? preview.fixtures : "—";
    $("#comp-preview-matchdays").textContent = preview ? preview.matchdays : "—";
    $("#comp-preview-elo").textContent = eloInput.checked ? "On" : "Off";
    playersHint.textContent = "Select any number of available players (minimum 2).";
    $("#comp-preview-note").textContent = issue || (preview && (preview.blurb + " Seed order: " + preview.settings.seeds.map(p => p.seed + ". " + p.name).join(" · "))) || "Select players to preview.";
  }

  function setStep(next) {
    step = next;
    stage1.hidden = step !== 1;
    stage2.hidden = step !== 2;
    nextBtn.hidden = step !== 1;
    backBtn.hidden = step !== 2;
    createBtn.hidden = step !== 2;
    step1.setAttribute("data-state", step === 1 ? "active" : "done");
    step2.setAttribute("data-state", step === 2 ? "active" : "pending");
    $("#comp-dialog-sub").textContent = step === 1 ? "Step 1 of 2 · Name and format" : "Step 2 of 2 · Players and setup";
    if (step === 2) {
      syncPreview();
      const first = playerWrap.querySelector("input");
      if (first) setTimeout(() => first.focus(), 0);
    } else {
      setTimeout(() => { if (dialog.open) nameInput.focus(); }, 0);
    }
  }

  function reset() {
    saving = false;
    createBtn.disabled = false;
    $("#comp-seeding").value = "elo";
    $("#comp-playoffs").checked = false;
    $("#comp-playoff-count").value = 4;
    seedOrder = allPlayers.map(p => String(p.id));
    seeds = Object.fromEntries(seedOrder.map((id, i) => [id, i + 1]));
    nameInput.value = "";
    setNameError("");
    setPlayersError("");
    const league = dialog.querySelector('input[name="comp-format"][value="league"]');
    if (league) league.checked = true;
    legsInput.checked = false;
    $("#comp-elimination").value = "single";
    $("#comp-group-count").value = 2;
    $("#comp-advance").value = 2;
    eloInput.checked = true;
    selected.clear();
    allPlayers.forEach((p) => selected.add(String(p.id)));
    renderPlayers();
    updateFormatUI();
    setStep(1);
  }

  function updateFormatUI() {
    const format = formatValue();
    formatHint.textContent = formatHints[format] || formatHints.league;
    leagueOptions.hidden = format !== "league";
    $("#comp-knockout-options").hidden = format === "league" && !$("#comp-playoffs").checked;
    $("#comp-playoff-options").hidden = !$("#comp-playoffs").checked;
    $("#comp-group-options").hidden = format !== "groups";
    setPlayersError("");
    syncPreview();
  }

  function showPlayersErrorForCount() {
    const current = chosenPlayers();
    const format = formatValue();
    try { COMP_STORE.generate(opts(), current); }
    catch (err) { setPlayersError(err.message); return false; }
    setPlayersError("");
    return true;
  }

  function create() {
    if (saving) return;
    if (!validateName()) {
      setStep(1);
      nameInput.focus();
      return;
    }
    if (!showPlayersErrorForCount()) return;
    const competition = COMP_STORE.generate(opts(), chosenPlayers());
    saving = true;
    createBtn.disabled = true;
    if (!COMP_STORE.save(gameSlug, competition)) {
      saving = false;
      createBtn.disabled = false;
      setPlayersError("Could not save in this browser. Check storage settings and try again.");
      return;
    }
    UI.closeDialog(dialog);
    location.href = "competition.html?id=" + encodeURIComponent(competition.id) + gameQuery + "&created=1";
  }

  $("#comp-new").addEventListener("click", () => {
    reset();
    UI.openDialog(dialog, $("#comp-new"));
  });

  nextBtn.addEventListener("click", () => {
    if (validateName()) setStep(2);
    else nameInput.focus();
  });

  backBtn.addEventListener("click", () => setStep(1));
  createBtn.addEventListener("click", create);

  nameInput.addEventListener("input", () => {
    if (nameError.textContent) setNameError("");
  });

  dialog.querySelectorAll('input[name="comp-format"]').forEach((input) => {
    input.addEventListener("change", updateFormatUI);
  });

  ["#comp-elimination", "#comp-group-count", "#comp-advance"].forEach((id) => {
    $(id).addEventListener("input", syncPreview);
  });
  $("#comp-playoffs").addEventListener("change", updateFormatUI);
  $("#comp-playoff-count").addEventListener("input", syncPreview);
  $("#comp-seeding").addEventListener("change", syncPreview);
  $("#comp-seed-list").addEventListener("change", (e) => {
    const id = e.target.getAttribute("data-seed-number");
    if (id === null) return;
    seeds[id] = Number(e.target.value);
    syncPreview();
  });
  $("#comp-seed-list").addEventListener("click", (e) => {
    const button = e.target.closest("[data-move]");
    if (!button) return;
    const active = seedOrder.filter(id => selected.has(id));
    const i = active.indexOf(button.dataset.seedId), j = i + Number(button.dataset.move);
    if (j < 0 || j >= active.length) return;
    const a = seedOrder.indexOf(active[i]), b = seedOrder.indexOf(active[j]);
    [seedOrder[a], seedOrder[b]] = [seedOrder[b], seedOrder[a]];
    syncPreview();
    const replacement = Array.from($("#comp-seed-list").querySelectorAll("[data-move]")).find(el => el.dataset.seedId === button.dataset.seedId && el.dataset.move === button.dataset.move && !el.disabled);
    (replacement || $("#comp-seeding")).focus();
  });
  legsInput.addEventListener("change", syncPreview);
  eloInput.addEventListener("change", syncPreview);

  playerWrap.addEventListener("change", (e) => {
    const box = e.target.closest('input[type="checkbox"]');
    if (!box) return;
    if (box.checked) selected.add(box.value);
    else selected.delete(box.value);
    if (playersError.textContent) setPlayersError("");
    syncPreview();
  });

  $("#comp-select-all").addEventListener("click", () => {
    allPlayers.forEach((p) => selected.add(String(p.id)));
    playerWrap.querySelectorAll('input[type="checkbox"]').forEach((box) => { box.checked = true; });
    setPlayersError("");
    syncPreview();
  });

  $("#comp-select-none").addEventListener("click", () => {
    selected.clear();
    playerWrap.querySelectorAll('input[type="checkbox"]').forEach((box) => { box.checked = false; });
    syncPreview();
  });

  $("#comp-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (step === 1) {
      if (validateName()) setStep(2);
    } else {
      create();
    }
  });

  renderPlayers();
  updateFormatUI();
})();
