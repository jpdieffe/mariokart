import test from 'node:test';
import assert from 'node:assert/strict';
import {terrainMesh,floorHeight,cameraFloor} from '../site/terrain-geometry.js';
import {NativeTerrain} from '../site/native-terrain.js';

test('raised terrain has exposed outward walls and no buried ramp end caps',()=>{
 for(const {wall,vertices:v} of terrainMesh()){
  const a=v[0],b=v[1],c=v[2],u=b.map((n,i)=>n-a[i]),w=c.map((n,i)=>n-a[i]);
  const normal=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];
  if(!wall){assert(normal[2]>0);continue;}
  const x=v.reduce((n,p)=>n+p[0],0)/4,y=v.reduce((n,p)=>n+p[1],0)/4;
  const length=Math.hypot(...normal);if(!length)continue;
  const dx=normal[0]/length*.01,dy=normal[1]/length*.01;
  const inside=floorHeight(x-dx,y-dy),outside=floorHeight(x+dx,y+dy);
  assert(inside>outside,`wall must face downhill at ${x},${y}`);
  assert(Math.min(...v.map(p=>p[2]))>=outside-1,'no buried wall below the adjacent floor');
 }
});

test('second-camera sprite depth starts at its own list head and follows native screen coordinates',()=>{
 const words=new Map([[0xb0,0xb0],[0xb4,0xb4],[0xbc,0x1a00],[0x1a08,0xb4],
  [0x1a18,20],[0x1a1c,100],[0x1a32,0xff00+200],[0x1a34,0xff00+185]]);
 const t={m:{u:a=>words.get(a)||0},depths:new Float32Array(256*224),depthPixels:new Uint8Array(256*224*4),height:()=>0,
  camera:()=>({eye:[0,0,0],forward:[0,1,0],right:[1,0,0],down:[0,0,-1],focal:256,origin:102})};
 NativeTerrain.prototype.spriteDepth.call(t);
 assert.equal(t.depths[180*256+200],100,'shell outside own-driver overlay retains its depth in player two view');
 assert.equal(t.depths[68*256+200],4095,'player one list must stay independent');
 words.set(0x1a32,0xff00-2);NativeTerrain.prototype.spriteDepth.call(t);
 assert.equal(t.depths[180*256],100,'partially offscreen native sprites keep their visible edge');
});

test('fall camera preserves world height at a cliff and converges to the landing floor',()=>{
 for(const player of [0,1]){
  const p=0x1000+player*256,words=new Map([[p+0x18,380],[p+0x1c,580],[p+0xf6,18*256],[p+0x1f,50*256]]),m={u:a=>words.get(a)||0};
  assert.equal(cameraFloor(m,player),32);
  words.set(p+0x1f,34*256);assert.equal(cameraFloor(m,player),16);
  words.set(p+0x1f,10*256);assert.equal(cameraFloor(m,player),0);
  words.set(p+0xf6,0xffff);assert.equal(cameraFloor(m,player),0);
 }
});
