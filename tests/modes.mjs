import {chromium,devices} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from '../scripts/serve.mjs';
const server=process.env.MARIOKART_URL?null:createServer(4207),base=process.env.MARIOKART_URL||'http://127.0.0.1:4207/';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required','--enable-unsafe-swiftshader']}),errors=[];
await mkdir('test-results',{recursive:true});
try{
 for(const [mode,arena] of [['battle-teams','courtyard'],['battle-bots','junction'],['team-gp','original']]){
  const page=await browser.newPage({...devices['Pixel 7'],viewport:{width:844,height:390},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'?debug');await page.locator('#game-mode').selectOption(mode);if(mode!=='team-gp')await page.locator('#arena-choice').selectOption(arena);
  await page.locator('#solo-button').click();await page.waitForFunction(()=>window.kart?.memory,{},{timeout:90000});
  await page.waitForFunction(()=>kart.memory.u(0x3a)===6&&[2,14].includes(kart.memory.u(0x36)));
  if(mode==='team-gp'){
   assert.equal(await page.evaluate(()=>kart.memory.inspect().racers.filter(r=>r.active).length),8);
   await page.evaluate(()=>{kart.memory.w(0x10f0,9);kart.memory.w(0x11f0,6);});await page.waitForFunction(()=>document.querySelector('#match-score').textContent.includes('15 pts'));
   console.log('PASS: native two-player GP with six CPUs and combined team scoring.');
  }else{
   await page.waitForFunction(()=>kart.battle?.ready);const before=await page.evaluate(()=>kart.memory.inspect());
   assert.equal(before.racers.filter(r=>r.active).length,6);assert.equal(await page.evaluate(()=>kart.battle.state().racers.filter(r=>!r.player).length),4);
   await page.waitForTimeout(2200);const after=await page.evaluate(()=>kart.memory.inspect());
   assert.ok(after.racers.slice(4).some((r,i)=>Math.hypot(r.x-before.racers[i+4].x,r.y-before.racers[i+4].y)>4),JSON.stringify({before:before.racers.slice(4),after:after.racers.slice(4)}));
   await page.locator('#view-button').click();await page.waitForFunction(()=>document.querySelector('#screen').classList.contains('driver-view'));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight),false);
   await page.screenshot({path:`test-results/${mode}-${arena}.png`});
   if(mode==='battle-teams'){
    // No synthetic hits: native shells must eliminate both idle humans.
    await page.waitForFunction(()=>kart.battle.winner,{},{timeout:60000});assert.equal(await page.evaluate(()=>kart.battle.winner),'Bot team wins!');
    const frame=await page.evaluate(()=>kart.memory.u(0x38));await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>kart.memory.u(0x38)),frame);
    await page.locator('#rematch-button').click();await page.waitForFunction(()=>kart.battle.ready&&!kart.battle.winner);
    assert.deepEqual(await page.evaluate(()=>kart.battle.state().racers.map(r=>r.hp)),[3,3,3,3,3,3]);
    // Exercise the opposite result and native actor removal deterministically.
    await page.evaluate(()=>{for(const r of kart.battle.racers.filter(r=>!r.human))for(let n=0;n<3;n++){r.hitAt=-10000;kart.battle.hurt(r);}});
    await page.waitForFunction(()=>kart.battle.winner==='Your team wins!');
    console.log('PASS: native shell damage, both team outcomes, paused finish and clean rematch.');
   }else{
    assert.equal(await page.evaluate(()=>new Set(kart.battle.state().racers.map(r=>r.team)).size),6);
    console.log('PASS: six-way battle with four moving native bots on Jump Junction.');
    await page.locator('#levels-button').click();await page.getByRole('button',{name:/Play Grand Prix/}).click();
    await page.waitForFunction(()=>kart.memory.u(0x36)===2&&kart.memory.u(0x3a)===6);
    assert.equal(await page.evaluate(()=>kart.memory.inspect().racers.filter(r=>r.active).length),8);assert.equal(await page.evaluate(()=>kart.battle.ready),false);
    const gpY=await page.evaluate(()=>kart.memory.u(0x141c));await page.waitForTimeout(1200);assert.notEqual(await page.evaluate(()=>kart.memory.u(0x141c)),gpY);
    console.log('PASS: switching from extended battle to native GP preserves CPU driving.');
   }
  }
  await page.close();
 }
 assert.deepEqual(errors,[]);
}catch(e){for(const p of browser.contexts().flatMap(c=>c.pages())){console.error(await p.evaluate(()=>({status:document.querySelector('#status')?.textContent,state:window.kart?.memory?.inspect(),battle:window.kart?.battle?.state()})));await p.screenshot({path:'test-results/modes-failure.png'});}throw e;}
finally{await browser.close();server?.close();}
