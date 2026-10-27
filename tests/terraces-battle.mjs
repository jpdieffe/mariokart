import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {createServer} from '../scripts/serve.mjs';
const server=createServer(4217),browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']}),errors=[];
try{
 const p=await browser.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:4217/?debug');await p.locator('#game-mode').selectOption('battle-teams');await p.locator('#arena-choice').selectOption('terraces');await p.locator('#solo-button').click();await p.waitForFunction(()=>kart.battle?.ready&&kart.terrain?.frames>20,{},{timeout:90000});
 await p.evaluate(()=>{
  window.place=(p,x,y,angle=0)=>{for(const[o,v]of[[0x18,x],[0x1c,y],[0x16,0],[0x1a,0],[0x1f,0],[0x22,0],[0x24,0],[0x26,0],[0xea,0],[0xe8,0],[0x2a,angle],[0xa2,angle],[0xa4,angle],[0xfa,angle],[0xa0,0],[0xe2,0],[0x5a,0],[0x5c,0],[0x5e,0]])kart.memory.w(p+o,v);};
  const b=kart.battle,m=kart.memory;for(const r of b.racers.slice(3)){b.unlink(r.p);m.w(r.p+0x10,0);r.hp=0;}
  place(0x1000,900,900);place(0x1400,592,944);b.racers[2].path=[];b.racers[2].targetKey=null;
  kart.items.blocks=kart.items.blocks.filter(b=>kart.terrain.height(b.x,b.y)===56);
 });
 await p.waitForFunction(()=>kart.battle.racers[2].pickups>0,{},{timeout:30000});
 assert.equal(await p.evaluate(()=>kart.items.blocks.some(b=>!kart.items.available(b))),true);
 console.log('PASS bot climbs both ramps from ground level and consumes a real upper-platform item.');
 // Use the earned slot with a deterministic green shell and aligned target.
 // Positions/item type are fixtures; original item spawn, motion and damage run normally.
 await p.evaluate(()=>{const r=kart.battle.racers[2];place(0x1000,512,412);place(r.p,512,452);r.item=1;r.nextShot=0;r.targetKey=null;});
 await p.waitForFunction(()=>kart.battle.racers[0].hp<3,{},{timeout:15000});
 assert.ok(await p.evaluate(()=>kart.battle.racers[2].uses>0));
 console.log('PASS original green shell damages a native human kart on the upper floor.');
 await p.screenshot({path:'test-results/terraces-native-weapons.png'});
 // A second controlled shell fixture crosses a complete ground-to-terrace ramp.
 await p.waitForTimeout(2500);
 await p.evaluate(()=>{const r=kart.battle.racers[2];place(0x1000,592,615);place(r.p,592,850);r.item=1;r.nextShot=0;r.shotHoldUntil=0;r.targetKey=null;window.beforeRampHit=kart.battle.racers[0].hp;});
 await p.waitForFunction(()=>kart.battle.racers[0].hp<beforeRampHit,{},{timeout:12000});
 console.log('PASS original shell traverses the ramp and damages a kart on the next floor.');
 // Isolate the original human pickup and the anti-camping respawn rule upstairs.
 await p.evaluate(()=>{const b=kart.battle;b.tick=()=>{};for(const r of b.racers.filter(r=>!r.human)){if(kart.memory.u(r.p+0x10))b.unlink(r.p);kart.memory.w(r.p+0x10,0);}place(0x1000,900,900);});
 await p.waitForFunction(()=>kart.items.blocks.every(b=>kart.items.available(b)),{},{timeout:10000});
 await p.evaluate(()=>{kart.memory.w(0xd70,0);place(0x1000,488,466);});await p.keyboard.down('KeyZ');await p.waitForFunction(()=>!kart.items.available(kart.items.blocks.find(b=>b.x===488)),{},{timeout:8000});await p.keyboard.up('KeyZ');
 assert.ok(await p.evaluate(()=>kart.memory.u(0xd70)&0x8000));await p.evaluate(()=>place(0x1000,488,440));await p.waitForTimeout(5500);assert.equal(await p.evaluate(()=>kart.items.available(kart.items.blocks.find(b=>b.x===488))),false);
 await p.evaluate(()=>place(0x1000,900,900));await p.waitForTimeout(1500);assert.equal(await p.evaluate(()=>kart.items.available(kart.items.blocks.find(b=>b.x===488))),false);await p.waitForFunction(()=>kart.items.available(kart.items.blocks.find(b=>b.x===488)),{},{timeout:7000});
 console.log('PASS native upper-floor human pickup and respawn only after vacating the block.');
 // Switching to the original GP must release the terrain patch and BG override.
 await p.locator('#levels-button').click();await p.getByRole('button',{name:/Play Grand Prix/}).click();await p.waitForFunction(()=>kart.memory.u(0x36)===2&&kart.memory.u(0x3a)===6);
 assert.equal(await p.evaluate(()=>kart.terrain.active),false);assert.notEqual(await p.evaluate(()=>kart.memory.u(0x10f4)),0x52a9);assert.equal(await p.evaluate(()=>kart.memory.inspect().racers.filter(r=>r.active).length),8);assert.deepEqual(errors,[]);
 console.log('PASS original eight-racer GP still runs after leaving raised battle.');
}catch(e){for(const p of browser.contexts().flatMap(c=>c.pages())){console.error(JSON.stringify(await p.evaluate(()=>({status:document.querySelector('#status').textContent,state:kart.memory.inspect(),bots:kart.battle.racers,pool:[0x1a00,0x1a80,0x1b00,0x1b80].map(p=>Object.fromEntries([0x12,0x18,0x1c,0x20,0x22,0x24,0x60,0x62,0x6e].map(o=>[o.toString(16),kart.memory.u(p+o)])))})),null,2));await p.screenshot({path:'test-results/terraces-battle-failure.png'});}throw e;}finally{await browser.close();server.close();}
