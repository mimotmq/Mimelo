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
// Shared by singles and doubles ratings. Doubles passes each team's
// average rating; the match's set and tiebreak scores determine its margin.
static double tennisRatingDelta(double ratingA,double ratingB,int setsA,int setsB,const json& details) {
    int games=0,tiebreak=0;
    for(const auto& item:details.value("sets",json::array())) {
        games+=item.value("a",0)-item.value("b",0);
        tiebreak+=item.value("tb_a",0)-item.value("tb_b",0);
    }
    double expected=1.0/(1.0+std::pow(10.0,(ratingB-ratingA)/400.0));
    double actual=setsA>setsB?1.0:0.0, direction=setsA>setsB?1.0:-1.0;
    double margin=std::clamp(0.7+std::abs(games)*0.06+(std::abs(setsA-setsB)>=2?0.08:0.0)+std::clamp(direction*tiebreak*0.01,-0.08,0.08),0.7,1.3);
    return std::round(24.0*(actual-expected)*margin);
}
static double smashRatingDelta(double ratingA,double ratingB,int gamesA,int gamesB,const json& details) {
    int stocksA=0,stocksB=0;
    for(const auto& game:details.value("games",json::array())){stocksA+=game.value("a",0);stocksB+=game.value("b",0);}
    double expected=1.0/(1.0+std::pow(10.0,(ratingB-ratingA)/400.0));
    double actual=gamesA>gamesB?1.0:0.0;
    double margin=std::clamp(0.7+std::abs(gamesA-gamesB)*0.08+std::abs(stocksA-stocksB)*0.02,0.7,1.3);
    return std::round(24.0*(actual-expected)*margin);
}
static Replay calculateReplay(const std::string& game) {
    Replay R;
    auto stars = loadStars(game);
    for (auto& r : query("SELECT id,p1,p2,s1,s2,details FROM matches WHERE game=? AND status='approved' AND rated_at IS NOT NULL AND elo_enabled=1 ORDER BY played_at,id", {game})) {
        long long id = r[0], p1 = r[1], p2 = r[2];
        int s1 = (int)r[3].get<long long>(), s2 = (int)r[4].get<long long>();
        json d = json::parse(S(r[5]), nullptr, false);
        if((gameKind(game)=="tennis"||gameKind(game)=="smash") && d.value("format",std::string("singles"))=="doubles")continue;
        Stat &a = R.st[p1], &b = R.st[p2];
        double ra = a.elo + STAR_W * (d.value("stars1", starsOf(stars, jstr(d, "team1"))) - 3), rb = b.elo + STAR_W * (d.value("stars2", starsOf(stars, jstr(d, "team2"))) - 3);
        double e = 1.0 / (1.0 + std::pow(10.0, (rb - ra) / 400.0));
        double sa = s1 > s2 ? 1.0 : s1 == s2 ? 0.5 : 0.0;
        double delta;
        if(gameKind(game)=="tabletennis") {
            int points=0;for(const auto& item:d.value("games",json::array()))points+=item.value("a",0)-item.value("b",0);
            double margin=std::clamp(0.7+std::abs(points)*0.015+std::abs(s1-s2)*0.08,0.7,1.3);
            delta=std::round(24.0*(sa-e)*margin);
        } else if(gameKind(game)=="tennis") {
            delta=tennisRatingDelta(a.elo,b.elo,s1,s2,d);
        } else if(gameKind(game)=="smash") {
            delta=smashRatingDelta(a.elo,b.elo,s1,s2,d);
        } else delta = K_FACTOR * goalMult(s1 - s2) * (sa - e);
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

// Rebuild Tennis doubles independently from singles, using each team's average rating.
static Replay calculateTennisDoubles() {
    Replay result;
    for(const auto& row:query("SELECT id,p1,p2,s1,s2,details FROM matches WHERE game='tennis' AND status='approved' AND rated_at IS NOT NULL AND elo_enabled=1 ORDER BY played_at,id")) {
        json details=json::parse(S(row[5]),nullptr,false);
        if(!details.is_object()||details.value("format",std::string("singles"))!="doubles")continue;
        auto partners=query("SELECT side,user_id FROM match_partners WHERE match_id=? ORDER BY side",{row[0]});
        if(partners.size()!=2 || partners[0][0]!=1 || partners[1][0]!=2)throw std::runtime_error("A doubles match is missing its partners.");
        long long a=row[1],b=row[2],pa=partners[0][1],pb=partners[1][1];
        if(a==b||a==pa||a==pb||b==pa||b==pb||pa==pb)throw std::runtime_error("A doubles match has duplicate players.");
        int sa=row[3],sb=row[4];
        double delta=tennisRatingDelta((result.st[a].elo+result.st[pa].elo)/2,(result.st[b].elo+result.st[pb].elo)/2,sa,sb,details);
        auto update=[&](long long id,double change,int own,int opponent){Stat& st=result.st[id];st.elo+=change;st.peak=std::max(st.peak,st.elo);st.gf+=own;st.ga+=opponent;if(own>opponent){st.w++;st.form+='W';}else{st.l++;st.form+='L';}};
        update(a,delta,sa,sb);update(pa,delta,sa,sb);update(b,-delta,sb,sa);update(pb,-delta,sb,sa);result.delta[row[0].get<long long>()]=delta;
    }
    return result;
}
static Replay calculateSmashDoubles() {
    Replay result;
    for(const auto& row:query("SELECT id,p1,p2,s1,s2,details FROM matches WHERE game='smash-ultimate' AND status='approved' AND rated_at IS NOT NULL AND elo_enabled=1 ORDER BY played_at,id")) {
        json details=json::parse(S(row[5]),nullptr,false);
        if(!details.is_object()||details.value("format",std::string("singles"))!="doubles")continue;
        auto partners=query("SELECT side,user_id FROM match_partners WHERE match_id=? ORDER BY side",{row[0]});
        if(partners.size()!=2||partners[0][0]!=1||partners[1][0]!=2)throw std::runtime_error("A Smash doubles match is missing its partners.");
        long long a=row[1],b=row[2],pa=partners[0][1],pb=partners[1][1];
        if(a==b||a==pa||a==pb||b==pa||b==pb||pa==pb)throw std::runtime_error("A Smash doubles match has duplicate players.");
        int sa=row[3],sb=row[4];
        double delta=smashRatingDelta((result.st[a].elo+result.st[pa].elo)/2,(result.st[b].elo+result.st[pb].elo)/2,sa,sb,details);
        auto update=[&](long long id,double change,int own,int opponent){Stat& st=result.st[id];st.elo+=change;st.peak=std::max(st.peak,st.elo);st.gf+=own;st.ga+=opponent;if(own>opponent){st.w++;st.form+='W';}else{st.l++;st.form+='L';}};
        update(a,delta,sa,sb);update(pa,delta,sa,sb);update(b,-delta,sb,sa);update(pb,-delta,sb,sa);result.delta[row[0].get<long long>()]=delta;
    }
    return result;
}
// Published ratings are immutable until the admin explicitly publishes a rebuild.
static void markRatingsDirty(const std::string& game) {
    query("INSERT INTO rating_state(game,payload,dirty) VALUES(?,'{}',1) ON CONFLICT(game) DO UPDATE SET dirty=1", {game});
    if(game=="smash-ultimate")query("INSERT INTO rating_state(game,payload,dirty) VALUES('smash-ultimate:doubles','{}',1) ON CONFLICT(game) DO UPDATE SET dirty=1");
}
static void publishRatings(const std::string& game) {
    Replay r = game=="tennis:doubles" ? calculateTennisDoubles() : game=="smash-ultimate:doubles" ? calculateSmashDoubles() : calculateReplay(game); json v={{"players",json::array()},{"deltas",json::array()}};
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
    add("matches","rejection_reason","TEXT NOT NULL DEFAULT ''");
    add("leagues","config","TEXT NOT NULL DEFAULT '{}'");add("matches","elo_enabled","INTEGER NOT NULL DEFAULT 1");
    add("fixtures","stage","TEXT NOT NULL DEFAULT 'league'");add("fixtures","group_no","INTEGER NOT NULL DEFAULT 0");
    query("CREATE TABLE IF NOT EXISTS rating_state(game TEXT PRIMARY KEY,payload TEXT NOT NULL,dirty INTEGER NOT NULL DEFAULT 0,updated INTEGER)");
    query("INSERT OR IGNORE INTO rating_state(game,payload) VALUES('smash-ultimate:doubles','{}')");
    query("CREATE TABLE IF NOT EXISTS brackets(league_id INTEGER PRIMARY KEY REFERENCES leagues(id) ON DELETE CASCADE,data TEXT NOT NULL)");
    // A doubles match has one extra player per side; p1/p2 remain the team leads.
    // The match-specific participant records cascade when a match is deleted.
    query("CREATE TABLE IF NOT EXISTS match_partners(match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,side INTEGER NOT NULL CHECK(side IN (1,2)),user_id INTEGER NOT NULL REFERENCES users(id),PRIMARY KEY(match_id,side),UNIQUE(match_id,user_id))");
    query("CREATE INDEX IF NOT EXISTS match_partners_user ON match_partners(user_id,match_id)");
    // Add initial Tennis identity fields once, preserving later admin customizations.
    if(query("SELECT 1 FROM settings WHERE key='tennis_identity_v1'").empty()){
        for(auto label:{"Nationality","Rank tier"})if(query("SELECT 1 FROM flair_defs WHERE game='tennis' AND label=?",{label}).empty())query("INSERT INTO flair_defs(game,label,sort) VALUES('tennis',?,?)",{label,std::string(label)=="Nationality"?0:1});
        query("INSERT INTO settings(key,value) VALUES('tennis_identity_v1','1')");
    }
    // Preserve historical club strength before any later catalog replacement.
    for(auto& r:query("SELECT id,game,details FROM matches WHERE game IN (SELECT slug FROM games WHERE kind='fifa')")) {auto d=json::parse(S(r[2]));bool changed=false;auto teams=teamCatalog(S(r[1]));
        for(int n=1;n<=2;n++){auto key=std::to_string(n);if(!d.contains("stars"+key)){auto name=jstr(d,("team"+key).c_str());auto it=std::find_if(teams.begin(),teams.end(),[&](const json&t){return lowerStr(t["name"])==lowerStr(name);});
            d["stars"+key]=it==teams.end()?json(3):(*it)["stars"];d["club"+key]=it==teams.end()?json({{"name",name},{"code",name},{"gender","men"},{"league","Unsorted"},{"stars",3},{"icon",""}}):*it;changed=true;}}
        if(changed)query("UPDATE matches SET details=? WHERE id=?",{d.dump(),r[0]});}
    for(auto& r:query("SELECT slug FROM games WHERE slug NOT IN (SELECT game FROM rating_state)")){auto game=S(r[0]);if(query("SELECT 1 FROM matches WHERE game=? AND rated_at IS NOT NULL",{game}).empty())query("INSERT INTO rating_state(game,payload) VALUES(?,'{}')",{game});else publishRatings(game);}
}

// Table tennis uses a best-of series. A game ends at 11, or two points ahead after 10–10.
static std::string validateTableTennis(const json& in, int& s1, int& s2, json& d) {
    int best=0;if(!getInt(in,"best_of",1,5,best)||(best!=1&&best!=3&&best!=5))return "Choose best of 1, 3, or 5 games.";
    if(!in.contains("games")||!in["games"].is_array()||in["games"].empty()||in["games"].size()>(size_t)best)return "Enter the scores for the completed games.";
    s1=0;s2=0;int target=best/2+1;json games=json::array();
    for(const auto& game:in["games"]){int a,b;if(s1==target||s2==target)return "Remove games after the match was decided.";
        if(!getInt(game,"a",0,999,a)||!getInt(game,"b",0,999,b))return "Enter whole-number scores for both players in each game.";
        int high=std::max(a,b),low=std::min(a,b);
        if(high<11||(low<10?high!=11:high-low!=2))return "Each game must reach 11 points with a two-point lead.";
        if(a>b)++s1;else ++s2;games.push_back({{"a",a},{"b",b}});
    }
    if(s1!=target&&s2!=target)return "Enter games until a player wins the match.";
    d={{"best_of",best},{"games",games}};return "";
}
// Standard six-game sets; 7–6 sets carry both players' tiebreak points.
static std::string validateTennis(const json& in, int& s1, int& s2, json& d) {
    int best=0;if(!getInt(in,"best_of",1,5,best)||(best!=1&&best!=3&&best!=5))return "Choose best of 1, 3, or 5 sets.";
    std::string format=in.contains("format")?jstr(in,"format"):"singles";
    if(format!="singles"&&format!="doubles")return "Choose singles or doubles.";
    std::string surface=jstr(in,"surface");if(surface.empty())surface="hardcourt";
    if(surface!="hardcourt"&&surface!="clay"&&surface!="grass")return "Choose a valid court surface.";
    if(!in.contains("sets")||!in["sets"].is_array()||in["sets"].empty()||in["sets"].size()>(size_t)best)return "Enter the completed set scores.";
    s1=0;s2=0;int target=best/2+1;json sets=json::array();
    for(const auto& set:in["sets"]){int a,b;if(s1==target||s2==target)return "Remove sets after the match was decided.";
        if(!getInt(set,"a",0,7,a)||!getInt(set,"b",0,7,b))return "Enter whole-number games for both players in each set.";
        int hi=std::max(a,b),lo=std::min(a,b);
        if(!((hi==6&&lo<=4)||(hi==7&&(lo==5||lo==6))))return "Use a valid set score, such as 6–4, 7–5, or 7–6.";
        json item={{"a",a},{"b",b}};
        if(hi==7&&lo==6){int ta,tb;if(!getInt(set,"tb_a",0,999,ta)||!getInt(set,"tb_b",0,999,tb)||std::max(ta,tb)<7||std::abs(ta-tb)<2||((ta>tb)!=(a>b))||(std::min(ta,tb)<6?std::max(ta,tb)!=7:std::abs(ta-tb)!=2))return "Enter a valid tiebreak score for the set winner (at least 7 points, win by two).";item["tb_a"]=ta;item["tb_b"]=tb;}
        else if((set.contains("tb_a")&&!set["tb_a"].is_null())||(set.contains("tb_b")&&!set["tb_b"].is_null()))return "Tiebreak points apply only to a 7–6 set.";
        if(a>b)++s1;else ++s2;sets.push_back(item);
    }
    if(s1!=target&&s2!=target)return "Enter sets until a player wins the match.";
    d={{"format",format},{"best_of",best},{"surface",surface},{"sets",sets}};return "";
}
static const std::vector<std::pair<std::string,std::string>>& smashRoster(){
    static const std::vector<std::pair<std::string,std::string>> roster={
        {"01","Mario"},{"02","Donkey Kong"},{"03","Link"},{"04","Samus"},{"04e","Dark Samus"},{"05","Yoshi"},{"06","Kirby"},{"07","Fox"},{"08","Pikachu"},{"09","Luigi"},{"10","Ness"},{"11","Captain Falcon"},{"12","Jigglypuff"},{"13","Peach"},{"13e","Daisy"},{"14","Bowser"},{"15","Ice Climbers"},{"16","Sheik"},{"17","Zelda"},{"18","Dr. Mario"},{"19","Pichu"},{"20","Falco"},{"21","Marth"},{"21e","Lucina"},{"22","Young Link"},{"23","Ganondorf"},{"24","Mewtwo"},{"25","Roy"},{"25e","Chrom"},{"26","Mr. Game & Watch"},{"27","Meta Knight"},{"28","Pit"},{"28e","Dark Pit"},{"29","Zero Suit Samus"},{"30","Wario"},{"31","Snake"},{"32","Ike"},{"33-35","Pokémon Trainer"},{"36","Diddy Kong"},{"37","Lucas"},{"38","Sonic"},{"39","King Dedede"},{"40","Olimar"},{"41","Lucario"},{"42","R.O.B."},{"43","Toon Link"},{"44","Wolf"},{"45","Villager"},{"46","Mega Man"},{"47","Wii Fit Trainer"},{"48","Rosalina & Luma"},{"49","Little Mac"},{"50","Greninja"},{"51","Mii Brawler"},{"52","Mii Swordfighter"},{"53","Mii Gunner"},{"54","Palutena"},{"55","Pac-Man"},{"56","Robin"},{"57","Shulk"},{"58","Bowser Jr."},{"59","Duck Hunt"},{"60","Ryu"},{"60e","Ken"},{"61","Cloud"},{"62","Corrin"},{"63","Bayonetta"},{"64","Inkling"},{"65","Ridley"},{"66","Simon"},{"66e","Richter"},{"67","King K. Rool"},{"68","Isabelle"},{"69","Incineroar"},{"70","Piranha Plant"},{"71","Joker"},{"72","Hero"},{"73","Banjo & Kazooie"},{"74","Terry"},{"75","Byleth"},{"76","Min Min"},{"77","Steve"},{"78","Sephiroth"},{"79-80","Pyra / Mythra"},{"81","Kazuya"},{"82","Sora"}
    };
    return roster;
}
static const std::vector<std::pair<std::string,std::string>>& smashStages(){
    static const std::vector<std::pair<std::string,std::string>> stages={{"BF","Battlefield"},{"FD","Final Destination"},{"SBF","Small Battlefield"},{"SV","Smashville"},{"T&C","Town and City"},{"PS2","Pokémon Stadium 2"},{"HB","Hollow Bastion"},{"LC","Lylat Cruise"},{"YS","Yoshi's Story"},{"KPL","Kalos Pokémon League"}};
    return stages;
}
static std::string validateSmash(const json& in,int& s1,int& s2,json& d){
    int best=0;if(!getInt(in,"best_of",1,5,best)||(best!=1&&best!=3&&best!=5))return "Choose best of 1, 3, or 5 games.";
    std::string format=in.contains("format")?jstr(in,"format"):"singles";if(format!="singles"&&format!="doubles")return "Choose Singles or Doubles.";
    if(!in.contains("games")||!in["games"].is_array()||in["games"].empty()||in["games"].size()>(size_t)best)return "Enter each completed game's stock score, characters and stage.";
    const int stockLimit=format=="doubles"?6:3,target=best/2+1;const int fightersPerSide=format=="doubles"?2:1;
    s1=s2=0;json games=json::array();
    for(const auto& game:in["games"]){
        if(s1==target||s2==target)return "Remove games after the match was decided.";
        int a=0,b=0;if(!getInt(game,"a",0,stockLimit,a)||!getInt(game,"b",0,stockLimit,b)||((a!=stockLimit&&b!=stockLimit)||a==b))return "Enter stocks taken by each side; the winning side must take all opponent stocks.";
        json item={{"a",a},{"b",b}};
        for(int side=0;side<2;side++){
            const char* key=side==0?"fighters_a":"fighters_b";
            if(!game.contains(key)||!game[key].is_array()||game[key].size()!=(size_t)fightersPerSide)return "Choose a character for every player in each game.";
            json selected=json::array();
            for(const auto& fighter:game[key]){
                if(!fighter.is_string())return "Choose a valid roster character.";
                auto it=std::find_if(smashRoster().begin(),smashRoster().end(),[&](const auto& f){return f.first==fighter.get<std::string>();});
                if(it==smashRoster().end())return "Choose a character from the roster.";
                selected.push_back({{"id",it->first},{"name",it->second}});
            }
            item[key]=selected;
        }
        if(!game.contains("stage")||!game["stage"].is_string())return "Choose a stage for every game.";
        std::string stage=game["stage"];
        if(std::none_of(smashStages().begin(),smashStages().end(),[&](const auto& s){return s.first==stage;}))return "Choose a stage from the stage menu.";
        item["stage"]=stage;games.push_back(item);if(a>b)++s1;else ++s2;
    }
    if(s1!=target&&s2!=target)return "Enter games until a side wins the match.";
    d={{"format",format},{"best_of",best},{"games",games}};return "";
}
static std::string validateGameMatch(const json& in,const std::string& game,int& s1,int& s2,json& d,const json& previous=json::object());

// ---------- validation ----------
static std::string validateFifa(const json& in, const std::string& game, int& s1, int& s2, json& d, const json& previous=json::object()) {
    std::string t1 = jstr(in, "team1"), t2 = jstr(in, "team2");
    if (t1.empty() || t2.empty() || t1.size() > 160 || t2.size() > 160) return "Choose both clubs.";
    if (!getInt(in, "s1", 0, 30, s1) || !getInt(in, "s2", 0, 30, s2)) return "Goals must be whole numbers from 0 to 30.";
    bool pens = in.contains("pens") && in["pens"].is_boolean() && in["pens"].get<bool>();
    d = {{"pens", pens}, {"aet",in.value("aet",false)}};
    // Keep omitted fields on edits; old records remain unknown until supplied.
    for (int side=1;side<=2;side++) {
        std::string key="red_cards"+std::to_string(side);
        int cards=0;
        if(in.contains(key)) {
            if(!getInt(in,key.c_str(),0,11,cards))return "Red cards must be whole numbers from 0 to 11 for each team.";
            d[key]=cards;
        } else if(previous.contains(key)) d[key]=previous[key];
    }
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

static std::string validateGameMatch(const json& in,const std::string& game,int& s1,int& s2,json& d,const json& previous) {
    const auto kind=gameKind(game);
    if(kind=="fifa")return validateFifa(in,game,s1,s2,d,previous);
    if(kind=="tabletennis")return validateTableTennis(in,s1,s2,d);
    if(kind=="tennis")return validateTennis(in,s1,s2,d);
    if(kind=="smash")return validateSmash(in,s1,s2,d);
    return "Match recording for this game isn’t available yet.";
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
    json partners=json::array();
    for(const auto& partner:query("SELECT side,user_id FROM match_partners WHERE match_id=? ORDER BY side",{r[0]}))
        partners.push_back({{"side",partner[0]},{"id",partner[1]},{"name",nameOf(partner[1])}});
    o["rejection_reason"]=query("SELECT rejection_reason FROM matches WHERE id=?",{r[0]})[0][0];
    o["partners"]=partners;auto fixture=query("SELECT id FROM fixtures WHERE match_id=?",{r[0]});o["fixture_id"]=fixture.empty()?json(nullptr):fixture[0][0];
    Replay doubles;
    if(rp && o["details"].value("format",std::string("singles"))=="doubles"){
        const std::string game=S(r[1]);doubles=replay(gameKind(game)=="smash"?"smash-ultimate:doubles":"tennis:doubles");rp=&doubles;
    }
    if (rp && r[14].is_number_integer()) {
        auto it = rp->delta.find(r[0].get<long long>());
        if (it != rp->delta.end()) o["delta"] = std::round(it->second * 10) / 10;
    }
    return o;
}
// Validate all four identities before any write; partners belong to this match only.
static std::string validatePartners(const json& in,const json& details,long long p1,long long p2,json& partners) {
    partners=json::array();
    if(details.value("format",std::string("singles"))!="doubles")return "";
    int a,b;
    if(!getInt(in,"partner1",1,2147483647,a)||!getInt(in,"partner2",1,2147483647,b))return "Choose a partner for each side.";
    if(a==b||a==p1||a==p2||b==p1||b==p2)return "Doubles requires four different players.";
    if(query("SELECT COUNT(*) FROM users WHERE id IN (?,?)",{a,b})[0][0]!=2)return "Unknown doubles partner.";
    partners.push_back(a);partners.push_back(b);return "";
}
static void savePartners(long long mid,const json& partners) {
    query("DELETE FROM match_partners WHERE match_id=?",{mid});
    for(size_t i=0;i<partners.size();i++)query("INSERT INTO match_partners(match_id,side,user_id) VALUES(?,?,?)",{mid,(int)i+1,partners[i]});
}
static bool firstSide(const json& match,long long uid) {
    if(match["p1"]==uid)return true;
    for(const auto& p:match["partners"])if(p["id"]==uid)return p["side"]==1;
    return false;
}
static bool canEditMatch(const User& u, const std::vector<json>& m) {
    if (canAdminGame(u, S(m[1]))) return true;
    if (S(m[8]) != "pending" && S(m[8])!="rejected") return false;
    long long id = u.id;
    return (m[10].is_number_integer() && m[10].get<long long>() == id) || m[3].get<long long>() == id || m[4].get<long long>() == id || !query("SELECT 1 FROM match_partners WHERE match_id=? AND user_id=?",{m[0],id}).empty();
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
    for(const auto& pair:cfg.value("pairs",json::array()))nm[pair[0].get<long long>()]+=" / "+nm[pair[1].get<long long>()];
    for(auto& id:cfg.value("players",std::vector<long long>{}))st[id];
    for(auto& f:query("SELECT p1,p2 FROM fixtures WHERE league_id=? AND stage!='knockout'",{lid})){st[f[0].get<long long>()];st[f[1].get<long long>()];}
    for (auto& r : query("SELECT p1,p2,s1,s2,details FROM matches WHERE league_id=? AND status='approved' AND id NOT IN (SELECT match_id FROM fixtures WHERE league_id=? AND stage='knockout' AND match_id IS NOT NULL)", {lid,lid})) {
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
static json tennisIdentity(long long uid){json value={{"nationality",""},{"tier",""}};for(const auto& f:query("SELECT d.label,v.value FROM flair_defs d JOIN flair_values v ON v.def_id=d.id WHERE d.game='tennis' AND v.user_id=?",{uid})){if(S(f[0])=="Nationality")value["nationality"]=f[1];if(S(f[0])=="Rank tier")value["tier"]=f[1];}return value;}
static json playerGames(long long uid, bool forEditing) {
    auto nm=userNames();json out=json::array();
    for(const auto& g:query("SELECT g.slug,g.kind FROM games g WHERE EXISTS (SELECT 1 FROM matches m WHERE m.game=g.slug AND (m.p1=? OR m.p2=? OR EXISTS (SELECT 1 FROM match_partners p WHERE p.match_id=m.id AND p.user_id=?))) ORDER BY g.sort",{uid,uid,uid})) {
        std::string slug=S(g[0]);Replay rp=replay(slug),dp=replay(S(g[1])=="smash"?"smash-ultimate:doubles":"tennis:doubles");json flairs=json::array(),hist=json::array();
        for(const auto& f:query("SELECT d.id,d.label,COALESCE(v.value,'') FROM flair_defs d LEFT JOIN flair_values v ON v.def_id=d.id AND v.user_id=? WHERE d.game=? ORDER BY d.sort,d.id",{uid,slug}))
            if(forEditing||!S(f[2]).empty())flairs.push_back({{"id",f[0]},{"label",f[1]},{"value",f[2]}});
        json records={{"singles",{{"w",0},{"d",0},{"l",0},{"gf",0},{"ga",0}}},{"doubles",{{"w",0},{"d",0},{"l",0},{"gf",0},{"ga",0}}}};
        for(const auto& row:query(std::string("SELECT ")+MCOLS+" FROM matches WHERE game=? AND (p1=? OR p2=? OR id IN (SELECT match_id FROM match_partners WHERE user_id=?)) ORDER BY played_at DESC,id DESC",{slug,uid,uid,uid})) {
            auto m=matchJson(row,nm,&rp);bool first=firstSide(m,uid);auto details=m["details"];
            if(!first&&m["delta"].is_number())m["delta"]=-m["delta"].get<double>();
            if(hist.size()<100)hist.push_back(m);
            if(m["status"]!="approved")continue;
            auto& r=records[details.value("format",std::string("singles"))=="doubles"?"doubles":"singles"];
            int a=m[first?"s1":"s2"],b=m[first?"s2":"s1"];r["gf"]=r["gf"].get<int>()+a;r["ga"]=r["ga"].get<int>()+b;
            if(a==b&&details.value("pens",false)){a=details.value(first?"pen1":"pen2",0);b=details.value(first?"pen2":"pen1",0);}
            auto k=a>b?"w":a==b?"d":"l";r[k]=r[k].get<int>()+1;
        }
        auto rating=[&](const Replay& r){auto it=r.st.find(uid);return it==r.st.end()?json(nullptr):json((int)std::lround(it->second.elo));};
        out.push_back({{"slug",slug},{"kind",g[1]},{"title",loadTheme(slug)["title"]},{"flairs",flairs},{"elo",rating(rp)},{"doubles_elo",(S(g[1])=="tennis"||S(g[1])=="smash")?rating(dp):json(nullptr)},{"record",records["singles"]},{"records",records},{"history",hist}});
    }
    return out;
}
