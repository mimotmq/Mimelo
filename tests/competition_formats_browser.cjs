// Run with an installed Playwright module; all test data lives in a temporary directory.
const {chromium}=require(process.env.MIMELO_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const {spawn}=require('node:child_process');
(async()=>{
 const work=fs.mkdtempSync(path.join(os.tmpdir(),'mimelo-competition-browser-')),root=path.resolve(__dirname,'..');
 fs.symlinkSync(path.join(root,'static'),path.join(work,'static'),'dir');
 const port=await new Promise(resolve=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})});
 const server=spawn(path.resolve(process.argv[2]||'./mimelo'),[String(port)],{cwd:work,env:{...process.env,MIMELO_ADMIN_PASSWORD:'BrowserTest123'},stdio:'ignore'});
 let browser;
 try{
  const base=`http://127.0.0.1:${port}`;for(let i=0;i<100;i++){try{if((await fetch(base+'/api/games')).ok)break}catch{}await new Promise(r=>setTimeout(r,50))}
  browser=await chromium.launch({headless:true});const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),page=await ctx.newPage();
  const errors=[],failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>{if(r.failure()?.errorText!=='net::ERR_ABORTED')failed.push(r.url())});page.on('dialog',d=>d.accept());
  await page.goto(base+'/login.html');await page.locator('#u').fill('mimo');await page.locator('#p').fill('BrowserTest123');await page.locator('#go').click();await page.waitForURL(base+'/');
  async function api(p,b,method){const res=await ctx.request.fetch(base+'/api/'+p,{method:method||(b?'POST':'GET'),...(b?{data:b}:{})});assert(res.ok(),`${p}: ${await res.text()}`);return res.json()}
  const ids=[];for(const name of ['Alex','Jordan','Morgan','Sam','Riley','Casey','Taylor','Jamie'])ids.push((await api('users',{name})).id);
  async function tab(name){await page.locator(`[data-t="${name}"]`).click();await page.waitForFunction(()=>document.querySelector('#view').getAttribute('aria-busy')==='false')}
  async function noOverflow(){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page overflow')}
  const csv='gender,league,name,stars,code,icon\nmen,Premier League,Arsenal,4.5,ARS,\nmen,La Liga,Barcelona,5,BAR,\n';
  for(const slug of ['ea-fc-26','ea-fc-27','table-tennis']){
   if(slug!=='table-tennis')await api(`games/${slug}/teams`,{csv});
   await page.goto(base+'/game.html?g='+slug);await page.locator('[data-t=leagues]').waitFor();
   for(const format of ['knockout','groups','league']){
    await page.setViewportSize({width:format==='groups'?1440:390,height:1000});
    await tab('leagues');const name=slug+' '+format;
    await page.locator('#ln').fill(name);await page.locator('#lk').selectOption(format==='league'?'league':'tournament');await page.locator('#lmk').click();await page.getByRole('heading',{name,exact:true}).click();
    assert.equal(await page.locator('#cmatchformat').count(),0,'Unsupported doubles format exposed');
    await page.locator('#cformat').selectOption(format);await page.locator('#celimination').selectOption('double');await page.locator('#cseed').selectOption('preseeded');
    for(let i=0;i<4;i++){await page.locator(`[data-entrant="${ids[i]}"]`).check();await page.locator(`[data-seed="${ids[i]}"]`).fill(String(i+1))}
    if(format==='league')await page.locator('#cplayoffs').fill('2');
    if(format==='groups'){await page.locator('#cgroups').fill('2');await page.locator('#cadvance').fill('1')}
    await page.locator('#cpreview').click();await page.locator('#cgenerate').waitFor();await noOverflow();await page.locator('#cgenerate').click();await page.locator('[data-competition-tab=bracket]').click();await page.getByText('Draw seeds · preseeded',{exact:false}).waitFor();
    const leagues=await api(`games/${slug}/leagues`),lid=leagues.find(l=>l.name===name).id;let league=await api(`leagues/${lid}`);
    assert.equal(league.config.elimination,'double');assert.equal(league.config.qualification_mode,'automatic');
    for(const f of league.fixtures){
     const body={p1:f.p1,p2:f.p2,fixture_id:f.id,...(slug==='table-tennis'?{best_of:1,games:[{a:11,b:8}]}:{team1:'Arsenal',team2:'Barcelona',s1:2,s2:0,red_cards1:1,red_cards2:0})};
     const m=await api(`games/${slug}/matches`,body);await api(`matches/${m.id}/approve`,{});
    }
    await tab('leagues');await page.getByRole('heading',{name,exact:true}).click();await page.locator('[data-competition-tab=bracket]').click();await page.locator('.bracket').waitFor();await noOverflow();
    if(format!=='knockout')assert.equal((await api(`leagues/${lid}`)).bracket.entrants.length,2);
    await page.locator('[data-brfx]').first().click();await page.locator('#rsend').waitFor();assert(await page.locator('#f_p1').isDisabled());await noOverflow();
   }
  }
  // A tied qualifying cutoff must expose the admin resolver, not silently seed players.
  const tiedId=(await api('games/table-tennis/leagues',{name:'Tied qualification browser',kind:'league'})).id;
  await api(`leagues/${tiedId}/draw`,{players:ids.slice(0,3),format:'league',playoff_count:2,seeding:'manual'});
  const a=ids[0],b=ids[1],c=ids[2];
  for(const f of (await api(`leagues/${tiedId}`)).fixtures){
   const winner=f.p1===a&&f.p2===b?a:f.p1===a&&f.p2===c?c:b;
   const m=await api('games/table-tennis/matches',{p1:f.p1,p2:f.p2,fixture_id:f.id,best_of:1,games:[{a:winner===f.p1?11:8,b:winner===f.p2?11:8}]});
   await api(`matches/${m.id}/approve`,{});
  }
  await tab('leagues');await page.getByRole('heading',{name:'Tied qualification browser',exact:true}).click();await page.locator('[data-competition-tab=bracket]').click();
  await page.locator('#resolveQualifiers').waitFor();await page.locator(`[data-qualifier-pool="1"] input[value="${a}"]`).check();await page.locator(`[data-qualifier-pool="1"] input[value="${c}"]`).check();
  await page.locator('#resolveQualifiers').click();await page.locator('[data-competition-tab=bracket]').click();await page.locator('.bracket').waitFor();await noOverflow();
  assert.deepEqual((await api(`leagues/${tiedId}`)).bracket.entrants,[a,c]);
  assert(!(await page.locator('#view').innerText()).includes('Shoot-outs'),'Football copy leaked into Table Tennis');
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  console.log('PASS Chromium EA FC 26/27 and Table Tennis: DE/groups/league playoff creation, seeding, approved qualification, bracket and fixed-fixture entry at desktop/mobile');
 }finally{if(browser)await browser.close();server.kill();await new Promise(r=>server.once('exit',r));fs.rmSync(work,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
