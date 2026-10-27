import {chromium,devices} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from '../scripts/serve.mjs';
const server=process.env.MARIOKART_URL?null:createServer(4212),base=process.env.MARIOKART_URL||'http://127.0.0.1:4212/';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']}),errors=[];
await mkdir('test-results',{recursive:true});
try{
 const phone={...devices['Pixel 7'],viewport:{width:844,height:390},deviceScaleFactor:1};
 const host=await browser.newPage(process.env.PHONE_HOST?phone:{viewport:{width:1360,height:900}}),guest=await browser.newPage(phone);
 for(const p of[host,guest])p.on('pageerror',e=>errors.push(e.message));
 await host.goto(base+'arena.html?debug');await host.locator('#host-button').click();await host.waitForFunction(()=>arena.world&&arena.room?.peer?.open,{},{timeout:40000});
 await host.evaluate(()=>{arena.world.bot=()=>0;});
 const code=await host.evaluate(()=>arena.room.code);assert.equal(code.length,2);console.log('3D ROOM',code);
 await guest.goto(base+'arena.html?debug#room='+code);await guest.locator('#join-button').click();await guest.waitForFunction(()=>arena.state?.karts[1].active,{},{timeout:45000});
 assert.equal(await guest.evaluate(()=>arena.world),null);assert.equal(await guest.evaluate(()=>arena.room.call),undefined);
 const before=await host.evaluate(()=>arena.world.karts[1].z);await guest.keyboard.down('KeyZ');await guest.waitForTimeout(1200);await guest.keyboard.up('KeyZ');
 const after=await host.evaluate(()=>arena.world.karts[1].z);assert(after<before-8,`${before} -> ${after}`);
 await guest.waitForFunction(()=>Math.abs(arena.state.karts[1].z-70)>8);
 console.log('PASS guest drives host-authoritative Luigi with a local independent renderer.');
 // Drive both actual ramp elevations with ordinary inputs, from a reproducible start.
 await host.evaluate(()=>Object.assign(arena.world.karts[0],{x:24,z:68,y:0,speed:0,angle:Math.PI,grounded:true}));
 await host.keyboard.down('KeyZ');await host.waitForFunction(()=>arena.world.karts[0].y>=7,{},{timeout:12000});await host.keyboard.up('KeyZ');
 await host.evaluate(()=>Object.assign(arena.world.karts[0],{x:0,z:31,y:7,speed:0,angle:Math.PI,grounded:true}));
 await host.keyboard.down('KeyZ');await host.waitForFunction(()=>arena.world.karts[0].y>=14,{},{timeout:12000});await host.keyboard.up('KeyZ');
 await guest.waitForFunction(()=>arena.state.karts[0].y>=14);
 await host.locator('#view-button').click();await host.waitForTimeout(1600);await host.screenshot({path:'test-results/arena-overview.png'});
 await guest.screenshot({path:'test-results/arena-phone.png'});
 assert.equal(await guest.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 // Simultaneous touch gas and steering, then release all input.
 const gas=await guest.locator('.gas').boundingBox(),pad=await guest.locator('#dpad').boundingBox();const cdp=await guest.context().newCDPSession(guest);
 const touches=[{x:gas.x+gas.width/2,y:gas.y+gas.height/2,id:1},{x:pad.x+pad.width*.9,y:pad.y+pad.height/2,id:2}];
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touches});await host.waitForFunction(()=>(arena.inputs[1]&129)===129);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await host.waitForFunction(()=>arena.inputs[1]===0);
 console.log('PASS ramps climb 0 -> 7 -> 14 metres, state reaches guest, mobile multitouch and fit.');
 const third=await browser.newPage();await third.goto(base+'arena.html#room='+code);await third.locator('#join-button').click();await third.waitForFunction(()=>document.querySelector('#status').textContent.includes('already has two'),{},{timeout:30000});await third.close();
 const oldTick=await host.evaluate(()=>arena.world.tick);await guest.evaluate(()=>arena.room.connection.close());await host.waitForFunction(()=>!arena.world.karts[1].active);await guest.locator('#retry-button').click();await guest.waitForFunction(()=>arena.room.accepted&&arena.state?.karts[1].active,{},{timeout:40000});assert((await host.evaluate(()=>arena.world.tick))>=oldTick);
 await host.evaluate(()=>{for(const k of arena.world.karts.slice(2))k.hp=0;});await guest.waitForFunction(()=>arena.state.winner==='Your team wins!');await host.locator('#rematch-button').click();await guest.waitForFunction(()=>!arena.state.winner&&arena.state.karts.every(k=>k.hp===3));
 assert.deepEqual(errors,[]);console.log('PASS capacity, reconnect without resetting host, co-op result and rematch.');
}catch(e){console.error(e);for(const[i,p]of browser.contexts().flatMap(c=>c.pages()).entries()){try{console.error(await p.evaluate(()=>({status:document.querySelector('#status')?.textContent,frame:window.arena?.state})));await p.screenshot({path:`test-results/arena-failure-${i}.png`});}catch{}}process.exitCode=1;}
finally{await browser.close();server?.close();}
