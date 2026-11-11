// Routes for match recording. Included inside main() after the stage 1 routes.
#define NEED_GAME_ADMIN(slug) if (!canAdminGame(u, slug)) { fail(res, "Only this game’s admins can do that.", 403); return; }
#define NEED_FIFA(slug) if (gameKind(slug) != "fifa") { fail(res, "Match recording for this game isn’t available yet.", 400); return; }

// ---------- teams (star ratings) ----------
svr.Get(R"(/api/games/([a-z0-9-]+)/teams)", [](const httplib::Request& req, httplib::Response& res) {
    std::lock_guard<std::mutex> l(M);
    reply(res, teamCatalog(std::string(req.matches[1])));
});
svr.Post(R"(/api/games/([a-z0-9-]+)/teams)", [](const httplib::Request& req, httplib::Response& res) {
    std::lock_guard<std::mutex> l(M);NEED_USER
    std::string g=req.matches[1];NEED_GAME_ADMIN(g) NEED_FIFA(g)
    auto j=json::parse(req.body,nullptr,false);std::string csv=jstr(j,"csv");
    try {
        auto rows=readCSV(csv);if(rows.size()<2||rows.size()>2001)return fail(res,"Include a header and 1–2000 clubs.");
        std::map<std::string,size_t> cols;for(size_t i=0;i<rows[0].size();i++)cols[lowerStr(rows[0][i])]=i;
        for(auto key:{"gender","league","name","stars","code","icon"})if(!cols.count(key))return fail(res,"CSV header must contain gender,league,name,stars,code,icon.");
        json clubs=json::array();std::map<std::string,bool> names,codes;
        for(size_t i=1;i<rows.size();i++){
            auto& row=rows[i];auto get=[&](const char* k){if(cols[k]>=row.size())throw std::runtime_error("CSV row "+std::to_string(i+1)+" has missing columns.");return trim(row[cols[k]]);};
            std::string name=get("name"),gender=lowerStr(get("gender")),league=get("league"),code=upper(get("code")),icon=get("icon"),sv=get("stars");
            size_t used=0;double stars=std::stod(sv,&used);
            bool validCode=code.size()>=2&&code.size()<=4&&std::all_of(code.begin(),code.end(),[](char c){return (c>='A'&&c<='Z')||(c>='0'&&c<='9');});
            if(gender!="men"&&gender!="women")throw std::runtime_error("Row "+std::to_string(i+1)+": gender must be men or women.");
            if(name.empty()||name.size()>40||league.empty()||league.size()>80||!validCode||!safeIcon(icon)||used!=sv.size()||!std::isfinite(stars)||stars<0.5||stars>5||std::floor(stars*2)!=stars*2)throw std::runtime_error("Row "+std::to_string(i+1)+": check name, league, 2–4 character code, icon URL, and stars (0.5–5 in half-star steps).");
            std::string identity=gender+"|"+lowerStr(league)+"|"+lowerStr(name);
            if(names[identity]||codes[gender+":"+code])throw std::runtime_error("Row "+std::to_string(i+1)+": duplicate club in the same league, or code within the same gender.");
            names[identity]=true;codes[gender+":"+code]=true;clubs.push_back({{"name",name},{"gender",gender},{"league",league},{"code",code},{"icon",icon},{"stars",stars},{"key",identity}});
        }
        query("BEGIN");query("DELETE FROM teams WHERE game=?",{g});
        for(auto& t:clubs)query("INSERT INTO teams(game,name_lc,name,stars,gender,league,code,icon) VALUES(?,?,?,?,?,?,?,?)",{g,t["key"],t["name"],t["stars"],t["gender"],t["league"],t["code"],t["icon"]});
        query("COMMIT");reply(res,{{"count",clubs.size()}});
    }catch(const std::exception& e){try{query("ROLLBACK");}catch(...){}fail(res,std::string("Catalog not changed. ")+e.what());}
});

