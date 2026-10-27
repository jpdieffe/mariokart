// Shared geometry, host-only simulation, and bounded wire snapshots for Sky Plaza.
export const SIZE = 88;
export const COLORS = [0xeb4b40,0x30bc7b,0xf4b83f,0xa787f5,0x3bb7e7,0xf47ca3];
export const NAMES = ['Mario','Luigi','Gold CPU','Violet CPU','Blue CPU','Pink CPU'];
export const ITEMS = ['green shell','red shell','banana','boost'];
export const TERRAIN = [
  {id:'terrace',x:-38,z:-32,w:76,d:64,h:7,color:0x56af9f},
  {id:'sky',x:-14,z:-22,w:28,d:28,h:14,color:0xf5c254},
  {id:'west',x:-70,z:10,w:32,d:12,h:0,end:7,axis:'x',color:0xffa65d},
  {id:'east',x:38,z:-22,w:32,d:12,h:7,end:0,axis:'x',color:0xffa65d},
  {id:'north',x:-30,z:-64,w:12,d:32,h:0,end:7,axis:'z',color:0xffa65d},
  {id:'south',x:18,z:32,w:12,d:32,h:7,end:0,axis:'z',color:0xffa65d},
  {id:'summit',x:-10,z:6,w:20,d:24,h:14,end:7,axis:'z',color:0xff9960},
];
export function heightOn(t,x,z) {
  return t.h + (t.axis ? (t.end-t.h)*(t.axis==='x'?(x-t.x)/t.w:(z-t.z)/t.d) : 0);
}
export function floorAt(x,z) {
  let h=0;
  for(const t of TERRAIN) if(x>=t.x&&x<=t.x+t.w&&z>=t.z&&z<=t.z+t.d)h=Math.max(h,heightOn(t,x,z));
  return h;
}
export const PADS = [{x:0,z:-19,y:14,angle:Math.PI},{x:34,z:17,y:7,angle:Math.PI/2},{x:-34,z:-17,y:7,angle:-Math.PI/2}];
export const PICKUPS = [[-54,40],[52,44],[-52,-43],[52,-43],[0,65],[0,-70],[-30,0],[30,0],[-22,23],[23,-25],[-8,-12],[8,-12]].map(([x,z],id)=>({id,x,z,y:floorAt(x,z),ready:true,clear:0}));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
// Explicit links describe ramps; same-level visible links fill in each driving floor.
const coords=[[-76,-72],[-24,-68],[76,-72],[74,-16],[76,72],[24,68],[-76,72],[-74,16],[-24,-28],[-34,16],[24,28],[34,-16],[-24,0],[24,0],[-24,25],[24,-25],[0,31],[0,3],[0,-12],[-8,-12],[8,-12],[-54,40],[52,44],[-52,-43],[52,-43],[0,65],[0,-70],[-30,0],[30,0],[-22,23],[23,-25]];
export const NODES=coords.map(([x,z],id)=>({id,x,z,y:floorAt(x,z),links:[]}));
export function clearPath(a,b) {
  const n=Math.ceil(dist(a,b)/2);
  for(let i=1;i<=n;i++) {
    const f=i/n,h=floorAt(a.x+(b.x-a.x)*f,a.z+(b.z-a.z)*f);
    if(Math.abs(h-(a.y+(b.y-a.y)*f))>0.8)return false;
  }
  return true;
}
for(let i=0;i<NODES.length;i++) for(let j=i+1;j<NODES.length;j++) {
  const a=NODES[i],b=NODES[j];
  if(Math.abs(a.y-b.y)<.1&&clearPath(a,b)){a.links.push(j);b.links.push(i);}
}
for(const [a,b] of [[1,8],[3,11],[5,10],[7,9],[16,17]]){NODES[a].links.push(b);NODES[b].links.push(a);}
export function route(a,b) {
  if(clearPath(a,b))return [b];
  // Connect the current position to every visible waypoint, including ramp
  // endpoints. A mid-ramp replan must not send a bot back to the nearest floor.
  const costs=NODES.map(n=>clearPath(a,n)?dist(a,n):Infinity),prev=NODES.map(()=>-1),todo=new Set(NODES.map(n=>n.id));
  while(todo.size){const id=[...todo].sort((c,d)=>costs[c]-costs[d])[0];todo.delete(id);if(costs[id]===Infinity)break;
    for(const j of NODES[id].links){const c=costs[id]+dist(NODES[id],NODES[j]);if(c<costs[j]){costs[j]=c;prev[j]=id;}}
  }
  const end=NODES.filter(n=>Number.isFinite(costs[n.id])&&clearPath(n,b)).sort((c,d)=>costs[c.id]+dist(c,b)-costs[d.id]-dist(d,b))[0];if(!end)return [];
  const path=[end];while(prev[path[0].id]!==-1)path.unshift(NODES[prev[path[0].id]]);return [...path,b];
}
function kart(id) {
  const [x,z,angle]=[[-9,70,Math.PI],[9,70,Math.PI],[-52,-45,0],[52,-45,0],[-30,0,Math.PI/2],[8,-12,Math.PI]][id];
  return {id,x,z,y:floorAt(x,z),angle,speed:0,vy:0,hp:3,item:null,active:id!==1,grounded:true,inv:2,boost:0,stun:0,lastMask:0,pad:0,brain:0,path:[],picked:0,fired:0};
}
export class ArenaWorld {
  constructor(teams=true,random=Math.random){this.teams=teams;this.random=random;this.reset();}
  reset(){this.time=0;this.tick=0;this.winner=null;this.karts=Array.from({length:6},(_,i)=>kart(i));this.karts[1].active=!!this.guest;this.pickups=PICKUPS.map(p=>({...p}));this.shots=[];this.effects=[];this.shotId=0;}
  guestActive(active){this.guest=active;this.karts[1].active=active;}
  enemy(a,b){return a.id!==b.id&&b.active&&b.hp>0&&(!this.teams||(a.id<2)!==(b.id<2));}
  hit(k){if(k.inv>0||!k.hp)return;k.hp--;k.inv=1.8;k.stun=.7;k.speed*=-.3;this.effects.push({x:k.x,y:k.y+2,z:k.z,life:.6});}
  fire(k){
    if(!k.item||k.hp<=0)return;
    const type=k.item;k.item=null;k.fired++;
    if(type==='boost'){k.boost=1.6;return;}
    const back=type==='banana',off=back?-3.5:3.5;
    this.shots.push({id:this.shotId++,owner:k.id,type,x:k.x+Math.sin(k.angle)*off,z:k.z+Math.cos(k.angle)*off,y:k.y+.8,angle:k.angle,vy:k.vy,life:back?18:6});
  }
  bot(k,dt){
    k.brain-=dt;
    const enemies=this.karts.filter(p=>this.enemy(k,p));
    const target=enemies.sort((a,b)=>dist(k,a)+Math.abs(k.y-a.y)*8-dist(k,b)-Math.abs(k.y-b.y)*8)[0];
    if(k.brain<=0||!k.path.length){
      k.brain=.7+k.id*.07;
      const goals=k.item?(target?[target]:[]):this.pickups.filter(p=>p.ready);
      const paths=goals.map(p=>route(k,p)).filter(p=>p.length).sort((a,b)=>this.pathLength(k,a)-this.pathLength(k,b));
      k.path=paths[0]||route(k,NODES[(k.id*7+Math.floor(this.time/5))%NODES.length]);
    }
    while(k.path.length>1&&dist(k,k.path[0])<1.4)k.path.shift();
    const goal=k.path[0];let mask=0;
    if(goal){const error=angleDelta(Math.atan2(goal.x-k.x,goal.z-k.z),k.angle);if(error>.07)mask|=1<<7;if(error<-.07)mask|=1<<6;
      let speed=Math.abs(error)>.3?5:24;if(k.path.length>1&&dist(k,goal)<18)speed=Math.min(speed,8);if(Math.abs(error)>1.2)speed=0;
      if(k.speed<speed)mask|=1;else if(k.speed>speed+1)mask|=2;
    }
    if(k.item&&target){const error=Math.abs(angleDelta(Math.atan2(target.x-k.x,target.z-k.z),k.angle));
      if(k.item==='boost'||(k.item==='banana'?dist(k,target)<18:dist(k,target)<48&&error<.28&&Math.abs(k.y-target.y)<2&&clearPath(k,target)))this.fire(k);
    }
    return mask;
  }
  pathLength(k,path){let total=0,p=k;for(const q of path){total+=dist(p,q);p=q;}return total;}
  move(k,dx,dz){
    // Terraces and ramps are solid volumes. Sidewalls cannot teleport a kart upwards.
    for(const [axis,delta] of [['x',dx],['z',dz]]){
      const next=clamp(k[axis]+delta,-SIZE+1.4,SIZE-1.4),x=axis==='x'?next:k.x,z=axis==='z'?next:k.z;
      const h=floorAt(x,z);
      if(h<=k.y+.48){k[axis]=next;}else{k.speed*=.7;}
    }
  }
  step(dt,inputs=[0,0]){
    if(this.winner)return;
    dt=clamp(dt,0,1/60);this.time+=dt;this.tick++;
    for(const k of this.karts){
      if(!k.active||!k.hp)continue;
      const mask=k.id<2?(inputs[k.id]||0):this.bot(k,dt);
      k.inv=Math.max(0,k.inv-dt);k.stun=Math.max(0,k.stun-dt);k.boost=Math.max(0,k.boost-dt);k.pad=Math.max(0,k.pad-dt);
      if(!k.stun){
        const steer=((mask>>7)&1)-((mask>>6)&1),gas=!!(mask&((1<<0)|(1<<4))),brake=!!(mask&((1<<1)|(1<<5)));
        k.angle+=steer*dt*(1.85+Math.min(Math.abs(k.speed),30)*.018)*(k.speed<-.5?-1:1);
        k.speed+=((gas?25:0)-(brake?34:0)-k.speed*(gas?.62:1.4))*dt;
        k.speed=clamp(k.speed,-9,k.boost?49:30);if(k.boost)k.speed=Math.max(k.speed,45);
        if((mask&((1<<10)|(1<<11)))&&!(k.lastMask&((1<<10)|(1<<11)))&&k.grounded){k.vy=9;k.grounded=false;}
        if((mask&(1<<8))&&!(k.lastMask&(1<<8)))this.fire(k);
      }
      k.lastMask=mask;
      this.move(k,Math.sin(k.angle)*k.speed*dt,Math.cos(k.angle)*k.speed*dt);
      const h=floorAt(k.x,k.z);
      if(k.grounded&&Math.abs(k.y-h)<=.5){k.y=h;k.vy=0;}else{k.grounded=false;k.vy-=24*dt;k.y+=k.vy*dt;if(k.y<=h){k.y=h;k.vy=0;k.grounded=true;}}
      for(const p of PADS)if(k.grounded&&!k.pad&&dist(k,p)<3.5&&Math.abs(k.y-p.y)<.5&&Math.abs(k.speed)>12){k.vy=13;k.grounded=false;k.boost=.7;k.pad=2;}
    }
    for(let i=0;i<this.karts.length;i++)for(let j=i+1;j<this.karts.length;j++){
      const a=this.karts[i],b=this.karts[j],d=dist(a,b);
      if(a.active&&b.active&&a.hp&&b.hp&&d<2.8&&Math.abs(a.y-b.y)<2){const nx=(a.x-b.x)/(d||1),nz=(a.z-b.z)/(d||1),push=(2.8-d)/2;this.move(a,nx*push,nz*push);this.move(b,-nx*push,-nz*push);a.speed*=.96;b.speed*=.96;}
    }
    for(const p of this.pickups){
      const near=this.karts.filter(k=>k.active&&k.hp&&Math.abs(k.y-p.y)<3&&dist(k,p)<5.5);
      if(!p.ready){p.clear=near.length?0:p.clear+dt;if(p.clear>=5){p.ready=true;p.clear=0;}}
      if(p.ready){const k=near.find(k=>!k.item&&dist(k,p)<2.8);if(k){k.item=ITEMS[Math.floor(this.random()*ITEMS.length)];k.picked++;p.ready=false;p.clear=0;}}
    }
    for(const s of this.shots){
      s.life-=dt;const owner=this.karts[s.owner];
      if(s.type==='red shell'){
        const t=this.karts.filter(k=>this.enemy(owner,k)&&Math.abs(k.y-s.y)<3).sort((a,b)=>dist(s,a)-dist(s,b))[0];
        if(t)s.angle+=clamp(angleDelta(Math.atan2(t.x-s.x,t.z-s.z),s.angle),-2.5*dt,2.5*dt);
      }
      if(s.type!=='banana'){
        const speed=48,x=s.x+Math.sin(s.angle)*speed*dt,z=s.z+Math.cos(s.angle)*speed*dt,h=floorAt(x,z);
        if(h>s.y+.5||Math.abs(x)>SIZE||Math.abs(z)>SIZE){s.life=0;this.effects.push({x:s.x,y:s.y,z:s.z,life:.3});}
        else{s.x=x;s.z=z;}
      }
      const floor=floorAt(s.x,s.z)+.8;s.vy-=24*dt;s.y+=s.vy*dt;if(s.y<floor){s.y=floor;s.vy=0;}
      for(const k of this.karts)if(this.enemy(owner,k)&&dist(k,s)<2.3&&Math.abs(k.y+.8-s.y)<1.8&&s.life>0){this.hit(k);s.life=0;break;}
    }
    this.shots=this.shots.filter(s=>s.life>0);for(const e of this.effects)e.life-=dt;this.effects=this.effects.filter(e=>e.life>0).slice(-24);
    const alive=this.karts.filter(k=>k.active&&k.hp>0);
    if(this.teams){if(!alive.some(k=>k.id<2))this.winner='The bots win!';else if(!alive.some(k=>k.id>=2))this.winner='Your team wins!';}
    else if(alive.length<=1)this.winner=alive.length?`${NAMES[alive[0].id]} wins!`:'Draw!';
  }
  snapshot(){return {tick:this.tick,time:this.time,teams:this.teams,winner:this.winner,karts:this.karts.map(({id,x,y,z,angle,speed,hp,item,active,inv})=>({id,x,y,z,angle:angleDelta(angle,0),speed,hp,item,active,inv})),pickups:this.pickups.map(({ready,clear})=>({ready,clear})),shots:this.shots.map(s=>({...s})),effects:this.effects.map(e=>({...e}))};}
}
