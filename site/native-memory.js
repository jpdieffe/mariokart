// Addresses refer to the supplied USA Super Mario Kart ROM and pinned Snes9x.
export class NativeMemory {
 constructor(manager){this.manager=manager;this.module=manager.Module;this.base=this.findRam();}
 findRam(){
  const info=this.manager.functions.saveStateInfo().split('|').map(Number),heap=this.module.HEAPU8;
  if(info[2]!==1)throw Error('The original game memory could not be inspected.');
  const saved=heap.subarray(info[1],info[1]+info[0]),tag=new TextEncoder().encode('RAM:131072:');let start=-1;
  for(let i=16;i<saved.length-tag.length;i++)if(tag.every((v,j)=>saved[i+j]===v)){start=i+tag.length;break;}
  if(start<0)throw Error('This emulator does not expose the expected SNES work RAM.');
  const ram=saved.slice(start,start+131072),matches=[];
  if(new Set(ram.subarray(0,256)).size<8)throw Object.assign(Error('The original game is still starting.'),{notReady:true});
  let anchor=0,score=-1;
  for(let i=0;i<4096;i+=4){const distinct=new Set(ram.subarray(i,i+16)).size;if(distinct>score){score=distinct;anchor=i;}}
  const signature=new DataView(ram.buffer).getUint32(anchor,true),words=new Uint32Array(heap.buffer);
  for(let word=0;word<words.length;word++){
   if(words[word]!==signature)continue;
   const i=word*4-anchor;if(i<0||i+131072>heap.length)continue;
   if(i>=info[1]&&i<info[1]+info[0])continue;
   if(heap[i]!==ram[0]||heap[i+1]!==ram[1]||heap[i+2]!==ram[2])continue;
   let equal=true;for(let j=0;j<4096;j++)if(heap[i+j]!==ram[j]){equal=false;break;}
   if(equal&&[0x8000,0x10000,0x18000,0x1ffff].every(j=>heap[i+j]===ram[j]))matches.push(i);
  }
  if(matches.length!==1)throw Error('Could not safely identify the original game RAM.');
  return matches[0];
 }
 bytes(){return this.module.HEAPU8.subarray(this.base,this.base+131072);}
 u(address){const h=this.module.HEAPU8,p=this.base+address;return h[p]|h[p+1]<<8;}
 w(address,value){const h=this.module.HEAPU8,p=this.base+address;h[p]=value&255;h[p+1]=value>>>8&255;}
 inspect(){return{phase:this.u(0x36),substate:this.u(0x3a),mode:this.u(0x2c),players:this.u(0x2e),track:this.u(0x124),frame:this.u(0x34),racers:Array.from({length:8},(_,i)=>{const p=0x1000+i*256;return{slot:i,active:!!this.u(p+0x10),character:this.u(p+0x12),x:this.u(p+0x18),y:this.u(p+0x1c),height:this.u(p+0x20),heading:this.u(p+0x2a),rank:this.u(p+0xe6)/2+1,points:this.u(p+0xf0)};})};}
}
export function teamScores(racers){return Array.from({length:4},(_,team)=>({name:team===0?'You + your friend':`CPU team ${team}`,points:racers.slice(team*2,team*2+2).reduce((sum,r)=>sum+r.points,0)}));}
