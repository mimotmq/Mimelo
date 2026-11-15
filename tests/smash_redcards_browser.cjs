// Run with an installed Playwright module; all test data lives in a temporary directory.
const {chromium}=require(process.env.MIMELO_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const {spawn}=require('node:child_process');
(async()=>{
 const work=fs.mkdtempSync(path.join(os.tmpdir(),'mimelo-smash-redcards-browser-')),root=path.resolve(__dirname,'..');
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
  async function noOverflow(){const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1?[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1).map(el=>el.tagName+'.'+el.className).slice(0,12):[]);assert.deepEqual(overflow,[],'Page overflow')}
  async function game(slug){await page.goto(base+'/game.html?g='+slug);await page.locator('[data-t=record]').waitFor();await page.waitForFunction(()=>document.querySelector('#view').getAttribute('aria-busy')==='false')}
  const csv='gender,league,name,stars,code,icon\nmen,Premier League,Arsenal,4.5,ARS,\nmen,La Liga,Barcelona,5,BAR,\n';
  for(const slug of ['ea-fc-26','ea-fc-27']){
   await api(`games/${slug}/teams`,{csv});await game(slug);await tab('record');
   await page.locator('#f_p1').selectOption(String(ids[0]));await page.locator('#f_p2').selectOption(String(ids[1]));
   await page.locator('#k_league1').selectOption('Premier League');await page.locator('#k_t1').selectOption({label:'Arsenal · 4.5 ★'});
   await page.locator('#k_league2').selectOption('La Liga');await page.locator('#k_t2').selectOption({label:'Barcelona · 5 ★'});
   await page.locator('#k_s1').fill('2');await page.locator('#k_s2').fill('1');await page.locator('#k_red1').fill('1');await page.locator('#k_red2').fill('2');
   await page.setViewportSize({width:390,height:1000});await noOverflow();await page.locator('#rsend').click();await page.locator('#mapp').waitFor();
   assert.equal(await page.locator('#k_red2').inputValue(),'2');await page.locator('#mapp').click();await page.locator('#panel .tag.lock').waitFor();
   await page.locator('#k_red1').fill('0');await page.locator('#msave').click();await page.locator('#k_red1').filter({visible:true}).waitFor();
   await page.waitForFunction(()=>document.querySelector('#panel .tag.lock')&&document.querySelector('#k_red1').value==='0');
   await page.reload();await page.locator('.red-card-count').filter({hasText:'2 red cards'}).first().waitFor();
   await page.locator('[data-open]').first().click();assert.equal(await page.locator('#k_red1').inputValue(),'0');assert.equal(await page.locator('#k_red2').inputValue(),'2');
   await noOverflow();
  }
  await game('smash-ultimate');
  async function pick(row,side,slot,id){const trigger=page.locator(`[data-smash-row="${row}"] [data-smash-picker=fighter][data-side="${side}"][data-slot="${slot}"]`);await trigger.click();await page.locator(`[data-smash-choice="${id}"]`).click();assert(await trigger.evaluate(el=>el===document.activeElement))}
  async function stage(row,id){await page.locator(`[data-smash-row="${row}"] [data-smash-picker=stage]`).click();await page.locator(`[data-smash-choice="${id}"]`).click()}
  async function score(row,a,b){await page.locator(`[data-smash-row="${row}"] [data-smash-stock=a]`).fill(String(a));await page.locator(`[data-smash-row="${row}"] [data-smash-stock=b]`).fill(String(b))}
  for(const width of [1440,390])for(const format of ['singles','doubles'])for(const best of [1,3,5]){
   await page.setViewportSize({width,height:1000});await tab('record');await page.locator('#smash-format').selectOption(format);await page.locator('#smash-best').selectOption(String(best));
   await page.locator('#f_p1').selectOption(String(ids[0]));await page.locator('#f_p2').selectOption(String(ids[1]));
   if(format==='doubles'){await page.locator('#smash-partner1').selectOption(String(ids[2]));await page.locator('#smash-partner2').selectOption(String(ids[3]))}
   assert.equal(await page.locator('.smash-entry-row:visible').count(),best);assert.equal(await page.locator('.jv-toggle').count(),0);
   for(let i=0;i<Math.floor(best/2)+1;i++){await score(i,format==='doubles'?6:3,format==='doubles'?5:2);await pick(i,'a',0,'33-35');await pick(i,'b',0,'79-80');if(format==='doubles'){await pick(i,'a',1,'04e');await pick(i,'b',1,'01')}await stage(i,'T&C')}
   await noOverflow();
  }
  if(process.env.MIMELO_SCREENSHOT_DIR){fs.mkdirSync(process.env.MIMELO_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.MIMELO_SCREENSHOT_DIR,'smash-mobile.png'),fullPage:true})}
  await page.locator('#rsend').click();await page.locator('#mapp').waitFor();assert.equal(await page.locator('#smash-format').inputValue(),'doubles');
  assert.equal(await page.locator('[data-smash-row="0"] [data-smash-stock=a]').inputValue(),'6');assert.equal(await page.locator('[data-smash-row="0"] [data-smash-stock=b]').inputValue(),'5');
  await page.locator('#rejectReason').fill('Check game 1');await page.locator('#mreject').click();await page.getByText('Needs correction',{exact:true}).first().waitFor();
  await score(0,6,4);await page.locator('#msave').click();await page.locator('#mapp').waitFor();await page.locator('#mapp').click();await page.locator('#panel .tag.lock').waitFor();
  await tab('review');await page.locator('#upd').click();await page.locator('#ru').filter({hasText:'Ratings rebuilt'}).waitFor();
  await tab('rankings');await page.locator('[data-tennis-ranking=doubles]').click();await page.waitForFunction(()=>document.querySelectorAll('#view tbody tr').length===4);
  await page.goto(base+`/player.html?id=${ids[2]}&g=smash-ultimate`);await page.locator('.smash-scorecard').waitFor();assert((await page.locator('.smash-scorecard').textContent()).includes('Town and City'));await noOverflow();
  await game('smash-ultimate');await tab('leagues');await page.locator('#ln').fill('Smash doubles cup');await page.locator('#lk').selectOption('tournament');await page.locator('#lmk').click();await page.getByRole('heading',{name:'Smash doubles cup'}).click();
  await page.locator('#cmatchformat').selectOption('doubles');await page.locator('#celimination').selectOption('double');
  for(let i=0;i<3;i++){await page.locator(`[data-entrant="${ids[i]}"]`).check();await page.locator(`[data-pair="${ids[i]}"]`).selectOption(String(ids[i+4]))}
  await page.locator('#cpreview').click();await page.locator('#cgenerate').waitFor();await noOverflow();await page.locator('#cgenerate').click();await page.locator('[data-brfx]').first().click();
  assert.equal(await page.locator('#smash-format').inputValue(),'doubles');assert(await page.locator('#smash-partner1').isDisabled());await page.locator('#smash-best').selectOption('1');
  await score(0,6,5);for(const side of ['a','b'])for(const slot of [0,1])await pick(0,side,slot,slot?'01':'04e');await stage(0,'T&C');await page.locator('#rsend').click();await page.locator('#mapp').waitFor();await page.locator('#mapp').click();await page.locator('#panel .tag.lock').waitFor();
  await tab('leagues');await page.getByRole('heading',{name:'Smash doubles cup'}).click();await page.locator('.bracket .smash-scorecard').waitFor();await noOverflow();
  for(const colorScheme of ['dark','light']){await page.emulateMedia({colorScheme});await tab('record');await noOverflow()}
  await page.reload();await page.locator('.smash-scorecard').first().waitFor();assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  console.log('PASS Chromium: EA FC 26/27 red cards submit/correct/approve/reload; Smash best-of 1/3/5 singles/doubles, roster/stage pickers, review/correction, ratings, partner profile, paired double-elimination fixture, desktop/mobile and light/dark');
 }finally{if(browser)await browser.close();server.kill();await new Promise(r=>server.once('exit',r));fs.rmSync(work,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
