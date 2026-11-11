// Game-specific forms and summaries. Future catalogs can use their own schema.
const KINDS={};
const starStr=n=>`${'★'.repeat(Math.floor(n))}${n%1?'½':''} (${n})`;
const clubIcon=t=>t?.icon&&(/^(https:\/\/|\/media\/)/.test(t.icon))?`<img class="club-icon" src="${esc(t.icon)}" alt="" loading="lazy" onerror="this.hidden=true">`:'';
KINDS.fifa={
 fields(m){const d=m?.details||{};
  const side=n=>`<section class="club-picker" data-side="${n}"><h3>Player ${n}’s club</h3><label for="k_gender${n}">Competition</label><select id="k_gender${n}"><option value="men">Men’s football</option><option value="women">Women’s football</option></select><label for="k_league${n}">League</label><select id="k_league${n}"></select><label for="k_t${n}">Club</label><select id="k_t${n}" required><option value="">Choose a club…</option></select><div class="club-preview" id="k_st${n}" aria-live="polite"></div><label for="k_s${n}">Goals (including extra time)</label><input type="number" id="k_s${n}" min="0" max="30" value="${m?.['s'+n]??0}"></section>`;
  return `<div class="club-pickers">${side(1)}${side(2)}</div><label class="check"><input type="checkbox" id="k_aet"${d.aet?' checked':''}> After extra time (a.e.t.)</label><label class="check"><input type="checkbox" id="k_pens"${d.pens?' checked':''}> Penalty shoot-out (draw for Elo)</label><div class="row" id="k_pw"${d.pens?'':' hidden'}>${[1,2].map(n=>`<div><label for="k_p${n}">Player ${n} penalties</label><input type="number" id="k_p${n}" min="0" max="30" value="${d['pen'+n]??0}"></div>`).join('')}</div>`},
 wire(teams,m){const d=m?.details||{};for(const n of [1,2]){
   let all=[...teams.values()];const saved=d['club'+n];if(saved){all=all.filter(t=>t.key!==saved.key);all.push({...saved,key:saved.key||saved.name});}
   const gender=$('#k_gender'+n),league=$('#k_league'+n),club=$('#k_t'+n),preview=$('#k_st'+n);
   let selected=saved||all.find(t=>t.name.toLowerCase()===(d['team'+n]||'').toLowerCase());if(selected)gender.value=selected.gender;
   const show=()=>{const t=all.find(t=>t.key===club.value);preview.innerHTML=t?`${clubIcon(t)}<strong>${esc(t.code||t.name)}</strong> <span>${esc(starStr(t.stars))}</span>`:all.some(t=>t.gender===gender.value)?'<span class="sub">Choose a club from the catalog.</span>':'<span class="sub">No clubs in this category. Upload the team CSV in Game settings.</span>'};
   const clubs=(value='')=>{club.innerHTML='<option value="">Choose a club…</option>'+all.filter(t=>t.gender===gender.value&&t.league===league.value).map(t=>`<option value="${esc(t.key)}">${esc(t.name)} · ${t.stars} ★</option>`).join('');club.value=value;show()};
   const leagues=(lv='',cv='')=>{const names=[...new Set(all.filter(t=>t.gender===gender.value).map(t=>t.league))];league.innerHTML=names.map(x=>`<option>${esc(x)}</option>`).join('');if(names.includes(lv))league.value=lv;clubs(cv)};
   gender.onchange=()=>leagues();league.onchange=()=>clubs();club.onchange=show;leagues(selected?.league,selected?.key||selected?.name);
  }$('#k_pens').onchange=e=>{$('#k_pw').hidden=!e.target.checked}},
 read(){const pens=$('#k_pens').checked;return {team1:$('#k_t1').value,team2:$('#k_t2').value,s1:+$('#k_s1').value,s2:+$('#k_s2').value,aet:$('#k_aet').checked,pens,...(pens?{pen1:+$('#k_p1').value,pen2:+$('#k_p2').value}:{})}},
 summary(m,teams=new Map()){const d=m.details||{},t=n=>d['club'+n]||teams.get((d['team'+n]||'').toLowerCase())||{name:d['team'+n],code:d['team'+n]};const a=t(1),b=t(2);const score=d.pens?`${m.s1}(${d.pen1})–(${d.pen2})${m.s2}`:`${m.s1}–${m.s2}`;
  return `<span class="match-mini"><span>${esc(m.p1_name)} ${clubIcon(a)} <abbr title="${esc(a.name||'')}">${esc(a.code||a.name||'')}</abbr></span> <strong class="sc">${score}</strong> <span><abbr title="${esc(b.name||'')}">${esc(b.code||b.name||'')}</abbr> ${clubIcon(b)} ${esc(m.p2_name)}</span>${d.aet?' <small class="tag">a.e.t.</small>':''}</span>`}
};
