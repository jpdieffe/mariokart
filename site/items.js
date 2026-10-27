// Native 2x2 item tiles. The ROM's NMI queue updates the visible Mode-7 map.
export const RESPAWN_FRAMES = 300;
export const CLEAR_RADIUS = 32;
export class ItemBlocks {
 constructor(memory){this.m=memory;this.reset();}
 reset(){this.blocks=[];this.ready=false;this.frame=0;this.lastNative=-1;this.track=-1;}
 initialize(){
  const b=this.m.bytes();this.blocks=[];this.track=this.m.u(0x124);this.ready=true;
  for(let i=0;i<16384-129;i++){
   const tile=b[0x10000+i],base=tile&0xef;
   if(base<0xc0||base>0xcc||(base&3)||(i&127)===127||b[0xb00+base]!==0x14)continue;
   const cells=[i,i+1,i+128,i+129];
   if(!cells.every((p,n)=>(b[0x10000+p]&0xef)===base+n))continue;
   this.blocks.push({index:i,x:(i%128)*8+8,y:(i>>7)*8+8,cells,tiles:cells.map((_,n)=>base+n),clearFrames:0});
  }
 }
 available(block){const b=this.m.bytes();return block.cells.every((p,n)=>b[0x10000+p]===block.tiles[n]);}
 write(block,active){
  // Never overwrite a pending native pickup/coin update.
  if(this.m.u(0x1e20)!==0)return false;
  const b=this.m.bytes();block.cells.forEach((p,n)=>{b[0x10000+p]=block.tiles[n]+(active?0:16);});
  this.m.w(0x1e22,0);this.m.w(0x1e20,block.index);block.clearFrames=0;return true;
 }
 collect(pos,height=0){
  if(height>4)return null;
  const block=this.blocks.find(b=>Math.abs(pos.x-b.x)<8&&Math.abs(pos.y-b.y)<8&&this.available(b));
  return block&&this.write(block,false)?block:null;
 }
 tick(){
  const m=this.m;if(![2,14].includes(m.u(0x36))){if(this.ready)this.reset();return;}
  if(m.u(0x3a)!==6)return;
  if(!this.ready||this.track!==m.u(0x124))this.initialize();
  const native=m.u(0x38);if(native===this.lastNative)return;
  const step=this.lastNative<0?1:Math.min(8,(native-this.lastNative)&65535);this.lastNative=native;this.frame+=step;
  const karts=Array.from({length:8},(_,i)=>0x1000+i*256).filter(p=>m.u(p+0x10)).map(p=>({x:m.u(p+0x18),y:m.u(p+0x1c)}));
  for(const block of this.blocks){
   if(this.available(block)){block.clearFrames=0;continue;}
   const occupied=karts.some(p=>Math.abs(p.x-block.x)<=CLEAR_RADIUS&&Math.abs(p.y-block.y)<=CLEAR_RADIUS);
   block.clearFrames=occupied?0:block.clearFrames+step;
   if(block.clearFrames>=RESPAWN_FRAMES)this.write(block,true);
  }
 }
}
