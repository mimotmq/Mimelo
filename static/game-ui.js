// Views for the live record book. All counts and results come from the API.
const bookIcons={overview:'⌂',matches:'▤',rankings:'▥',leagues:'♜',players:'♙',record:'＋',review:'✓'};
const bookUrl=(view,params={})=>'/game.html?'+new URLSearchParams({g:slug,view,...params});
const bookLink=(view,label,params={})=>`<a href="${esc(bookUrl(view,params))}" class="panel-link">${label} <span aria-hidden="true">→</span></a>`;
const pageHead=(title,description,action='')=>`<header class="book-page-head"><div><p class="eyebrow">${esc(G.title)}</p><h2>${title}</h2><p class="sub">${description}</p></div>${action}</header>`;
const emptyBook=(title,description,action='')=>`<div class="book-empty"><span aria-hidden="true">◇</span><h3>${title}</h3><p>${description}</p>${action}</div>`;
const compactMatch=m=>`<div class="book-compact-score"><div><strong>${esc(tennisSide(m,1))}</strong><span>vs</span><strong>${esc(tennisSide(m,2))}</strong></div><b>${m.s1}<span>–</span>${m.s2}</b></div><small class="book-score-note">${m.details.format==='doubles'?'Doubles · ':''}${G.kind==='fifa'?(m.details.pens?'Shoot-out '+m.details.pen1+'–'+m.details.pen2:'Goals'):G.kind==='tennis'?'Sets':'Games'}</small>`;

drawTabs=function(){
 const tabs=TABS();$('#tabs').hidden=false;
 const groups=[['The game',['overview','matches','rankings']],['Play',['leagues','record']],['Group',['players','review']]];
 $('#tabs').innerHTML=groups.map(([label,keys])=>{const items=keys.map(key=>tabs.find(([k])=>k===key)).filter(Boolean);return items.length?`<section class="side-group"><div class="side-label">${label}</div><nav class="side-nav">${items.map(([key,text])=>`<button type="button" class="side-link" role="tab" id="tab-${key}" aria-controls="view" data-t="${key}" tabindex="${key===tab?0:-1}" aria-selected="${key===tab}"><span class="nav-glyph" aria-hidden="true">${bookIcons[key]}</span>${text}${key==='review'&&counts.pending?`<span class="side-badge" aria-label="${counts.pending} pending">${counts.pending}</span>`:''}</button>`).join('')}${label==='Group'&&isAdmin()?`<a class="side-link" href="/settings.html?scope=${encodeURIComponent(slug)}"><span class="nav-glyph" aria-hidden="true">⚙</span>Game settings</a>`:''}</nav></section>`:''}).join('');
 $('#view').setAttribute('aria-labelledby','tab-'+tab);
 $$('#tabs button').forEach((button,index)=>{
  button.onclick=()=>go(button.dataset.t);
  button.onkeydown=e=>{let next=index;if(['ArrowDown','ArrowRight'].includes(e.key))next=(index+1)%tabs.length;else if(['ArrowUp','ArrowLeft'].includes(e.key))next=(index+tabs.length-1)%tabs.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=tabs.length-1;else return;e.preventDefault();go(tabs[next][0]);$('#tab-'+tabs[next][0]).focus()};
 });
 $('#sidebar-settings').innerHTML='';
};
function navigateGame(view,state={},replace=false){
 tab=TABS().some(([key])=>key===view)?view:'overview';sub=state;
 const params={};for(const [key,urlKey] of [['league','league'],['f','status'],['format','format'],['q','q'],['offset','offset'],['competition','competition'],['player','player']])if(state[key])params[urlKey]=state[key];
 if(tab==='rankings')params.format=tennisFormat;
 if(state.fixture){params.fixture=state.fixture.id;if(state.fixture.league_id)params.league=state.fixture.league_id}
 history[replace?'replaceState':'pushState']({view:tab,sub:state},'',bookUrl(tab,params));drawTabs();return render();
}
async function restoreGameRoute(){
 const requested=qs('view')||qs('tab')||(qs('match')?'matches':'overview');tab=requested==='competitions'?'leagues':requested;
 if(!TABS().some(([key])=>key===tab))tab='overview';
 sub={};for(const [key,urlKey] of [['league','league'],['f','status'],['format','format'],['q','q'],['offset','offset'],['competition','competition'],['player','player']])if(qs(urlKey))sub[key]=['league','offset','player'].includes(key)?Number(qs(urlKey)):qs(urlKey);
 tennisFormat=qs('format')==='doubles'?'doubles':'singles';
 if(tab==='record'&&qs('fixture')&&qs('league')){try{const l=await api('leagues/'+Number(qs('league')));if(l.game!==slug)throw Error('Wrong game');const f=l.fixtures.find(f=>f.id===Number(qs('fixture')));if(!f)throw Error('Fixture not found');sub={fixture:{...f,league:l.name,league_id:l.id}}}catch(e){tab='leagues';sub={}}}
 drawTabs();await render();if(qs('match'))await openMatch(Number(qs('match')));
}
addEventListener('popstate',()=>restoreGameRoute());

