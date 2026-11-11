// Helpers for games that record matches (stage 2: EA FC 26 / EA FC 27).
// Included into main.cpp just before main(), so it can use query(), User, themes, etc.
//
// Match life cycle:  pending (editable by submitter / either player / admins)
//                 -> approved (locked with a timestamp; only admins can change it, every change is logged)
//                 -> rated   (an admin presses "Update ratings"; only then does it move anyone's Elo)
#include <cmath>
#include <sstream>

static std::string lowerStr(std::string s) { for (auto& c : s) c = (char)std::tolower((unsigned char)c); return s; }
static std::map<long long, std::string> userNames() {
    std::map<long long, std::string> m;
    for (auto& r : query("SELECT id,name FROM users")) m[r[0]] = S(r[1]);
    return m;
}
static std::string gameKind(const std::string& slug) {
    auto r = query("SELECT kind FROM games WHERE slug=?", {slug});
    return r.empty() ? "" : S(r[0][0]);
}
static bool getInt(const json& j, const char* k, int lo, int hi, int& out) {
    if (!j.is_object() || !j.contains(k)) return false;
    const json& v = j[k];
    long long x;
    if (v.is_number_integer()) x = v.get<long long>();
    else if (v.is_number_float() && v.get<double>() == std::floor(v.get<double>())) x = (long long)v.get<double>();
    else return false;
    if (x < lo || x > hi) return false;
    out = (int)x;
    return true;
}

// ---------- Elo (EA FC) ----------
// Start 1000, K=32. Goal difference scales the change (World Football Elo style).
// Each team's star rating (1-5, from the team file; unknown teams count as 3) shifts the expected result by
// STAR_W rating points per star, so beating a higher-star team earns more and losing to a lower-star team costs more.
// A shoot-out is a draw for Elo purposes.
static const double K_FACTOR = 32.0, STAR_W = 50.0;
struct Stat { double elo = 1000, peak = 1000; int w = 0, d = 0, l = 0, gf = 0, ga = 0; std::string form; };
struct Replay { std::map<long long, Stat> st; std::map<long long, double> delta; };
static double goalMult(int gd) {
    gd = std::abs(gd);
    return gd <= 1 ? 1.0 : gd == 2 ? 1.5 : (11.0 + gd) / 8.0;
}
static std::map<std::string, double> loadStars(const std::string& game) {
    std::map<std::string, double> m;
    for (auto& r : query("SELECT name_lc,stars FROM teams WHERE game=?", {game})) m[S(r[0])] = r[1].get<double>();
    return m;
}
static double starsOf(const std::map<std::string, double>& m, const std::string& team) {
    auto it = m.find(lowerStr(team));
    return it == m.end() ? 3 : it->second;
}
static Replay calculateReplay(const std::string& game) {
    Replay R;
    auto stars = loadStars(game);
    for (auto& r : query("SELECT id,p1,p2,s1,s2,details FROM matches WHERE game=? AND status='approved' AND rated_at IS NOT NULL AND elo_enabled=1 ORDER BY played_at,id", {game})) {
        long long id = r[0], p1 = r[1], p2 = r[2];
        int s1 = (int)r[3].get<long long>(), s2 = (int)r[4].get<long long>();
        json d = json::parse(S(r[5]), nullptr, false);
        Stat &a = R.st[p1], &b = R.st[p2];
        double ra = a.elo + STAR_W * (d.value("stars1", starsOf(stars, jstr(d, "team1"))) - 3), rb = b.elo + STAR_W * (d.value("stars2", starsOf(stars, jstr(d, "team2"))) - 3);
        double e = 1.0 / (1.0 + std::pow(10.0, (rb - ra) / 400.0));
        double sa = s1 > s2 ? 1.0 : s1 == s2 ? 0.5 : 0.0;
        double delta = K_FACTOR * goalMult(s1 - s2) * (sa - e);
        a.elo += delta; b.elo -= delta;
        a.peak = std::max(a.peak, a.elo); b.peak = std::max(b.peak, b.elo);
        a.gf += s1; a.ga += s2; b.gf += s2; b.ga += s1;
        char ca = sa == 1 ? 'W' : sa == 0.5 ? 'D' : 'L', cb = sa == 1 ? 'L' : sa == 0.5 ? 'D' : 'W';
        (ca == 'W' ? a.w : ca == 'D' ? a.d : a.l)++;
        (cb == 'W' ? b.w : cb == 'D' ? b.d : b.l)++;
        a.form += ca; b.form += cb;
        R.delta[id] = delta;
    }
    return R;
}

