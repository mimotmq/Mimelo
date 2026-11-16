/* EA FC-style team picker for the record form. Sample catalogue only. */
(function () {
  const $ = UI.$;
  const esc = UI.esc;

  let dialog = null;
  let els = {};
  let ctx = null;
  let selected = null;
  let filters = { gender: "men", nation: "all", league: "all", q: "" };

  const pool = () => window.MOCK.teamPool || [];
  const teamByCode = (code) => pool().find((t) => t.code === code) || null;
  const teamMeta = (t) => [t.league, t.nation].filter(Boolean).join(" · ");

  function unique(values) {
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }

  function genderTeams() {
    return pool().filter((t) => t.gender === filters.gender);
  }

  function buildNationOptions() {
    const nations = unique(genderTeams().map((t) => t.nation));
    if (!nations.includes(filters.nation)) filters.nation = "all";
    els.nation.innerHTML = '<option value="all">All nations</option>' +
      nations.map((n) => '<option value="' + esc(n) + '">' + esc(n) + "</option>").join("");
    els.nation.value = filters.nation;
  }

  function buildLeagueOptions() {
    const teams = genderTeams().filter((t) => filters.nation === "all" || t.nation === filters.nation);
    const leagues = unique(teams.map((t) => t.league));
    if (!leagues.includes(filters.league)) filters.league = "all";
    els.league.innerHTML = '<option value="all">All leagues</option>' +
      leagues.map((l) => '<option value="' + esc(l) + '">' + esc(l) + "</option>").join("");
    els.league.value = filters.league;
  }

  function syncGender() {
    els.genderBtns.forEach((btn) => {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-gender") === filters.gender ? "true" : "false");
    });
  }

  function visibleTeams() {
    const q = filters.q.trim().toLowerCase();
    return pool().filter((t) =>
      t.gender === filters.gender &&
      (filters.nation === "all" || t.nation === filters.nation) &&
      (filters.league === "all" || t.league === filters.league) &&
      (!q || (t.name + " " + t.league + " " + t.nation).toLowerCase().includes(q))
    ).sort((a, b) => a.name.localeCompare(b.name));
  }

  function renderResults() {
    const list = visibleTeams();
    els.count.textContent = list.length + (list.length === 1 ? " team" : " teams");
    els.results.innerHTML = list.length
      ? list.map((t) =>
          '<button class="team-option" type="button" data-team="' + esc(t.code) + '" aria-pressed="' + (t.code === selected ? "true" : "false") + '">' +
          UI.monogram(t.code) +
          '<span class="team-option-copy"><b>' + esc(t.name) + "</b><span>" + esc(teamMeta(t)) + "</span></span>" +
          "</button>"
        ).join("")
      : '<div class="team-empty">No teams match those filters. Try another nation or league.</div>';
    els.apply.disabled = !teamByCode(selected);
  }

  function renderQuick() {
    if (!ctx) return;
    const chips = [];
    const add = (code, label) => {
      if (!code || chips.some((c) => c.code === code)) return;
      const team = teamByCode(code);
      if (team) chips.push({ code: code, label: label, team: team });
    };
    add(ctx.lastUsed, "Last used");
    add(ctx.player && ctx.player.club, "Favourite");
    (ctx.player && ctx.player.teams ? ctx.player.teams : []).slice(0, 3).forEach((t) => add(t.code, "Season"));
    els.quick.innerHTML = chips.map((c) =>
      '<button class="chip team-quick-chip" type="button" data-quick="' + esc(c.code) + '">' +
      UI.monogram(c.code) + "<span>" + esc(c.label) + ": " + esc(c.team.name) + "</span></button>"
    ).join("");
  }

  function render() {
    buildLeagueOptions();
    renderResults();
  }

  function choose(code) {
    if (!teamByCode(code)) return;
    selected = code;
    renderResults();
  }

  function apply() {
    const team = teamByCode(selected);
    if (!team) return;
    const onSelect = ctx.onSelect;
    UI.closeDialog(dialog);
    if (onSelect) onSelect(team);
  }

  function open(opts) {
    if (!dialog) return;
    ctx = opts;
    selected = opts.current || opts.lastUsed || (opts.player && opts.player.club) || null;
    const current = teamByCode(selected);
    filters = {
      gender: current ? current.gender : "men",
      nation: "all",
      league: "all",
      q: ""
    };
    els.search.value = "";
    els.sub.textContent = "For " + opts.player.name + " · this match only";
    syncGender();
    buildNationOptions();
    renderQuick();
    render();
    UI.openDialog(dialog, opts.trigger);
  }

  function init() {
    dialog = $("#team-dialog");
    if (!dialog) return;
    els = {
      dialog: dialog,
      sub: $("#team-picker-sub"),
      genderBtns: Array.from(document.querySelectorAll("[data-gender]")),
      search: $("#team-search"),
      nation: $("#team-nation"),
      league: $("#team-league"),
      quick: $("#team-quick"),
      count: $("#team-count"),
      results: $("#team-results"),
      apply: $("#team-apply")
    };

    els.genderBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        filters.gender = btn.getAttribute("data-gender");
        filters.nation = "all";
        filters.league = "all";
        syncGender();
        buildNationOptions();
        render();
      });
    });

    els.nation.addEventListener("change", () => {
      filters.nation = els.nation.value;
      filters.league = "all";
      buildLeagueOptions();
      renderResults();
    });

    els.league.addEventListener("change", () => {
      filters.league = els.league.value;
      renderResults();
    });

    els.search.addEventListener("input", () => {
      filters.q = els.search.value;
      renderResults();
    });

    els.results.addEventListener("click", (e) => {
      const opt = e.target.closest("[data-team]");
      if (opt) choose(opt.getAttribute("data-team"));
    });

    els.results.addEventListener("dblclick", (e) => {
      const opt = e.target.closest("[data-team]");
      if (opt) {
        choose(opt.getAttribute("data-team"));
        apply();
      }
    });

    els.quick.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-quick]");
      if (!chip) return;
      const team = teamByCode(chip.getAttribute("data-quick"));
      if (!team) return;
      filters.gender = team.gender;
      filters.nation = "all";
      filters.league = "all";
      filters.q = "";
      els.search.value = "";
      syncGender();
      buildNationOptions();
      selected = team.code;
      render();
      const el = els.results.querySelector('[data-team="' + team.code + '"]');
      if (el) el.scrollIntoView({ block: "nearest" });
    });

    els.apply.addEventListener("click", apply);
  }

  window.TEAM_PICKER = { init: init, open: open, teamByCode: teamByCode };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
