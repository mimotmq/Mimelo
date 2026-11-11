// mimELo, stage 1: accounts, roles, game registry, per-scope themes, uploads.
// Libraries: cpp-httplib, nlohmann/json, SQLite, OpenSSL (password hashing only).
#include <sqlite3.h>
#include <openssl/evp.h>
#include <openssl/rand.h>
#include <openssl/sha.h>
#include <algorithm>
#include <chrono>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <map>
#include <mutex>
#include <string>
#include <vector>
#include "httplib.h"
#include "json.hpp"

using json = nlohmann::json;
static sqlite3* DB = nullptr;
static std::mutex M;

// ---------- SQLite helper ----------
static std::vector<std::vector<json>> query(const std::string& sql, const std::vector<json>& args = {}) {
    sqlite3_stmt* st = nullptr;
    if (sqlite3_prepare_v2(DB, sql.c_str(), -1, &st, nullptr) != SQLITE_OK) throw std::runtime_error(sqlite3_errmsg(DB));
    for (size_t i = 0; i < args.size(); i++) {
        const json& a = args[i];
        int k = (int)i + 1;
        if (a.is_null()) sqlite3_bind_null(st, k);
        else if (a.is_boolean()) sqlite3_bind_int(st, k, a.get<bool>() ? 1 : 0);
        else if (a.is_number_integer()) sqlite3_bind_int64(st, k, a.get<long long>());
        else if (a.is_number_float()) sqlite3_bind_double(st, k, a.get<double>());
        else sqlite3_bind_text(st, k, a.get<std::string>().c_str(), -1, SQLITE_TRANSIENT);
    }
    std::vector<std::vector<json>> out;
    int rc;
    while ((rc = sqlite3_step(st)) == SQLITE_ROW) {
        std::vector<json> r;
        for (int c = 0; c < sqlite3_column_count(st); c++) {
            switch (sqlite3_column_type(st, c)) {
                case SQLITE_INTEGER: r.push_back((long long)sqlite3_column_int64(st, c)); break;
                case SQLITE_NULL: r.push_back(nullptr); break;
                case SQLITE_FLOAT: r.push_back(sqlite3_column_double(st, c)); break;
                default: r.push_back(std::string((const char*)sqlite3_column_text(st, c)));
            }
        }
        out.push_back(std::move(r));
    }
    std::string err = sqlite3_errmsg(DB);
    sqlite3_finalize(st);
    if (rc != SQLITE_DONE) throw std::runtime_error(err);
    return out;
}

// ---------- small utilities ----------
static void reply(httplib::Response& res, const json& j, int code = 200) { res.status = code; res.set_content(j.dump(), "application/json"); }
static void fail(httplib::Response& res, const std::string& msg, int code = 400) { reply(res, {{"error", msg}}, code); }
static long long nowMs() { return std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count(); }
static std::string trim(std::string s) {
    size_t a = s.find_first_not_of(" \t\r\n"), b = s.find_last_not_of(" \t\r\n");
    return a == std::string::npos ? "" : s.substr(a, b - a + 1);
}
static std::string S(const json& j) { return j.is_string() ? j.get<std::string>() : ""; }
static std::string jstr(const json& j, const char* k) { return j.is_object() && j.contains(k) && j[k].is_string() ? trim(j[k].get<std::string>()) : ""; }
static std::string hexOf(const unsigned char* d, size_t n) {
    static const char* h = "0123456789abcdef";
    std::string s;
    for (size_t i = 0; i < n; i++) { s += h[d[i] >> 4]; s += h[d[i] & 15]; }
    return s;
}
static std::string randHex(size_t bytes) {
    std::vector<unsigned char> b(bytes);
    RAND_bytes(b.data(), (int)bytes);
    return hexOf(b.data(), bytes);
}
static std::string sha256hex(const std::string& s) {
    unsigned char o[32];
    SHA256((const unsigned char*)s.data(), s.size(), o);
    return hexOf(o, 32);
}
static std::string pbkdf2(const std::string& pw, const std::string& salt) {
    unsigned char o[32];
    PKCS5_PBKDF2_HMAC(pw.c_str(), (int)pw.size(), (const unsigned char*)salt.data(), (int)salt.size(), 600000, EVP_sha256(), 32, o);
    return hexOf(o, 32);
}
static bool ctEq(const std::string& a, const std::string& b) {
    if (a.size() != b.size()) return false;
    unsigned char d = 0;
    for (size_t i = 0; i < a.size(); i++) d |= (unsigned char)(a[i] ^ b[i]);
    return d == 0;
}
static bool validUsername(const std::string& u) {
    if (u.size() < 3 || u.size() > 24) return false;
    for (unsigned char c : u) if (!(std::isalnum(c) || c == '_' || c == '.' || c == '-')) return false;
    return true;
}
static std::string upper(std::string s) { for (auto& c : s) c = (char)std::toupper((unsigned char)c); return s; }