// Published ratings are immutable until the admin explicitly publishes a rebuild.
static void markRatingsDirty(const std::string& game) {
    query("INSERT INTO rating_state(game,payload,dirty) VALUES(?,'{}',1) ON CONFLICT(game) DO UPDATE SET dirty=1", {game});
}
static void publishRatings(const std::string& game) {
    Replay r = calculateReplay(game); json v={{"players",json::array()},{"deltas",json::array()}};
    for(auto& [id,s]:r.st) v["players"].push_back({{"id",id},{"elo",s.elo},{"peak",s.peak},{"w",s.w},{"d",s.d},{"l",s.l},{"gf",s.gf},{"ga",s.ga},{"form",s.form}});
    for(auto& [id,d]:r.delta) v["deltas"].push_back({{"id",id},{"delta",d}});
    query("INSERT INTO rating_state(game,payload,dirty,updated) VALUES(?,?,0,?) ON CONFLICT(game) DO UPDATE SET payload=excluded.payload,dirty=0,updated=excluded.updated",{game,v.dump(),nowMs()});
}
static Replay replay(const std::string& game) {
    Replay r; auto rows=query("SELECT payload FROM rating_state WHERE game=?",{game}); if(rows.empty()) return r;
    auto v=json::parse(S(rows[0][0]));
    if(v.contains("players")) for(auto& p:v["players"]) {Stat s;s.elo=p["elo"];s.peak=p["peak"];s.w=p["w"];s.d=p["d"];s.l=p["l"];s.gf=p["gf"];s.ga=p["ga"];s.form=p["form"];r.st[p["id"].get<long long>()]=s;}
    if(v.contains("deltas")) for(auto& d:v["deltas"])r.delta[d["id"].get<long long>()]=d["delta"].get<double>();
    return r;
}
static bool safeIcon(const std::string& u) {return u.empty() || u.rfind("https://",0)==0 || u.rfind("/media/",0)==0;}
static json teamCatalog(const std::string& game) {
    json out=json::array();
    for(auto& r:query("SELECT name,stars,gender,league,code,icon,name_lc FROM teams WHERE game=? ORDER BY gender,league,name COLLATE NOCASE",{game}))
        out.push_back({{"name",r[0]},{"stars",r[1]},{"gender",r[2]},{"league",r[3]},{"code",r[4]},{"icon",r[5]},{"key",r[6]}});
    return out;
}
static void migrateCompetitionData() {
    auto add=[](const std::string& table,const std::string& col,const std::string& def){bool have=false;for(auto& r:query("PRAGMA table_info("+table+")"))if(S(r[1])==col)have=true;if(!have)query("ALTER TABLE "+table+" ADD COLUMN "+col+" "+def);};
    add("teams","gender","TEXT NOT NULL DEFAULT 'men'");add("teams","league","TEXT NOT NULL DEFAULT 'Unsorted'");add("teams","code","TEXT NOT NULL DEFAULT ''");add("teams","icon","TEXT NOT NULL DEFAULT ''");
    add("leagues","config","TEXT NOT NULL DEFAULT '{}'");add("matches","elo_enabled","INTEGER NOT NULL DEFAULT 1");
    add("fixtures","stage","TEXT NOT NULL DEFAULT 'league'");add("fixtures","group_no","INTEGER NOT NULL DEFAULT 0");
    query("CREATE TABLE IF NOT EXISTS rating_state(game TEXT PRIMARY KEY,payload TEXT NOT NULL,dirty INTEGER NOT NULL DEFAULT 0,updated INTEGER)");
    query("CREATE TABLE IF NOT EXISTS brackets(league_id INTEGER PRIMARY KEY REFERENCES leagues(id) ON DELETE CASCADE,data TEXT NOT NULL)");
    // Preserve historical club strength before any later catalog replacement.
    for(auto& r:query("SELECT id,game,details FROM matches")) {auto d=json::parse(S(r[2]));bool changed=false;auto teams=teamCatalog(S(r[1]));
        for(int n=1;n<=2;n++){auto key=std::to_string(n);if(!d.contains("stars"+key)){auto name=jstr(d,("team"+key).c_str());auto it=std::find_if(teams.begin(),teams.end(),[&](const json&t){return lowerStr(t["name"])==lowerStr(name);});
            d["stars"+key]=it==teams.end()?json(3):(*it)["stars"];d["club"+key]=it==teams.end()?json({{"name",name},{"code",name},{"gender","men"},{"league","Unsorted"},{"stars",3},{"icon",""}}):*it;changed=true;}}
        if(changed)query("UPDATE matches SET details=? WHERE id=?",{d.dump(),r[0]});}
    for(auto& r:query("SELECT slug FROM games WHERE slug NOT IN (SELECT game FROM rating_state)")){auto game=S(r[0]);if(query("SELECT 1 FROM matches WHERE game=? AND rated_at IS NOT NULL",{game}).empty())query("INSERT INTO rating_state(game,payload) VALUES(?,'{}')",{game});else publishRatings(game);}
}