views.overview=async()=>{
 const [stats,r,ls,recent,pending]=await Promise.all([api(`games/${slug}/summary`),api(`games/${slug}/rankings`),api(`games/${slug}/leagues`),api(`games/${slug}/matches?limit=3`),api(`games/${slug}/matches?status=pending&limit=3`)]);
 const leader=r.rows[0],ratedFormats=['tennis','smash'].includes(G.kind)?'Singles rankings':'Published rankings',active=ls.find(l=>l.fixtures>0)||ls[0],competition=active?await api('leagues/'+active.id):null,standings=competition?.table||[];
 const metrics=[['Players',stats.players,'All active in this game'],['Matches',stats.matches,`${stats.approved} approved · ${stats.pending} pending`],['Table leader',leader?esc(leader.name):'—',leader?`${leader.elo} Elo · ${leader.pts??leader.w??0} pts`:'Rankings begin with the first approved results'],['Pending review',stats.pending,stats.rejected?`${stats.rejected} returned for correction`:'Waiting for a game admin']];
 const standingsRows=standings.length?standings.slice(0,5).map((p,i)=>`<tr><td>${i+1}</td><td><a href="/player.html?id=${p.id}&g=${slug}">${esc(p.name)}</a></td><td>${p.p}</td><td>${p.gd}</td><td class="num">${p.pts}</td></tr>`):r.rows.slice(0,5).map((p,i)=>`<tr><td>${i+1}</td><td><a href="/player.html?id=${p.id}&g=${slug}">${esc(p.name)}</a></td><td>${p.w}-${p.d}-${p.l}</td><td class="num">${p.elo}</td><td>${formDots(p.form)}</td></tr>`);
 return pageHead('The current season',"Leagues, ratings, and the group’s record.",`<a class="b" href="${bookUrl('record')}">＋ Record a result</a>`)+
 `<div class="book-stat-grid">${metrics.map(([label,value,note])=>`<section class="book-stat"><span>${label}</span><strong>${value}</strong><small>${note}</small></section>`).join('')}</div><div id="panel" class="card panel" hidden></div>`+
 `<div class="book-dashboard"><div class="book-stack"><section class="book-panel"><header><div><h3>${active?esc(active.name)+' table':ratedFormats}</h3><p class="sub">${standings.length?`After ${standings[0].p} matches · approved results only`:r.updated?'Ratings published '+esc(fmtD(r.updated)):'Waiting for the first rating update'}</p></div>${bookLink('rankings','Full rankings')}</header>${standings.length?table(['#','Player','P','GD','Pts'],standingsRows):r.rows.length?table(['#','Player','W-D-L','Elo','Form'],standingsRows):emptyBook('A fresh record book','Approve a result and publish ratings to start the standings.')}</section></div>`+
 `<aside class="book-stack"><section class="book-panel"><header><div><h3>Group activity</h3><p class="sub">The latest results across this game</p></div>${bookLink('matches','All matches')}</header>${recent.length?`<div class="book-match-list">${recent.map(m=>`<article><div class="book-match-meta"><span>${fmtD(m.played_at)}</span>${badge(m)}</div>${compactMatch(m)}<div class="book-match-actions">${dlt(m)}${openBtn(m)}</div></article>`).join('')}</div>`:emptyBook('The first result is yours.','Record a match to start building the group’s history.',bookLink('record','Record a result'))}</section>`+
 `<section class="book-panel"><header><div><h3>Waiting on you</h3><p class="sub">Results that need a game admin.</p></div>${isAdmin()?bookLink('review','Review all'):''}</header>${isAdmin()&&pending.length?`<div class="book-pending-list">${pending.map(m=>`<article><div>${compactMatch(m)}<small>${fmtD(m.played_at)} · ${esc(m.submitted_by||'Player submission')}</small></div>${openBtn(m)}</article>`).join('')}</div>`:emptyBook(isAdmin()?'Nothing needs review':'Approval in progress',isAdmin()?'There are no results waiting for a game admin.':'A game admin reviews and locks submitted results.')}</section></aside></div>`;
};
wire.overview=()=>bindOpen();

