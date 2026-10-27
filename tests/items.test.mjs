import test from 'node:test';
import assert from 'node:assert/strict';
import {ItemBlocks,RESPAWN_FRAMES} from '../site/items.js';
function fixture(){
 const b=new Uint8Array(131072),m={bytes:()=>b,u:p=>b[p]|b[p+1]<<8,w:(p,v)=>{b[p]=v;b[p+1]=v>>8;}};
 m.w(0x36,14);m.w(0x3a,6);m.w(0x124,22);b[0xbc0]=0x14;
 const cells=[1000,1001,1128,1129];cells.forEach((p,n)=>b[0x10000+p]=0xc0+n);
 const items=new ItemBlocks(m);items.tick();const block=items.blocks[0];
 function advance(n){for(let i=0;i<n;i++){m.w(0x1e20,0);m.w(0x38,m.u(0x38)+1);items.tick();}}
 return{m,b,items,block,advance};
}
test('a real footprint pickup consumes all four tiles once; jumping over it does not',()=>{
 const {items,block}=fixture();assert.equal(items.collect(block,6),null);
 assert.equal(items.collect({x:block.x+20,y:block.y}),null);
 assert.equal(items.collect(block),block);assert.equal(items.collect(block),null);assert.equal(items.available(block),false);
});
test('any kart camping blocks respawn; leaving starts a fresh five-second clear timer',()=>{
 const {items,block,m,advance}=fixture();items.collect(block);
 m.w(0x1410,0x2000);m.w(0x1418,block.x);m.w(0x141c,block.y);
 advance(RESPAWN_FRAMES+60);assert.equal(items.available(block),false);
 m.w(0x1418,block.x+80);advance(RESPAWN_FRAMES-1);assert.equal(items.available(block),false);
 m.w(0x1418,block.x);advance(1);m.w(0x1418,block.x+80);advance(RESPAWN_FRAMES-1);assert.equal(items.available(block),false);
 advance(1);assert.equal(items.available(block),true);
});
test('native pending updates are preserved and eliminated karts do not camp',()=>{
 const {items,block,m,advance}=fixture();m.w(0x1e20,123);assert.equal(items.collect(block),null);assert.equal(m.u(0x1e20),123);
 m.w(0x1e20,0);items.collect(block);m.w(0x1018,block.x);m.w(0x101c,block.y);advance(RESPAWN_FRAMES);assert.equal(items.available(block),true);
 m.w(0x36,4);items.tick();assert.equal(items.ready,false);assert.equal(items.blocks.length,0);
});
