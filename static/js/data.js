/* Live application transport. The preserved HTML is hydrated from the new API. */
(() => {
  const params = new URLSearchParams(location.search),
    slug = params.get("game") || "eafc27";
  const app = (window.APP = {
    params,
    slug,
    me: null,
    csrf: null,
    games: [],
    players: new Map(),
    teams: new Map(),
  });
  document.documentElement.style.visibility = "hidden";
  app.api = async (path, body, method) => {
    const headers = { "x-mimelo-request": "1" };
    if (app.csrf) headers["x-csrf-token"] = app.csrf;
    const options = {
      method: method || (body === undefined ? "GET" : "POST"),
      headers,
      credentials: "same-origin",
    };
    if (body !== undefined) {
      if (body instanceof FormData) options.body = body;
      else {
        headers["content-type"] = "application/json";
        options.body = JSON.stringify(body);
      }
    }
    const response = await fetch("/api/" + path, options);
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("The server returned an unreadable response.");
    }
    if (!response.ok) throw new Error(result.error || "Request failed.");
    return result;
  };
  app.dom = new Promise((resolve) =>
    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", resolve, { once: true })
      : resolve(),
  );
  app.ready = Promise.all([app.api("me"), app.api("games")]).then(
    async ([session, games]) => {
      app.me = session.user;
      if (app.me)
        app.players.set(app.me.player_id, {
          id: app.me.player_id,
          name: app.me.name,
        });
      app.csrf = session.csrf;
      app.games = games;
      app.game = games.find((g) => g.slug === slug) || games[0];
      app.slug = app.game.slug;
      if (app.game.kind === "smash")
        app.smashCatalog = await app.api("catalogs/smash");
      return app;
    },
  );
  // A fast failed request can arrive before deferred page scripts attach their
  // handlers. Keep the rejection for those handlers without an unhandled event.
  app.ready.catch(() => {});
  app.run = async (fn) => {
    app.pending = (app.pending || 0) + 1;
    try {
      await app.ready;
      await app.dom;
      if (app.shell) await app.shell;
      await fn();
    } catch (e) {
      console.error(e);
      const target = document.querySelector("main") || document.body;
      target.innerHTML =
        '<div class="wrap panel" style="padding:32px;margin-top:32px"><h1>Could not load this page</h1><p id="load-error"></p><a class="btn btn-outline" href="">Try again</a></div>';
      document.querySelector("#load-error").textContent = e.message;
    } finally {
      app.pending--;
      if (app.pending === 0) {
        document.body.dataset.ready = "true";
        document.documentElement.style.visibility = "";
      }
    }
  };
  app.admin = () =>
    !!app.me && (app.me.site_admin || app.me.admin_of.includes(app.slug));
  app.login = () => {
    location.href =
      "/login.html?next=" +
      encodeURIComponent(location.pathname + location.search);
  };
  app.url = (page, query = {}) =>
    page + ".html?" + new URLSearchParams({ game: app.slug, ...query });
})();