// ---------- users, sessions, permissions ----------
struct User {
    long long id = 0;
    std::string username, name, email;
    bool main = false;
    std::vector<std::string> adminOf;
    explicit operator bool() const { return id > 0; }
};
static User userById(long long id) {
    User u;
    auto r = query("SELECT id,username,name,email,is_main FROM users WHERE id=?", {id});
    if (r.empty()) return u;
    u.id = r[0][0]; u.username = S(r[0][1]); u.name = S(r[0][2]); u.email = S(r[0][3]); u.main = r[0][4].get<long long>() != 0;
    for (auto& g : query("SELECT game FROM game_admins WHERE user_id=? ORDER BY game", {id})) u.adminOf.push_back(g[0]);
    return u;
}
static json userJson(const User& u) {
    return {{"id", u.id}, {"username", u.username}, {"name", u.name}, {"email", u.email}, {"is_main", u.main}, {"admin_of", u.adminOf}};
}
static std::string cookieVal(const httplib::Request& req, const std::string& k) {
    std::string c = req.get_header_value("Cookie");
    size_t p = 0;
    while (p < c.size()) {
        size_t e = c.find(';', p);
        if (e == std::string::npos) e = c.size();
        std::string part = trim(c.substr(p, e - p));
        if (part.rfind(k + "=", 0) == 0) return part.substr(k.size() + 1);
        p = e + 1;
    }
    return "";
}
static User currentUser(const httplib::Request& req) {
    std::string t = cookieVal(req, "mimelo_session");
    if (t.empty()) return {};
    auto r = query("SELECT user_id FROM sessions WHERE token_hash=? AND expires>?", {sha256hex(t), nowMs()});
    return r.empty() ? User{} : userById(r[0][0]);
}
static bool canAdminGame(const User& u, const std::string& slug) {
    return u && (u.main || std::find(u.adminOf.begin(), u.adminOf.end(), slug) != u.adminOf.end());
}
static bool canAdminScope(const User& u, const std::string& scope) { return scope == "home" ? (u && u.main) : canAdminGame(u, scope); }
static bool isAnyAdmin(const User& u) { return u && (u.main || !u.adminOf.empty()); }
static void startSession(const httplib::Request& req, httplib::Response& res, long long uid, bool remember) {
    std::string tok = randHex(32);
    query("INSERT INTO sessions(token_hash,user_id,expires) VALUES(?,?,?)", {sha256hex(tok), uid, nowMs() + (remember ? 30LL * 86400000 : 12LL * 3600000)});
    query("DELETE FROM sessions WHERE expires<?", {nowMs()});
    std::string c = "mimelo_session=" + tok + "; Path=/; HttpOnly; SameSite=Lax";
    if (remember) c += "; Max-Age=2592000";
    if (req.get_header_value("X-Forwarded-Proto") == "https") c += "; Secure";
    res.set_header("Set-Cookie", c);
}
static bool signupsOpen() {
    auto r = query("SELECT value FROM settings WHERE key='signups_open'");
    return r.empty() || r[0][0] != "0";
}

#define NEED_USER User u = currentUser(req); if (!u) { fail(res, "Please log in.", 401); return; }
#define NEED_MAIN NEED_USER if (!u.main) { fail(res, "Only the main admin can do that.", 403); return; }

// Login throttle: 5 wrong passwords locks that username+address for a minute.
struct Fail { int n = 0; long long until = 0; };
static std::map<std::string, Fail> FAILS;

