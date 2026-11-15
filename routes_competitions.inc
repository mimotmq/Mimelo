// Draw generation stores seed order and an Elo snapshot. Preview performs no writes.
svr.Post(R"(/api/leagues/(\d+)/draw)",[](const httplib::Request& req,httplib::Response& res){
    std::lock_guard<std::mutex> lock(M);NEED_USER
    long long lid=std::stoll(req.matches[1]);auto l=query("SELECT game FROM leagues WHERE id=?",{lid});if(l.empty())return fail(res,"Competition not found.",404);
    std::string game=S(l[0][0]);NEED_GAME_ADMIN(game)
    auto j=json::parse(req.body,nullptr,false);if(!j.is_object()||!j.contains("players")||!j["players"].is_array())return fail(res,"Select entrants in seed order.");
    try{
        std::vector<long long> ids=j["players"].get<std::vector<long long>>();auto sorted=ids;std::sort(sorted.begin(),sorted.end());
        if(ids.size()<2||std::adjacent_find(sorted.begin(),sorted.end())!=sorted.end())return fail(res,"Choose at least two distinct entrants.");
        for(auto id:ids)if(query("SELECT 1 FROM users WHERE id=?",{id}).empty())return fail(res,"Unknown entrant.");
        std::string format=j.value("format",std::string("knockout")),seed=j.value("seeding",std::string("manual"));
        if(format!="league"&&format!="knockout"&&format!="groups")return fail(res,"Choose league, knockout or groups plus knockout.");
        std::string matchFormat=j.value("match_format",std::string("singles"));json pairs=j.value("pairs",json::array());
        if(matchFormat!="singles"&&matchFormat!="doubles")return fail(res,"Choose singles or doubles.");
        if(matchFormat=="doubles"&&game!="tennis"&&game!="smash-ultimate")return fail(res,"Doubles competitions are available for Tennis and Smash.");
        if(!pairs.is_array())return fail(res,"Choose valid doubles pairs.");
        if(matchFormat=="doubles"){
            if(pairs.size()!=ids.size())return fail(res,"Choose a partner for every entrant.");std::vector<long long> used;
            for(auto id:ids){int found=0;for(auto& pair:pairs){if(!pair.is_array()||pair.size()!=2||!pair[0].is_number_integer()||!pair[1].is_number_integer())return fail(res,"Choose valid doubles pairs.");if(pair[0]==id){found++;used.push_back(id);used.push_back(pair[1].get<long long>());}}
                if(found!=1)return fail(res,"Each entrant needs exactly one partner.");}
            std::sort(used.begin(),used.end());if(std::adjacent_find(used.begin(),used.end())!=used.end())return fail(res,"A player can only enter one pair.");
            for(auto id:used)if(query("SELECT 1 FROM users WHERE id=?",{id}).empty())return fail(res,"Unknown partner.");
        }else pairs=json::array();
        std::string ratingGame=matchFormat=="doubles"?(game=="smash-ultimate"?"smash-ultimate:doubles":"tennis:doubles"):game;
        auto state=query("SELECT updated FROM rating_state WHERE game=?",{ratingGame});json version=state.empty()?json(nullptr):state[0][0];
        if(seed=="elo"&&!j.value("preview",false)&&j.contains("expected_ratings_updated")&&j["expected_ratings_updated"]!=version)return fail(res,"Published ratings changed after your preview. Preview the draw again.");
        Replay rp=replay(ratingGame);auto elo=[&](long long id){double rating=rp.st[id].elo;if(matchFormat=="doubles")for(auto& pair:pairs)if(pair[0]==id)rating=(rating+rp.st[pair[1].get<long long>()].elo)/2;return rating;};
        if(seed=="elo")std::stable_sort(ids.begin(),ids.end(),[&](long long a,long long b){return elo(a)>elo(b);});
        else if(seed=="random") {auto nonce=j.value("nonce",std::string("draw"));std::sort(ids.begin(),ids.end(),[&](long long a,long long b){return sha256hex(nonce+":"+std::to_string(a))<sha256hex(nonce+":"+std::to_string(b));});}
        else if(seed!="manual"&&seed!="preseeded")return fail(res,"Choose manual, pre-seeded, Elo or random seeding.");
        int count=j.value("groups",2),advance=j.value("advance",2),legs=j.value("rounds",1);
        if(legs<1||legs>2)return fail(res,"Round robin must be single or double.");
        if(format=="groups"&&(count<1||count>(int)ids.size()/2||advance<1||advance>(int)ids.size()/count||count*advance<2))return fail(res,"Each group must contain at least the number advancing.");
        std::string elimination=j.value("elimination",std::string("single"));int playoffs=j.value("playoff_count",0);
        if(elimination!="single"&&elimination!="double")return fail(res,"Choose single or double elimination.");
        if(playoffs!=0&&(format!="league"||playoffs<2||playoffs>(int)ids.size()))return fail(res,"Choose 2 or more playoff qualifiers, up to the entrant count.");
        json cfg={{"rating_version",version},{"format",format},{"seeding",seed},{"players",ids},{"rated",j.value("rated",true)},{"groups",count},{"advance",advance},{"rounds",legs},{"seeds",json::array()}};
        cfg["qualification_mode"]="automatic";cfg["match_format"]=matchFormat;cfg["pairs"]=pairs;cfg["elimination"]=elimination;cfg["playoff_count"]=playoffs;
        for(auto k:{"win_points","draw_points","loss_points"}){int value=j.value(k,std::string(k)=="win_points"?3:std::string(k)=="draw_points"?1:0);if(value<0||value>10)return fail(res,"Points must be between 0 and 10.");cfg[k]=value;}cfg["shootout_points"]=j.value("shootout_points",false);
        auto names=userNames();for(auto& pair:pairs)names[pair[0].get<long long>()]+=" / "+names[pair[1].get<long long>()];for(auto id:ids)cfg["seeds"].push_back({{"id",id},{"name",names[id]},{"elo",elo(id)}});
        json bracket=format=="knockout"?competitionBracket(ids,cfg):json(nullptr);
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
    auto cfg=competitionConfig(lid);
     if(automaticQualification(lid)){
        if(!query("SELECT 1 FROM brackets WHERE league_id=?",{lid}).empty())return fail(res,"The knockout stage has already started.");
        if(!qualificationReady(lid))return fail(res,"Approve every league or group fixture first.");
        auto body=json::parse(req.body,nullptr,false);if(!body.is_object())return fail(res,"Invalid qualifier selection.");
        try{query("BEGIN");qualifyCompetition(lid,body.value("selections",json::object()));if(query("SELECT 1 FROM brackets WHERE league_id=?",{lid}).empty())throw std::runtime_error("Resolve the tied qualification places first.");query("COMMIT");reply(res,{{"ok",true}});}catch(const std::exception& e){query("ROLLBACK");fail(res,e.what());}return;
    }
    if(cfg.value("format",std::string())!="groups")return fail(res,"This competition has no group stage.");
    if(!query("SELECT 1 FROM brackets WHERE league_id=?",{lid}).empty())return fail(res,"The knockout stage has already started.");
    if(!query("SELECT 1 FROM fixtures f LEFT JOIN matches m ON m.id=f.match_id WHERE f.league_id=? AND f.stage='group' AND (m.id IS NULL OR m.status!='approved')",{lid}).empty())return fail(res,"Approve every group result before starting the knockout stage.");
    std::vector<long long> ids;for(int rank=0;rank<cfg.value("advance",2);rank++)for(int g=1;g<=cfg.value("groups",2);g++){auto t=groupTable(lid,g);ids.push_back(t[rank]["id"]);}
    if(ids.size()<2)return fail(res,"At least two qualifiers are required.");
    try{query("BEGIN");auto br=newBracket(ids);query("INSERT INTO brackets(league_id,data) VALUES(?,?)",{lid,br.dump()});syncBracket(lid);query("COMMIT");reply(res,{{"ok",true}});}catch(const std::exception& e){query("ROLLBACK");fail(res,e.what());}
});