// ---------- flairs ----------
svr.Get(R"(/api/games/([a-z0-9-]+)/flairs)", [](const httplib::Request& req, httplib::Response& res) {
    std::lock_guard<std::mutex> l(M);
    json out = json::array();
    for (auto& r : query("SELECT id,label FROM flair_defs WHERE game=? ORDER BY sort,id", {std::string(req.matches[1])})) out.push_back({{"id", r[0]}, {"label", r[1]}});
    reply(res, out);
});
svr.Post(R"(/api/games/([a-z0-9-]+)/flairs)", [](const httplib::Request& req, httplib::Response& res) {
    std::lock_guard<std::mutex> l(M);
    NEED_USER
    std::string g = req.matches[1];
    NEED_GAME_ADMIN(g)
    json j = json::parse(req.body, nullptr, false);
    if (!j.is_object() || !j.contains("labels") || !j["labels"].is_array()) return fail(res, "Send a list of flair names.");
    std::vector<std::string> labels;
    for (auto& x : j["labels"]) {
        std::string s = x.is_string() ? trim(x.get<std::string>()) : "";
        if (s.empty()) continue;
        if (s.size() > 30) return fail(res, "Flair names can be up to 30 characters.");
        if (std::find(labels.begin(), labels.end(), s) == labels.end()) labels.push_back(s);
    }
    if (labels.size() > 8) return fail(res, "Up to 8 flairs per game.");
    for (auto& r : query("SELECT id,label FROM flair_defs WHERE game=?", {g}))
        if (std::find(labels.begin(), labels.end(), S(r[1])) == labels.end()) query("DELETE FROM flair_defs WHERE id=?", {r[0]});
    int i = 0;
    for (auto& s : labels) {
        auto r = query("SELECT id FROM flair_defs WHERE game=? AND label=?", {g, s});
        if (r.empty()) query("INSERT INTO flair_defs(game,label,sort) VALUES(?,?,?)", {g, s, i});
        else query("UPDATE flair_defs SET sort=? WHERE id=?", {i, r[0][0]});
        i++;
    }
    reply(res, {{"count", labels.size()}});
});
svr.Get("/api/me/games", [](const httplib::Request& req, httplib::Response& res) {
    std::lock_guard<std::mutex> l(M);
    NEED_USER
    reply(res, playerGames(u.id, true));
});
svr.Post(R"(/api/games/([a-z0-9-]+)/flairs/me)", [](const httplib::Request& req, httplib::Response& res) {
    std::lock_guard<std::mutex> l(M);
    NEED_USER
    std::string g = req.matches[1];
    json j = json::parse(req.body, nullptr, false);
    if (!j.is_object() || !j.contains("values") || !j["values"].is_object()) return fail(res, "Invalid request.");
    if (query("SELECT 1 FROM matches WHERE game=? AND (p1=? OR p2=?) LIMIT 1", {g, u.id, u.id}).empty()) return fail(res, "You can set flairs once you’ve played a match in this game.", 403);
    for (auto& [k, v] : j["values"].items()) {
        long long id = 0;
        try { id = std::stoll(k); } catch (...) { continue; }
        if (query("SELECT 1 FROM flair_defs WHERE id=? AND game=?", {id, g}).empty()) continue;
        std::string val = v.is_string() ? trim(v.get<std::string>()) : "";
        if (val.size() > 40) return fail(res, "Flair text can be up to 40 characters.");
        if (val.empty()) query("DELETE FROM flair_values WHERE user_id=? AND def_id=?", {u.id, id});
        else query("INSERT OR REPLACE INTO flair_values(user_id,def_id,value) VALUES(?,?,?)", {u.id, id, val});
    }
    reply(res, {{"ok", true}});
});

