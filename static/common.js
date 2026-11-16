const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(p,o={}){const h={};let b=o.body;if(b&&!(b instanceof FormData)){h['Content-Type']='application/json';b=JSON.stringify(b)}
 const r=await fetch('/api/'+p,{method:o.method||(b?'POST':'GET'),headers:h,body:b,credentials:'same-origin'});
 let j=null;try{j=await r.json()}catch(e){}if(!r.ok)throw new Error((j&&j.error)||'Something went wrong');return j}
const say=(sel,t,bad)=>{const m=$(sel);if(m){m.textContent=t;m.className='msg '+(bad?'err':'ok')}};
const qs=k=>new URLSearchParams(location.search).get(k);
// Load the theme stylesheet for a scope ('home' or a game slug) before the page paints.
function themeLink(scope){document.write('<link rel="stylesheet" href="/theme.css?scope='+encodeURIComponent(scope||'home')+'">')}
// Fills the header, nav and title. Returns {me, theme}.
async function boot(scope='home'){
 const [m,t]=await Promise.all([api('me'),api('theme?scope='+encodeURIComponent(scope))]);
 const me=m.user;
 if($('#ttl'))$('#ttl').textContent=t.title;if($('#tag'))$('#tag').textContent=t.tagline;
 if($('#logo'))$('#logo').innerHTML=`<img src="${esc(t.imageUrls.logo||'/assets/brand/m-crest.png')}" alt="${esc(t.title)} logo">`;
 document.title=t.title;
 const a=[['/','Home'],['/players.html','Players']];
 if(me){a.push(['/account.html','My account']);if(me.is_main)a.push(['/admin.html','Admin'],['/settings.html?scope=home','Home settings'])}
 let h=a.map(([u,l])=>`<a href="${u}">${l}</a>`).join('');
 h+=me?`<span class="sp">${esc(me.name)}</span><button id="out" type="button">Log out</button>`:`<a class="sp" href="/login.html?next=${encodeURIComponent(location.pathname+location.search)}">Log in</a>`;
 if($('#nav')){$('#nav').className='n';$('#nav').innerHTML=h}
 $$('#nav a').forEach(a=>{if(new URL(a.href).pathname===location.pathname)a.setAttribute('aria-current','page')});
 if($('#out'))$('#out').onclick=async()=>{await api('logout',{method:'POST'});location.href='/'};
 return {me,theme:t};
}

function nationalityLabel(value){const code=String(value||'').trim().toUpperCase();return /^[A-Z]{2}$/.test(code)?`<span aria-label="Nationality ${esc(code)}">${[...code].map(c=>String.fromCodePoint(127397+c.charCodeAt(0))).join('')} ${esc(code)}</span>`:esc(value)}
function tennisIdentityLabel(identity){return identity?`${identity.nationality?nationalityLabel(identity.nationality):''}${identity.tier?` <span class="tag">${esc(identity.tier)}</span>`:''}`:''}
function initials(name){return esc(String(name||'?').trim().split(/\s+/).slice(0,2).map(word=>Array.from(word)[0]).join('').toUpperCase())}
function formDots(form){return `<span class="form-dots" aria-label="Recent form: ${esc(form||'No rated matches')}">${Array.from(form||'').map(result=>`<span class="form-${result.toLowerCase()}">${esc(result)}</span>`).join('')}</span>`}
