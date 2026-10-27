// Check actual native frames, not just collision results. Fixtures only position
// karts and grant an item; firing, shell movement, falling and drawing stay native.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from '../scripts/serve.mjs';
const server=createServer(4221),browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
await mkdir('test-results/visual',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4221/?debug');
 await page.locator('#game-mode').selectOption('battle-teams');await page.locator('#arena-choice').selectOption('terraces');await page.locator('#solo-button').click();
 await page.waitForFunction(()=>kart.battle?.ready&&kart.terrain?.frames>20,{},{timeout:90000});
 await page.evaluate(()=>{
  kart.battle.tick=()=>{};
  for(const r of kart.battle.racers.filter(r=>!r.human)){kart.battle.unlink(r.p);kart.memory.w(r.p+0x10,0);}
  window.seed=kart.game.save();window.capture=null;
  window.place=(player,x,y,h=0,heading=0)=>{for(const[o,v]of[[0x18,x],[0x1c,y],[0x16,0],[0x1a,0],[0x1f,h*256],[0x26,0],[0x22,0],[0x24,0],[0xea,0],[0xe8,0],[0x2a,heading],[0xa2,heading],[0xa4,heading],[0xa0,h?2:0],[0xe2,h?0x8000:0],[0xf6,0xffff]])kart.memory.w(0x1000+player*256+o,v);};
  const t=kart.terrain,original=t.render.bind(t),src=document.createElement('canvas'),dst=document.createElement('canvas');src.width=dst.width=256;src.height=dst.height=224;
  const a=src.getContext('2d',{willReadFrequently:true}),b=dst.getContext('2d',{willReadFrequently:true});a.imageSmoothingEnabled=b.imageSmoothingEnabled=false;
  t.render=function(gl){
   original(gl);const c=window.capture;if(!c||c.frames.length>=c.limit)return;
   const m=kart.memory,player=c.view??c.player,p=0x1000+c.player*256,rect=t.sourceRect,canvas=kart.game.emulator.canvas;
   a.drawImage(canvas,rect[0]*canvas.width,rect[1]*canvas.height,rect[2]*canvas.width,rect[3]*canvas.height,0,0,256,224);b.drawImage(t.canvas,0,0);
   const raw=a.getImageData(0,0,256,224).data,out=b.getImageData(0,0,256,224).data;
   const shells=[0x1a00,0x1a80,0x1b00,0x1b80].filter(q=>(m.u(q+0x12)&0x8000)&&m.u(q+0x6a)===p&&m.u(q+0x70)===2).map(q=>{
    const sx=(m.u(q+(player?0x32:0x2c))+256)&65535,sy=(m.u(q+(player?0x34:0x2e))+256)&65535;
    let green=0,matched=0;
    for(let y=Math.max(player*112+24,sy-16);y<Math.min((player+1)*112-4,sy+2);y++)for(let x=Math.max(0,sx-12);x<Math.min(256,sx+12);x++){
     const i=(y*256+x)*4;if(raw[i]<80&&raw[i+1]>120&&raw[i+2]<100){green++;if(raw[i]===out[i]&&raw[i+1]===out[i+1]&&raw[i+2]===out[i+2])matched++;}
    }
    return{q,x:m.u(q+0x18),y:m.u(q+0x1c),init:m.u(q+0x6c),sx,sy,green,matched};
   });
   let driverPixels=0;
   for(let y=player*112+2;y<(player+1)*112-4;y++)for(let x=112;x<144;x++){const i=(y*256+x)*4;if(player===0?out[i]>160&&out[i+1]<90&&out[i+2]<90:out[i]<90&&out[i+1]>160&&out[i+2]<90)driverPixels++;}
   c.frames.push({frame:m.u(0x38),x:m.u(p+0x18),y:m.u(p+0x1c),jump:m.u(p+0x1f)/256,offset:m.u(p+0xf6),eye:t.camera(player).eye,shells,driverPixels,driverY:((m.u(p+(player?0x34:0x2e))+256)&65535)-player*112,image:t.canvas.toDataURL()});
  };
 });
 for(const player of [0,1]){
  for(const [name,x,y]of [['ground',700,850],['upper',512,452],['ramp',592,850],['other-view',700,800]]){
   await page.evaluate(()=>kart.game.load(seed));await page.waitForTimeout(200);
   await page.evaluate(({player,x,y,name})=>{if(name==='other-view')place(1-player,740,720,0,32768);else place(1-player,950,950);place(player,x,y);}, {player,x,y,name});
   await page.waitForTimeout(400);
   await page.evaluate(({player,name})=>{kart.memory.w(0xd70+player*2,0xc004);kart.memory.w(0xd78+player*2,0);window.capture={player,view:name==='other-view'?1-player:player,frames:[],limit:24};kart.game.input(player,1<<8);},{player,name});
   await page.waitForFunction(()=>capture.frames.length>=8);await page.evaluate(player=>kart.game.input(player,0),player);
   await page.waitForFunction(()=>capture.frames.length>=24);
   const frames=await page.evaluate(()=>capture.frames);
   assert(Math.hypot(frames[0].x-x,frames[0].y-y)<4,'fixture must be in the requested floor/view, after async state load');
   await writeFile(`test-results/visual/shell-p${player}-${name}.json`,JSON.stringify(frames.map(({image,...r})=>r),null,2));
   for(const i of [6,12,18])await writeFile(`test-results/visual/shell-p${player}-${name}-${i}.png`,Buffer.from(frames[i].image.split(',')[1],'base64'));
   assert(frames.findIndex(f=>f.shells.length)>-1&&frames.findIndex(f=>f.shells.length)<8,`${name} player ${player}: shell spawns promptly`);
   const moving=frames.slice(6).flatMap(f=>f.shells).filter(s=>s.init===0);assert(moving.some(s=>Math.abs(s.y-y)>20),'native shell moves immediately');
   const visible=moving.filter(s=>s.green>=6);assert(visible.length>=5,`${name} player ${player}: native shell visible in successive frames`);
   for(const s of visible)assert(s.matched/s.green>.8,`${name} player ${player}: compositor lost shell pixels ${JSON.stringify(s)}`);
   console.log(`PASS player ${player+1} ${name}: immediate shell spawn, motion and visible native sprite (${visible.length} frames).`);
  }
  for(const [drop,x,y,jump,heading,speed]of [['lower',405,580,18,49152,0x500],['slow',386,580,6,49152,0x180],['upper',568,440,6,16384,0x500]]){
  await page.evaluate(()=>kart.game.load(seed));await page.waitForTimeout(200);
  await page.evaluate(({player,x,y,heading})=>{place(1-player,950,950);place(player,x,y,0,heading);},{player,x,y,heading});await page.waitForTimeout(400);
  await page.evaluate(({player,x,y,jump,heading,speed})=>{place(player,x,y,jump,heading);const p=0x1000+player*256;kart.memory.w(p+0xea,speed);kart.memory.w(p+0x22,heading===49152?65536-speed:speed);capture={player,frames:[],limit:75};kart.game.input(player,1);},{player,x,y,jump,heading,speed});
  await page.waitForFunction(()=>capture.frames.length>=75);await page.evaluate(player=>kart.game.input(player,0),player);
  const frames=await page.evaluate(()=>capture.frames),edge=frames.findIndex(f=>drop==='upper'?f.x>=576:f.x<384);assert(edge>0,'crossed the cliff');
  assert(Math.abs(frames[edge].eye[2]-frames[edge-1].eye[2])<3,'camera must not snap down inside the terrace');
  assert(frames[edge].jump>(drop==='upper'?20:30),'native kart retains world height over the lower floor');assert.equal(frames.at(-1).jump,0);
  assert.equal(frames.at(-1).offset,65535,'landing releases fall camera');
  assert(frames.every(f=>f.driverPixels>=5),'own native driver must remain visible throughout the fall');
  assert(frames.every(f=>f.driverY>=20&&f.driverY<112),'native own-driver anchor must remain inside its view');
  for(const i of [edge,edge+4,edge+8,edge+16,60])await writeFile(`test-results/visual/drop-p${player}-${drop}-${i}.png`,Buffer.from(frames[i].image.split(',')[1],'base64'));
  await writeFile(`test-results/visual/drop-p${player}-${drop}.json`,JSON.stringify(frames.map(({image,...r})=>r),null,2));
  console.log(`PASS player ${player+1} ${drop}: continuous cliff camera, native fall and landing.`);
  }
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();server.close();}
