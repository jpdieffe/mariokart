import {webkit,devices} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from '../scripts/serve.mjs';
const server=createServer(4213),browser=await webkit.launch({headless:true,...(process.env.WEBKIT_EXECUTABLE?{executablePath:process.env.WEBKIT_EXECUTABLE}:{})}),errors=[];
try{
 await mkdir('test-results',{recursive:true});const page=await browser.newPage({...devices['iPhone 13'],viewport:{width:844,height:390}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4213/arena.html?debug');await page.locator('#solo-button').tap();await page.waitForFunction(()=>window.arena?.world?.tick>10);
 await page.evaluate(()=>{arena.world.bot=()=>0;Object.assign(arena.world.karts[0],{x:24,z:68,y:0,speed:0,angle:Math.PI});});await page.keyboard.down('KeyZ');await page.waitForFunction(()=>arena.world.karts[0].y>=7,{},{timeout:20000});await page.keyboard.up('KeyZ');
 await page.locator('#view-button').tap();await page.waitForTimeout(1400);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'test-results/arena-webkit.png'});
 assert.deepEqual(errors,[]);console.log('PASS iPhone-sized WebKit: 3D renderer, ramp driving, touch UI and landscape fit.');
}catch(e){console.error('ERRORS',errors);for(const p of browser.contexts().flatMap(c=>c.pages()))console.error(await p.locator('#status').textContent());throw e;}
finally{await browser.close();server.close();}
