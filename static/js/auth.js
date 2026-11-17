APP.run(async () => {
  const { $, $$, text, esc, toast } = UI;
  const next = APP.params.get("next");
  const target = new URL(next || "/", location.origin);
  const destination =
    target.origin === location.origin ? target.pathname + target.search : "/";
  $("#login-email").type = "text";
  $("#login-email").autocomplete = "username";
  $("#login-email").value = "";
  $("#login-email").placeholder = "Handle or email";
  text("label[for=login-email]", "Handle or email");
  $("#login-password").value = "";
  $("#reg-email").required = false;
  $("#reg-password").minLength = 8;
  $("#reg-handle").autocomplete = "username";
  text("label[for=reg-email]", "Email (optional)");
  text("label[for=reg-handle]", "Handle");
  $$(".demo-note").forEach((n) => n.remove());
  text(
    ".auth-foot",
    "Independent fan project. Not affiliated with EA or the University of Virginia.",
  );
  const rankings = await APP.api("games/eafc27/rankings?limit=3");
  $(".auth-board").setAttribute("aria-label", "EA FC 27 rankings");
  $(".auth-board .board").innerHTML =
    '<div class="board-head"><span>#</span><span>Player</span><span>Elo</span></div>' +
    (rankings.rows.length
      ? rankings.rows
          .map(
            (p) =>
              `<div class="board-row"><span class="rank">${p.rank}</span><span class="board-player">${UI.avatar(p.name)}<span class="nm">${esc(p.name)}</span></span><span class="elo">${UI.elo(p)}</span></div>`,
          )
          .join("")
      : '<div class="board-row"><span>—</span><span>The first result starts the book.</span><span>1000</span></div>');
  const showError = (form, message) => {
    let e = $("[role=alert]", form);
    if (!e) {
      e = document.createElement("p");
      e.className = "hint";
      e.setAttribute("role", "alert");
      form.append(e);
    }
    e.textContent = message;
  };
  $("#lt-login").addEventListener("click", () => {
    text("#auth-title", "Welcome back");
    text("#auth-sub", "Log in to record a result or review the book.");
  });
  $("#lt-register").addEventListener("click", () => {
    text("#auth-title", "Join the group");
    text("#auth-sub", "Create your account and player profile.");
  });
  const claim = APP.params.get("claim"),
    reset = APP.params.get("reset");
  if (reset) {
    await APP.api("link?kind=reset&token=" + encodeURIComponent(reset));
    $(".auth-tabs").remove();
    $("#lp-register").remove();
    text("#auth-title", "Choose a new password");
    $("#login-form").innerHTML =
      UI.field(
        "New password",
        "password",
        "",
        "password",
        'required minlength="8" autocomplete="new-password"',
      ) +
      '<button class="btn btn-primary btn-block btn-lg">Set password</button>';
    $("#login-form").onsubmit = async (e) => {
      e.preventDefault();
      try {
        await APP.api("reset-password", {
          token: reset,
          password: new FormData(e.target).get("password"),
        });
        location.href = "/login.html";
      } catch (x) {
        showError(e.target, x.message);
      }
    };
    return;
  }
  if (claim) {
    const info = await APP.api(
      "link?kind=claim&token=" + encodeURIComponent(claim),
    );
    $("#reg-name").value = info.name;
    text(
      "#auth-sub",
      "Claim " + info.name + " and keep their record across all games.",
    );
    if (APP.me) {
      $(".auth-tabs").remove();
      $("#lp-register").remove();
      text("#auth-title", "Claim player history");
      $("#login-form").innerHTML =
        `<p>Request a site-admin review to merge ${esc(info.name)} into your account.</p><button class="btn btn-primary btn-block">Request merge review</button>`;
      $("#login-form").onsubmit = async (e) => {
        e.preventDefault();
        try {
          await APP.api("claim", { token: claim });
          location.href = "/account.html";
        } catch (x) {
          showError(e.target, x.message);
        }
      };
      return;
    }
    $("#lt-register").click();
  } else if (APP.me) {
    location.href = destination;
    return;
  }
  $("#login-form").onsubmit = async (e) => {
    e.preventDefault();
    const b = $("button[type=submit]", e.target);
    b.disabled = true;
    try {
      const s = await APP.api("login", {
        identity: $("#login-email").value,
        password: $("#login-password").value,
        remember: $("input[type=checkbox]", e.target).checked,
      });
      APP.csrf = s.csrf;
      APP.me = s.user;
      location.href = claim
        ? "/login.html?claim=" + encodeURIComponent(claim)
        : destination;
    } catch (x) {
      showError(e.target, x.message);
    } finally {
      b.disabled = false;
    }
  };
  $("#register-form").onsubmit = async (e) => {
    e.preventDefault();
    const b = $("button[type=submit]", e.target);
    b.disabled = true;
    try {
      await APP.api("signup", {
        name: $("#reg-name").value,
        handle: $("#reg-handle").value,
        email: $("#reg-email").value,
        password: $("#reg-password").value,
        ...(claim ? { claim } : {}),
      });
      location.href = destination;
    } catch (x) {
      showError(e.target, x.message);
    } finally {
      b.disabled = false;
    }
  };
});
