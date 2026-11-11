// Competition results consume approved matches independently of Elo.
static long long competitionWinner(long long p1,long long p2,int s1,int s2,const json& d) {
    if(s1!=s2)return s1>s2?p1:p2;
    if(d.value("pens",false))return d.value("pen1",0)>d.value("pen2",0)?p1:p2;
    return 0;
}
static json competitionConfig(long long id) {auto r=query("SELECT config FROM leagues WHERE id=?",{id});return r.empty()?json::object():json::parse(S(r[0][0]));}
static json groupTable(long long lid,int group) {
    auto nm=userNames();auto cfg=competitionConfig(lid); std::map<long long,json> st;
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
static void syncBracket(long long lid) {
    auto row=query("SELECT data FROM brackets WHERE league_id=?",{lid});if(row.empty())return;
    json data=json::parse(S(row[0][0]));auto& rounds=data["rounds"];
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
static void syncMatchCompetition(long long mid){auto r=query("SELECT league_id FROM matches WHERE id=?",{mid});if(!r.empty()&&!r[0][0].is_null())syncBracket(r[0][0]);}
static void syncAllBrackets(){for(auto& r:query("SELECT league_id FROM brackets"))syncBracket(r[0]);}