// ---------- validation ----------
static std::string validateFifa(const json& in, const std::string& game, int& s1, int& s2, json& d, const json& previous=json::object()) {
    std::string t1 = jstr(in, "team1"), t2 = jstr(in, "team2");
    if (t1.empty() || t2.empty() || t1.size() > 160 || t2.size() > 160) return "Choose both clubs.";
    if (!getInt(in, "s1", 0, 30, s1) || !getInt(in, "s2", 0, 30, s2)) return "Goals must be whole numbers from 0 to 30.";
    bool pens = in.contains("pens") && in["pens"].is_boolean() && in["pens"].get<bool>();
    d = {{"pens", pens}, {"aet",in.value("aet",false)}};
    auto catalog=teamCatalog(game);
    for(int side=1;side<=2;side++) {std::string key=std::to_string(side),choice=side==1?t1:t2;
        bool same=previous.contains("club"+key)&&(lowerStr(jstr(previous,("team"+key).c_str()))==lowerStr(choice)||previous["club"+key].value("key",std::string())==choice);
        if(same){d["club"+key]=previous["club"+key];d["stars"+key]=previous.value("stars"+key,3.0);d["team"+key]=previous["team"+key];continue;}
        auto it=std::find_if(catalog.begin(),catalog.end(),[&](const json& t){return t["key"]==choice;});
        if(it==catalog.end()) {int matches=0;for(auto t=catalog.begin();t!=catalog.end();t++)if(lowerStr((*t)["name"])==lowerStr(choice)){it=t;matches++;}if(matches!=1)return "Choose both clubs from the uploaded team catalog. Upload a team CSV in Game settings first.";}
        d["club"+key]=*it;d["stars"+key]=(*it)["stars"];d["team"+key]=(*it)["name"];
    }
    if (pens) {
        int a, b;
        if (s1 != s2) return "Penalties only happen when the score is level.";
        if (!getInt(in, "pen1", 0, 30, a) || !getInt(in, "pen2", 0, 30, b) || a == b) return "Enter the shoot-out score. Someone has to win it.";
        d["pen1"] = a; d["pen2"] = b;
    }
    return "";
}

