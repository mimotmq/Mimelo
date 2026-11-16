(function(){
 const params=new URLSearchParams(location.search),ctx=resolveGame(params),slug=ctx.slug;
 const esc=UI.esc;
 const id=params.get('id');
 const root=document.createElement('section');root.className='panel';root.style.padding='24px';root.style.margin='24px 0';
 const isDetail=location.pathname.endsWith('competition.html');
 let comp=isDetail&&COMP_STORE.find(slug,id);
 const target=isDetail?document.querySelector('main'):document.querySelector('[data-view-panel="review"]');
 if(!target)return;
 if(isDetail&&!comp)return;
 target.appendChild(root);
 const link=(cid)=>'competition.html?id='+encodeURIComponent(cid)+'&game='+slug;
 function draw(){
   if(isDetail){
    comp=COMP_RESULTS.load(slug,id);
    const fixtures=comp.data.fixtures;
    root.innerHTML='<h2>Competition results</h2><p>Record an available fixture, then approve it below. Only approved scores affect this competition. Saved in this browser; global Elo is unchanged.</p>'+
    (comp.champion?'<p><strong>Champion: '+esc(comp.champion)+'</strong></p>':'')+
    fixtures.filter(f=>f.status==='scheduled'||f.status==='pending').map(f=>'<div class="comp-seed-row"><span>'+esc(f.stage)+' · '+esc(f.home)+' vs '+esc(f.away)+'</span><button class="btn btn-outline" data-record="'+esc(f.resultId)+'" '+(f.status==='pending'?'disabled':'')+'>'+ (f.status==='pending'?'Awaiting approval':'Record result')+'</button></div>').join('')+
    '<div id="local-result-entry"></div><h3>Pending approval</h3>'+queue([comp])+
    (comp.ties.length?'<h3>Resolve qualification ties</h3><p>Order tied players using your agreed tiebreak decision. Points, score difference and scores won still take priority.</p>'+[...new Set(comp.ties.map(t=>t.key))].map(key=>{
     const rows=comp.data.groups?.[key]||comp.data.standings;
     return '<div data-tie="'+esc(key)+'"><h4>'+esc(key==='league'?'League':'Group '+key.toUpperCase())+'</h4>'+rows.map((r,i)=>'<label class="field-label">Place '+(i+1)+'<select class="input">'+rows.map(x=>'<option '+(r.name===x.name?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></label>').join('')+'<button class="btn btn-primary" data-resolve="'+esc(key)+'">Confirm tiebreak order</button></div>';
    }).join(''):'');
   }else root.innerHTML='<h2>Custom competition approvals</h2>'+queue(COMP_STORE.read(slug).map(c=>COMP_RESULTS.recalc(c,slug)));
 }
 function queue(comps){const entries=comps.flatMap(c=>Object.entries(c.results||{}).filter(([,r])=>r.status==='pending').map(([fid,r])=>'<div class="comp-seed-row"><span><a href="'+link(c.id)+'">'+esc(c.name)+'</a><br>'+esc(r.home)+' '+r.a+'–'+r.b+' '+esc(r.away)+(r.detail?'<br>'+esc(r.detail):'')+'</span><div><button class="btn btn-primary" data-approve="'+esc(fid)+'" data-comp="'+esc(c.id)+'">Approve</button><button class="btn btn-outline" data-reject="'+esc(fid)+'" data-comp="'+esc(c.id)+'">Reject</button></div></div>'));return entries.join('')||'<p>No pending custom competition results.</p>';}
 root.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  try{
   if(b.dataset.approve||b.dataset.reject){COMP_RESULTS.review(slug,b.dataset.comp,b.dataset.approve||b.dataset.reject,!!b.dataset.approve);location.reload();}
   if(b.dataset.resolve){const area=b.closest('[data-tie]');COMP_RESULTS.ties(slug,id,b.dataset.resolve,[...area.querySelectorAll('select')].map(s=>s.value));location.reload();}
   if(b.dataset.record){
    const f=comp.data.fixtures.find(x=>x.resultId===b.dataset.record),football=slug.startsWith('eafc');
    const entry=root.querySelector('#local-result-entry');
    entry.innerHTML='<h3>'+esc(f.home)+' vs '+esc(f.away)+'</h3>'+(football?'<p>Enter goals. For a drawn knockout, select the shootout winner.</p>':'<label class="field-label">Best of<select class="input" id="result-best"><option>1</option><option selected>3</option><option>5</option></select></label><p>Enter '+(slug==='tennis'?'games per set':slug==='tt'?'points per game':'stocks taken per game (3 stocks)')+' in order. Leave unplayed rows blank.</p>')+
    Array.from({length:football?1:5},(_,i)=>'<div class="comp-seed-row" data-score-row><span>'+ (football?'Goals':(slug==='tennis'?'Set ':'Game ')+(i+1))+'</span><div><label>'+esc(f.home)+'<input class="input" type="number" min="0" max="99" aria-label="'+esc(f.home)+' score"></label><label>'+esc(f.away)+'<input class="input" type="number" min="0" max="99" aria-label="'+esc(f.away)+' score"></label></div></div>').join('')+
    (football&&f.code?'<label class="field-label">Shootout winner (only if tied)<select class="input" id="result-winner"><option value="">No shootout</option><option>'+esc(f.home)+'</option><option>'+esc(f.away)+'</option></select></label>':'')+
    '<p role="alert" id="result-error"></p><button type="button" class="btn btn-primary" id="result-submit">Submit for approval</button>';
    entry.querySelector('#result-submit').onclick=()=>{try{
      const rows=[...entry.querySelectorAll('[data-score-row]')].map(row=>[...row.querySelectorAll('input')].map(x=>x.value));
      let gap=false;const scores=[];
      rows.forEach(([a,b])=>{if(a===''&&b===''){gap=true;return;}if(gap||a===''||b==='')throw Error('Enter both scores in order, without gaps.');a=Number(a);b=Number(b);if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>99||b>99)throw Error('Use whole scores from 0 to 99.');scores.push([a,b]);});
      if(!scores.length)throw Error('Enter a score.');
      let a=0,b=0;
      if(football)[a,b]=scores[0];
      else {const target=Math.floor(Number(entry.querySelector('#result-best').value)/2)+1;scores.forEach(([x,y])=>{if(a===target||b===target)throw Error('Remove games after the match was decided.');const hi=Math.max(x,y),lo=Math.min(x,y);const valid=slug==='tt'?(hi===11&&lo<=9||hi>11&&hi-lo===2):slug==='smash'?(hi===3&&lo<3):(hi===6&&lo<=4||hi===7&&(lo===5||lo===6));if(!valid)throw Error('Check the '+(slug==='tennis'?'set': 'game')+' scores.');if(x>y)a++;else b++;});if(Math.max(a,b)!==target)throw Error('Enter a completed best-of match.');}
      const winner=entry.querySelector('#result-winner')?.value||null;
      COMP_RESULTS.submit(slug,id,f.resultId,{a,b,winner,detail:scores.map(s=>s.join('–')).join(', ')});location.reload();
     }catch(err){entry.querySelector('#result-error').textContent=err.message;}};
    entry.scrollIntoView({block:'nearest'});
   }
  }catch(err){UI.toast(err.message);}
 });draw();
})();
