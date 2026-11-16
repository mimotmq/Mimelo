/* Demo login and registration. No credentials are stored. */
(function () {
  const $ = UI.$;

  const loginTab = $("#lt-login");
  const registerTab = $("#lt-register");
  const title = $("#auth-title");
  const sub = $("#auth-sub");

  function setCopy(which) {
    if (which === "register") {
      if (title) title.textContent = "Join the group";
      if (sub) sub.textContent = "Create a player profile for this record book.";
    } else {
      if (title) title.textContent = "Welcome back";
      if (sub) sub.textContent = "Log in to record a result or review the book.";
    }
  }

  if (loginTab) loginTab.addEventListener("click", () => setCopy("login"));
  if (registerTab) registerTab.addEventListener("click", () => setCopy("register"));

  const login = $("#login-form");
  if (login) {
    login.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = $("#login-email").value.trim() || "your account";
      UI.toast("Signed in as " + email + " — demo only. Opening the game hub.");
      setTimeout(() => { window.location.href = "game.html"; }, 800);
    });
  }

  const register = $("#register-form");
  if (register) {
    register.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = $("#reg-name").value.trim() || "New player";
      UI.toast("Account created for " + name + " — demo only. Nothing was saved.");
      setTimeout(() => { window.location.href = "account.html"; }, 900);
    });
  }
})();