// ---------- themes ----------
static bool scopeOk(const std::string& s) { return s == "home" || !query("SELECT 1 FROM games WHERE slug=?", {s}).empty(); }
static bool isHex(const std::string& s) {
    if (s.size() != 7 || s[0] != '#') return false;
    for (size_t i = 1; i < 7; i++) if (!std::isxdigit((unsigned char)s[i])) return false;
    return true;
}
static std::string onColor(const std::string& h) {
    int r = std::stoi(h.substr(1, 2), nullptr, 16), g = std::stoi(h.substr(3, 2), nullptr, 16), b = std::stoi(h.substr(5, 2), nullptr, 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255.0 > 0.6 ? "#000000" : "#ffffff";
}
static const char* SLOTS[] = {"logo", "bgImage", "faceWin", "faceLoss", "faceDraw"};
static json defaultTheme(const std::string& scope) {
    std::string title = "mimELo", tag = "Elo ratings, leagues and match history.";
    if (scope != "home") {
        auto r = query("SELECT name FROM games WHERE slug=?", {scope});
        if (!r.empty()) { title = r[0][0].get<std::string>(); tag = ""; }
    }
    return {{"title", title}, {"tagline", tag},
            {"light", {{"bg", "#f1f4ee"}, {"card", "#ffffff"}, {"ink", "#14231b"}, {"accent", "#1f6b45"}}},
            {"dark", {{"bg", "#0f1812"}, {"card", "#17221b"}, {"ink", "#e8efe9"}, {"accent", "#4fbf84"}}},
            {"headingFont", ""}, {"bodyFont", ""}, {"radius", 10},
            {"images", {{"logo", nullptr}, {"bgImage", nullptr}, {"faceWin", nullptr}, {"faceLoss", nullptr}, {"faceDraw", nullptr}}}};
}
static json loadTheme(const std::string& scope) {
    json t = defaultTheme(scope);
    auto r = query("SELECT value FROM settings WHERE key=?", {"theme:" + scope});
    if (!r.empty()) {
        json s = json::parse(S(r[0][0]), nullptr, false);
        if (s.is_object())
            for (auto& [k, v] : s.items()) {
                if ((k == "light" || k == "dark" || k == "images") && v.is_object()) for (auto& [k2, v2] : v.items()) t[k][k2] = v2;
                else t[k] = v;
            }
    }
    return t;
}
static std::string mediaUrl(const json& id) {
    if (!id.is_number_integer()) return "";
    auto r = query("SELECT ext FROM media WHERE id=?", {id});
    return r.empty() ? "" : "/media/" + std::to_string(id.get<long long>()) + "." + S(r[0][0]);
}
static std::string buildThemeCss(const std::string& scope) {
    std::string css;
    for (auto& r : query("SELECT id,name,ext FROM fonts")) {
        std::string ext = S(r[2]), fmt = ext == "woff2" ? "woff2" : ext == "woff" ? "woff" : ext == "ttf" ? "truetype" : "opentype";
        css += "@font-face{font-family:\"" + S(r[1]) + "\";src:url(/fonts/" + std::to_string(r[0].get<long long>()) + "." + ext + ") format(\"" + fmt + "\");font-display:swap}\n";
    }
    if (query("SELECT 1 FROM settings WHERE key=?", {"theme:" + scope}).empty()) return css;
    json t = loadTheme(scope);
    auto vars = [](const json& s) {
        std::string a = s["accent"];
        return "--bg:" + s["bg"].get<std::string>() + ";--card:" + s["card"].get<std::string>() + ";--ink:" + s["ink"].get<std::string>() + ";--pitch:" + a +
               ";--onpitch:" + onColor(a) + ";--mute:color-mix(in srgb,var(--ink) 60%,var(--bg));--line:color-mix(in srgb,var(--ink) 14%,var(--bg));--chip:color-mix(in srgb,var(--ink) 8%,var(--bg));";
    };
    css += ":root{" + vars(t["light"]) + "}\n@media (prefers-color-scheme:dark){:root{" + vars(t["dark"]) + "}}\n";
    int R = t["radius"];
    css += ".card,.tbl,form.g{border-radius:" + std::to_string(R) + "px}select,input:not([type=checkbox]),textarea,button{border-radius:" + std::to_string(R > 4 ? R - 4 : R) + "px}\n";
    std::string bf = t["bodyFont"], hf = t["headingFont"], bg = mediaUrl(t["images"]["bgImage"]);
    if (!bf.empty()) css += "body{font-family:\"" + bf + "\",system-ui,sans-serif}\n";
    if (!hf.empty()) css += "h1,h2,h3{font-family:\"" + hf + "\",system-ui,sans-serif}\n";
    if (!bg.empty()) css += "body{background-image:url(" + bg + ");background-size:cover;background-position:center;background-attachment:fixed}\n";
    return css;
}

// ---------- media ----------
struct Sniff { std::string ext, kind; size_t maxBytes; };
static bool sniff(const std::string& d, Sniff& o) {
    auto at = [&](size_t p, const std::string& s) { return d.size() >= p + s.size() && d.compare(p, s.size(), s) == 0; };
    const size_t MB = 1024 * 1024;
    if (at(0, "\x89PNG")) o = {"png", "image", 5 * MB};
    else if (at(0, "\xFF\xD8\xFF")) o = {"jpg", "image", 5 * MB};
    else if (at(0, "GIF8")) o = {"gif", "image", 5 * MB};
    else if (at(0, "RIFF") && at(8, "WEBP")) o = {"webp", "image", 5 * MB};
    else if (at(0, "ID3") || at(0, "\xFF\xFB") || at(0, "\xFF\xF3") || at(0, "\xFF\xF2")) o = {"mp3", "audio", 10 * MB};
    else if (at(0, "OggS")) o = {"ogg", "audio", 10 * MB};
    else if (at(0, "RIFF") && at(8, "WAVE")) o = {"wav", "audio", 10 * MB};
    else if (at(4, "ftyp")) o = {"mp4", "video", 25 * MB};
    else if (at(0, "\x1A\x45\xDF\xA3")) o = {"webm", "video", 25 * MB};
    else return false;
    return true;
}

#include "matches_core.inc"
#include "competition_core.inc"
#include "catalog_core.inc"

int main(int argc, char** argv) {
    int port = argc > 1 ? std::atoi(argv[1]) : 8080;
    if (sqlite3_open("mimelo.db", &DB)) { std::cerr << "cannot open db\n"; return 1; }
    sqlite3_exec(DB, R"(
        PRAGMA foreign_keys=ON;
        CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT UNIQUE COLLATE NOCASE, name TEXT NOT NULL, email TEXT,
            salt TEXT, hash TEXT, is_main INTEGER NOT NULL DEFAULT 0, claim_code TEXT, created INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS games(slug TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL, sort INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS game_admins(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            game TEXT NOT NULL REFERENCES games(slug) ON DELETE CASCADE, PRIMARY KEY(user_id, game));
        CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS fonts(id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL, ext TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS media(id INTEGER PRIMARY KEY, ext TEXT NOT NULL, kind TEXT NOT NULL, owner INTEGER, created INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS teams(game TEXT NOT NULL REFERENCES games(slug) ON DELETE CASCADE, name_lc TEXT NOT NULL, name TEXT NOT NULL,
            stars INTEGER NOT NULL, PRIMARY KEY(game, name_lc));
        CREATE TABLE IF NOT EXISTS flair_defs(id INTEGER PRIMARY KEY, game TEXT NOT NULL REFERENCES games(slug) ON DELETE CASCADE, label TEXT NOT NULL, sort INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS flair_values(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            def_id INTEGER NOT NULL REFERENCES flair_defs(id) ON DELETE CASCADE, value TEXT NOT NULL, PRIMARY KEY(user_id, def_id));
        CREATE TABLE IF NOT EXISTS leagues(id INTEGER PRIMARY KEY, game TEXT NOT NULL REFERENCES games(slug) ON DELETE CASCADE,
            name TEXT NOT NULL, kind TEXT NOT NULL, created_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS matches(id INTEGER PRIMARY KEY, game TEXT NOT NULL REFERENCES games(slug),
            league_id INTEGER REFERENCES leagues(id) ON DELETE SET NULL,
            p1 INTEGER NOT NULL REFERENCES users(id), p2 INTEGER NOT NULL REFERENCES users(id),
            s1 INTEGER NOT NULL, s2 INTEGER NOT NULL, details TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending', played_at INTEGER NOT NULL,
            submitted_by INTEGER REFERENCES users(id) ON DELETE SET NULL, submitted_at INTEGER NOT NULL,
            locked_at INTEGER, locked_by INTEGER REFERENCES users(id) ON DELETE SET NULL, rated_at INTEGER, edited_at INTEGER);
        CREATE INDEX IF NOT EXISTS matches_game ON matches(game, status, played_at);
        CREATE TABLE IF NOT EXISTS fixtures(id INTEGER PRIMARY KEY, league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
            p1 INTEGER NOT NULL REFERENCES users(id), p2 INTEGER NOT NULL REFERENCES users(id),
            scheduled_ts INTEGER, match_id INTEGER REFERENCES matches(id) ON DELETE SET NULL);
        CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, game TEXT NOT NULL, match_id INTEGER, action TEXT NOT NULL,
            by_user INTEGER, at INTEGER NOT NULL, before TEXT, after TEXT);
        INSERT OR IGNORE INTO games(slug,name,kind,sort) VALUES
            ('ea-fc-26','EA FC 26','fifa',1),('ea-fc-27','EA FC 27','fifa',2),('table-tennis','Table Tennis','tabletennis',3),
            ('tennis','Tennis','tennis',4),('smash-ultimate','Super Smash Bros. Ultimate','smash',5);
    )", nullptr, nullptr, nullptr);
    migrateCompetitionData();
    std::filesystem::create_directories("fonts");
    std::filesystem::create_directories("media");

    // First run: create the main admin. The password comes from the environment or is generated and printed once.
    if (query("SELECT 1 FROM users WHERE is_main=1").empty()) {
        const char *eu = std::getenv("MIMELO_ADMIN_USER"), *ep = std::getenv("MIMELO_ADMIN_PASSWORD");
        std::string un = eu && validUsername(eu) ? eu : "mimo", pw = ep && std::string(ep).size() >= 8 ? ep : randHex(6);
        std::string salt = randHex(16);
        query("INSERT INTO users(username,name,salt,hash,is_main,created) VALUES(?,?,?,?,1,?)", {un, un, salt, pbkdf2(pw, salt), nowMs()});
        std::cout << "\n=== Main admin created ===\n  username: " << un << "\n  password: " << (ep ? "(the one you set in MIMELO_ADMIN_PASSWORD)" : pw)
                  << "\n  Log in and change it on the Account page.\n==========================\n\n" << std::flush;
    }

    httplib::Server svr;
    svr.set_payload_max_length(30 * 1024 * 1024);
    svr.set_default_headers({{"X-Content-Type-Options", "nosniff"}, {"X-Frame-Options", "DENY"}, {"Referrer-Policy", "same-origin"}});
    svr.set_mount_point("/fonts", "./fonts");
    svr.set_mount_point("/media", "./media");
    svr.set_mount_point("/", "./static");
    svr.set_exception_handler([](const httplib::Request&, httplib::Response& res, std::exception_ptr ep) {
        try { std::rethrow_exception(ep); } catch (std::exception& e) { fail(res, e.what(), 500); }
    });

    // ---------- accounts ----------
    svr.Post("/api/signup", [](const httplib::Request& req, httplib::Response& res) {
        json j = json::parse(req.body, nullptr, false);
        if (!j.is_object()) return fail(res, "Invalid request.");
        std::string un = jstr(j, "username"), name = jstr(j, "name"), pw = j.contains("password") && j["password"].is_string() ? j["password"].get<std::string>() : "";
        std::string email = jstr(j, "email"), code = upper(jstr(j, "claim_code"));
        if (!validUsername(un)) return fail(res, "Usernames are 3 to 24 characters: letters, numbers, . _ -");
        if (name.empty() || name.size() > 40) return fail(res, "Enter your name (up to 40 characters).");
        if (pw.size() < 8 || pw.size() > 128) return fail(res, "Passwords need at least 8 characters.");
        if (email.size() > 100 || (!email.empty() && email.find('@') == std::string::npos)) return fail(res, "That email doesn’t look right.");
        std::string salt = randHex(16), h = pbkdf2(pw, salt);
        std::lock_guard<std::mutex> l(M);
        if (!signupsOpen()) return fail(res, "Sign-ups are closed. Ask the admin for an account.", 403);
        if (!query("SELECT 1 FROM users WHERE username=?", {un}).empty()) return fail(res, "That username is taken.", 409);
        json em = email.empty() ? json(nullptr) : json(email);
        long long id;
        if (!code.empty()) {
            auto r = query("SELECT id FROM users WHERE claim_code=? AND hash IS NULL", {code});
            if (r.empty()) return fail(res, "That claim code isn’t valid.", 404);
            id = r[0][0];
            query("UPDATE users SET username=?,name=?,email=?,salt=?,hash=?,claim_code=NULL WHERE id=?", {un, name, em, salt, h, id});
        } else {
            query("INSERT INTO users(username,name,email,salt,hash,created) VALUES(?,?,?,?,?,?)", {un, name, em, salt, h, nowMs()});
            id = sqlite3_last_insert_rowid(DB);
        }
        startSession(req, res, id, true);
        reply(res, {{"user", userJson(userById(id))}}, 201);
    });
    svr.Post("/api/login", [](const httplib::Request& req, httplib::Response& res) {
        json j = json::parse(req.body, nullptr, false);
        if (!j.is_object()) return fail(res, "Invalid request.");
        std::string un = jstr(j, "username"), pw = j.contains("password") && j["password"].is_string() ? j["password"].get<std::string>() : "";
        bool remember = j.value("remember", false);
        std::string key = req.remote_addr + "|" + upper(un);
        std::lock_guard<std::mutex> l(M);
        Fail& f = FAILS[key];
        if (f.n >= 5 && f.until > nowMs()) return fail(res, "Too many attempts. Wait a minute and try again.", 429);
        if (f.until && f.until <= nowMs()) f = Fail();
        auto r = query("SELECT id,salt,hash FROM users WHERE username=? AND hash IS NOT NULL", {un});
        bool ok = false;
        if (!r.empty()) ok = ctEq(pbkdf2(pw, S(r[0][1])), S(r[0][2]));
        else pbkdf2(pw, "0000");  // same cost whether or not the username exists
        if (!ok) {
            if (++f.n >= 5) f.until = nowMs() + 60000;
            return fail(res, "Wrong username or password.", 401);
        }
        FAILS.erase(key);
        startSession(req, res, r[0][0], remember);
        reply(res, {{"user", userJson(userById(r[0][0]))}});
    });
    svr.Post("/api/logout", [](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> l(M);
        std::string t = cookieVal(req, "mimelo_session");
        if (!t.empty()) query("DELETE FROM sessions WHERE token_hash=?", {sha256hex(t)});
        res.set_header("Set-Cookie", "mimelo_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
        reply(res, {{"ok", true}});
    });
    svr.Get("/api/me", [](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> l(M);
        User u = currentUser(req);
        reply(res, {{"user", u ? userJson(u) : json(nullptr)}});
    });
    svr.Post("/api/me", [](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> l(M);
        NEED_USER
        json j = json::parse(req.body, nullptr, false);
        std::string name = jstr(j, "name"), email = jstr(j, "email");
        if (name.empty() || name.size() > 40) return fail(res, "Enter your name (up to 40 characters).");
        if (email.size() > 100 || (!email.empty() && email.find('@') == std::string::npos)) return fail(res, "That email doesn’t look right.");
        query("UPDATE users SET name=?,email=? WHERE id=?", {name, email.empty() ? json(nullptr) : json(email), u.id});
        reply(res, {{"user", userJson(userById(u.id))}});
    });
    svr.Post("/api/me/password", [](const httplib::Request& req, httplib::Response& res) {
        json j = json::parse(req.body, nullptr, false);
        std::string cur = j.is_object() && j.contains("current") && j["current"].is_string() ? j["current"].get<std::string>() : "";
        std::string nw = j.is_object() && j.contains("new") && j["new"].is_string() ? j["new"].get<std::string>() : "";
        std::lock_guard<std::mutex> l(M);
        NEED_USER
        if (nw.size() < 8 || nw.size() > 128) return fail(res, "New passwords need at least 8 characters.");
        auto r = query("SELECT salt,hash FROM users WHERE id=?", {u.id});
        if (!ctEq(pbkdf2(cur, S(r[0][0])), S(r[0][1]))) return fail(res, "Your current password is wrong.", 401);
        std::string salt = randHex(16);
        query("UPDATE users SET salt=?,hash=? WHERE id=?", {salt, pbkdf2(nw, salt), u.id});
        std::string keep = sha256hex(cookieVal(req, "mimelo_session"));
        query("DELETE FROM sessions WHERE user_id=? AND token_hash<>?", {u.id, keep});  // sign out other devices
        reply(res, {{"ok", true}});
    });

    // ---------- public site info, games, players ----------
    svr.Get("/api/site", [](const httplib::Request&, httplib::Response& res) {
        std::lock_guard<std::mutex> l(M);
        json a = json::array();
        for (auto& r : query("SELECT id,name FROM users WHERE is_main=1 ORDER BY id")) a.push_back({{"id", r[0]}, {"name", r[1]}});
        reply(res, {{"signups_open", signupsOpen()}, {"main_admins", a}});
    });
    svr.Post("/api/site", [](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> l(M);
        NEED_MAIN
        json j = json::parse(req.body, nullptr, false);
        query("INSERT OR REPLACE INTO settings(key,value) VALUES('signups_open',?)", {j.value("signups_open", true) ? "1" : "0"});
        reply(res, {{"ok", true}});
    });
    svr.Get("/api/games", [](const httplib::Request&, httplib::Response& res) {
        std::lock_guard<std::mutex> l(M);
        json out = json::array();
        for (auto& r : query("SELECT slug,name,kind FROM games ORDER BY sort")) {
            json t = loadTheme(S(r[0]));
            out.push_back({{"slug", r[0]}, {"name", r[1]}, {"kind", r[2]}, {"title", t["title"]}, {"tagline", t["tagline"]}, {"logo", mediaUrl(t["images"]["logo"])}});
        }
        reply(res, out);
    });
    svr.Get(R"(/api/games/([a-z0-9-]+))", [](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> l(M);
        std::string slug = req.matches[1];
        auto g = query("SELECT slug,name,kind FROM games WHERE slug=?", {slug});
        if (g.empty()) return fail(res, "Game not found.", 404);
        json t = loadTheme(slug), admins = json::array();
        for (auto& r : query("SELECT u.id,u.name FROM game_admins a JOIN users u ON u.id=a.user_id WHERE a.game=? ORDER BY u.name", {slug}))
            admins.push_back({{"id", r[0]}, {"name", r[1]}});
        reply(res, {{"slug", g[0][0]}, {"name", g[0][1]}, {"kind", g[0][2]}, {"title", t["title"]}, {"tagline", t["tagline"]}, {"logo", mediaUrl(t["images"]["logo"])}, {"admins", admins}});
    });
    svr.Get("/api/players", [](const httplib::Request&, httplib::Response& res) {
        std::lock_guard<std::mutex> l(M);
        json out = json::array();
        for (auto& r : query("SELECT id,name,username,hash IS NULL FROM users ORDER BY name COLLATE NOCASE"))
            out.push_back({{"id", r[0]}, {"name", r[1]}, {"username", r[2]}, {"placeholder", r[3].get<long long>() != 0}});
        reply(res, out);
    });
    svr.Get(R"(/api/players/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> l(M);
        auto r = query("SELECT id,name,username,hash IS NULL FROM users WHERE id=?", {(long long)std::stoll(req.matches[1])});
        if (r.empty()) return fail(res, "Player not found.", 404);
        json admin = json::array();
        for (auto& g : query("SELECT g.slug,g.name FROM game_admins a JOIN games g ON g.slug=a.game WHERE a.user_id=? ORDER BY g.sort", {r[0][0]}))
            admin.push_back({{"slug", g[0]}, {"name", g[1]}});
        reply(res, {{"id", r[0][0]}, {"name", r[0][1]}, {"username", r[0][2]}, {"placeholder", r[0][3].get<long long>() != 0}, {"admin_of", admin}, {"games", playerGames(r[0][0], false)}});
    });

    // ---------- main admin: people ----------
    svr.Get("/api/users", [](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> l(M);
        NEED_MAIN
        json out = json::array();
        for (auto& r : query("SELECT id,username,name,email,is_main,claim_code,hash IS NULL FROM users ORDER BY name COLLATE NOCASE")) {
            json a = json::array();
            for (auto& g : query("SELECT game FROM game_admins WHERE user_id=?", {r[0]})) a.push_back(g[0]);
            out.push_back({{"id", r[0]}, {"username", r[1]}, {"name", r[2]}, {"email", r[3]}, {"is_main", r[4].get<long long>() != 0}, {"claim_code", r[5]}, {"placeholder", r[6].get<long long>() != 0}, {"admin_of", a}});
        }
        reply(res, out);
    });
    svr.Post("/api/users", [](const httplib::Request& req, httplib::Response& res) {
        json j = json::parse(req.body, nullptr, false);
        if (!j.is_object()) return fail(res, "Invalid request.");
        std::string name = jstr(j, "name"), un = jstr(j, "username"), email = jstr(j, "email");
        std::string pw = j.contains("password") && j["password"].is_string() ? j["password"].get<std::string>() : "";
        if (name.empty() || name.size() > 40) return fail(res, "Enter a name (up to 40 characters).");
        std::lock_guard<std::mutex> l(M);
        NEED_MAIN
        if (un.empty() && pw.empty()) {  // placeholder with a claim code
            std::string code = upper(randHex(4));
            query("INSERT INTO users(name,claim_code,created) VALUES(?,?,?)", {name, code, nowMs()});
            return reply(res, {{"id", sqlite3_last_insert_rowid(DB)}, {"claim_code", code}}, 201);
        }
        if (!validUsername(un)) return fail(res, "Usernames are 3 to 24 characters: letters, numbers, . _ -");
        if (pw.size() < 8 || pw.size() > 128) return fail(res, "Passwords need at least 8 characters.");
        if (!query("SELECT 1 FROM users WHERE username=?", {un}).empty()) return fail(res, "That username is taken.", 409);
        std::string salt = randHex(16);
        query("INSERT INTO users(username,name,email,salt,hash,created) VALUES(?,?,?,?,?,?)", {un, name, email.empty() ? json(nullptr) : json(email), salt, pbkdf2(pw, salt), nowMs()});
        reply(res, {{"id", sqlite3_last_insert_rowid(DB)}}, 201);
    });
    svr.Post(R"(/api/users/(\d+)/password)", [](const httplib::Request& req, httplib::Response& res) {
        json j = json::parse(req.body, nullptr, false);
        std::string pw = j.is_object() && j.contains("password") && j["password"].is_string() ? j["password"].get<std::string>() : "";
        std::lock_guard<std::mutex> l(M);
        NEED_MAIN
        long long id = std::stoll(req.matches[1]);
        if (pw.size() < 8 || pw.size() > 128) return fail(res, "Passwords need at least 8 characters.");
        if (query("SELECT 1 FROM users WHERE id=? AND hash IS NOT NULL", {id}).empty()) return fail(res, "That person doesn’t have an account yet.", 404);
        std::string salt = randHex(16);
        query("UPDATE users SET salt=?,hash=? WHERE id=?", {salt, pbkdf2(pw, salt), id});
        query("DELETE FROM sessions WHERE user_id=?", {id});
        reply(res, {{"ok", true}});
    });
    svr.Post(R"(/api/users/(\d+)/claim-code)", [](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> l(M);
        NEED_MAIN
        long long id = std::stoll(req.matches[1]);
        if (query("SELECT 1 FROM users WHERE id=? AND hash IS NULL", {id}).empty()) return fail(res, "Only placeholders have claim codes.", 404);
        std::string code = upper(randHex(4));
        query("UPDATE users SET claim_code=? WHERE id=?", {code, id});
        reply(res, {{"claim_code", code}});
    });
    svr.Delete(R"(/api/users/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> l(M);
        NEED_MAIN
        long long id = std::stoll(req.matches[1]);
        if (id == u.id) return fail(res, "You can’t delete your own account here.");
        if (!query("SELECT 1 FROM users WHERE id=? AND is_main=1", {id}).empty()) return fail(res, "The main admin can’t be deleted.");
        if (!query("SELECT 1 FROM matches WHERE p1=? OR p2=? LIMIT 1", {id, id}).empty()) return fail(res, "This person has match history, so they can’t be deleted.");
        query("DELETE FROM users WHERE id=?", {id});
        reply(res, {{"ok", true}});
    });
    svr.Post(R"(/api/games/([a-z0-9-]+)/admins)", [](const httplib::Request& req, httplib::Response& res) {
        json j = json::parse(req.body, nullptr, false);
        std::lock_guard<std::mutex> l(M);
        NEED_MAIN
        std::string slug = req.matches[1];
        if (!j.is_object() || !j.contains("user_id") || !j["user_id"].is_number_integer()) return fail(res, "Pick a person.");
        long long uid = j["user_id"];
        if (!scopeOk(slug) || slug == "home") return fail(res, "Game not found.", 404);
        if (query("SELECT 1 FROM users WHERE id=? AND hash IS NOT NULL", {uid}).empty()) return fail(res, "Only people with an account can be admins.");
        if (j.value("admin", true)) query("INSERT OR IGNORE INTO game_admins(user_id,game) VALUES(?,?)", {uid, slug});
        else query("DELETE FROM game_admins WHERE user_id=? AND game=?", {uid, slug});
        reply(res, {{"ok", true}});
    });

    // ---------- themes, fonts, media (admins) ----------
    svr.Get("/theme.css", [](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> l(M);
        std::string scope = req.has_param("scope") ? req.get_param_value("scope") : "home";
        res.set_header("Cache-Control", "no-cache");
        res.set_content(scopeOk(scope) ? buildThemeCss(scope) : "", "text/css");
    });
    svr.Get("/api/theme", [](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> l(M);
        std::string scope = req.has_param("scope") ? req.get_param_value("scope") : "home";
        if (!scopeOk(scope)) return fail(res, "Not found.", 404);
        json t = loadTheme(scope), urls = json::object();
        for (const char* s : SLOTS) urls[s] = mediaUrl(t["images"][s]);
        t["imageUrls"] = urls;
        reply(res, t);
    });
    svr.Post("/api/theme", [](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> l(M);
        NEED_USER
        std::string scope = req.has_param("scope") ? req.get_param_value("scope") : "home";
        if (!scopeOk(scope)) return fail(res, "Not found.", 404);
        if (!canAdminScope(u, scope)) return fail(res, "You don’t have permission to change this page.", 403);
        json in = json::parse(req.body, nullptr, false);
        if (!in.is_object()) return fail(res, "Invalid request.");
        json t = defaultTheme(scope);
        std::string title = jstr(in, "title"), tag = jstr(in, "tagline");
        if (title.size() > 60 || tag.size() > 120) return fail(res, "Title up to 60 characters, tagline up to 120.");
        if (!title.empty()) t["title"] = title;
        t["tagline"] = tag;
        for (const char* set : {"light", "dark"})
            for (const char* k : {"bg", "card", "ink", "accent"}) {
                std::string v = in.contains(set) ? jstr(in[set], k) : "";
                if (!isHex(v)) return fail(res, "Colours must look like #1f6b45.");
                t[set][k] = v;
            }
        for (const char* k : {"headingFont", "bodyFont"}) {
            std::string f = jstr(in, k);
            if (!f.empty() && query("SELECT 1 FROM fonts WHERE name=?", {f}).empty()) return fail(res, "That font isn’t uploaded.");
            t[k] = f;
        }
        t["radius"] = std::clamp(in.value("radius", 10), 0, 24);
        for (const char* s : SLOTS) {
            json v = in.contains("images") && in["images"].is_object() && in["images"].contains(s) ? in["images"][s] : json(nullptr);
            if (v.is_number_integer() && query("SELECT 1 FROM media WHERE id=? AND kind='image'", {v}).empty()) return fail(res, "That image doesn’t exist.");
            t["images"][s] = v.is_number_integer() ? v : json(nullptr);
        }
        query("INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)", {"theme:" + scope, t.dump()});
        reply(res, {{"ok", true}});
    });
    svr.Delete("/api/theme", [](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> l(M);
        NEED_USER
        std::string scope = req.has_param("scope") ? req.get_param_value("scope") : "home";
        if (!scopeOk(scope)) return fail(res, "Not found.", 404);
        if (!canAdminScope(u, scope)) return fail(res, "You don’t have permission to change this page.", 403);
        query("DELETE FROM settings WHERE key=?", {"theme:" + scope});
        reply(res, {{"ok", true}});
    });
    svr.Get("/api/fonts", [](const httplib::Request&, httplib::Response& res) {
        std::lock_guard<std::mutex> l(M);
        json out = json::array();
        for (auto& r : query("SELECT id,name FROM fonts ORDER BY name")) out.push_back({{"id", r[0]}, {"name", r[1]}});
        reply(res, out);
    });
    svr.Post("/api/fonts", [](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> l(M);
        NEED_USER
        if (!isAnyAdmin(u)) return fail(res, "Only admins can upload fonts.", 403);
        if (!req.has_file("font")) return fail(res, "Choose a font file.");
        const auto& f = req.get_file_value("font");
        const std::string fn = f.filename, &d = f.content;
        size_t dot = fn.rfind('.');
        std::string ext = dot == std::string::npos ? "" : fn.substr(dot + 1);
        std::transform(ext.begin(), ext.end(), ext.begin(), [](unsigned char c) { return std::tolower(c); });
        bool ok = (ext == "woff2" && d.compare(0, 4, "wOF2") == 0) || (ext == "woff" && d.compare(0, 4, "wOFF") == 0) || (ext == "otf" && d.compare(0, 4, "OTTO") == 0) ||
                  (ext == "ttf" && (d.compare(0, 4, std::string("\0\1\0\0", 4)) == 0 || d.compare(0, 4, "true") == 0));
        if (!ok) return fail(res, "Use a .woff2, .woff, .ttf or .otf font file.");
        if (d.size() > 5 * 1024 * 1024) return fail(res, "Font files must be under 5 MB.");
        std::string name;
        for (char c : fn.substr(0, dot)) name += (std::isalnum((unsigned char)c) || c == ' ' || c == '_' || c == '-') ? c : ' ';
        name = trim(name);
        if (name.size() > 40) name.resize(40);
        if (name.empty()) name = "Custom font";
        if (!query("SELECT 1 FROM fonts WHERE name=?", {name}).empty()) return fail(res, "A font named " + name + " is already uploaded.", 409);
        query("INSERT INTO fonts(name,ext) VALUES(?,?)", {name, ext});
        long long id = sqlite3_last_insert_rowid(DB);
        std::ofstream("fonts/" + std::to_string(id) + "." + ext, std::ios::binary).write(d.data(), (std::streamsize)d.size());
        reply(res, {{"id", id}, {"name", name}}, 201);
    });
    svr.Delete(R"(/api/fonts/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> l(M);
        NEED_MAIN
        long long id = std::stoll(req.matches[1]);
        auto r = query("SELECT ext FROM fonts WHERE id=?", {id});
        if (!r.empty()) {
            std::error_code ec;
            std::filesystem::remove("fonts/" + std::to_string(id) + "." + S(r[0][0]), ec);
            query("DELETE FROM fonts WHERE id=?", {id});
        }
        reply(res, {{"ok", true}});
    });
    // Images, short audio and short video. The file type is decided from the file's own bytes, never its name.
    svr.Post("/api/media", [](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> l(M);
        NEED_USER
        if (!isAnyAdmin(u)) return fail(res, "Only admins can upload media.", 403);
        if (!req.has_file("file")) return fail(res, "Choose a file.");
        const std::string& d = req.get_file_value("file").content;
        Sniff s;
        if (!sniff(d, s)) return fail(res, "Use a PNG, JPG, GIF or WebP image, an MP3/OGG/WAV clip, or an MP4/WebM video.");
        if (d.size() > s.maxBytes) return fail(res, "That file is too large (images 5 MB, audio 10 MB, video 25 MB).");
        query("INSERT INTO media(ext,kind,owner,created) VALUES(?,?,?,?)", {s.ext, s.kind, u.id, nowMs()});
        long long id = sqlite3_last_insert_rowid(DB);
        std::ofstream("media/" + std::to_string(id) + "." + s.ext, std::ios::binary).write(d.data(), (std::streamsize)d.size());
        reply(res, {{"id", id}, {"kind", s.kind}, {"url", "/media/" + std::to_string(id) + "." + s.ext}}, 201);
    });

    #include "routes_matches.inc"
#include "routes_competitions.inc"

    std::cout << "mimELo running at http://localhost:" << port << std::endl;
    svr.listen("0.0.0.0", port);
}
