export function configureConferences(c, reload) {
  const { esc, select, field } = UI;
  const entries = c.entries.filter((e) => !e.withdrawn);
  const name = (e) => e.players.map((p) => p.name).join(" + ");
  const layout = c.settings.conferenceLayout;
  const confs = layout?.conferences ?? [
    { name: "AFC", divisions: [] },
    { name: "NFC", divisions: [] },
  ];
  const divisionNames = ["North", "South", "East", "West"];
  const guesses = Math.max(1, Math.min(4, Math.floor(entries.length / 8)));
  const assignments = entries
    .map((entry, index) => {
      const saved = confs.findIndex((conf) =>
        conf.divisions.some((d) => d.entries.includes(entry.id)),
      );
      const conf = saved >= 0 ? saved : index % 2;
      const division =
        confs[conf].divisions.find((d) => d.entries.includes(entry.id))?.name ??
        divisionNames[Math.floor(index / 2) % guesses];
      const seed = (layout?.playoffSeeds?.indexOf(entry.id) ?? -1) + 1;
      return `<tr data-entry="${entry.id}"><th scope="row">${esc(name(entry))}</th><td><select class="select" aria-label="${esc(name(entry))} conference">${confs.map((v, i) => `<option value="${i}" ${conf === i ? "selected" : ""}>${esc(v.name)}</option>`).join("")}</select></td><td><input class="input" list="division-names" maxlength="50" aria-label="${esc(name(entry))} division" value="${esc(division)}" required></td><td><input class="input" type="number" min="1" max="${entries.length}" data-playoff-seed aria-label="${esc(name(entry))} fixed playoff seed" value="${seed || ""}"></td></tr>`;
    })
    .join("");
  const games = layout?.games ?? {
    division: 2,
    conference: guesses > 1 ? 2 : 0,
    cross: 1,
  };
  const dialog = UI.formDialog(
    "Conferences and schedule",
    '<p>Each division winner advances. Wild cards fill the remaining places in each conference bracket.</p><div class="form-grid">' +
      confs
        .map((v, i) =>
          field(
            "Conference " + (i + 1),
            "conference" + i,
            v.name,
            "text",
            'maxlength="50" required',
          ),
        )
        .join("") +
      field(
        "Wild cards per conference",
        "wildcards",
        layout?.wildcards ??
          Math.min(3, Math.max(0, Math.floor(entries.length / 2) - guesses)),
        "number",
        'min="0" max="64" required',
      ) +
      "</div>" +
      '<h3>Regular-season games per entrant</h3><div class="form-grid">' +
      [
        ["division", "In division"],
        ["conference", "Other divisions in conference"],
        ["cross", "Other conference"],
      ]
        .map(([key, label]) =>
          field(label, key, games[key], "number", 'min="0" max="64" required'),
        )
        .join("") +
      '</div><h3>Division assignments</h3><datalist id="division-names">' +
      divisionNames.map((s) => `<option value="${s}"></option>`).join("") +
      '</datalist><p class="hint">Leave playoff seeds blank for automatic qualification.</p><div class="table-wrap"><table><thead><tr><th>Entrant</th><th>Conference</th><th>Division</th><th>Fixed playoff seed</th></tr></thead><tbody data-assign>' +
      assignments +
      "</tbody></table></div>" +
      '<details><summary>Manual crossover fixtures</summary><p>Reserve an opponent and round. The scheduler fills the remaining quota.</p><div data-crossovers></div><button class="btn btn-outline" type="button" data-add-game>Add fixture</button></details>' +
      (layout
        ? '<label class="check"><input type="checkbox" name="remove">Return to a single league table and regular round robin</label>'
        : ""),
    async (data) => {
      const conferences = [0, 1].map((i) => ({
        name: data.get("conference" + i).trim(),
        divisions: [],
      }));
      const seeded = [];
      for (const row of dialog.querySelectorAll("[data-assign] tr")) {
        const group = conferences[Number(row.querySelector("select").value)];
        const name = row.querySelector("input").value.trim();
        let div = group.divisions.find((d) => d.name === name);
        if (!div) {
          div = { name, entries: [] };
          group.divisions.push(div);
        }
        div.entries.push(Number(row.dataset.entry));
        const seed = Number(row.querySelector("[data-playoff-seed]").value);
        if (seed) seeded.push([seed, Number(row.dataset.entry)]);
      }
      const crossovers = [...dialog.querySelectorAll("[data-manual]")].map(
        (el) => ({
          a: Number(el.querySelector("[name=a]").value),
          b: Number(el.querySelector("[name=b]").value),
          round: Number(el.querySelector("[name=round]").value),
        }),
      );
      const games = Object.fromEntries(
        ["division", "conference", "cross"].map((k) => [
          k,
          Number(data.get(k)),
        ]),
      );
      seeded.sort((a, b) => a[0] - b[0]);
      if (seeded.some(([seed], i) => seed !== i + 1))
        throw new Error("Use consecutive playoff seeds starting at 1.");
      await APP.api(
        "competitions/" + c.id + "/conferences",
        {
          layout: data.has("remove")
            ? null
            : {
                conferences,
                crossovers,
                games,
                wildcards: Number(data.get("wildcards")),
                ...(seeded.length
                  ? { playoffSeeds: seeded.map(([, entry]) => entry) }
                  : {}),
              },
        },
        "PATCH",
      );
      await reload();
    },
  );
  dialog.classList.add("competition-settings-dialog");
  confs.forEach((_, i) =>
    dialog
      .querySelector("[name=conference" + i + "]")
      .addEventListener("input", (event) => {
        dialog
          .querySelectorAll('[data-assign] option[value="' + i + '"]')
          .forEach((o) => (o.textContent = event.target.value));
      }),
  );
  function addGame(f = {}) {
    const row = document.createElement("div");
    row.className = "form-grid";
    row.dataset.manual = "";
    const options = entries.map((e) => [e.id, name(e)]);
    row.innerHTML =
      select("Home", "a", options, f.a) +
      select("Away", "b", options, f.b) +
      field(
        "Round",
        "round",
        f.round ?? 1,
        "number",
        'min="1" max="999" required',
      ) +
      '<button type="button" class="btn btn-ghost">Remove</button>';
    row.querySelectorAll("[id]").forEach((input) => {
      const label = row.querySelector('label[for="' + input.id + '"]');
      input.id += "-" + crypto.randomUUID();
      label.htmlFor = input.id;
    });
    row.querySelector("button").onclick = () => row.remove();
    dialog.querySelector("[data-crossovers]").append(row);
  }
  for (const f of layout?.crossovers ?? []) addGame(f);
  dialog.querySelector("[data-add-game]").onclick = () => addGame();
}
