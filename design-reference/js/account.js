/* Account demo interactions, including a local profile-picture preview. */
(function () {
  const $ = UI.$;
  const $$ = UI.$$;

  const club = $("#acct-club");
  if (club) {
    club.innerHTML = window.MOCK.clubs.map((c) =>
      '<option value="' + c.code + '">' + UI.esc(c.code) + " · " + UI.esc(c.name) + "</option>"
    ).join("");
    club.value = "ARS";
  }

  const preview = $("#avatar-preview");
  const header = $("#header-avatar");
  const side = $("#side-avatar");
  const file = $("#avatar-file");
  const remove = $("#avatar-remove");
  let photo = "";

  function renderAvatars() {
    const markup = photo
      ? '<img src="' + photo + '" alt="Alex Rivera profile picture">'
      : "AR";
    [preview, header, side].forEach((el) => {
      if (!el) return;
      if (photo) {
        el.innerHTML = '<img src="' + photo + '" alt="Alex Rivera profile picture">';
      } else {
        el.innerHTML = markup;
      }
    });
  }

  if (file) {
    file.addEventListener("change", () => {
      const f = file.files && file.files[0];
      if (!f) return;
      if (!/^image\//.test(f.type)) {
        UI.toast("Choose an image file for your profile picture.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        photo = String(reader.result);
        renderAvatars();
        UI.toast("Profile picture preview updated — demo only. It is not uploaded.");
      };
      reader.readAsDataURL(f);
    });
  }

  if (remove) {
    remove.addEventListener("click", () => {
      photo = "";
      if (file) file.value = "";
      renderAvatars();
      UI.toast("Profile picture removed — initials restored. Demo only.");
    });
  }

  const profile = $("#profile-form");
  if (profile) {
    profile.addEventListener("submit", (e) => {
      e.preventDefault();
      UI.toast("Profile saved — demo only. Nothing was saved.");
    });
  }

  const security = $("#security-form");
  if (security) {
    security.addEventListener("submit", (e) => {
      e.preventDefault();
      const a = $("#new-pass").value;
      const b = $("#conf-pass").value;
      if (a.length < 8) {
        UI.toast("Use at least 8 characters for the new password.");
        $("#new-pass").focus();
        return;
      }
      if (a !== b) {
        UI.toast("The new passwords do not match.");
        $("#conf-pass").focus();
        return;
      }
      UI.toast("Password updated — demo only. Nothing was saved.");
    });
  }

  $$(".toggle input").forEach((input) => {
    const label = input.closest(".toggle");
    const text = label ? label.querySelector("span") : null;
    if (!text) return;
    const sync = () => { text.textContent = input.checked ? "On" : "Off"; };
    input.addEventListener("change", sync);
    sync();
  });
})();
