import test from 'node:test';
import assert from 'node:assert/strict';
import {ArenaWorld,floorAt,route,NODES} from '../site/arena-world.js';
import {validArenaFrame} from '../site/arena-net.js';
const frames=(w,n,input=0)=>{for(let i=0;i<n;i++)w.step(1/60,[input,0]);};
const quiet=w=>{w.bot=()=>0;};
test('drive from ground up a real ramp, then onto the upper deck; side walls block climbing',()=>{
 const w=new ArenaWorld();quiet(w);const k=w.karts[0];Object.assign(k,{x:24,z:68,angle:Math.PI});
 frames(w,135,1);assert(k.y>6.9&&k.z<32,JSON.stringify(k));assert(k.y<7.1);
 Object.assign(k,{x:0,z:31,y:7,speed:0,angle:Math.PI,grounded:true});frames(w,115,1);assert(k.y>=14);assert(k.z<6);
 Object.assign(k,{x:0,z:38,y:0,speed:0,angle:Math.PI,grounded:true});frames(w,180,1);assert(k.z>=32);assert.equal(k.y,0);
});
test('dropping off a deck falls to ground; launch pad creates airborne travel',()=>{
 const w=new ArenaWorld();quiet(w);const k=w.karts[0];Object.assign(k,{x:34,z:0,y:7,angle:Math.PI/2,speed:26});
 frames(w,30,1);assert(k.x>38);assert(k.y<7&&k.y>0);frames(w,80,1);assert.equal(k.y,0);
 Object.assign(k,{x:29,z:17,y:7,speed:25,angle:Math.PI/2,grounded:true,pad:0});frames(w,15,1);assert(k.y>7&&k.vy>0);
});
test('navigation connects each floor through the ramps',()=>{
 for(const node of NODES){const p=route({x:-9,z:70,y:0},node);assert(p.length,`unreachable ${node.id}`);}
 const up=route({x:24,z:68,y:0},{x:8,z:-12,y:14});assert(up.some(p=>p.y===7));assert(up.some(p=>p.y===14));
});
test('one item per pickup, no camping respawn, earned ammunition for bots',()=>{
 const w=new ArenaWorld(true,()=>0);quiet(w);const k=w.karts[0],p=w.pickups[0];Object.assign(k,{x:p.x,z:p.z,y:p.y});
 frames(w,1);assert.equal(k.item,'green shell');assert.equal(p.ready,false);w.fire(k);assert.equal(k.item,null);assert.equal(w.shots.length,1);w.fire(k);assert.equal(w.shots.length,1);
 frames(w,360);assert.equal(p.ready,false);k.x+=7;frames(w,290);assert.equal(p.ready,false);frames(w,12);assert.equal(p.ready,true);
 const bot=w.karts[2],picked=bot.picked,fired=bot.fired;Object.assign(bot,{x:p.x,z:p.z,y:p.y,item:null});frames(w,1);assert.equal(bot.item,'green shell');w.fire(bot);assert.equal(bot.item,null);assert.equal(bot.picked,picked+1);assert.equal(bot.fired,fired+1);
});
test('shells cannot hit another floor or a co-op teammate',()=>{
 const w=new ArenaWorld();quiet(w);w.guestActive(true);const [a,b]=w.karts;Object.assign(a,{x:0,z:65,y:0,angle:0,inv:0});Object.assign(b,{x:0,z:70,y:0,inv:0});a.item='green shell';w.fire(a);frames(w,15);assert.equal(b.hp,3);
 const enemy=w.karts[2];Object.assign(enemy,{x:0,z:70,y:8,vy:0,grounded:false,inv:0});a.item='green shell';w.fire(a);frames(w,2);assert.equal(enemy.hp,3);
 Object.assign(enemy,{x:0,z:70,y:0,grounded:true,inv:0});a.item='green shell';w.fire(a);frames(w,10);assert.equal(enemy.hp,2);
});
test('bots find boxes and spend pickups in an unassisted simulation',()=>{
 const w=new ArenaWorld(true,()=>0);frames(w,60*90);const bots=w.karts.slice(2);assert(bots.every(k=>k.picked>0),JSON.stringify(bots.map(k=>({id:k.id,picked:k.picked,x:k.x,z:k.z}))));assert(bots.some(k=>k.fired>0));assert(bots.every(k=>k.fired<=k.picked));
});
test('a bot drives both ramps from ground to a sky-deck pickup',()=>{
 const w=new ArenaWorld(true,()=>0);w.pickups=w.pickups.slice(10);for(const k of w.karts.slice(3))k.active=false;
 const k=w.karts[2];Object.assign(k,{x:24,z:68,y:0,angle:Math.PI});let height=0;
 for(let i=0;i<60*40;i++){w.step(1/60);height=Math.max(height,k.y);}
 assert.equal(height,14);assert(k.picked>0,'bot reached and collected an upper-floor box');assert(k.fired<=k.picked);
});
test('snapshots validate, malformed payloads fail, rematch resets and keeps guest',()=>{
 const w=new ArenaWorld();w.guestActive(true);frames(w,240);assert(validArenaFrame(w.snapshot()));const bad=w.snapshot();bad.karts[0].x=NaN;assert.equal(validArenaFrame(bad),false);w.karts[0].hp=0;frames(w,1);w.reset();assert(w.karts[1].active);assert(w.karts.every(k=>k.hp===3&&k.item===null));assert.equal(w.winner,null);
});