// ---------- leagues, tournaments and fixtures ----------
svr.Get(R"(/api/games/([a-z0-9-]+)/leagues)", [](const httplib::Request& req, httplib::Response& res) {
    std::lock_guard<std::mutex> l(M);
    json out = json::array();
    for (auto& r : query("SELECT l.id,l.name,l.kind,(SELECT COUNT(*) FROM fixtures f WHERE f.league_id=l.id),"
                         "(SELECT COUNT(*) FROM fixtures f JOIN matches m ON m.id=f.match_id WHERE f.league_id=l.id AND m.status='approved') "
                         "FROM leagues l WHERE l.game=? ORDER BY l.id DESC", {std::string(req.matches[1])}))
        out.push_back({{"id", r[0]}, {"name", r[1]}, {"kind", r[2]}, {"fixtures", r[3]}, {"played", r[4]}, {"format",competitionConfig(r[0]).value("format",std::string("league"))}});
    reply(res, out);
});
svr.Post(R"(/api/games/([a-z0-9-]+)/leagues)", [](const httplib::Request& req, httplib::Response& res) {
    std::lock_guard<std::mutex> l(M);
    NEED_USER
    std::string g = req.matches[1];
    NEED_GAME_ADMIN(g)
    json j = json::parse(req.body, nullptr, false);
    std::string name = jstr(j, "name"), kind = jstr(j, "kind");
    if (name.empty() || name.size() > 60) return fail(res, "Give it a name (up to 60 characters).");
    if (kind != "tournament") kind = "league";
    query("INSERT INTO leagues(game,name,kind,created_at) VALUES(?,?,?,?)", {g, name, kind, nowMs()});
    reply(res, {{"id", sqlite3_last_insert_rowid(DB)}}, 201);
});
svr.Get(R"(/api/leagues/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
    std::lock_guard<std::mutex> l(M);
    long long id = std::stoll(req.matches[1]);
    auto lg = query("SELECT id,game,name,kind FROM leagues WHERE id=?", {id});
    if (lg.empty()) return fail(res, "League not found.", 404);
    auto nm = userNames();
    json fx = json::array();
    for (auto& r : query("SELECT f.id,f.p1,f.p2,f.scheduled_ts,m.id,m.status,m.s1,m.s2,m.details,f.stage,f.group_no FROM fixtures f LEFT JOIN matches m ON m.id=f.match_id WHERE f.league_id=? "
                         "ORDER BY COALESCE(f.scheduled_ts,9223372036854775807),f.id", {id})) {
        json m = r[4].is_null() ? json(nullptr) : json({{"id", r[4]}, {"status", r[5]}, {"s1", r[6]}, {"s2", r[7]}, {"p1_name",nm[r[1]]}, {"p2_name",nm[r[2]]}, {"details",json::parse(S(r[8]))}});
        fx.push_back({{"id", r[0]}, {"p1", r[1]}, {"p2", r[2]}, {"p1_name", nm[r[1]]}, {"p2_name", nm[r[2]]}, {"scheduled_ts", r[3]}, {"stage",r[9]}, {"group_no",r[10]}, {"match", m}});
    }
    auto br=query("SELECT data FROM brackets WHERE league_id=?",{id});json groups=json::array();
    for(auto& r:query("SELECT DISTINCT group_no FROM fixtures WHERE league_id=? AND stage='group' ORDER BY group_no",{id}))groups.push_back({{"number",r[0]},{"table",groupTable(id,r[0])}});
    reply(res, {{"config",competitionConfig(id)}, {"groups",groups}, {"bracket",br.empty()?json(nullptr):json::parse(S(br[0][0]))}, {"id", lg[0][0]}, {"game", lg[0][1]}, {"name", lg[0][2]}, {"kind", lg[0][3]}, {"table", leagueTable(id)}, {"fixtures", fx}});
});
svr.Delete(R"(/api/leagues/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
    std::lock_guard<std::mutex> l(M);
    NEED_USER
    long long id = std::stoll(req.matches[1]);
    auto lg = query("SELECT game FROM leagues WHERE id=?", {id});
    if (lg.empty()) return fail(res, "League not found.", 404);
    NEED_GAME_ADMIN(S(lg[0][0]))
    query("DELETE FROM leagues WHERE id=?", {id});  // its matches stay as friendlies
    reply(res, {{"ok", true}});
});
svr.Post(R"(/api/leagues/(\d+)/fixtures)", [](const httplib::Request& req, httplib::Response& res) {
    std::lock_guard<std::mutex> l(M);
    NEED_USER
    long long id = std::stoll(req.matches[1]);
    auto lg = query("SELECT game FROM leagues WHERE id=?", {id});
    if (lg.empty()) return fail(res, "League not found.", 404);
    NEED_GAME_ADMIN(S(lg[0][0]))
    if(competitionConfig(id).value("format",std::string("league"))!="league")return fail(res,"This competition manages its fixtures through its draw.");
    json j = json::parse(req.body, nullptr, false);
    long long p1 = j.is_object() && j.contains("p1") && j["p1"].is_number_integer() ? j["p1"].get<long long>() : -1;
    long long p2 = j.is_object() && j.contains("p2") && j["p2"].is_number_integer() ? j["p2"].get<long long>() : -1;
    if (p1 < 0 || p2 < 0) return fail(res, "Pick both players.");
    if (p1 == p2) return fail(res, "A player can’t play themselves.");
    json ts = j.contains("scheduled_ts") && j["scheduled_ts"].is_number_integer() ? j["scheduled_ts"] : json(nullptr);
    try { query("INSERT INTO fixtures(league_id,p1,p2,scheduled_ts) VALUES(?,?,?,?)", {id, p1, p2, ts}); }
    catch (...) { return fail(res, "Unknown player."); }
    reply(res, {{"id", sqlite3_last_insert_rowid(DB)}}, 201);
});
svr.Post(R"(/api/leagues/(\d+)/schedule)", [](const httplib::Request& req, httplib::Response& res) {
    std::lock_guard<std::mutex> l(M);
    NEED_USER
    long long id = std::stoll(req.matches[1]);
    auto lg = query("SELECT game FROM leagues WHERE id=?", {id});
    if (lg.empty()) return fail(res, "League not found.", 404);
    NEED_GAME_ADMIN(S(lg[0][0]))
    if(competitionConfig(id).value("format",std::string("league"))!="league")return fail(res,"Use the competition draw for this format.");
    json j = json::parse(req.body, nullptr, false);
    if (!j.is_object() || !j.contains("players") || !j["players"].is_array()) return fail(res, "Select the players.");
    std::vector<long long> ids;
    for (auto& x : j["players"]) if (x.is_number_integer()) ids.push_back(x.get<long long>());
    int rounds = std::clamp(j.value("rounds", 1), 1, 2);
    if (ids.size() < 2 || ids.size() > 20) return fail(res, "Select between 2 and 20 players.");
    int made = 0;
    try {
        query("BEGIN");
        for (size_t a = 0; a < ids.size(); a++)
            for (size_t b = a + 1; b < ids.size(); b++) {
                long long have = query("SELECT COUNT(*) FROM fixtures WHERE league_id=? AND ((p1=? AND p2=?) OR (p1=? AND p2=?))", {id, ids[a], ids[b], ids[b], ids[a]})[0][0];
                for (long long k = have; k < rounds; k++) {
                    bool flip = k % 2 == 1;
                    query("INSERT INTO fixtures(league_id,p1,p2) VALUES(?,?,?)", {id, flip ? ids[b] : ids[a], flip ? ids[a] : ids[b]});
                    made++;
                }
            }
        query("COMMIT");
    } catch (...) { try { query("ROLLBACK"); } catch (...) {} return fail(res, "Unknown player in the selection."); }
    reply(res, {{"created", made}}, 201);
});
svr.Delete(R"(/api/fixtures/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
    std::lock_guard<std::mutex> l(M);
    NEED_USER
    auto r = query("SELECT l.game,l.id,f.stage FROM fixtures f JOIN leagues l ON l.id=f.league_id WHERE f.id=?", {(long long)std::stoll(req.matches[1])});
    if (r.empty()) return fail(res, "Fixture not found.", 404);
    NEED_GAME_ADMIN(S(r[0][0]))
    if(S(r[0][2])!="league")return fail(res,"Generated group and bracket fixtures cannot be removed individually.");
    query("DELETE FROM fixtures WHERE id=?", {(long long)std::stoll(req.matches[1])});
    reply(res, {{"ok", true}});
});