// ---------- match rows ----------
static const char* MCOLS = "id,game,league_id,p1,p2,s1,s2,details,status,played_at,submitted_by,submitted_at,locked_at,locked_by,rated_at,edited_at,elo_enabled";
static bool loadMatch(long long id, std::vector<json>& out) {
    auto r = query(std::string("SELECT ") + MCOLS + " FROM matches WHERE id=?", {id});
    if (r.empty()) return false;
    out = r[0];
    return true;
}
static json matchJson(const std::vector<json>& r, const std::map<long long, std::string>& nm, const Replay* rp) {
    auto nameOf = [&](const json& id) -> json {
        if (!id.is_number_integer()) return nullptr;
        auto it = nm.find(id.get<long long>());
        return it == nm.end() ? json(nullptr) : json(it->second);
    };
    json o = {{"id", r[0]}, {"game", r[1]}, {"league_id", r[2]}, {"p1", r[3]}, {"p2", r[4]}, {"p1_name", nameOf(r[3])}, {"p2_name", nameOf(r[4])},
              {"s1", r[5]}, {"s2", r[6]}, {"details", json::parse(S(r[7]), nullptr, false)}, {"status", r[8]}, {"played_at", r[9]},
              {"submitted_by", nameOf(r[10])}, {"submitted_at", r[11]}, {"locked_at", r[12]}, {"locked_by", nameOf(r[13])},
              {"rated_at", r[14]}, {"edited_at", r[15]}, {"elo_enabled",r.size()>16?r[16]:json(1)}, {"delta", nullptr}};
    if (rp && r[14].is_number_integer()) {
        auto it = rp->delta.find(r[0].get<long long>());
        if (it != rp->delta.end()) o["delta"] = std::round(it->second * 10) / 10;
    }
    return o;
}
static bool canEditMatch(const User& u, const std::vector<json>& m) {
    if (canAdminGame(u, S(m[1]))) return true;
    if (S(m[8]) != "pending") return false;
    long long id = u.id;
    return (m[10].is_number_integer() && m[10].get<long long>() == id) || m[3].get<long long>() == id || m[4].get<long long>() == id;
}
static void audit(const std::string& game, long long matchId, const std::string& action, long long by, const json& before, const json& after) {
    query("INSERT INTO audit(game,match_id,action,by_user,at,before,after) VALUES(?,?,?,?,?,?,?)",
          {game, matchId, action, by, nowMs(), before.dump(), after.dump()});
}

// ---------- league table (approved matches only) ----------
static json leagueTable(long long lid) {
    auto nm = userNames();
    std::map<long long, Stat> st;
    auto settings=query("SELECT config FROM leagues WHERE id=?",{lid});auto cfg=settings.empty()?json::object():json::parse(S(settings[0][0]));
    for(auto& id:cfg.value("players",std::vector<long long>{}))st[id];
    for(auto& f:query("SELECT p1,p2 FROM fixtures WHERE league_id=?",{lid})){st[f[0].get<long long>()];st[f[1].get<long long>()];}
    for (auto& r : query("SELECT p1,p2,s1,s2,details FROM matches WHERE league_id=? AND status='approved'", {lid})) {
        long long p1 = r[0], p2 = r[1];
        int s1 = (int)r[2].get<long long>(), s2 = (int)r[3].get<long long>();
        Stat &a = st[p1], &b = st[p2];
        a.gf += s1; a.ga += s2; b.gf += s2; b.ga += s1;
        auto detail=json::parse(S(r[4]));int x=s1,y=s2;if(x==y&&cfg.value("shootout_points",false)&&detail.value("pens",false)){x=detail.value("pen1",0);y=detail.value("pen2",0);}
        if (x > y) { a.w++; b.l++; } else if (x < y) { b.w++; a.l++; } else { a.d++; b.d++; }
    }
    struct T { long long id; Stat s; int pts; };
    std::vector<T> t;
    for (auto& [id, s] : st) t.push_back({id, s, s.w * cfg.value("win_points",3) + s.d * cfg.value("draw_points",1) + s.l * cfg.value("loss_points",0)});
    std::sort(t.begin(), t.end(), [&](const T& a, const T& b) {
        if (a.pts != b.pts) return a.pts > b.pts;
        if (a.s.gf - a.s.ga != b.s.gf - b.s.ga) return a.s.gf - a.s.ga > b.s.gf - b.s.ga;
        if(a.s.gf!=b.s.gf)return a.s.gf>b.s.gf;
        auto ids=cfg.value("players",std::vector<long long>{});auto ai=std::find(ids.begin(),ids.end(),a.id),bi=std::find(ids.begin(),ids.end(),b.id);return ai==bi?a.id<b.id:ai<bi;
    });
    json out = json::array();
    for (auto& r : t)
        out.push_back({{"id", r.id}, {"name", nm[r.id]}, {"p", r.s.w + r.s.d + r.s.l}, {"w", r.s.w}, {"d", r.s.d}, {"l", r.s.l},
                       {"gf", r.s.gf}, {"ga", r.s.ga}, {"gd", r.s.gf - r.s.ga}, {"pts", r.pts}});
    return out;
}

