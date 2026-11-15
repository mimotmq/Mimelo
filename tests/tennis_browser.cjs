// Run with an installed Playwright module; all test data lives in a temporary directory.
const {chromium}=require(process.env.MIMELO_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const {spawn}=require('node:child_process');
(async()=>{
 const work=fs.mkdtempSync(path.join(os.tmpdir(),'mimelo-tennis-browser-')),root=path.resolve(__dirname,'..');
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
  async function record(format,best){await tab('record');await page.locator('#tennis-format').selectOption(format);await page.locator('#f_p1').selectOption(String(ids[0]));await page.locator('#f_p2').selectOption(String(ids[1]));if(format==='doubles'){await page.locator('#tennis-partner1').selectOption(String(ids[2]));await page.locator('#tennis-partner2').selectOption(String(ids[3]))}await page.locator('#tennis-best').selectOption(String(best));}
  async function setScore(index,a,b,tba,tbb){await page.locator(`[data-set="${index}"][data-tennis-side="a"]`).fill(String(a));await page.locator(`[data-set="${index}"][data-tennis-side="b"]`).fill(String(b));if(tba!==undefined){await page.locator(`[data-set="${index}"][data-tennis-side="tb_a"]`).fill(String(tba));await page.locator(`[data-set="${index}"][data-tennis-side="tb_b"]`).fill(String(tbb))}}
  async function noOverflow(){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page has horizontal overflow')}
  await page.goto(base+'/game.html?g=tennis');await page.locator('[data-t=record]').waitFor();
  for(const width of [1440,390])for(const format of ['singles','doubles'])for(const best of [1,3,5]){
   await page.setViewportSize({width,height:1000});await record(format,best);assert.equal(await page.locator('#tennis-surface').inputValue(),'hardcourt');assert(await page.locator('#f_elo').isChecked());
   for(let i=0;i<Math.floor(best/2)+1;i++)await setScore(i,i===0?7:6,i===0?6:4,...(i===0?[9,7]:[]));
   await page.waitForFunction(()=>document.querySelector('#tennis-elo-preview').textContent.includes('Estimated Elo'));await noOverflow();
   assert.equal(await page.locator('#tennis-preview tbody tr').count(),2);assert.equal(await page.locator('#tennis-preview thead th').count(),Math.floor(best/2)+3);
  }
  if(process.env.MIMELO_SCREENSHOT_DIR){fs.mkdirSync(process.env.MIMELO_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.MIMELO_SCREENSHOT_DIR,'tennis-mobile.png'),fullPage:true})}
  await page.locator('#rsend').click();await page.locator('#mapp').waitFor();assert((await page.locator('#panel').textContent()).includes('Morgan'));
  await page.locator('#rejectReason').fill('Please correct the surface');await page.locator('#mreject').click();await page.getByText('Needs correction',{exact:true}).first().waitFor();
  await page.locator('#tennis-surface').selectOption('clay');await page.locator('#msave').click();await page.locator('#mapp').waitFor();await page.locator('#mapp').click();await page.locator('#panel .tag.lock').waitFor();
  await tab('review');await page.locator('#upd').click();await page.locator('#ru').filter({hasText:'Ratings rebuilt'}).waitFor();
  await tab('rankings');await page.locator('[data-tennis-ranking=doubles]').click();await page.waitForFunction(()=>document.querySelectorAll('#view tbody tr').length===4);
  await page.reload();await page.locator('[data-t=rankings]').waitFor();await tab('rankings');await page.locator('[data-tennis-ranking=doubles]').click();await page.waitForFunction(()=>document.querySelectorAll('#view tbody tr').length===4);
  await page.goto(base+`/player.html?id=${ids[2]}&g=tennis`);await page.locator('.tennis-profile-ratings').waitFor();assert((await page.locator('.tennis-profile-ratings').textContent()).includes('Doubles'));assert((await page.locator('.tennis-scorecard').textContent()).includes('Morgan'));await noOverflow();
  await page.goto(base+'/game.html?g=tennis');await page.locator('[data-t=leagues]').waitFor();await tab('leagues');
  await page.locator('#ln').fill('Browser doubles cup');await page.locator('#lk').selectOption('tournament');await page.locator('#lmk').click();await page.getByRole('heading',{name:'Browser doubles cup'}).click();
  await page.locator('#cmatchformat').selectOption('doubles');await page.locator('#celimination').selectOption('double');await page.locator('#cseed').selectOption('preseeded');
  for(let i=0;i<3;i++){await page.locator(`[data-entrant="${ids[i]}"]`).check();await page.locator(`[data-pair="${ids[i]}"]`).selectOption(String(ids[i+4]));await page.locator(`[data-seed="${ids[i]}"]`).fill(String(i+1))}
  await page.locator('#cpreview').click();await page.locator('#cgenerate').waitFor();await noOverflow();
  await page.locator('#celimination').selectOption('single');assert.equal(await page.locator('#cgenerate').count(),0,'Changed inputs must invalidate preview');await page.locator('#celimination').selectOption('double');
  await page.locator('#cpreview').click();await page.locator('#cgenerate').click();await page.getByText('Draw seeds · preseeded',{exact:false}).waitFor();
  await page.locator('[data-brfx]').first().click();assert.equal(await page.locator('#tennis-format').inputValue(),'doubles');assert(await page.locator('#tennis-partner1').isDisabled());assert(await page.locator('#f_p1').isDisabled());assert(await page.locator('#f_elo').isChecked());assert(await page.locator('#f_elo').isDisabled());
  await page.locator('#tennis-best').selectOption('1');await setScore(0,6,2);await page.locator('#rsend').click();await page.locator('#mapp').waitFor();await page.locator('#mapp').click();await page.locator('#panel .tag.lock').waitFor();
  await tab('leagues');await page.getByRole('heading',{name:'Browser doubles cup'}).click();await page.locator('.bracket').waitFor();assert((await page.locator('.bracket').textContent()).includes('Riley'));await noOverflow();
  for(const colorScheme of ['dark','light']){await page.emulateMedia({colorScheme});await record('doubles',5);await setScore(0,6,1);await noOverflow();assert((await page.locator('body').evaluate(el=>getComputedStyle(el).fontFamily)).includes('Gotham'))}
  // Other existing game entry points still boot.
  for(const slug of ['ea-fc-26','ea-fc-27','table-tennis','smash-ultimate']){await page.goto(base+'/game.html?g='+slug);await page.waitForFunction(()=>document.querySelector('#view').textContent.trim().length>0);await noOverflow()}
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  console.log('PASS Chromium: singles/doubles best-of 1/3/5 at desktop/mobile, tiebreaks, preview, rejection/resubmission, approval, published rankings/reload, partner profile, paired double-elimination creation and fixture recording, dark/light and other-game smoke checks');
 }finally{if(browser)await browser.close();server.kill();await new Promise(r=>server.once('exit',r));fs.rmSync(work,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
