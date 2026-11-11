// Draw generation stores seed order and an Elo snapshot. Preview performs no writes.
svr.Post(R"(/api/leagues/(\d+)/draw)",[](const httplib::Request& req,httplib::Response& res){
    std::lock_guard<std::mutex> lock(M);NEED_USER
    long long lid=std::stoll(req.matches[1]);auto l=query("SELECT game FROM leagues WHERE id=?",{lid});if(l.empty())return fail(res,"Competition not found.",404);
    std::string game=S(l[0][0]);NEED_GAME_ADMIN(game)
    auto j=json::parse(req.body,nullptr,false);if(!j.is_object()||!j.contains("players")||!j["players"].is_array())return fail(res,"Select entrants in seed order.");
    try{
        std::vector<long long> ids=j["players"].get<std::vector<long long>>();auto sorted=ids;std::sort(sorted.begin(),sorted.end());
        if(ids.size()<2||ids.size()>64||std::adjacent_find(sorted.begin(),sorted.end())!=sorted.end())return fail(res,"Choose 2–64 distinct entrants.");
        for(auto id:ids)if(query("SELECT 1 FROM users WHERE id=?",{id}).empty())return fail(res,"Unknown entrant.");
        std::string format=j.value("format",std::string("knockout")),seed=j.value("seeding",std::string("manual"));
        if(format!="league"&&format!="knockout"&&format!="groups")return fail(res,"Choose league, knockout or groups plus knockout.");
        auto state=query("SELECT updated FROM rating_state WHERE game=?",{game});json version=state.empty()?json(nullptr):state[0][0];
        if(seed=="elo"&&!j.value("preview",false)&&j.contains("expected_ratings_updated")&&j["expected_ratings_updated"]!=version)return fail(res,"Published ratings changed after your preview. Preview the draw again.");
        Replay rp=replay(game);if(seed=="elo")std::stable_sort(ids.begin(),ids.end(),[&](long long a,long long b){return rp.st[a].elo>rp.st[b].elo;});
        else if(seed=="random") {auto nonce=j.value("nonce",std::string("draw"));std::sort(ids.begin(),ids.end(),[&](long long a,long long b){return sha256hex(nonce+":"+std::to_string(a))<sha256hex(nonce+":"+std::to_string(b));});}
        else if(seed!="manual")return fail(res,"Choose manual, Elo or random seeding.");
        int count=j.value("groups",2),advance=j.value("advance",2),legs=j.value("rounds",1);
        if(legs<1||legs>2)return fail(res,"Round robin must be single or double.");
        if(format=="groups"&&(count<2||count>16||advance<1||advance>(int)ids.size()/count))return fail(res,"Each group must contain at least the number advancing.");
        json cfg={{"rating_version",version},{"format",format},{"seeding",seed},{"players",ids},{"rated",j.value("rated",true)},{"groups",count},{"advance",advance},{"rounds",legs},{"seeds",json::array()}};
        for(auto k:{"win_points","draw_points","loss_points"}){int value=j.value(k,std::string(k)=="win_points"?3:std::string(k)=="draw_points"?1:0);if(value<0||value>10)return fail(res,"Points must be between 0 and 10.");cfg[k]=value;}cfg["shootout_points"]=j.value("shootout_points",false);
        auto names=userNames();for(auto id:ids)cfg["seeds"].push_back({{"id",id},{"name",names[id]},{"elo",rp.st[id].elo}});
        json bracket=format=="knockout"?newBracket(ids):json(nullptr);
        if(j.value("preview",false))return reply(res,{{"config",cfg},{"bracket",bracket}});
        if(!query("SELECT 1 FROM fixtures WHERE league_id=?",{lid}).empty()||!query("SELECT 1 FROM matches WHERE league_id=?",{lid}).empty())return fail(res,"A draw already exists or results have been recorded. Create a new competition to make a new draw.");
        query("BEGIN");query("UPDATE leagues SET config=?,kind=? WHERE id=?",{cfg.dump(),format=="league"?"league":"tournament",lid});
        if(format=="knockout"){query("INSERT INTO brackets(league_id,data) VALUES(?,?)",{lid,bracket.dump()});syncBracket(lid);}
        else {std::vector<std::vector<long long>> pools(format=="groups"?count:1);for(size_t i=0;i<ids.size();i++){size_t g=format=="groups"?((i/count)%2?count-1-i%count:i%count):0;pools[g].push_back(ids[i]);}
            for(size_t g=0;g<pools.size();g++)for(size_t a=0;a<pools[g].size();a++)for(size_t b=a+1;b<pools[g].size();b++)for(int leg=0;leg<legs;leg++)query("INSERT INTO fixtures(league_id,p1,p2,stage,group_no) VALUES(?,?,?,?,?)",{lid,pools[g][leg?b:a],pools[g][leg?a:b],format=="groups"?"group":"league",format=="groups"?(int)g+1:0});}
        query("COMMIT");reply(res,{{"config",cfg},{"ok",true}},201);
    }catch(const std::exception& e){try{query("ROLLBACK");}catch(...){}fail(res,e.what());}
});
svr.Post(R"(/api/leagues/(\d+)/advance)",[](const httplib::Request& req,httplib::Response& res){
    std::lock_guard<std::mutex> lock(M);NEED_USER
    long long lid=std::stoll(req.matches[1]);auto l=query("SELECT game FROM leagues WHERE id=?",{lid});if(l.empty())return fail(res,"Competition not found.",404);NEED_GAME_ADMIN(S(l[0][0]))
    auto cfg=competitionConfig(lid);if(cfg.value("format",std::string())!="groups")return fail(res,"This competition has no group stage.");
    if(!query("SELECT 1 FROM brackets WHERE league_id=?",{lid}).empty())return fail(res,"The knockout stage has already started.");
    if(!query("SELECT 1 FROM fixtures f LEFT JOIN matches m ON m.id=f.match_id WHERE f.league_id=? AND f.stage='group' AND (m.id IS NULL OR m.status!='approved')",{lid}).empty())return fail(res,"Approve every group result before starting the knockout stage.");
    std::vector<long long> ids;for(int rank=0;rank<cfg.value("advance",2);rank++)for(int g=1;g<=cfg.value("groups",2);g++){auto t=groupTable(lid,g);ids.push_back(t[rank]["id"]);}
    if(ids.size()<2)return fail(res,"At least two qualifiers are required.");
    try{query("BEGIN");auto br=newBracket(ids);query("INSERT INTO brackets(league_id,data) VALUES(?,?)",{lid,br.dump()});syncBracket(lid);query("COMMIT");reply(res,{{"ok",true}});}catch(const std::exception& e){query("ROLLBACK");fail(res,e.what());}
});
