// Original-ROM battle extension. Native game owns movement, collisions, sprites,
// weapons, audio and arena. This controller supplies targets and match rules.
const SLOTS=[0x1000,0x1100,0x1400,0x1500,0x1600,0x1700];
const NAMES=['Mario','Luigi','Bowser','Peach','Donkey Kong Jr.','Koopa Troopa','Toad','Yoshi'];
const SPEED=[32,96,64,128,192,192,224,192,176,160,144,128,112,96,80,64,35,40,48,51,43,47,57,65,35,38,43,45,22,30,36,40,6,8,10,12,14,16,20,24,12,14,16,18,22,28,32,36,4,6,8,10,12,14,18,22,2,4,6,8,10,12,14,18];
const GRID=32,CELL=32;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const heading=(a,b)=>(Math.round(Math.atan2(b.x-a.x,a.y-b.y)*65536/(Math.PI*2))+65536)&65535;
const angleDiff=(a,b)=>((a-b+32768)&65535)-32768;
export class NativeBattle {
 constructor(memory,{teams=false,items}={}){this.m=memory;this.teams=teams;this.items=items;this.reset();}
 reset(){this.ready=false;this.racers=[];this.winner=null;this.frame=0;this.lastFrame=-1;this.lastNative=-1;}
 state(){return{active:this.ready,teams:this.teams,winner:this.winner,racers:this.racers.map(r=>({name:r.name,hp:r.hp,team:r.team,player:r.human?r.id+1:null,character:r.character,item:r.item===null?null:['Banana','Green shell','Red shell'][r.item]}))};}
 pos(p){return{x:this.m.u(p+0x18),y:this.m.u(p+0x1c)};}
 surface(x,y){if(x<8||y<8||x>=1016||y>=1016)return 0x80;const b=this.m.bytes();return b[0xb00+b[0x10000+(y>>3)*128+(x>>3)]];}
 driveable(x,y){const t=this.surface(x,y);return t<0x80&&!(t>=0x20&&t<=0x3f);}
 clear(x,y,r=10){return [[0,0],[r,0],[-r,0],[0,r],[0,-r]].every(([dx,dy])=>this.driveable(x+dx,y+dy));}
 cell(pos){return Math.max(0,Math.min(31,pos.y>>5))*32+Math.max(0,Math.min(31,pos.x>>5));}
 point(cell){return{x:(cell%32)*32+16,y:(cell>>5)*32+16};}
 nearest(pos){let best=-1,bestD=Infinity;for(let i=0;i<1024;i++)if(this.grid[i]){const p=this.point(i),d=(p.x-pos.x)**2+(p.y-pos.y)**2;if(d<bestD){bestD=d;best=i;}}return best;}
 line(a,b,clearance=9){const n=Math.ceil(dist(a,b)/8);for(let i=0;i<=n;i++){const t=n?i/n:0;if(!this.clear(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,clearance))return false;}return true;}
 route(from,to){const start=this.nearest(from),goal=this.nearest(to);if(start<0||goal<0)return[];if(start===goal)return[this.point(goal)];
  const queue=[start],previous=new Int16Array(1024).fill(-1);previous[start]=start;
  for(let head=0;head<queue.length&&previous[goal]<0;head++){const at=queue[head],x=at%32,y=at>>5;for(const[dx,dy]of[[0,-1],[1,0],[0,1],[-1,0]]){const nx=x+dx,ny=y+dy,next=ny*32+nx;if(nx<0||nx>=32||ny<0||ny>=32||!this.grid[next]||previous[next]>=0)continue;previous[next]=at;queue.push(next);}}
  if(previous[goal]<0)return[];const path=[];for(let n=goal;n!==start;n=previous[n])path.push(this.point(n));path.reverse();return path;
 }
 link(p,top,bottom){this.m.w(p+4,top);this.m.w(p+12,bottom);for(const[sentinel,off]of[[0xb0,0],[0xb4,8]]){const tail=this.m.u(sentinel+off+2),old=this.m.u(tail+off);this.m.w(sentinel+off+2,p);this.m.w(tail+off,p);this.m.w(p+off,old);this.m.w(p+off+2,tail);}}
 unlink(p){for(const off of[0,8]){const next=this.m.u(p+off),prev=this.m.u(p+off+2);if(next&&prev){this.m.w(next+off+2,prev);this.m.w(prev+off,next);}this.m.w(p+off,p);this.m.w(p+off+2,p);}}
 initialize(){const m=this.m,b=m.bytes();this.ready=true;this.frame=0;this.winner=null;
  this.grid=Uint8Array.from({length:1024},(_,i)=>{const p=this.point(i);return this.clear(p.x,p.y,11)?1:0;});
  // Four safe native item slots: avoid original Battle Mode's borrowed CPU RAM.
  m.w(0xdfa,0xf16a);m.w(0xdf8,2);m.w(0xdfc,0);
  for(const[i,p]of[0x1a00,0x1a80,0x1b00,0x1b80].entries()){b.fill(0,p,p+0x80);m.w(p+0x14,i*2);m.w(p+0x60,0xd00);m.w(p+0x62,0xd00);m.w(p+0x6e,0xf6eb);for(const off of[0x74,0x76,0x78,0x7a])m.w(p+off,0x14);}
  m.w(0xd60,0xd00);m.w(0xd62,0xd00);
  SPEED.forEach((v,i)=>m.w(0x690+i*2,v*16));
  const source=b.slice(0x1010,0x1100),top=m.u(0x1104),bottom=m.u(0x100c),used=new Set([m.u(0x1012),m.u(0x1112)]),characters=[];
  for(let c=0;c<16;c+=2)if(!used.has(c))characters.push(c);
  const starts=[{x:416,y:512},{x:608,y:512},{x:416,y:416},{x:608,y:608}];
  for(let i=0;i<4;i++){const p=SLOTS[i+2],slot=(p-0x1000)>>8,character=characters[i];b.set(source,p+0x10);
   for(const off of[0x22,0x24,0x26,0x28,0x40,0x5e,0x60,0x62,0x82,0x84,0x86,0x88,0x8c,0x9e,0xa0,0xa6,0xa8,0xaa,0xac,0xc8,0xd0,0xd4,0xd6,0xe0,0xe2,0xe4,0xe8,0xea,0xec,0xee,0xf0,0xf2,0xf4,0xfc,0xfe])m.w(p+off,0);
   m.w(p+0x10,0x2000);m.w(p+0x12,character);m.w(p+0x4e,[0x1a,0x1a,0x1b,0x19,0x1b,0x19,0x19,0x19][character/2]);
   m.w(p+0x14,[0x180,0x184,0x188,0x18c,0x1c0,0x1c4,0x1c8,0x1cc][slot]|[0x200,0x400,0,0x600,0x600,0x400,0x200,0][character/2]);
   m.w(p+0xb6,[0x5800,0x5840,0x5880,0x58c0,0x5c00,0x5c40,0x5c80,0x5cc0][slot]);m.w(p+0xb8,m.u(p+0xb6)+0x1000);m.w(p+0xba,0x140);m.w(p+0xbc,0x140);m.w(p+0xd2,65535);m.w(p+0xe6,(i+2)*2);m.w(p+0xda,i*2);m.w(p+0xf6,65535);
   const pos=this.point(this.nearest(starts[i]));m.w(p+0x16,0);m.w(p+0x18,pos.x);m.w(p+0x1a,0);m.w(p+0x1c,pos.y);m.w(p+0x1e,0);m.w(p+0x20,0);const h=heading(pos,this.pos(0x1000));for(const o of[0x2a,0xa2,0xa4,0xfa])m.w(p+o,h);this.link(p,top,bottom);
  }
  [...SLOTS,0x1200,0x1300,0].forEach((p,i)=>m.w(0x10e+i*2,p));
  for(const p of[0x1000,0x1100]){m.w(p+0xf0,0);m.w(p+0x8c,m.u(p+0x8c)&0x7ffe);}m.w(0x10f2,0xb07b);
  this.racers=SLOTS.map((p,id)=>({p,id,human:id<2,character:m.u(p+0x12)/2,name:NAMES[m.u(p+0x12)/2],team:this.teams?(id<2?0:1):id,hp:3,hitAt:-120,hits:0,item:null,pickups:0,uses:0,nextShot:120+id*27,targetKey:null,path:[],repath:0,lastPos:this.pos(p),stuck:0}));
 }
 hurt(r){if(r.hp<=0||this.frame-r.hitAt<90)return;r.hp--;r.hitAt=this.frame;
  if(r.human){const balloons=r.id===0?[0x1800,0x1880,0x1900]:[0x1980,0x1238,0x1338];this.m.w(balloons[r.hp]+0x12,0x1000);}
  if(r.hp===0){this.unlink(r.p);this.m.w(r.p+0x10,0);this.m.w(r.p+0x4e,0);this.m.w(r.p+0xea,0);this.m.w(r.p+0xf0,0);}
 }
 tick(){const m=this.m;if(m.u(0x36)!==14||m.u(0x2c)!==6){if(this.ready)this.reset();return;}if(m.u(0x3a)!==6)return;
  const native=m.u(0x38);if(native===this.lastNative)return;const step=this.lastNative<0?1:Math.min(8,(native-this.lastNative)&65535);this.lastNative=native;
  if(!this.ready)this.initialize();this.frame+=step;if(this.winner)return;
  for(const r of this.racers){if(r.hp<=0)continue;if(r.human){const hits=m.u(r.p+0xf0);if(hits!==r.hits){r.hits=hits;this.hurt(r);}}else{const flags=m.u(r.p+0x8c);if(flags&1){m.w(r.p+0x8c,flags&~1);this.hurt(r);}}}
  const living=this.racers.filter(r=>r.hp>0),teams=new Set(living.map(r=>r.team));if(teams.size<=1){this.winner=this.teams?(living[0]?.team===0?'Your team wins!':'Bot team wins!'):(living[0]?`${living[0].name} wins!`:'Draw');return;}
  for(const r of this.racers){
   if(r.human||r.hp<=0)continue;
   const pos=this.pos(r.p);
   if(r.item===null&&!m.u(r.p+0xf0)&&this.items.collect(pos,m.u(r.p+0x20))){
    r.item=(m.u(0x1f26)+r.id+r.pickups)%3;r.pickups++;r.nextShot=this.frame+60;r.targetKey=null;
   }
   const enemies=living.filter(t=>t.team!==r.team).sort((a,b)=>dist(pos,this.pos(a.p))-dist(pos,this.pos(b.p)));
   const enemy=enemies[0];if(!enemy)continue;
   let target=this.pos(enemy.p),targetKey='enemy'+enemy.id,attack=r.item!==null;
   if(!attack){
    const boxes=this.items.blocks.filter(b=>this.items.available(b)).sort((a,b)=>dist(pos,a)-dist(pos,b));
    const box=boxes.find(b=>this.line(pos,b)||this.route(pos,b).length);
    if(box){target=box;targetKey='box'+box.index;}
    else {
     // Vacate every empty pickup, allowing its clear-area timer to run.
     const safe=Array.from({length:1024},(_,i)=>i).filter(i=>this.grid[i]).map(i=>this.point(i)).filter(p=>this.items.blocks.every(b=>Math.abs(p.x-b.x)>40||Math.abs(p.y-b.y)>40)).sort((a,b)=>dist(pos,a)-dist(pos,b));
     target=safe[0]||pos;targetKey='wait'+this.cell(target);
    }
   }
   const direct=this.line(pos,target);
   if(this.frame>=r.repath||r.targetKey!==targetKey){r.path=direct?[]:this.route(pos,target);r.repath=this.frame+45;r.targetKey=targetKey;}
   while(r.path.length&&dist(pos,r.path[0])<24)r.path.shift();let aim=target;if(!direct&&r.path.length){aim=r.path[0];for(let i=Math.min(r.path.length-1,4);i>0;i--)if(this.line(pos,r.path[i],11)){aim=r.path[i];break;}}
   const h=heading(pos,aim);m.w(r.p+0xfa,h);const delta=Math.abs(angleDiff(h,m.u(r.p+0x2a)));
   const cap=direct&&dist(pos,target)<(attack?110:28)?0x20:delta>0x3000?0x60:delta>0x1800?0x140:0x2b0;if(m.u(r.p+0xea)>cap)m.w(r.p+0xea,cap);
   if(this.frame%30<step){if(dist(pos,r.lastPos)<10)r.stuck+=30;else r.stuck=0;r.lastPos=pos;if(r.stuck>=90){m.w(r.p+0xac,0);m.w(r.p+0xa6,0);m.w(r.p+0xa8,0);m.w(r.p+0xaa,0);for(const off of[0x2a,0xa2,0xa4])m.w(r.p+off,h);r.repath=0;r.stuck=0;}}
   const fireAngle=Math.abs(angleDiff(heading(pos,target),m.u(r.p+0x2a)));
   if(attack&&this.frame>=r.nextShot&&direct&&dist(pos,target)<320&&(r.item===0||fireAngle<0x1600)&&!(m.u(r.p+0xe2)&0x300)&&!m.u(0xdfc)){
    m.w(r.p+0xf0,r.item+1);r.item=null;r.uses++;r.targetKey=null;r.nextShot=this.frame+90;
   }
  }
 }
}