views.matches=async()=>{
 const query=new URLSearchParams({paged:'1',limit:'25',offset:String(sub.offset||0)});
 for(const [key,param] of [['f','status'],['format','format'],['q','q'],['player','player']])if(sub[key])query.set(param,sub[key]);
 if(sub.competition==='friendly')query.set('competition','friendly');else if(sub.competition)query.set('league_id',sub.competition);
 const [result,competitions]=await Promise.all([api(`games/${slug}/matches?${query}`),api(`games/${slug}/leagues`)]);
 const labels=new Map(competitions.map(l=>[l.id,l.name]));
 const statuses=[['','All results'],['pending','Pending'],['approved','Locked'],...(['tennis','smash'].includes(G.kind)?[['rejected','Needs correction']]:[])];
 return pageHead('Matches','Every result, from first submission to the published record.',`<a class="b" href="${bookUrl('record')}">＋ Record a match</a>`)+`<div id="panel" class="card panel" hidden></div>`+
 `<div class="book-filters"><div class="book-segmented" role="group" aria-label="Match status">${statuses.map(([value,label])=>`<button data-f="${value}" aria-pressed="${(sub.f||'')===value}">${label}</button>`).join('')}</div><form id="match-search-form" class="book-search"><label class="sr-only" for="match-search">Search players, teams, fighters, or competitions</label><input type="search" id="match-search" placeholder="Search players, teams, competitions…" value="${esc(sub.q||'')}"><button class="alt" type="submit">Search</button></form></div>`+
 `<div class="book-filter-options">${['tennis','smash'].includes(G.kind)?`<label>Match format<select id="match-format-filter">${[['','All formats'],['singles','Singles'],['doubles','Doubles']].map(([value,label])=>`<option value="${value}"${(sub.format||'')===value?' selected':''}>${label}</option>`).join('')}</select></label>`:''}<label>Competition<select id="match-competition"><option value="">All competitions and friendlies</option><option value="friendly"${sub.competition==='friendly'?' selected':''}>Friendlies</option>${competitions.map(l=>`<option value="${l.id}"${String(sub.competition)===String(l.id)?' selected':''}>${esc(l.name)}</option>`).join('')}</select></label>${sub.player?`<span class="tag">Player: ${esc(users.find(u=>u.id===sub.player)?.name||sub.player)}</span>`:''}${sub.q||sub.f||sub.format||sub.competition||sub.player?'<button class="alt" id="clear-match-filters">Clear filters</button>':''}</div>`+
 (result.rows.length?table(['Date','Match','Competition','Status','Elo ±',''],result.rows.map(m=>`<tr><td>${fmtD(m.played_at)}</td><td>${K.summary(m,teams)}</td><td>${m.league_id?`<a href="${bookUrl('leagues',{league:m.league_id})}">${esc(labels.get(m.league_id)||'Competition')}</a>`:'Friendly'}</td><td>${badge(m)}</td><td>${dlt(m)}</td><td>${openBtn(m)}</td></tr>`)):emptyBook('No matches found.',result.total?'Try another page.':'Try changing the filters, or record a new match.'))+
 `<div class="book-pagination" aria-label="Match pages"><span role="status">${result.total?`${result.offset+1}–${Math.min(result.offset+result.rows.length,result.total)} of ${result.total} results`:'0 results'}</span><div><button class="alt" id="matches-prev"${result.offset===0?' disabled':''}>← Previous</button><button class="alt" id="matches-next"${result.offset+result.limit>=result.total?' disabled':''}>Next →</button></div></div>`;
};
wire.matches=()=>{
 const filter=changes=>go('matches',{...sub,...changes,offset:0});
 $$('[data-f]').forEach(b=>b.onclick=()=>filter({f:b.dataset.f}));
 $('#match-search-form').onsubmit=e=>{e.preventDefault();filter({q:$('#match-search').value.trim()})};
 $('#match-search').onsearch=()=>{if(!$('#match-search').value)filter({q:''})};
 if($('#match-format-filter'))$('#match-format-filter').onchange=e=>filter({format:e.target.value});
 $('#match-competition').onchange=e=>filter({competition:e.target.value});
 if($('#clear-match-filters'))$('#clear-match-filters').onclick=()=>go('matches');
 $('#matches-prev').onclick=()=>go('matches',{...sub,offset:Math.max(0,(Number(sub.offset)||0)-25)});
 $('#matches-next').onclick=()=>go('matches',{...sub,offset:(Number(sub.offset)||0)+25});bindOpen();
};
const basicRankings=views.rankings;
views.rankings=async()=>pageHead('Rankings','Published ratings. Each game and match format keeps its own record.')+await basicRankings();
wire.rankings=()=>$$('[data-tennis-ranking]').forEach(b=>b.onclick=()=>{tennisFormat=b.dataset.tennisRanking;go('rankings')});
const basicReview=views.review;
views.review=async()=>pageHead('Review & publish','Approve results first. Publish ratings when the record is ready.')+await basicReview();
views.players=async()=>{
 window.__ps=await api(`games/${slug}/players`);
 return pageHead('Players','The people building this game’s record book.',`<span class="tag">${window.__ps.length} players</span>`)+`<label for="pq">Search by name or username</label><input type="search" id="pq" placeholder="Find a player…"><div class="book-player-grid" id="pl"></div>`;
};
wire.players=()=>{
 const draw=()=>{const q=$('#pq').value.trim().toLowerCase(),players=(window.__ps||[]).filter(p=>(p.name+' '+(p.username||'')).toLowerCase().includes(q));$('#pl').innerHTML=players.length?players.map(p=>`<a class="book-player" href="/player.html?id=${p.id}&g=${slug}"><span class="player-initials">${initials(p.name)}</span><div><h3>${esc(p.name)}</h3><small>${p.username?'@'+esc(p.username):'Unclaimed profile'}</small><p>${p.matches} matches · ${p.elo==null?'Unrated':p.elo+' Elo'}</p>${p.doubles_elo==null?'':`<small>${p.doubles_elo} doubles Elo</small>`}${G.kind==='tennis'?tennisIdentityLabel(p.identity):''}</div><span class="player-arrow" aria-hidden="true">↗</span></a>`).join(''):emptyBook('No players found.','Players appear here once they have a match in this game.')};$('#pq').oninput=draw;draw();
};
initGame().catch(e=>{$('#view').innerHTML=emptyBook('Could not load the record book.',esc(e.message),'<a href="">Try again</a>')});