// ---------- matches ----------
svr.Post(R"(/api/games/([a-z0-9-]+)/matches)", [](const httplib::Request& req, httplib::Response& res) {
    std::lock_guard<std::mutex> l(M);
    NEED_USER
    std::string g = req.matches[1];
    if (query("SELECT 1 FROM games WHERE slug=?", {g}).empty()) return fail(res, "Game not found.", 404);
    NEED_FIFA(g)
    json j = json::parse(req.body, nullptr, false);
    if (!j.is_object()) return fail(res, "Invalid request.");
    long long p1 = j.contains("p1") && j["p1"].is_number_integer() ? j["p1"].get<long long>() : -1;
    long long p2 = j.contains("p2") && j["p2"].is_number_integer() ? j["p2"].get<long long>() : -1;
    if (p1 < 0 || p2 < 0) return fail(res, "Pick both players.");
    if (p1 == p2) return fail(res, "A player can’t play themselves.");
    if (query("SELECT COUNT(*) FROM users WHERE id IN (?,?)", {p1, p2})[0][0] != 2) return fail(res, "Unknown player.");
    int s1, s2;
    json d;
    std::string err = validateFifa(j, g, s1, s2, d);
    if (!err.empty()) return fail(res, err);
    long long played = nowMs();
    if (j.contains("played_at") && j["played_at"].is_number_integer()) {
        played = j["played_at"];
        if (played < 946684800000LL || played > nowMs() + 86400000LL) return fail(res, "That date doesn’t look right.");
    }
    json league = nullptr, fixture = nullptr;
    if (j.contains("fixture_id") && j["fixture_id"].is_number_integer()) {
        auto f = query("SELECT f.id,f.league_id,f.p1,f.p2,f.match_id,l.game FROM fixtures f JOIN leagues l ON l.id=f.league_id WHERE f.id=?", {j["fixture_id"]});
        if (f.empty() || S(f[0][5]) != g) return fail(res, "Fixture not found.", 404);
        if (!f[0][4].is_null()) return fail(res, "That fixture already has a result submitted.");
        if (f[0][2].get<long long>() != p1 || f[0][3].get<long long>() != p2) return fail(res, "Use the fixture’s players in the same order.");
        fixture = f[0][0]; league = f[0][1];
    } else if (j.contains("league_id") && j["league_id"].is_number_integer()) {
        if (query("SELECT 1 FROM leagues WHERE id=? AND game=?", {j["league_id"], g}).empty()) return fail(res, "League not found.", 404);
        league = j["league_id"];
        if(competitionConfig(league.get<long long>()).value("format",std::string("league"))!="league")return fail(res,"Record group and knockout results through their scheduled fixture.");
    }
    bool enabled=league.is_null()?true:competitionConfig(league.get<long long>()).value("rated",true);
    if(canAdminGame(u,g)&&j.contains("elo_enabled")&&j["elo_enabled"].is_boolean())enabled=j["elo_enabled"];
    query("INSERT INTO matches(game,league_id,p1,p2,s1,s2,details,status,played_at,submitted_by,submitted_at) VALUES(?,?,?,?,?,?,?, 'pending',?,?,?)",
          {g, league, p1, p2, s1, s2, d.dump(), played, u.id, nowMs()});
    long long id = sqlite3_last_insert_rowid(DB);
    query("UPDATE matches SET elo_enabled=? WHERE id=?",{enabled,id});
    if (!fixture.is_null()) query("UPDATE fixtures SET match_id=? WHERE id=?", {id, fixture});
    std::vector<json> row;
    loadMatch(id, row);
    reply(res, matchJson(row, userNames(), nullptr), 201);
});
svr.Get(R"(/api/games/([a-z0-9-]+)/matches)", [](const httplib::Request& req, httplib::Response& res) {
    std::lock_guard<std::mutex> l(M);
    std::string g = req.matches[1];
    std::string sql = std::string("SELECT ") + MCOLS + " FROM matches WHERE game=?";
    std::vector<json> args = {g};
    std::string st = req.get_param_value("status");
    if (st == "pending" || st == "approved") { sql += " AND status=?"; args.push_back(st); }
    if (req.has_param("player")) { sql += " AND (p1=? OR p2=?)"; long long p = std::stoll(req.get_param_value("player")); args.push_back(p); args.push_back(p); }
    if (req.has_param("league_id")) { sql += " AND league_id=?"; args.push_back((long long)std::stoll(req.get_param_value("league_id"))); }
    sql += " ORDER BY played_at DESC,id DESC LIMIT " + std::to_string(std::clamp(req.has_param("limit") ? std::atoi(req.get_param_value("limit").c_str()) : 100, 1, 300));
    auto nm = userNames();
    Replay rp = replay(g);
    json out = json::array();
    for (auto& r : query(sql, args)) out.push_back(matchJson(r, nm, &rp));
    reply(res, out);
});
svr.Get(R"(/api/matches/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
    std::lock_guard<std::mutex> l(M);
    std::vector<json> m;
    if (!loadMatch(std::stoll(req.matches[1]), m)) return fail(res, "Match not found.", 404);
    User u = currentUser(req);
    Replay rp=replay(S(m[1]));
    json o = matchJson(m, userNames(), &rp);
    o["can_edit"] = u && canEditMatch(u, m);
    if (canAdminGame(u, S(m[1]))) {
        auto nm = userNames();
        json log = json::array();
        for (auto& r : query("SELECT action,by_user,at,before,after FROM audit WHERE match_id=? ORDER BY id", {m[0]}))
            log.push_back({{"action", r[0]}, {"by", nm[r[1]]}, {"at", r[2]}, {"before", json::parse(S(r[3]), nullptr, false)}, {"after", json::parse(S(r[4]), nullptr, false)}});
        o["log"] = log;
    }
    reply(res, o);
});
svr.Put(R"(/api/matches/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
    std::lock_guard<std::mutex> l(M);
    NEED_USER
    std::vector<json> m;
    if (!loadMatch(std::stoll(req.matches[1]), m)) return fail(res, "Match not found.", 404);
    if (!canEditMatch(u, m)) return fail(res, S(m[8]) == "pending" ? "You can’t edit this match." : "This match is locked. Only an admin can change it.", 403);
    json j = json::parse(req.body, nullptr, false);
    if (!j.is_object()) return fail(res, "Invalid request.");
    std::string g = S(m[1]);
    long long p1 = m[3], p2 = m[4];
    bool inFixture = !query("SELECT 1 FROM fixtures WHERE match_id=?", {m[0]}).empty();
    if (j.contains("p1") && j["p1"].is_number_integer()) p1 = j["p1"];
    if (j.contains("p2") && j["p2"].is_number_integer()) p2 = j["p2"];
    if (p1 == p2) return fail(res, "A player can’t play themselves.");
    if (inFixture && (p1 != m[3].get<long long>() || p2 != m[4].get<long long>())) return fail(res, "This match belongs to a scheduled fixture, so its players can’t change.");
    if (query("SELECT COUNT(*) FROM users WHERE id IN (?,?)", {p1, p2})[0][0] != 2) return fail(res, "Unknown player.");
    int s1, s2;
    json d;
    std::string err = validateFifa(j, g, s1, s2, d, json::parse(S(m[7])));
    if (!err.empty()) return fail(res, err);
    long long played = m[9];
    if (j.contains("played_at") && j["played_at"].is_number_integer()) {
        played = j["played_at"];
        if (played < 946684800000LL || played > nowMs() + 86400000LL) return fail(res, "That date doesn’t look right.");
    }
    if(!query("SELECT 1 FROM fixtures f JOIN brackets b ON b.league_id=f.league_id WHERE f.match_id=? AND f.stage='group'",{m[0]}).empty())return fail(res,"Group results cannot change after the knockout draw starts.");
    bool locked = S(m[8]) != "pending";
    json before = matchJson(m, userNames(), nullptr);
    try {query("BEGIN");
    query("UPDATE matches SET p1=?,p2=?,s1=?,s2=?,details=?,played_at=?,edited_at=? WHERE id=?", {p1, p2, s1, s2, d.dump(), played, locked ? json(nowMs()) : json(nullptr), m[0]});
    if(canAdminGame(u,g)&&j.contains("elo_enabled")&&j["elo_enabled"].is_boolean())query("UPDATE matches SET elo_enabled=? WHERE id=?",{j["elo_enabled"],m[0]});
    syncMatchCompetition(m[0]);if(locked)markRatingsDirty(g);
    std::vector<json> m2;
    loadMatch(m[0], m2);
    json after = matchJson(m2, userNames(), nullptr);
    if (locked) audit(g, m[0], "edited after lock", u.id, before, after);
    query("COMMIT");reply(res, after);
    }catch(const std::exception& e){query("ROLLBACK");fail(res,e.what());}
});
svr.Post(R"(/api/matches/(\d+)/approve)", [](const httplib::Request& req, httplib::Response& res) {
    std::lock_guard<std::mutex> l(M);
    NEED_USER
    std::vector<json> m;
    if (!loadMatch(std::stoll(req.matches[1]), m)) return fail(res, "Match not found.", 404);
    NEED_GAME_ADMIN(S(m[1]))
    if (S(m[8]) != "pending") return fail(res, "That match is already locked.");
    try{query("BEGIN");
    query("UPDATE matches SET status='approved',locked_at=?,locked_by=? WHERE id=?", {nowMs(), u.id, m[0]});
    syncMatchCompetition(m[0]);markRatingsDirty(S(m[1]));
    audit(S(m[1]), m[0], "approved", u.id, nullptr, nullptr);
    loadMatch(m[0], m);
    query("COMMIT");reply(res, matchJson(m, userNames(), nullptr));
    }catch(const std::exception& e){query("ROLLBACK");fail(res,e.what());}
});
svr.Delete(R"(/api/matches/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
    std::lock_guard<std::mutex> l(M);
    NEED_USER
    std::vector<json> m;
    if (!loadMatch(std::stoll(req.matches[1]), m)) return fail(res, "Match not found.", 404);
    if(!query("SELECT 1 FROM fixtures f JOIN brackets b ON b.league_id=f.league_id WHERE f.match_id=? AND f.stage='group'",{m[0]}).empty())return fail(res,"Group results cannot be removed after the knockout draw starts.");
    bool admin = canAdminGame(u, S(m[1]));
    bool mine = m[10].is_number_integer() && m[10].get<long long>() == u.id;
    if (!(admin || (S(m[8]) == "pending" && mine))) return fail(res, S(m[8]) == "pending" ? "You can’t delete this match." : "This match is locked. Only an admin can delete it.", 403);
    try{query("BEGIN");
    audit(S(m[1]), m[0], "deleted", u.id, matchJson(m, userNames(), nullptr), nullptr);
    query("DELETE FROM matches WHERE id=?", {m[0]});
    if(!m[2].is_null())syncBracket(m[2]);markRatingsDirty(S(m[1]));query("COMMIT");reply(res, {{"ok", true}});
    }catch(const std::exception& e){query("ROLLBACK");fail(res,e.what());}
});
svr.Post(R"(/api/games/([a-z0-9-]+)/approve-all)", [](const httplib::Request& req, httplib::Response& res) {
    std::lock_guard<std::mutex> l(M);
    NEED_USER
    std::string g = req.matches[1];
    NEED_GAME_ADMIN(g)
    try{query("BEGIN");int n = 0;
    for (auto& r : query("SELECT id FROM matches WHERE game=? AND status='pending'", {g})) {
        query("UPDATE matches SET status='approved',locked_at=?,locked_by=? WHERE id=?", {nowMs(), u.id, r[0]});
        audit(g, r[0], "approved", u.id, nullptr, nullptr);
        n++;
    }
    syncAllBrackets();markRatingsDirty(g);query("COMMIT");reply(res, {{"approved", n}});
    }catch(const std::exception& e){query("ROLLBACK");fail(res,e.what());}
});
svr.Post(R"(/api/games/([a-z0-9-]+)/ratings/update)", [](const httplib::Request& req, httplib::Response& res) {
    std::lock_guard<std::mutex> l(M);
    NEED_USER
    std::string g = req.matches[1];
    NEED_GAME_ADMIN(g)
    long long n = query("SELECT COUNT(*) FROM matches WHERE game=? AND status='approved' AND rated_at IS NULL AND elo_enabled=1", {g})[0][0];
    try{query("BEGIN");query("UPDATE matches SET rated_at=? WHERE game=? AND status='approved' AND rated_at IS NULL AND elo_enabled=1", {nowMs(), g});
    publishRatings(g);query("COMMIT");reply(res, {{"updated", n}});}catch(const std::exception& e){query("ROLLBACK");fail(res,e.what(),500);}
});

