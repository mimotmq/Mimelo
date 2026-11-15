// Competition results consume approved matches independently of Elo.
static long long competitionWinner(long long p1,long long p2,int s1,int s2,const json& d) {
    if(s1!=s2)return s1>s2?p1:p2;
    if(d.value("format",std::string())=="smash")return 0;
    if(d.value("pens",false))return d.value("pen1",0)>d.value("pen2",0)?p1:p2;
    return 0;
}
static json competitionConfig(long long id) {auto r=query("SELECT config FROM leagues WHERE id=?",{id});return r.empty()?json::object():json::parse(S(r[0][0]));}
// New draws use automatic qualification; keep legacy EA FC/Table Tennis draws unchanged.
static bool automaticQualification(long long lid) {
    auto cfg=competitionConfig(lid);auto rows=query("SELECT game FROM leagues WHERE id=?",{lid});
    return cfg.value("qualification_mode",std::string())=="automatic"||(!rows.empty()&&(S(rows[0][0])=="tennis"||S(rows[0][0])=="smash-ultimate"));
}
static json groupTable(long long lid,int group) {
    auto nm=userNames();auto cfg=competitionConfig(lid);for(const auto& pair:cfg.value("pairs",json::array()))nm[pair[0].get<long long>()]+=" / "+nm[pair[1].get<long long>()]; std::map<long long,json> st;
    auto init=[&](long long id){if(!st.count(id))st[id]={{"id",id},{"name",nm[id]},{"p",0},{"w",0},{"d",0},{"l",0},{"gf",0},{"ga",0},{"gd",0},{"pts",0}};};
    for(auto& f:query("SELECT p1,p2 FROM fixtures WHERE league_id=? AND group_no=? AND stage!='knockout'",{lid,group})){init(f[0]);init(f[1]);}
    for(auto& r:query("SELECT m.p1,m.p2,m.s1,m.s2,m.details FROM matches m JOIN fixtures f ON f.match_id=m.id WHERE f.league_id=? AND f.group_no=? AND f.stage!='knockout' AND m.status='approved'",{lid,group})) {
        long long a=r[0],b=r[1];init(a);init(b);int x=r[2],y=r[3];
        for(auto id:{a,b})st[id]["p"]=st[id]["p"].get<int>()+1;
        auto inc=[&](long long id,const char* k,int n){st[id][k]=st[id][k].get<int>()+n;};
        inc(a,"gf",x);inc(a,"ga",y);inc(b,"gf",y);inc(b,"ga",x);
        auto detail=json::parse(S(r[4]));if(x==y&&cfg.value("shootout_points",false)&&detail.value("pens",false)){x=detail.value("pen1",0);y=detail.value("pen2",0);}
        if(x==y){inc(a,"d",1);inc(b,"d",1);inc(a,"pts",cfg.value("draw_points",1));inc(b,"pts",cfg.value("draw_points",1));}else{long long w=x>y?a:b,l=x>y?b:a;inc(w,"w",1);inc(w,"pts",cfg.value("win_points",3));inc(l,"l",1);inc(l,"pts",cfg.value("loss_points",0));}
    }
    json out=json::array();for(auto& [id,t]:st){t["gd"]=t["gf"].get<int>()-t["ga"].get<int>();out.push_back(t);}
    auto ids=cfg.value("players",std::vector<long long>{});
    std::sort(out.begin(),out.end(),[&](const json&a,const json&b){for(auto k:{"pts","gd","gf"})if(a[k]!=b[k])return a[k].get<int>()>b[k].get<int>();return std::find(ids.begin(),ids.end(),a["id"].get<long long>())<std::find(ids.begin(),ids.end(),b["id"].get<long long>());});return out;
}
static json newBracket(const std::vector<long long>& entrants) {
    size_t size=2;while(size<entrants.size())size*=2;
    std::vector<int> positions{1,2};while(positions.size()<size){std::vector<int> n;for(int p:positions){n.push_back(p);n.push_back((int)positions.size()*2+1-p);}positions=n;}
    json rounds=json::array();for(size_t count=size/2;count;count/=2){json round=json::array();for(size_t i=0;i<count;i++)round.push_back({{"p1",0},{"p2",0},{"winner",0},{"done",false},{"fixture",0}});rounds.push_back(round);}
    for(size_t i=0;i<size;i++)rounds[0][i/2][i%2?"p2":"p1"]=positions[i]<=(int)entrants.size()?entrants[positions[i]-1]:0;
    for(size_t r=0;r<rounds.size();r++)for(size_t i=0;i<rounds[r].size();i++){auto& n=rounds[r][i];bool ready=true;
        if(r){auto& a=rounds[r-1][i*2];auto& b=rounds[r-1][i*2+1];n["p1"]=a["winner"];n["p2"]=b["winner"];ready=a["done"].get<bool>()&&b["done"].get<bool>();}
        long long a=n["p1"],b=n["p2"];if(ready&&(!a||!b)){n["bye"]=true;n["done"]=true;n["winner"]=a?a:b;}}
    return {{"rounds",rounds},{"entrants",entrants}};
}
// A dependency graph keeps winners, losers, byes and a conditional reset explicit.
static json newDoubleBracket(const std::vector<long long>& entrants) {
    auto seeded=newBracket(entrants);json rounds=json::array();int k=(int)seeded["rounds"].size();
    auto node=[](std::string key,std::string lane,json a,json b){return json{{"key",key},{"lane",lane},{"sources",json::array({a,b})},{"p1",0},{"p2",0},{"winner",0},{"done",false},{"fixture",0},{"bye",false}};};
    auto src=[](const char* type,std::string key){return json{{type,key}};};
    for(int r=0;r<k;r++){json round=json::array();for(size_t i=0;i<seeded["rounds"][r].size();i++){
        auto a=r?src("win","W"+std::to_string(r-1)+"-"+std::to_string(2*i)):json{{"seed",seeded["rounds"][0][i]["p1"]}};
        auto b=r?src("win","W"+std::to_string(r-1)+"-"+std::to_string(2*i+1)):json{{"seed",seeded["rounds"][0][i]["p2"]}};
        round.push_back(node("W"+std::to_string(r)+"-"+std::to_string(i),"Winners · round "+std::to_string(r+1),a,b));}rounds.push_back(round);}
    std::string lastLoser;
    if(k>1){json round=json::array();size_t count=seeded["rounds"][0].size()/2;
        for(size_t i=0;i<count;i++)round.push_back(node("L0-"+std::to_string(i),"Losers · round 1",src("loss","W0-"+std::to_string(2*i)),src("loss","W0-"+std::to_string(2*i+1))));rounds.push_back(round);
        int lr=1;
        for(int r=1;r<k;r++){
            round=json::array();count=seeded["rounds"][r].size();
            for(size_t i=0;i<count;i++)round.push_back(node("L"+std::to_string(lr)+"-"+std::to_string(i),"Losers · round "+std::to_string(lr+1),src("win","L"+std::to_string(lr-1)+"-"+std::to_string(i)),src("loss","W"+std::to_string(r)+"-"+std::to_string(count-1-i))));
            rounds.push_back(round);lastLoser="L"+std::to_string(lr)+"-0";lr++;
            if(r<k-1){round=json::array();for(size_t i=0;i<count/2;i++)round.push_back(node("L"+std::to_string(lr)+"-"+std::to_string(i),"Losers · round "+std::to_string(lr+1),src("win","L"+std::to_string(lr-1)+"-"+std::to_string(2*i)),src("win","L"+std::to_string(lr-1)+"-"+std::to_string(2*i+1))));rounds.push_back(round);lr++;}
        }
    }
    auto final=node("GF","Grand final",src("win","W"+std::to_string(k-1)+"-0"),k==1?src("loss","W0-0"):src("win",lastLoser));
    rounds.push_back(json::array({final}));auto reset=node("RESET","Grand final reset",src("win","GF"),src("loss","GF"));reset["reset"]=true;rounds.push_back(json::array({reset}));
    return {{"elimination","double"},{"rounds",rounds},{"entrants",entrants}};
}
static json competitionBracket(const std::vector<long long>& ids,const json& cfg){return cfg.value("elimination",std::string("single"))=="double"?newDoubleBracket(ids):newBracket(ids);}
static void syncDoubleBracket(long long lid,json data) {
    std::map<std::string,json> processed;
    for(auto& round:data["rounds"])for(auto& n:round){bool ready=true;long long ids[2]={0,0};
        for(int side=0;side<2;side++){auto source=n["sources"][side];if(source.contains("seed")){ids[side]=source["seed"];continue;}
            bool loss=source.contains("loss");auto key=source[loss?"loss":"win"].get<std::string>();auto prev=processed.at(key);
            if(!prev["done"].get<bool>()){ready=false;continue;}
            if(!loss)ids[side]=prev["winner"];else if(!prev.value("bye",false))ids[side]=prev["winner"]==prev["p1"]?prev["p2"].get<long long>():prev["p1"].get<long long>();
        }
        bool skipped=n.value("reset",false)&&processed["GF"].value("done",false)&&processed["GF"]["winner"]==processed["GF"]["p1"];
        long long fid=n["fixture"];auto fx=fid?query("SELECT p1,p2,match_id FROM fixtures WHERE id=?",{fid}):std::vector<std::vector<json>>{};
        if(!fx.empty()&&(!ready||skipped||ids[0]!=fx[0][0].get<long long>()||ids[1]!=fx[0][1].get<long long>())){
            if(!fx[0][2].is_null())throw std::runtime_error("A later bracket match has a result. Remove that result before changing an earlier winner.");
            query("DELETE FROM fixtures WHERE id=?",{fid});fid=0;fx.clear();}
        n["p1"]=ids[0];n["p2"]=ids[1];n["done"]=false;n["winner"]=0;n["bye"]=false;n["skipped"]=skipped;
        if(skipped){n["done"]=true;n["winner"]=processed["GF"]["winner"];}
        else if(ready&&(!ids[0]||!ids[1])){n["done"]=true;n["winner"]=ids[0]?ids[0]:ids[1];n["bye"]=true;}
        else if(ready){if(fx.empty()){query("INSERT INTO fixtures(league_id,p1,p2,stage) VALUES(?,?,?,'knockout')",{lid,ids[0],ids[1]});fid=sqlite3_last_insert_rowid(DB);}
            auto rows=query("SELECT m.p1,m.p2,m.s1,m.s2,m.details FROM matches m JOIN fixtures f ON f.match_id=m.id WHERE f.id=? AND m.status='approved'",{fid});
            if(!rows.empty()){auto v=rows[0];auto winner=competitionWinner(v[0],v[1],v[2],v[3],json::parse(S(v[4])));if(!winner)throw std::runtime_error("A knockout match needs a winner.");n["winner"]=winner;n["done"]=true;}}
        n["fixture"]=fid;processed[n["key"].get<std::string>()]=n;
    }
    query("UPDATE brackets SET data=? WHERE league_id=?",{data.dump(),lid});
}
static void syncBracket(long long lid) {
    auto row=query("SELECT data FROM brackets WHERE league_id=?",{lid});if(row.empty())return;
    json data=json::parse(S(row[0][0]));if(data.value("elimination",std::string("single"))=="double"){syncDoubleBracket(lid,data);return;}auto& rounds=data["rounds"];
    for(size_t r=0;r<rounds.size();r++)for(size_t i=0;i<rounds[r].size();i++){
        auto& n=rounds[r][i];long long a=n["p1"],b=n["p2"];bool ready=true;
        if(r){auto& x=rounds[r-1][i*2];auto& y=rounds[r-1][i*2+1];ready=x["done"].get<bool>()&&y["done"].get<bool>();a=x["winner"];b=y["winner"];}
        long long fid=n["fixture"];auto fx=fid?query("SELECT p1,p2,match_id FROM fixtures WHERE id=?",{fid}):std::vector<std::vector<json>>{};
        if(!fx.empty() && (!ready || a!=fx[0][0].get<long long>() || b!=fx[0][1].get<long long>())) {
            if(!fx[0][2].is_null())throw std::runtime_error("A later bracket match already has a submitted result. Remove that result before changing an earlier winner.");
            query("DELETE FROM fixtures WHERE id=?",{fid});fid=0;fx.clear();
        }
        n["p1"]=a;n["p2"]=b;n["done"]=false;n["winner"]=0;n["bye"]=false;
        if(ready && (!a||!b)){n["done"]=true;n["winner"]=a?a:b;n["bye"]=true;}
        else if(ready){
            if(fx.empty()){query("INSERT INTO fixtures(league_id,p1,p2,stage) VALUES(?,?,?,'knockout')",{lid,a,b});fid=sqlite3_last_insert_rowid(DB);}
            auto m=query("SELECT m.p1,m.p2,m.s1,m.s2,m.details FROM fixtures f JOIN matches m ON m.id=f.match_id WHERE f.id=? AND m.status='approved'",{fid});
            if(!m.empty()){auto& v=m[0];long long winner=competitionWinner(v[0],v[1],v[2],v[3],json::parse(S(v[4])));if(!winner)throw std::runtime_error("A knockout match needs a winner: enter penalties when the score is tied.");n["winner"]=winner;n["done"]=true;}
        }
        n["fixture"]=fid;
    }
    query("UPDATE brackets SET data=? WHERE league_id=?",{data.dump(),lid});
}
// A competition qualifier is earned by standings. Ties at the cutoff pause for an admin.
static json qualificationPools(long long lid) {
    auto cfg=competitionConfig(lid);json pools=json::array();bool groups=cfg.value("format",std::string())=="groups";
    if(!groups&&cfg.value("playoff_count",0)==0)return pools;
    int count=groups?cfg.value("groups",1):1,advance=groups?cfg.value("advance",1):cfg.value("playoff_count",0);
    for(int g=1;g<=count;g++){
        auto rows=groups?groupTable(lid,g):leagueTable(lid);if(rows.size()<(size_t)advance)throw std::runtime_error("Not enough entrants to qualify.");
        json locked=json::array(),choices=json::array();auto boundary=rows[advance-1];
        auto same=[&](const json& row){return row["pts"]==boundary["pts"]&&row["gd"]==boundary["gd"]&&row["gf"]==boundary["gf"];};
        for(int i=0;i<(int)rows.size();i++){if(i<advance&&!same(rows[i]))locked.push_back(rows[i]["id"]);if(same(rows[i]))choices.push_back(rows[i]["id"]);}
        pools.push_back({{"group",g},{"advance",advance},{"locked",locked},{"choices",choices},{"slots",advance-(int)locked.size()},{"tied",choices.size()>(size_t)(advance-(int)locked.size())},{"table",rows}});
    }
    return pools;
}
static bool qualificationReady(long long lid){return query("SELECT 1 FROM fixtures f LEFT JOIN matches m ON m.id=f.match_id WHERE f.league_id=? AND f.stage!='knockout' AND (m.id IS NULL OR m.status!='approved')",{lid}).empty()&&!query("SELECT 1 FROM fixtures WHERE league_id=? AND stage!='knockout'",{lid}).empty();}
static void qualifyCompetition(long long lid,const json& selections=json::object()) {
    auto cfg=competitionConfig(lid);if(!query("SELECT 1 FROM brackets WHERE league_id=?",{lid}).empty()||!qualificationReady(lid))return;
    auto pools=qualificationPools(lid);if(pools.empty())return;std::vector<std::vector<long long>> qualified;
    for(auto& pool:pools){std::vector<long long> list=pool["locked"].get<std::vector<long long>>(),choices=pool["choices"].get<std::vector<long long>>();auto key=std::to_string(pool["group"].get<int>());
        if(pool["tied"]==true){if(!selections.contains(key))return;auto selected=selections.at(key).get<std::vector<long long>>(),sorted=selected;std::sort(sorted.begin(),sorted.end());
            if(selected.size()!=(size_t)pool["slots"].get<int>()||std::adjacent_find(sorted.begin(),sorted.end())!=sorted.end())throw std::runtime_error("Select exactly the required number of tied qualifiers.");
            for(auto id:selected)if(std::find(choices.begin(),choices.end(),id)==choices.end())throw std::runtime_error("Choose only tied entrants.");choices=selected;}
        list.insert(list.end(),choices.begin(),choices.end());qualified.push_back(list);
    }
    std::vector<long long> ids;for(size_t rank=0;rank<qualified[0].size();rank++)for(auto& pool:qualified)ids.push_back(pool[rank]);
    if(ids.size()<2)throw std::runtime_error("At least two qualifiers are required.");auto br=competitionBracket(ids,cfg);query("INSERT INTO brackets(league_id,data) VALUES(?,?)",{lid,br.dump()});
    cfg["qualification_decisions"]=selections;query("UPDATE leagues SET config=? WHERE id=?",{cfg.dump(),lid});syncBracket(lid);
}
static void syncMatchCompetition(long long mid){auto r=query("SELECT league_id,game FROM matches WHERE id=?",{mid});if(!r.empty()&&!r[0][0].is_null()){long long lid=r[0][0];syncBracket(lid);if(automaticQualification(lid))qualifyCompetition(lid);}}
static void syncAllBrackets(){for(auto& r:query("SELECT league_id FROM brackets"))syncBracket(r[0]);for(auto& r:query("SELECT id FROM leagues"))if(automaticQualification(r[0]))qualifyCompetition(r[0]);}
static json competitionPartners(long long lid,long long p1,long long p2){json out=json::array();auto cfg=competitionConfig(lid);for(const auto& pair:cfg.value("pairs",json::array()))for(int side=1;side<=2;side++)if(pair[0]==(side==1?p1:p2))out.push_back({{"side",side},{"id",pair[1]},{"name",userNames()[pair[1].get<long long>()]}});return out;}
static std::string validateCompetitionPlayers(long long lid,const json& d,long long p1,long long p2,const json& partners){
    auto cfg=competitionConfig(lid);auto format=cfg.value("match_format",std::string("singles"));if(format!=d.value("format",std::string("singles")))return "Use the competition's singles or doubles format.";
    if(format=="doubles"){auto expected=competitionPartners(lid,p1,p2);if(expected.size()!=2)return "Use registered pairs from this competition.";for(auto& p:expected)if(partners[p["side"].get<int>()-1]!=p["id"])return "Use the competition's fixed doubles partners.";}return "";
}
