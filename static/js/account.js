APP.run(async () => {
  if (!APP.me) return APP.login();
  const { $, $$, esc, text, toast, field, button } = UI;
  let me = APP.me;
  $(".breadcrumb").innerHTML =
    '<a href="index.html">Home</a><span class="sep">/</span><span>Your account</span>';
  function avatars() {
    for (const id of ["avatar-preview", "header-avatar", "side-avatar"]) {
      const e = $("#" + id);
      if (e)
        e.innerHTML = me.photo
          ? `<img src="${esc(me.photo)}" alt="${esc(me.name)}">`
          : esc(UI.initials(me.name));
    }
  }
  text(".page-head .sub", `${me.name} · @${me.handle}`);
  $$('a[href*="player.html"]').forEach(
    (a) => (a.href = "player.html?player=" + me.player_id),
  );
  const logout = $('.page-actions a[href="login.html"]');
  if (logout) {
    logout.href = "#";
    logout.onclick = async (e) => {
      e.preventDefault();
      await APP.api("logout", {});
      location.href = "/";
    };
  }
  $("#acct-name").value = me.name;
  $("#acct-handle").value = me.handle;
  $("#acct-handle").readOnly = true;
  $("#acct-handle").after(
    Object.assign(document.createElement("button"), {
      type: "button",
      className: "btn btn-ghost btn-sm",
      textContent: "Request handle change",
      onclick: () =>
        UI.formDialog(
          "Request handle change",
          field("New handle", "handle", "", "text", "required"),
          async (f) => {
            await APP.api("me/handle-request", { handle: f.get("handle") });
            toast("Sent to the site admin.");
          },
        ),
    }),
  );
  $("#acct-email").value = me.email;
  $("#acct-bio").value = me.profile.bio || "";
  const club = $("#acct-club");
  club.outerHTML = `<input class="input" id="acct-club" value="${esc(me.profile.favoriteTeam || "")}">`;
  const { countryList, profileNationalities } =
    await import("./profile-flairs.js");
  const countries = await countryList();
  const nationalities = profileNationalities(me.profile);
  const choices = [
    ["", "Not specified"],
    ...countries.map((country) => [country.name, country.name]),
  ];
  for (const nationality of nationalities)
    if (!countries.some((country) => country.name === nationality))
      choices.push([nationality, nationality + " (existing entry)"]);
  const form = $("#profile-form"),
    actions = $(".form-actions", form);
  function profileGroup(label) {
    const group = document.createElement("fieldset");
    group.className = "profile-fieldset";
    group.innerHTML = `<legend>${esc(label)}</legend>`;
    return group;
  }
  const shared = profileGroup("Shared identity");
  shared.append(
    $("#acct-name").closest(".form-grid"),
    $("#acct-email").closest(".field"),
    $("#acct-bio").closest(".field"),
  );
  shared.insertAdjacentHTML(
    "beforeend",
    `<div class="form-grid">${UI.select("Nationality (optional)", "nationality", choices, nationalities[0] || "")}${UI.select("Second nationality (optional)", "nationality-secondary", choices, nationalities[1] || "")}</div>`,
  );
  const football = profileGroup("Football");
  football.append($("#acct-club").closest(".field"));
  $(".hint", football).textContent = "Shown on your EA FC profiles.";
  const smash = profileGroup("Super Smash Bros.");
  smash.innerHTML +=
    field("Smash tag", "tag", me.profile.tag || "") +
    field("Smash mains", "mains", me.profile.mains || "");
  form.replaceChildren(shared, football, smash, actions);
  const nationalityFields = [
    $("#field-nationality"),
    $("#field-nationality-secondary"),
  ];
  function nationalityOptions() {
    nationalityFields.forEach((input, index) => {
      for (const option of input.options)
        option.disabled =
          !!option.value && option.value === nationalityFields[1 - index].value;
    });
  }
  nationalityFields.forEach((input) =>
    input.addEventListener("change", nationalityOptions),
  );
  nationalityOptions();
  text(
    "#profile-form .form-actions .muted",
    "Changes appear on your public profile.",
  );
  $("#profile-form").onsubmit = async (e) => {
    e.preventDefault();
    try {
      const f = new FormData(e.target);
      me = await APP.api(
        "me",
        {
          name: $("#acct-name").value,
          email: $("#acct-email").value,
          profile: {
            bio: $("#acct-bio").value,
            favoriteTeam: $("#acct-club").value,
            nationalities: [
              f.get("nationality"),
              f.get("nationality-secondary"),
            ].filter(Boolean),
            tag: f.get("tag"),
            mains: f.get("mains"),
          },
        },
        "PATCH",
      );
      APP.me = me;
      avatars();
      toast("Profile saved.");
    } catch (x) {
      toast(x.message);
    }
  };
  $("#avatar-file").onchange = async (e) => {
    if (!e.target.files[0]) return;
    try {
      const f = new FormData();
      f.append("photo", e.target.files[0]);
      me.photo = (await APP.api("me/photo", f)).photo;
      avatars();
      toast("Photo saved.");
    } catch (x) {
      toast(x.message);
    }
  };
  $("#avatar-remove").onclick = async () => {
    try {
      await APP.api("me/photo", {}, "DELETE");
      me.photo = null;
      avatars();
    } catch (e) {
      toast(e.message);
    }
  };
  avatars();
  const notificationLabels = [
    ["submitted", "Result submissions"],
    ["accepted", "Accepted results"],
    ["rated", "Elo checkoffs"],
    ["competition", "Competition updates"],
  ];
  $("#ap-notifications .flair-list").innerHTML = notificationLabels
    .map(
      ([key, label]) =>
        `<div class="flair-item"><div class="flair-name">${label}</div><label class="toggle"><input type="checkbox" data-preference="${key}" ${me.preferences[key] !== false ? "checked" : ""}><span>In app</span></label></div>`,
    )
    .join("");
  $("#ap-notifications .form-actions").innerHTML = button(
    "Save preferences",
    "preferences",
  );
  $("[data-action=preferences]").onclick = async () => {
    try {
      const preferences = Object.fromEntries(
        $$("[data-preference]").map((e) => [e.dataset.preference, e.checked]),
      );
      await APP.api("me", { preferences }, "PATCH");
      toast("Preferences saved.");
    } catch (e) {
      toast(e.message);
    }
  };
  text(
    "#ap-notifications > .sub",
    "Alerts about your matches and games you administer. Email delivery is not enabled.",
  );
  text(
    "#ap-security > .sub",
    "Change your password and manage signed-in devices.",
  );
  $("#security-form").onsubmit = async (e) => {
    e.preventDefault();
    try {
      if ($("#new-pass").value !== $("#conf-pass").value)
        throw new Error("New passwords do not match.");
      await APP.api("me/password", {
        current: $("#cur-pass").value,
        password: $("#new-pass").value,
      });
      e.target.reset();
      toast("Password changed. Other sessions were signed out.");
      await sessions();
    } catch (x) {
      toast(x.message);
    }
  };
  async function sessions() {
    const list = await APP.api("me/sessions");
    $("#ap-security .flair-list").innerHTML = list
      .map(
        (s) =>
          `<div class="flair-item"><div><b>${s.current ? "This browser" : "Signed-in device"}</b><p class="muted">${esc(s.agent)} · ${UI.date(s.created)}</p></div>${s.current ? '<span class="role-chip">Current</span>' : button("Revoke", "revoke", `data-session="${esc(s.token)}"`)}</div>`,
      )
      .join("");
    $$("[data-session]").forEach(
      (b) =>
        (b.onclick = async () => {
          await APP.api("me/sessions/" + b.dataset.session, {}, "DELETE");
          await sessions();
        }),
    );
  }
  $("#ap-security .form-section .form-actions").innerHTML = button(
    "Sign out other devices",
    "revoke-all",
  );
  $("[data-action=revoke-all]").onclick = async () => {
    await APP.api("me/sessions", {}, "DELETE");
    await sessions();
  };
  await sessions();
  const profile = await APP.api("players/" + me.player_id);
  const records = profile.records || [];
  $(".settings-side .panel-body").innerHTML =
    `<div class="player-cell">${UI.avatar(me.name, "", me.photo)}<b>${esc(me.name)}</b></div><div class="summary-meta">${
      records
        .map((record) => {
          const game = APP.games.find((g) => g.slug === record.game);
          const rating = profile.ratings.find(
            (r) => r.game === record.game && r.format === record.format,
          );
          return `<div><span>${esc(game.name)} · ${record.format}</span><b>${rating ? UI.elo(rating) + " Elo" : UI.count(record.matches, "match", "matches")}</b></div>`;
        })
        .join("") || "<p>No recorded games yet.</p>"
    }</div><a class="btn btn-outline btn-block" href="player.html?player=${me.player_id}">Public profile</a>`;
  const notes = $$(".settings-side .notice-card");
  notes[0].innerHTML =
    '<h3>Your roles</h3><div class="tag-row">' +
    (me.site_admin ? '<span class="role-chip site">Site admin</span>' : "") +
    me.admin_of
      .map(
        (g) =>
          `<span class="role-chip game">${esc(APP.games.find((x) => x.slug === g)?.name)} admin</span>`,
      )
      .join("") +
    '<span class="role-chip">Player</span></div>' +
    (me.site_admin || me.admin_of.length
      ? '<a class="link-arrow" href="admin.html">Open admin</a>'
      : "");
  notes[1].innerHTML = `<h3>${APP.games.length} independent game books</h3><p>Your identity is shared. Every game keeps its own ratings and results, with separate singles and doubles records.</p>`;
});
