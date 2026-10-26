import {chromium,devices} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from '../scripts/serve.mjs';
const server=createServer(4204),browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required','--enable-unsafe-swiftshader']}),errors=[];
await mkdir('test-results',{recursive:true});
try{
 const page=await browser.newPage({...devices['Pixel 7'],viewport:{width:844,height:390},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4204/?debug');await page.screenshot({path:'test-results/lobby-landscape.png',fullPage:true});
 await page.locator('#solo-button').click();await page.waitForFunction(()=>window.kart?.memory,{},{timeout:90000});
 await page.locator('#levels-button').click();await page.getByRole('button',{name:'Play Original Balloon Battle',exact:true}).click();
 await page.waitForFunction(()=>kart.memory.u(0x36)===14&&kart.memory.u(0x3a)===6);
 const before=await page.evaluate(()=>kart.memory.inspect().racers[0]);
 const cdp=await page.context().newCDPSession(page),gas=await page.locator('[data-button="0"]').boundingBox(),pad=await page.locator('#dpad').boundingBox();
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:gas.x+gas.width/2,y:gas.y+gas.height/2,id:1},{x:pad.x+pad.width*.9,y:pad.y+pad.height*.5,id:2}]});
 await page.waitForTimeout(900);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const after=await page.evaluate(()=>kart.memory.inspect().racers[0]);assert.ok(Math.hypot(after.x-before.x,after.y-before.y)>4);assert.notEqual(after.heading,before.heading);
 await page.locator('#view-button').click();await page.waitForFunction(()=>document.querySelector('#screen').classList.contains('driver-view'));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight),false);
 await page.screenshot({path:'test-results/driver-view-phone.png'});
 await page.locator('#levels-button').click();await page.getByRole('button',{name:'Play Grand Prix · 50cc',exact:true}).click();
 await page.waitForFunction(()=>kart.memory.u(0x36)===2&&kart.memory.u(0x2e)===0&&kart.memory.u(0x3a)===6);
 const gp=await page.evaluate(()=>kart.memory.inspect());assert.equal(gp.racers.filter(r=>r.active).length,8);
 await page.keyboard.down('KeyZ');await page.waitForTimeout(900);await page.keyboard.up('KeyZ');
 assert.ok(await page.evaluate(()=>kart.memory.inspect().racers[0].y)<gp.racers[0].y);
 await page.screenshot({path:'test-results/grand-prix-phone.png'});
 console.log('PASS: original two-player battle and Grand Prix, simultaneous touch gas/steering, individual view, and landscape fit.');
 await page.locator('#leave-button').click();await page.setViewportSize({width:393,height:852});await page.screenshot({path:'test-results/lobby-portrait.png',fullPage:true});
 assert.deepEqual(errors,[]);
}catch(e){for(const p of browser.contexts().flatMap(c=>c.pages())){console.error(await p.evaluate(()=>({status:document.querySelector('#status')?.textContent,state:window.kart?.memory?.inspect()})));await p.screenshot({path:'test-results/browser-failure.png'});}throw e;}
finally{await browser.close();server.close();}
