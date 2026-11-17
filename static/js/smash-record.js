/* Compact Smash recording. Picks inherit until a game explicitly changes them. */
export function createSmashRecorder(form, { catalog, format, initial = [] }) {
  const { $, $$, esc, catalogVisual } = UI;
  const container = $("#record-games", form);
  const fighters = [...catalog.fighters, ...(catalog.legacyFighters || [])];
  let currentFormat = format();
  let games = initial.map((game) => ({
    a: String(game.a),
    b: String(game.b),
    winner: game.suddenDeath ? String(game.winner) : "",
    jv: !!game.jv,
    picks: Object.fromEntries([
      ...(game.fighters || []).map((name, j) => ["fighter" + j, name]),
      ["stage", game.stage],
    ]),
  }));
  const empty = () => ({ a: "", b: "", winner: "", jv: false, picks: {} });
  const perSide = () => (format() === "doubles" ? 2 : 1);
  const stockLimit = () => perSide() * 3;
  const number = (fighter) =>
    fighter
      ? `<small class="fighter-number" ${String(fighter.num).length > 3 ? "data-wide-number" : ""}>#${esc(fighter.num)}${fighter.echo ? "<sup>ε</sup>" : ""}</small>`
      : "";
  const lookup = (key, name) =>
    (key === "stage" ? catalog.stages : fighters).find((f) => f.name === name);
  const effective = (i, key) =>
    games[i]?.picks[key] ?? (i > 0 ? effective(i - 1, key) : "");
  const playerName = (j) => {
    const side = Math.floor(j / perSide()),
      index = j % perSide();
    const id = Number($(`#field-p${side}${index}`)?.value);
    return (
      APP.players.get(id)?.name ||
      `Side ${side + 1}${perSide() === 2 ? " · player " + (index + 1) : ""}`
    );
  };
  const tied = (i) => {
    const { a, b } = games[i];
    return (
      a !== "" &&
      b !== "" &&
      Number(a) === Number(b) &&
      Number(a) >= 0 &&
      Number(a) < stockLimit()
    );
  };
  function capture() {
    $$("[data-game-row]", container).forEach((row) => {
      const i = Number(row.dataset.gameRow),
        game = games[i];
      game.a = $(`#field-score${i}a`, row).value;
      game.b = $(`#field-score${i}b`, row).value;
      game.winner = $(`input[name="sd-winner${i}"]:checked`, row)?.value ?? "";
      game.jv = !!$("[data-jv]", row)?.checked;
    });
  }
  function pickButton(i, key, label) {
    return `<button class="smash-pick" type="button" data-pick="${key}" data-game="${i}" aria-haspopup="dialog" aria-label="${esc(`Game ${i + 1} · ${label}`)}"></button>`;
  }
  function sync() {
    $$("[data-pick]", container).forEach((button) => {
      const { pick: key, game: index } = button.dataset;
      const value = effective(Number(index), key),
        item = lookup(key, value);
      const stage = key === "stage",
        j = Number(key.slice(7));
      const owner = stage ? "stage" : `${playerName(j)} · fighter`;
      const signature = JSON.stringify([value, owner, item?.image, item?.num]);
      if (button.dataset.rendered === signature) return;
      button.dataset.rendered = signature;
      button.classList.toggle("has-pick", !!value);
      button.innerHTML = `${catalogVisual(item, stage)}<span class="smash-pick-copy">${!stage ? `<small>${esc(playerName(j))}</small>` : ""}<span>${stage ? "" : number(item)}<b>${esc(value || (stage ? "Choose stage" : "Choose fighter"))}</b></span></span><span class="pick-chevron" aria-hidden="true">⌄</span>`;
      button.setAttribute(
        "aria-label",
        `Game ${Number(index) + 1} · ${owner}: ${value || "Choose"}`,
      );
      button.title = value || (stage ? "Choose stage" : "Choose fighter");
    });
    $$("[data-game-row]", container).forEach((row) => {
      const i = Number(row.dataset.gameRow),
        sd = tied(i);
      $(".smash-sudden-death", row).hidden = !sd;
      if (!sd) {
        games[i].winner = "";
        $$("[name^=sd-winner]", row).forEach((radio) => {
          radio.checked = false;
        });
      }
      $$("[data-winner-name]", row).forEach((label) => {
        label.textContent = Array.from({ length: perSide() }, (_, j) =>
          playerName(Number(label.dataset.winnerName) * perSide() + j),
        ).join(" + ");
      });
      const jv = $("[data-jv]", row);
      if (jv) {
        jv.closest("label").hidden = sd;
        if (sd) jv.checked = games[i].jv = false;
      }
    });
  }
  function renderGames(bestOf) {
    capture();
    if (currentFormat !== format()) {
      games = [];
      currentFormat = format();
    }
    while (games.length < bestOf) games.push(empty());
    container.innerHTML =
      `<p class="hint smash-carry-hint">Enter stocks taken. Fighters and stage carry forward; change a pick only when it changes.</p>` +
      Array.from({ length: bestOf }, (_, i) => {
        const game = games[i];
        return `<section class="live-game-row smash-record-game" data-game-row="${i}" aria-labelledby="smash-game-title${i}">
        <header class="smash-game-heading"><h4 id="smash-game-title${i}">Game ${i + 1}</h4>${perSide() === 1 ? `<label class="check smash-jv"><input type="checkbox" data-jv id="jv${i}" ${game.jv ? "checked" : ""}>JV win</label>` : ""}</header>
        <div class="smash-game-sides">${[0, 1].map((side) => `<div class="smash-side"><div class="smash-side-fighters">${Array.from({ length: perSide() }, (_, j) => pickButton(i, "fighter" + (side * perSide() + j), `Side ${side + 1} player ${j + 1} fighter`)).join("")}</div><label class="smash-stock-label">Stocks<input class="input stock-score" type="number" inputmode="numeric" min="0" max="${stockLimit()}" step="1" id="field-score${i}${side === 0 ? "a" : "b"}" aria-label="Game ${i + 1} · side ${side + 1} stocks taken" value="${esc(game[side === 0 ? "a" : "b"])}"></label></div>`).join("")}</div>
        <div class="smash-stage-row">${pickButton(i, "stage", "Stage")}</div>
        <fieldset class="smash-sudden-death" ${tied(i) ? "" : "hidden"}><legend>Sudden death · winner</legend>${[0, 1].map((side) => `<label><input type="radio" name="sd-winner${i}" value="${side}" ${game.winner === String(side) ? "checked" : ""}><span data-winner-name="${side}">Side ${side + 1}</span></label>`).join("")}</fieldset>
      </section>`;
      }).join("");
    sync();
    form.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function openPicker(button) {
    const i = Number(button.dataset.game),
      key = button.dataset.pick,
      stage = key === "stage";
    const chosen = effective(i, key);
    const j = Number(key.slice(7));
    const d = UI.dialog(
      stage ? "Choose stage" : "Choose fighter",
      `<p class="sub picker-context">Game ${i + 1}${stage ? "" : " · " + esc(playerName(j))}</p><label class="search-field smash-picker-search"><span class="sr-only">Search ${stage ? "stages" : "fighters"}</span><input class="input" type="search" placeholder="${stage ? "Search stages" : "Search fighters or number"}" aria-label="Search ${stage ? "stages" : "fighters"}"></label><p class="hint picker-count" role="status" aria-live="polite"></p><div class="smash-picker-results"></div>`,
    );
    d.classList.add(
      "smash-picker-dialog",
      stage ? "smash-stage-dialog" : "smash-fighter-dialog",
    );
    d.setAttribute("aria-label", stage ? "Choose stage" : "Choose fighter");
    const search = $("input[type=search]", d),
      results = $(".smash-picker-results", d);
    function fitNames() {
      $$(".roster-name", results).forEach((slot) => {
        const name = $("b", slot);
        const scale = Math.min(
          1,
          slot.clientWidth / Math.max(1, name.scrollWidth),
        );
        name.style.transform = `scaleX(${scale})`;
      });
    }
    const nameObserver = new ResizeObserver(fitNames);
    nameObserver.observe(results);
    document.fonts.ready.then(fitNames);
    d.addEventListener("close", () => nameObserver.disconnect(), {
      once: true,
    });
    const normalize = (s) =>
      String(s)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[#.\s/-]/g, "");
    function render() {
      const query = normalize(search.value);
      const entries = (stage ? catalog.stages : catalog.fighters).filter(
        (entry) =>
          [
            entry.name,
            entry.code,
            entry.num,
            ...(entry.aliases || []),
            entry.echo ? entry.num + "ε" : "",
          ].some((s) => s != null && normalize(s).includes(query)),
      );
      $(".picker-count", d).textContent =
        `${entries.length} ${stage ? "stages" : "fighters"}`;
      const tile = (entry) =>
        `<button type="button" class="smash-roster-tile" data-entry="${esc(entry.id)}" aria-pressed="${entry.name === chosen || entry.aliases?.includes(chosen) || false}" aria-label="${esc((stage ? "" : "#" + entry.num + (entry.echo ? "ε" : "") + " ") + entry.name)}" title="${esc(entry.name)}">${stage ? "" : number(entry)}${catalogVisual(entry, stage)}<span class="roster-tile-copy">${stage ? `<b>${esc(entry.name)}</b>` : `<span class="roster-name"><b>${esc(entry.name)}</b></span>`}</span></button>`;
      if (stage) {
        // New catalog groups and stages appear automatically; no hardcoded stage list.
        const groups = [
          ...new Set([
            "Starters",
            "Counterpicks",
            ...entries.map((s) => s.group || "Other stages"),
          ]),
        ];
        results.innerHTML = groups
          .map((group) => {
            const stages = entries.filter(
              (s) => (s.group || "Other stages") === group,
            );
            return stages.length
              ? `<section class="stage-picker-group"><h3>${esc(group)}</h3><div class="smash-stage-grid">${stages.map(tile).join("")}</div></section>`
              : "";
          })
          .join("");
      } else
        results.innerHTML = `<div class="smash-roster-grid">${entries.map(tile).join("")}</div>`;
      if (!entries.length)
        results.innerHTML =
          '<p class="hint">No matches. Try another name or number.</p>';
      results.scrollTop = 0;
      fitNames();
    }
    results.onclick = (event) => {
      const tile = event.target.closest("[data-entry]");
      if (!tile) return;
      const entry = (stage ? catalog.stages : catalog.fighters).find(
        (f) => String(f.id) === tile.dataset.entry,
      );
      games[i].picks[key] = entry.name;
      sync();
      d.close();
      button.focus();
      form.dispatchEvent(new Event("input", { bubbles: true }));
    };
    search.oninput = render;
    // Enter selects the first search result; Escape retains the current selection.
    search.onkeydown = (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        $("[data-entry]", results)?.click();
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        $("[data-entry]", results)?.focus();
      }
    };
    d.addEventListener("click", (event) => {
      if (event.target === d) {
        const r = d.getBoundingClientRect();
        if (
          event.clientX < r.left ||
          event.clientX > r.right ||
          event.clientY < r.top ||
          event.clientY > r.bottom
        )
          d.close();
      }
    });
    render();
    // Keep touch keyboards closed so the roster is visible on phones.
    if (matchMedia("(pointer:fine)").matches) search.focus();
    else $("[data-entry]", results)?.focus({ preventScroll: true });
  }
  container.addEventListener("click", (event) => {
    const button = event.target.closest("[data-pick]");
    if (button) openPicker(button);
  });
  container.addEventListener("input", () => {
    capture();
    sync();
  });
  form.addEventListener("change", (event) => {
    if (event.target.matches("#record-players select")) sync();
  });
  form.addEventListener("reset", () =>
    requestAnimationFrame(() => {
      games = initial.map((game) => ({
        ...empty(),
        a: String(game.a),
        b: String(game.b),
        winner: game.suddenDeath ? String(game.winner) : "",
        jv: !!game.jv,
        picks: Object.fromEntries([
          ...game.fighters.map((name, j) => ["fighter" + j, name]),
          ["stage", game.stage],
        ]),
      }));
      container.innerHTML = "";
      renderGames(Number($("#field-bestOf")?.value || 3));
    }),
  );
  return {
    renderGames,
    read(i) {
      capture();
      const suddenDeath = tied(i);
      if (suddenDeath && games[i].winner === "")
        throw new Error(`Choose the sudden-death winner for game ${i + 1}.`);
      return {
        fighters: Array.from({ length: perSide() * 2 }, (_, j) =>
          effective(i, "fighter" + j),
        ),
        stage: effective(i, "stage"),
        suddenDeath,
        ...(suddenDeath ? { winner: Number(games[i].winner) } : {}),
        jv: !suddenDeath && games[i].jv,
      };
    },
  };
}
