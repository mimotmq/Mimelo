/* Local custom-competition results and deterministic progression. */
(function () {
  const store = window.COMP_STORE;
  const clone = x => JSON.parse(JSON.stringify(x));
  const rounds = b => !b ? [] : b.type === 'double' ? [...b.winners, ...b.losers, b.grand] : b.rounds;
  function recalc(c, slug) {
    if (!c.resultBase) c.resultBase = clone(c.data);
    c.results ||= {}; c.tieOrders ||= {};
    const d = clone(c.resultBase), approved = c.results;
    const football = slug === 'eafc26' || slug === 'eafc27';
    const leagueFixtures = d.fixtures.filter(f => f.stage.startsWith('Matchday ') || f.stage.startsWith('Group '));
    const tables = d.groups || (d.standings.length ? { league: d.standings } : {});
    const qualifiers = {}; c.ties = [];
    Object.entries(tables).forEach(([key, rows]) => {
      rows.forEach(r => Object.assign(r, { pld:0,w:0,d:0,l:0,gf:0,ga:0,gd:0,pts:0,form:'' }));
      const fs = leagueFixtures.filter(f => key === 'league' || f.stage.startsWith('Group ' + key.toUpperCase() + ' ·'));
      fs.forEach(f => {
        const index = d.fixtures.indexOf(f), r = approved['f' + index];
        f.resultId = 'f' + index;
        if (!r || r.status !== 'approved') { f.status = r && r.status === 'pending' ? 'pending' : 'scheduled'; return; }
        f.status = 'approved'; f.score = r.a + '–' + r.b;
        const a = rows.find(p => p.name === f.home), b = rows.find(p => p.name === f.away);
        if (!a || !b) return;
        a.pld++; b.pld++; a.gf+=r.a; a.ga+=r.b; b.gf+=r.b; b.ga+=r.a;
        if (r.a === r.b) { a.d++;b.d++;a.pts++;b.pts++;a.form+='D';b.form+='D'; }
        else { const w = r.a > r.b ? a:b, l = w===a?b:a; w.w++;l.l++;w.pts+=football?3:1;w.form+='W';l.form+='L'; }
      });
      rows.forEach(r => r.gd=r.gf-r.ga);
      const compare=(a,b)=>b.pts-a.pts || b.gd-a.gd || b.gf-a.gf;
      const manual=c.tieOrders[key] || [];
      rows.sort((a,b)=>compare(a,b) || (manual.indexOf(a.name)<0?999:manual.indexOf(a.name))-(manual.indexOf(b.name)<0?999:manual.indexOf(b.name)));
      rows.forEach((r,i)=>r.p=i+1);
      const count=key==='league'?c.settings?.playoffCount:c.settings?.advance;
      const finished=fs.every(f=>f.status==='approved');
      if (finished && count) {
        let blocked=false;
        for(let i=0;i<rows.length;) {
          let j=i+1; while(j<rows.length && compare(rows[i],rows[j])===0) j++;
          const names=rows.slice(i,j).map(r=>r.name);
          if(j-i>1 && i<count && !names.every(n=>manual.includes(n))) { c.ties.push({key,names});blocked=true; }
          i=j;
        }
        if(!blocked) rows.slice(0,count).forEach((r,i)=>qualifiers[(key==='league'?'League':'Group '+key.toUpperCase())+' #'+(i+1)]=r.name);
      }
    });
    const outcomes={}; let champion=null;
    const resolve = name => {
      if(name==='Bye') return null;
      if(qualifiers[name]) return qualifiers[name];
      if(/^(Group .+ #|League #)/.test(name)) return undefined;
      const ref=/^(Winner|Loser) (.+)$/.exec(name);
      if(ref) return outcomes[ref[2]] ? outcomes[ref[2]][ref[1]==='Winner'?'winner':'loser'] : undefined;
      return name;
    };
    const bracketFixtures=[];
    rounds(d.bracket).forEach((round,ri)=>round.matches.forEach(m=>{
      const templateHome=m.home, templateAway=m.away;
      let a=resolve(templateHome),b=resolve(templateAway);
      if(m.code==='RESET') {
        const gf=outcomes.GF;
        if(!gf) { a=undefined;b=undefined; }
        else if(gf.winner===gf.home) { m.status='not-needed';m.score='Not needed';m.winner=null;return; }
        else {a=gf.home;b=gf.away;}
      }
      m.home=a===undefined?templateHome:a || 'Bye';m.away=b===undefined?templateAway:b || 'Bye';
      m.winner=null;m.score='';m.bye=false;
      const ready=a!==undefined&&b!==undefined;
      const r=approved[m.code];
      if(ready && (!a || !b)) {m.bye=true;m.status='bye';m.winner=a||b;outcomes[m.code]={winner:a||b,loser:null,home:a,away:b};}
      else if(ready && r?.status==='approved') {m.status='approved';m.score=r.a+'–'+r.b;m.winner=r.a===r.b?r.winner:(r.a>r.b?a:b);outcomes[m.code]={winner:m.winner,loser:m.winner===a?b:a,home:a,away:b};}
      else m.status=ready?(r?.status==='pending'?'pending':'scheduled'):'waiting';
      if(!m.bye) bracketFixtures.push({code:m.code,resultId:m.code,stage:round.title,home:m.home,away:m.away,score:m.score||'—',status:m.status,date:'TBD',round:ri+1});
    }));
    if(d.bracket?.type==='double') {const gf=outcomes.GF;champion=outcomes.RESET?.winner || (gf&&gf.winner===gf.home?gf.winner:null);}
    else if(d.bracket) champion=outcomes[d.bracket.rounds.at(-1).matches[0].code]?.winner;
    d.fixtures=[...leagueFixtures,...bracketFixtures]; c.data=d;
    c.played=d.fixtures.filter(f=>f.status==='approved').length;c.fixtures=d.fixtures.length;
    const allLeague=leagueFixtures.length>0&&leagueFixtures.every(f=>f.status==='approved');
    c.leader=champion || d.standings[0]?.name || '—';
    c.status=champion || (!d.bracket&&allLeague)?'Completed':c.played?'In progress':'Scheduled';
    c.champion=champion || null;
    return c;
  }
  function persist(slug,c) { if(!store.replace(slug,c)) throw Error('Could not save in this browser.'); }
  function load(slug,id) {const c=store.find(slug,id);if(!c)throw Error('Competition not found.');return recalc(c,slug);}
  function submit(slug,id,fid,result) {
    const c=load(slug,id),f=c.data.fixtures.find(f=>f.resultId===fid);
    if(!f || f.status!=='scheduled') throw Error('This fixture is not available for a result.');
    if(!Number.isInteger(result.a)||!Number.isInteger(result.b)||result.a<0||result.b<0)throw Error('Enter valid scores.');
    if(f.code && result.a===result.b && ![f.home,f.away].includes(result.winner))throw Error('A knockout match needs a winner.');
    c.results[fid]={...result,home:f.home,away:f.away,status:'pending'};persist(slug,recalc(c,slug));
  }
  function review(slug,id,fid,approve) {const c=load(slug,id);if(c.results[fid]?.status!=='pending')throw Error('This result has already been reviewed.');c.results[fid].status=approve?'approved':'rejected';persist(slug,recalc(c,slug));}
  function ties(slug,id,key,names) {const c=load(slug,id),table=c.data.groups?.[key] || (key==='league'?c.data.standings:null);if(!table || names.length!==table.length || new Set(names).size!==names.length || names.some(n=>!table.some(r=>r.name===n)))throw Error('Choose every player once.');c.tieOrders[key]=names;persist(slug,recalc(c,slug));}
  function recordFromForm(slug,id,home,away,result) {
    const c=load(slug,id);
    const fixtures=c.data.fixtures.filter(f=>f.status==='scheduled' && ((f.home===home&&f.away===away)||(f.home===away&&f.away===home)));
    if(!fixtures.length) { UI.toast('No available fixture for these players. Check competition qualification and pending results.'); return; }
    const dialog=document.createElement('dialog');dialog.className='dialog';
    const h=document.createElement('h2');h.textContent='Choose the scheduled fixture';dialog.appendChild(h);
    const error=document.createElement('p');error.setAttribute('role','alert');dialog.appendChild(error);
    fixtures.forEach(f=>{const b=document.createElement('button');b.type='button';b.className='btn btn-outline';b.textContent=f.stage+' · '+f.home+' vs '+f.away;
      b.onclick=()=>{try {const r={...result};if(f.home!==home){[r.a,r.b]=[r.b,r.a];r.recordedOrder=[home,away];}submit(slug,id,f.resultId,r);dialog.close();location.href='competition.html?id='+encodeURIComponent(id)+'&game='+slug;}catch(e){error.textContent=e.message;}};dialog.appendChild(b);});
    const close=document.createElement('button');close.type='button';close.className='btn btn-ghost';close.textContent='Cancel';close.onclick=()=>dialog.close();dialog.appendChild(close);
    const previous=document.activeElement;dialog.addEventListener('close',()=>{dialog.remove();if(previous?.isConnected)previous.focus();});document.body.appendChild(dialog);dialog.showModal();
  }
  window.COMP_RESULTS={recalc,load,submit,review,ties,recordFromForm};
})();
