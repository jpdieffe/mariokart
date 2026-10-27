import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {createServer} from '../scripts/serve.mjs';
const server=process.env.MARIOKART_URL?null:createServer(4211),base=process.env.MARIOKART_URL||'http://127.0.0.1:4211/';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required','--enable-unsafe-swiftshader']}),errors=[];
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'?debug');await page.locator('#arena-choice').selectOption('courtyard');await page.locator('#solo-button').click();await page.waitForFunction(()=>window.kart?.items,{},{timeout:90000});
 await page.locator('#levels-button').click();await page.getByRole('button',{name:'Play Grand Courtyard',exact:true}).click();await page.waitForFunction(()=>kart.items.ready);
 const block=await page.evaluate(()=>kart.items.blocks.find(b=>b.x===504&&b.y===504));assert.ok(block);
 await page.evaluate(()=>{const m=kart.memory;m.w(0x1018,504);m.w(0x101c,535);m.w(0x102a,0);m.w(0x10ea,0);m.w(0x1020,0);});
 await page.keyboard.down('KeyZ');await page.waitForFunction(()=>!kart.items.available(kart.items.blocks.find(b=>b.x===504&&b.y===504)));await page.keyboard.up('KeyZ');
 assert.ok(await page.evaluate(()=>kart.memory.u(0xd70)&0x8000),'native human received an item');
 await page.evaluate(()=>{const m=kart.memory;m.w(0x1018,504);m.w(0x101c,504);m.w(0x10ea,0);});
 await page.waitForTimeout(5500);assert.equal(await page.evaluate(()=>kart.items.available(kart.items.blocks.find(b=>b.x===504&&b.y===504))),false);
 await page.evaluate(()=>{kart.memory.w(0x1018,600);kart.memory.w(0x101c,600);});
 await page.waitForTimeout(1000);assert.equal(await page.evaluate(()=>kart.items.available(kart.items.blocks.find(b=>b.x===504&&b.y===504))),false);
 await page.waitForFunction(()=>kart.items.available(kart.items.blocks.find(b=>b.x===504&&b.y===504)),{},{timeout:7000});await page.waitForTimeout(150);
 const verifyMap=()=>{const s=EJS_emulator.gameManager.getState(),tag=t=>{const b=new TextEncoder().encode(t);for(let i=0;i<s.length-b.length;i++)if(b.every((v,j)=>s[i+j]===v))return i+b.length;throw Error('Missing state chunk');};const ram=tag('RAM:131072:'),vram=tag('VRA:065536:');return kart.items.blocks.every(b=>b.cells.every(p=>s[ram+0x10000+p]===s[vram+p*2]));};
 assert.equal(await page.evaluate(verifyMap),true,'native item graphics agree with collision map after respawn');
 await page.evaluate(()=>{const m=kart.memory;m.w(0xd70,0);m.w(0x1018,504);m.w(0x101c,535);m.w(0x102a,0);m.w(0x10ea,0);});
 await page.keyboard.down('KeyZ');await page.waitForFunction(()=>!kart.items.available(kart.items.blocks.find(b=>b.x===504&&b.y===504)));await page.keyboard.up('KeyZ');
 assert.ok(await page.evaluate(()=>kart.memory.u(0xd70)&0x8000));console.log('PASS: native human pickup, camping prevention, five-second respawn, visible tile restoration and second pickup.');
 await page.close();
 const bots=await browser.newPage();bots.on('pageerror',e=>errors.push(e.message));await bots.goto(base+'?debug');await bots.locator('#game-mode').selectOption('battle-teams');await bots.locator('#arena-choice').selectOption('courtyard');await bots.locator('#solo-button').click();await bots.waitForFunction(()=>window.kart?.battle?.ready,{},{timeout:90000});
 assert.ok(await bots.evaluate(()=>kart.battle.racers.slice(2).every(r=>r.item===null&&r.uses===0)));
 await bots.waitForFunction(()=>kart.battle.racers.slice(2).some(r=>r.pickups>0&&r.uses>0),{},{timeout:30000});
 await bots.waitForTimeout(12000);
 assert.ok(await bots.evaluate(()=>kart.battle.racers.slice(2).every(r=>r.uses<=r.pickups&&r.pickups-r.uses===(r.item===null?0:1))));
 assert.equal(await bots.evaluate(verifyMap),true,'bot consumption and respawn update original graphics');
 // Remove pickup opportunities after spending held items. Time alone must not refill them.
 await bots.evaluate(()=>{kart.items.blocks=[];for(const r of kart.battle.racers){r.item=null;kart.memory.w(r.p+0xf0,0);}});
 const uses=await bots.evaluate(()=>kart.battle.racers.map(r=>r.uses));await bots.waitForTimeout(4500);assert.deepEqual(await bots.evaluate(()=>kart.battle.racers.map(r=>r.uses)),uses);
 console.log('PASS: bots start empty, navigate to real blocks, spend one item per pickup, and cannot fire without another pickup.');assert.deepEqual(errors,[]);
}finally{await browser.close();server?.close();}
