import {Browser} from 'happy-dom';
import assert from 'node:assert/strict';
const browser=new Browser({settings:{enableJavaScriptEvaluation:false,handleDisabledFileLoadingAsSuccess:true}});const page=browser.newPage();const root=`http://127.0.0.1:${process.argv[2]}`;
async function load(path){await page.goto(root+path);await page.waitUntilComplete();const html=await (await fetch(root+path)).text();for(const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){const src=m[1].match(/src="([^"]+)"/);if(src)page.evaluate(await (await fetch(root+src[1])).text());else if(!m[2].trim().startsWith('themeLink('))page.evaluate(m[2]);}await page.waitUntilComplete();}
try{
 await load('/login.html');await page.evaluate(`api('login',{body:{username:'mimo',password:'TestingOnly123'}})`);
 await load('/game.html?g=ea-fc-26');
 await page.evaluate(`go('record')`);await page.waitUntilComplete();
 assert.equal(page.evaluate(`document.querySelectorAll('.club-picker').length`),2,page.virtualConsolePrinter.readAsString());
 page.evaluate(`$('#k_gender1').value='women';$('#k_gender1').onchange();$('#k_t1').selectedIndex=1;$('#k_t1').onchange();$('#k_league2').value='La Liga';$('#k_league2').onchange();$('#k_t2').selectedIndex=1;$('#k_t2').onchange();$('#k_pens').checked=true;$('#k_pens').onchange({target:$('#k_pens')});$('#k_aet').checked=true;$('#k_p1').value=5;$('#k_p2').value=4;`);
 const input=page.evaluate(`KINDS.fifa.read()`);assert(input.team1.startsWith('women|'));assert(input.pens&&input.aet);assert.equal(input.pen1,5);assert.equal(page.evaluate(`$('#k_pw').hidden`),false);
 const demo=JSON.parse(process.argv[3]);
 await page.evaluate(`go('leagues',{league:${demo.league}})`);await page.waitUntilComplete();
 assert.equal(page.evaluate(`document.querySelectorAll('.bracket-round').length`),2,page.virtualConsolePrinter.readAsString());assert(page.evaluate(`$('#view').textContent.includes('2(5)–(4)2')`));
 const lid=await page.evaluate(`api('games/ea-fc-26/leagues',{body:{name:'DOM draw',kind:'tournament'}}).then(r=>r.id)`);
 await page.evaluate(`go('leagues',{league:${lid}})`);await page.waitUntilComplete();
 page.evaluate(`$('#cformat').value='knockout';${demo.players.slice(0,3).map(id=>`document.querySelector('[data-entrant="${id}"]').checked=true;`).join('')}`);
 await page.evaluate(`$('#cpreview').onclick()`);await page.waitUntilComplete();assert(page.evaluate(`!!$('#cgenerate')`),page.virtualConsolePrinter.readAsString());
 await page.evaluate(`$('#cgenerate').onclick()`);await page.waitUntilComplete();assert(page.evaluate(`$('#view').textContent.includes('Draw seeds · manual')`));
 await load('/settings.html?scope=ea-fc-26');assert(page.evaluate(`$('#csv').value.startsWith('gender,league,name,stars,code,icon')`));
 assert.equal(page.virtualConsolePrinter.readAsString(),'');
 console.log('PASS DOM interaction: club cascade, half-stars, penalty/extra-time fields, bracket summaries, draw preview/create, settings CSV; no script errors');
}finally{await browser.close();}
