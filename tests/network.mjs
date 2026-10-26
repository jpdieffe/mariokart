import {chromium,devices} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from '../scripts/serve.mjs';
const server=process.env.MARIOKART_URL?null:createServer(4205),base=process.env.MARIOKART_URL||'http://127.0.0.1:4205/';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']}),errors=[];
await mkdir('test-results',{recursive:true});
try{
 const phone={...devices['Pixel 7'],viewport:{width:844,height:390},deviceScaleFactor:1};
 const host=await browser.newPage(process.env.PHONE_HOST?phone:{viewport:{width:1280,height:850}}),guest=await browser.newPage(phone);
 for(const p of[host,guest])p.on('pageerror',e=>errors.push(e.message));
 await host.goto(base+'?debug');if(process.env.BATTLE_MODE){await host.locator('#game-mode').selectOption('battle-teams');await host.locator('#arena-choice').selectOption('junction');}await host.locator('#host-button').click();await host.waitForFunction(()=>kart.memory&&kart.room?.peer?.open,{},{timeout:90000});
 const code=await host.evaluate(()=>kart.room.code);assert.equal(code.length,2);console.log('ROOM',code);
 if(!process.env.BATTLE_MODE){await host.locator('#levels-button').click();await host.getByRole('button',{name:'Play Original Balloon Battle',exact:true}).click();}
 await host.waitForFunction(()=>kart.memory.u(0x36)===14&&kart.memory.u(0x3a)===6);
 await guest.goto(base+'?debug#room='+code);await guest.locator('#join-button').click();await guest.waitForFunction(()=>document.querySelector('#remote-video').videoWidth>0,{},{timeout:45000});
 assert.equal(await guest.evaluate(()=>window.EJS_emulator),undefined);
 const tracks=await guest.evaluate(()=>document.querySelector('#remote-video').srcObject.getTracks().map(t=>t.kind));assert.ok(tracks.includes('audio')&&tracks.includes('video'));
 if(await guest.locator('#resume-video').isVisible())await guest.locator('#resume-video').click();
 const before=await host.evaluate(()=>kart.memory.inspect());await guest.keyboard.down('KeyZ');await guest.waitForTimeout(1300);await guest.keyboard.up('KeyZ');
 const after=await host.evaluate(()=>kart.memory.inspect());assert.ok(Math.hypot(after.racers[1].x-before.racers[1].x,after.racers[1].y-before.racers[1].y)>12);if(!process.env.BATTLE_MODE)assert.ok(Math.hypot(after.racers[0].x-before.racers[0].x,after.racers[0].y-before.racers[0].y)<5);else{await guest.waitForFunction(()=>document.querySelector('#match-score').textContent.includes('CPU'));assert.equal(await guest.locator('#match-score span').count(),6);}
 await host.locator('#view-button').click();await guest.locator('#view-button').click();await guest.waitForFunction(()=>document.querySelector('#screen').classList.contains('driver-view'));
 await host.screenshot({path:'test-results/network-host.png'});await guest.screenshot({path:'test-results/network-guest.png'});
 console.log('PASS: guest receives original video/audio and independently drives native player two; both devices can use their own camera.');
 const third=await browser.newPage();await third.goto(base+'#room='+code);await third.locator('#join-button').click();await third.waitForFunction(()=>document.querySelector('#status').textContent.includes('already has two'),{},{timeout:30000});await third.close();
 await guest.evaluate(()=>kart.room.connection.close());await host.waitForFunction(()=>!kart.room.accepted);await guest.locator('#retry-button').click();
 await guest.waitForFunction(()=>kart.room?.accepted&&document.querySelector('#remote-video').videoWidth>0,{},{timeout:40000});
 const rejoined=await host.evaluate(()=>kart.memory.inspect());assert.equal(rejoined.phase,14);assert.equal(rejoined.track,22);
 assert.deepEqual(errors,[]);console.log('PASS: room capacity, native input release, and reconnection to the ongoing battle.');
}catch(e){console.error(e);for(const[i,p]of browser.contexts().flatMap(c=>c.pages()).entries()){try{console.error(await p.evaluate(()=>({status:document.querySelector('#status')?.textContent,state:window.kart?.memory?.inspect()})));await p.screenshot({path:`test-results/network-failure-${i}.png`});}catch{}}process.exitCode=1;}
finally{await browser.close();server?.close();}