// ---------- rankings, players, head to head ----------
svr.Get(R"(/api/games/([a-z0-9-]+)/rankings)", [](const httplib::Request& req, httplib::Response& res) {
    std::lock_guard<std::mutex> l(M);
    std::string g = req.matches[1];
    auto nm = userNames();
    Replay rp = replay(g);
    std::vector<std::pair<long long, Stat>> v(rp.st.begin(), rp.st.end());
    std::sort(v.begin(), v.end(), [](auto& a, auto& b) { return a.second.elo > b.second.elo; });
    json rows = json::array();
    for (auto& [id, s] : v)
        rows.push_back({{"id", id}, {"name", nm[id]}, {"elo", (int)std::lround(s.elo)}, {"peak", (int)std::lround(s.peak)}, {"w", s.w}, {"d", s.d}, {"l", s.l},
                        {"gf", s.gf}, {"ga", s.ga}, {"form", s.form.size() > 5 ? s.form.substr(s.form.size() - 5) : s.form}});
    auto cnt = [&](const char* where) { return query(std::string("SELECT COUNT(*) FROM matches WHERE game=? AND ") + where, {g})[0][0]; };
    auto up = query("SELECT updated,dirty FROM rating_state WHERE game=?", {g});
    reply(res, {{"rows", rows}, {"pending", cnt("status='pending'")}, {"awaiting", cnt("status='approved' AND rated_at IS NULL AND elo_enabled=1")}, {"updated", up.empty()?json(nullptr):up[0][0]}, {"dirty",!up.empty()&&up[0][1].get<int>()!=0}});
});
svr.Get(R"(/api/games/([a-z0-9-]+)/players)", [](const httplib::Request& req, httplib::Response& res) {
    std::lock_guard<std::mutex> l(M);
    std::string g = req.matches[1];
    Replay rp = replay(g);
    json out = json::array();
    for (auto& r : query("SELECT u.id,u.name,u.username,u.hash IS NULL,COUNT(*) FROM users u JOIN (SELECT p1 AS pid FROM matches WHERE game=? UNION ALL SELECT p2 FROM matches WHERE game=?) m "
                         "ON m.pid=u.id GROUP BY u.id ORDER BY u.name COLLATE NOCASE", {g, g})) {
        auto it = rp.st.find(r[0].get<long long>());
        out.push_back({{"id", r[0]}, {"name", r[1]}, {"username", r[2]}, {"placeholder", r[3].get<long long>() != 0}, {"matches", r[4]},
                       {"elo", it == rp.st.end() ? json(nullptr) : json((int)std::lround(it->second.elo))}});
    }
    reply(res, out);
});
svr.Get(R"(/api/games/([a-z0-9-]+)/h2h)", [](const httplib::Request& req, httplib::Response& res) {
    std::lock_guard<std::mutex> l(M);
    std::string g = req.matches[1];
    if (!req.has_param("a") || !req.has_param("b")) return fail(res, "Pick two players.");
    long long a = std::stoll(req.get_param_value("a")), b = std::stoll(req.get_param_value("b"));
    auto nm = userNames();
    json games = json::array();
    int wa = 0, d = 0, wb = 0;
    for (auto& r : query(std::string("SELECT ") + MCOLS + " FROM matches WHERE game=? AND status='approved' AND ((p1=? AND p2=?) OR (p1=? AND p2=?)) ORDER BY played_at DESC,id DESC LIMIT 5", {g, a, b, b, a})) {
        json m = matchJson(r, nm, nullptr);
        bool aFirst = r[3].get<long long>() == a;
        int ga = (int)r[aFirst ? 5 : 6].get<long long>(), gb = (int)r[aFirst ? 6 : 5].get<long long>();
        auto details=m["details"];int x=ga,y=gb;if(x==y&&details.value("pens",false)){x=details.value(aFirst?"pen1":"pen2",0);y=details.value(aFirst?"pen2":"pen1",0);}
        (x > y ? wa : x == y ? d : wb)++;
        m["a_goals"] = ga; m["b_goals"] = gb;
        games.push_back(m);
    }
    reply(res, {{"a", nm[a]}, {"b", nm[b]}, {"a_wins", wa}, {"draws", d}, {"b_wins", wb}, {"games", games}});
});
