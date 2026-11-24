import { isBracketFixture, predictionRows } from "./bracket-picks.js";
import { bracketLayout } from "./competition-bracket.js";

export function renderPredictions(container, competition, data, { APP, UI }) {
  const { esc, avatar } = UI;
  const endpoint = `competitions/${competition.id}/predictions`;
  const editable = data.open && !!APP.me;
  const saved = { ...data.mine };
  const draft = { ...saved };
  const entries = new Map(
    competition.entries.map((entry) => [entry.id, entry.players]),
  );
  const entrant = (id) =>
    `<span class="prediction-team">${(entries.get(id) || [])
      .map(
        (p) =>
          `<span class="prediction-person">${avatar(p.name, "avatar-xs", p.photo)}<span>${esc(p.name)}</span></span>`,
      )
      .join("")}</span>`;
  const double = competition.settings.elimination === "double";
  const poolNames = {
    W: "Winners bracket",
    L: "Losers bracket",
    G: "Grand finals",
  };
  const roundNames = new Map();
  for (const pool of ["W", "L", "G", "P"]) {
    const fixtures = competition.fixtures.filter(
      (f) => f.pool === pool && isBracketFixture(f),
    );
    for (const match of bracketLayout(fixtures, { pool }).nodes)
      roundNames.set(match.f.id, match);
  }
  const deadline = data.deadline
    ? `Closes ${new Date(data.deadline).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} or when the first result is reported.`
    : "Closes when the first knockout result is reported.";
  container.innerHTML = `
    <div class="panel-body">
      <p>${esc(data.open ? deadline : "Entries closed.")} One point per correct winner.</p>
      ${data.open && !APP.me ? `<a class="btn btn-outline" href="/login.html?next=${encodeURIComponent("/" + APP.url("competition", { id: competition.id, view: "predictions" }))}">Log in to make picks</a>` : ""}
      ${
        editable || data.mine
          ? `<form class="prediction-form"><div class="prediction-rounds"></div>
        <div class="form-actions">${editable ? '<button class="btn btn-primary" type="submit" aria-describedby="prediction-save-hint">Save bracket</button><span class="hint" id="prediction-save-hint"></span>' : ""}
        <span role="status">${data.mine ? "Bracket saved." : ""}</span></div></form>`
          : ""
      }
      ${
        data.leaderboard.length
          ? `<section class="prediction-leaderboard"><h3>Leaderboard</h3>
        <div class="table-wrap"><table><thead><tr><th scope="col">Place</th><th scope="col">Player</th><th scope="col">Points</th></tr></thead>
        <tbody>${data.leaderboard.map((row) => `<tr><td>${row.rank}</td><th scope="row">${esc(row.name)}${row.mine ? " (you)" : ""}</th><td>${row.points}</td></tr>`).join("")}</tbody></table></div></section>`
          : data.open
            ? ""
            : "<p>No brackets were submitted.</p>"
      }
    </div>`;
  const form = container.querySelector(".prediction-form");
  if (!form) return;
  const leaderboard = container.querySelector(".prediction-leaderboard");
  if (leaderboard) form.before(leaderboard);
  const rounds = form.querySelector(".prediction-rounds");
  const feedback = form.querySelector("[role=status]");
  const submit = form.querySelector("button[type=submit]");
  function draw(focus) {
    const pools = new Map();
    const rows = predictionRows(competition.fixtures, draft);
    let complete = true;
    let changed = false;
    for (const row of rows) {
      const { fixture: f, a, b, winner, waiting, skipped, needsPick } = row;
      if (!needsPick || winner === undefined) delete draft[f.id];
      if (waiting || (needsPick && winner === undefined)) complete = false;
      if (draft[f.id] !== saved[f.id]) changed = true;
      if (f.conditional && f.status === "cancelled") continue;
      if (!waiting && !skipped && !needsPick) continue;
      if (f.pool === "L" && (a === null || b === null)) continue;
      const layout = roundNames.get(f.id);
      const heading = layout?.heading || f.label;
      if (!pools.has(f.pool)) pools.set(f.pool, new Map());
      const groups = pools.get(f.pool);
      if (!groups.has(heading)) groups.set(heading, []);
      const label = layout?.label || f.label;
      const result =
        !data.open &&
        f.status === "completed" &&
        !f.no_contest &&
        f.winner &&
        needsPick
          ? winner === f.winner
            ? "Correct"
            : "Incorrect"
          : "";
      const choices = skipped
        ? '<p class="muted">Reset not needed</p>'
        : waiting
          ? '<p class="muted">Pick earlier winners first</p>'
          : needsPick
            ? [a, b]
                .map((id) =>
                  editable
                    ? `<label class="prediction-choice"><input type="radio" name="pick-${f.id}" value="${id}" data-prediction-fixture="${f.id}" ${id === winner ? "checked" : ""}>${entrant(id)}</label>`
                    : `<div class="prediction-choice"${id === winner ? ' data-picked="true"' : ""}>${entrant(id)}${id === winner ? '<span class="muted">Picked</span>' : ""}</div>`,
                )
                .join("")
            : `<div class="prediction-choice">${entrant(winner)}<span class="muted">Bye</span></div>`;
      groups
        .get(heading)
        .push(
          `<fieldset class="prediction-match"><legend${label === heading ? ' class="sr-only"' : ""}>${esc(label)}</legend>${choices}${result ? `<p class="prediction-result" data-correct="${result === "Correct"}">${result}</p>` : ""}</fieldset>`,
        );
    }
    rounds.innerHTML = [...pools]
      .map(
        ([pool, groups]) =>
          `<section class="prediction-pool">${double ? `<h3>${poolNames[pool]}</h3>` : ""}<div class="prediction-grid">${[
            ...groups,
          ]
            .map(
              ([heading, cards]) =>
                `<section class="prediction-round"><${double ? "h4" : "h3"}>${esc(heading)}</${double ? "h4" : "h3"}>${cards.join("")}</section>`,
            )
            .join("")}</div></section>`,
      )
      .join("");
    if (submit) {
      submit.disabled = !complete || !changed;
      form.querySelector("#prediction-save-hint").textContent = complete
        ? ""
        : "Pick a winner for each matchup to save.";
    }
    if (focus)
      rounds
        .querySelector(
          `[data-prediction-fixture="${focus.fixture}"][value="${focus.value}"]`,
        )
        ?.focus({ preventScroll: true });
  }
  form.onchange = (event) => {
    const input = event.target.closest("[data-prediction-fixture]");
    if (!input) return;
    draft[input.dataset.predictionFixture] = Number(input.value);
    feedback.textContent = "";
    draw({
      fixture: Number(input.dataset.predictionFixture),
      value: Number(input.value),
    });
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (!submit || submit.disabled) return;
    submit.disabled = true;
    const payload = { ...draft };
    try {
      const result = await APP.api(endpoint, { picks: payload }, "PUT");
      for (const key of Object.keys(saved)) delete saved[key];
      Object.assign(saved, result.mine);
      feedback.textContent = "Bracket saved.";
    } catch (error) {
      feedback.textContent = error.message;
    }
    draw();
  };
  draw();
}