// ---------- a player's section for each game they have history in ----------
static json playerGames(long long uid, bool forEditing) {
    auto nm = userNames();
    json out = json::array();
    for (auto& g : query("SELECT g.slug,g.kind FROM games g WHERE EXISTS (SELECT 1 FROM matches m WHERE m.game=g.slug AND (m.p1=? OR m.p2=?)) ORDER BY g.sort", {uid, uid})) {
        std::string slug = S(g[0]);
        Replay rp = replay(slug);
        json flairs = json::array();
        for (auto& f : query("SELECT d.id,d.label,COALESCE(v.value,'') FROM flair_defs d LEFT JOIN flair_values v ON v.def_id=d.id AND v.user_id=? WHERE d.game=? ORDER BY d.sort,d.id", {uid, slug}))
            if (forEditing || !S(f[2]).empty()) flairs.push_back({{"id", f[0]}, {"label", f[1]}, {"value", f[2]}});
        int w = 0, d = 0, l = 0, gf = 0, ga = 0;
        for (auto& r : query("SELECT p1,s1,s2,details FROM matches WHERE game=? AND status='approved' AND (p1=? OR p2=?)", {slug, uid, uid}) ) {
            bool first = r[0].get<long long>() == uid;
            int mine = (int)r[first ? 1 : 2].get<long long>(), theirs = (int)r[first ? 2 : 1].get<long long>();
            gf += mine; ga += theirs;
            auto details=json::parse(S(r[3]));int a=mine,b=theirs;
            if(a==b&&details.value("pens",false)){a=details.value(first?"pen1":"pen2",0);b=details.value(first?"pen2":"pen1",0);}
            (a > b ? w : a == b ? d : l)++;
        }
        json hist = json::array();
        for (auto& r : query(std::string("SELECT ") + MCOLS + " FROM matches WHERE game=? AND (p1=? OR p2=?) ORDER BY played_at DESC,id DESC LIMIT 30", {slug, uid, uid}))
            {auto m=matchJson(r,nm,&rp);if(r[4].get<long long>()==uid && m["delta"].is_number())m["delta"]=-m["delta"].get<double>();hist.push_back(m);}
        auto it = rp.st.find(uid);
        out.push_back({{"slug", slug}, {"kind", g[1]}, {"title", loadTheme(slug)["title"]}, {"flairs", flairs},
                       {"elo", it == rp.st.end() ? json(nullptr) : json((int)std::lround(it->second.elo))},
                       {"record", {{"w", w}, {"d", d}, {"l", l}, {"gf", gf}, {"ga", ga}}}, {"history", hist}});
    }
    return out;
}
