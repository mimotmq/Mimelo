// The full interface is tested on a disposable database, never the live installation.
const {chromium}=require(process.env.MIMELO_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const {spawn}=require('node:child_process');
(async()=>{
 const work=fs.mkdtempSync(path.join(os.tmpdir(),'mimelo-book-ui-'));
 fs.symlinkSync(path.resolve(__dirname,'../static'),path.join(work,'static'),'dir');
 const port=await new Promise(resolve=>{const server=net.createServer().listen(0,'127.0.0.1',()=>{const p=server.address().port;server.close(()=>resolve(p))})});
 const server=spawn(path.resolve(process.argv[2]||'./mimelo'),[String(port)],{cwd:work,env:{...process.env,MIMELO_ADMIN_PASSWORD:'BrowserTest123'},stdio:'ignore'});
 let browser;
 try{
  const base=`http://127.0.0.1:${port}`;
  for(let i=0;i<100;i++){try{if((await fetch(base+'/api/games')).ok)break}catch{}await new Promise(r=>setTimeout(r,50))}
  browser=await chromium.launch({headless:true});const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),page=await ctx.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  async function api(p,body){const r=await ctx.request.fetch(base+'/api/'+p,{method:body?'POST':'GET',...(body?{data:body}:{})});assert(r.ok(),await r.text());return r.json()}
  async function ready(){await page.waitForFunction(()=>document.querySelector('#view')?.getAttribute('aria-busy')==='false')}
  async function tab(name){await page.locator(`[data-t=${name}]`).click();await ready()}
  async function noOverflow(){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal page overflow: '+page.url())}
  async function screenshot(name){if(process.env.MIMELO_SCREENSHOT_DIR){fs.mkdirSync(process.env.MIMELO_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.MIMELO_SCREENSHOT_DIR,name+'.png'),fullPage:true})}}
  await page.goto(base+'/login.html');await page.locator('#u').fill('mimo');await page.locator('#p').fill('BrowserTest123');await page.locator('#go').click();await page.waitForURL(base+'/');
  const names=['Alex Rivera','Jordan Blake','Morgan Chen','Sam Patel'];const ids=[];for(const name of names)ids.push((await api('users',{name})).id);
  for(let i=0;i<28;i++){
   const m=await api('games/tennis/matches',{p1:ids[0],p2:ids[1],format:'singles',best_of:1,surface:i%2?'grass':'hardcourt',sets:[{a:i%3?6:2,b:i%3?2:6}]});
   if(i<26)await api(`matches/${m.id}/approve`,{});
  }
  const doubles=await api('games/tennis/matches',{p1:ids[0],p2:ids[1],partner1:ids[2],partner2:ids[3],format:'doubles',best_of:1,sets:[{a:6,b:4}]});await api(`matches/${doubles.id}/approve`,{});await api('games/tennis/ratings/update',{});
  await api('games/tennis/leagues',{name:'Autumn Open',kind:'tournament'});
  await page.goto(base+'/game.html?g=tennis');await ready();assert.equal(await page.locator('[data-t=overview]').getAttribute('aria-selected'),'true');
  assert.deepEqual(await page.locator('.book-stat>strong').allTextContents(),['4','29','Alex Rivera','2']);await noOverflow();await screenshot('overview-desktop');
  assert(await page.locator('.book-page-head a.b').evaluate(el=>getComputedStyle(el).color!==getComputedStyle(el).backgroundColor),'Primary action must be readable');
  await tab('matches');assert(new URL(page.url()).searchParams.get('view')==='matches');
  assert((await page.locator('.book-pagination').textContent()).includes('1–25 of 29'));await page.locator('#matches-next').click();await ready();assert((await page.locator('.book-pagination').textContent()).includes('26–29 of 29'));
  await page.reload();await ready();assert((await page.locator('.book-pagination').textContent()).includes('26–29 of 29'));
  await page.locator('#match-search').fill('Morgan');await page.locator('#match-search-form button').click();await ready();assert((await page.locator('.book-pagination').textContent()).includes('1–1 of 1'));
  await page.goBack();await ready();assert((await page.locator('.book-pagination').textContent()).includes('26–29 of 29'));
  await page.locator('[data-f=pending]').click();await ready();assert((await page.locator('.book-pagination').textContent()).includes('1–2 of 2'));
  await page.locator('#clear-match-filters').click();await ready();await page.locator('#match-format-filter').selectOption('doubles');await ready();assert((await page.locator('.book-pagination').textContent()).includes('1–1 of 1'));
  await page.setViewportSize({width:390,height:900});await noOverflow();await screenshot('matches-mobile');
  await page.goto(base+`/player.html?id=${ids[2]}&g=tennis`);await page.locator('.profile-chart svg').waitFor();assert((await page.locator('.tennis-profile-ratings').textContent()).includes('Doubles'));assert((await page.locator('.tennis-scorecard').textContent()).includes('Morgan'));await noOverflow();await screenshot('profile-mobile');
  await page.setViewportSize({width:1440,height:1000});await page.goto(base+`/player.html?id=${ids[0]}&g=tennis`);await page.locator('.profile-chart svg').waitFor();await screenshot('profile-desktop');
  await page.locator('#profile-next').click();await page.waitForFunction(()=>document.querySelector('#main').getAttribute('aria-busy')==='false');assert((await page.locator('.book-pagination').textContent()).includes('21–28 of 28'));
  await page.locator('[data-profile-format=doubles]').click();await page.waitForFunction(()=>document.querySelector('#main').getAttribute('aria-busy')==='false');assert((await page.locator('.book-pagination').textContent()).includes('1–1 of 1'));
  await page.locator('.profile-history .panel-link').first().click();await page.locator('#panel:not([hidden])').waitFor();assert(new URL(page.url()).searchParams.has('match'));
  for(const game of ['ea-fc-26','ea-fc-27','tennis','smash-ultimate','table-tennis'])for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});await page.goto(base+'/game.html?g='+game);await ready();await noOverflow();await tab('players');await noOverflow();await tab('leagues');await noOverflow();
  }
  await page.goto(base+'/game.html?g=smash-ultimate&view=matches&status=rejected');await ready();assert.equal(await page.locator('[data-f=rejected]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-t=matches]').focus();await page.keyboard.press('ArrowRight');await ready();assert.equal(await page.locator('[data-t=rankings]').getAttribute('aria-selected'),'true');
  for(const colorScheme of ['light','dark']){
   await page.emulateMedia({colorScheme});for(const name of ['account','admin','settings','players']){await page.goto(base+'/'+name+'.html');await page.locator('#nav a').first().waitFor();await noOverflow()}
   await page.goto(base+'/game.html?g=tennis');await ready();await noOverflow();await screenshot('overview-mobile-'+colorScheme);
  }
  await page.goto(base+'/settings.html?scope=tennis');await page.locator('#body:not([hidden])').waitFor();
  await page.locator('#l_acc').fill('#2847a1');await page.locator('#d_acc').fill('#aabbff');await page.locator('#rad').fill('18');await page.locator('#save').click();await page.locator('#m1').filter({hasText:'Saved.'}).waitFor();
  for(const [scheme,accent] of [['light','#2847a1'],['dark','#aabbff']]){
   await page.emulateMedia({colorScheme:scheme});await page.goto(base+'/game.html?g=tennis');await ready();
   assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).getPropertyValue('--pitch').trim()),accent);
   assert.equal(await page.locator('.book-stat').first().evaluate(el=>getComputedStyle(el).borderRadius),'18px');
  }
  await api('logout',{});await page.goto(base+'/game.html?g=tennis&view=record');await ready();assert.equal(await page.locator('[data-t=review]').count(),0);assert((await page.locator('#view').textContent()).includes('log in'));
  assert.deepEqual(errors,[]);console.log('PASS live overview, searchable/paged matches, reload/back navigation, profile charts/formats/history, correction filter, keyboard tabs, five-game desktop/mobile, utility pages and guest permissions');
 }finally{if(browser)await browser.close();server.kill();await new Promise(r=>server.once('exit',r));fs.rmSync(work,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
