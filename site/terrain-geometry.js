export const TERRAIN_MARKER=0x52a9;
// Match scripts/terrain-hooks.asm. Heights are original-game world units.
export function floorHeight(x,y){
 if(x>=384&&x<640&&y>=384&&y<640){
  if(x>=448&&x<576&&y<480)return 56;
  if(x>=464&&x<560&&y>=480&&y<576)return (704-y)>>2;
  return 32;
 }
 if(x>=128&&x<384&&y>=480&&y<576)return (x-128)>>3;
 if(x>=640&&x<896&&y>=480&&y<576)return (896-y)>>3;
 if(x>=544&&x<640&&y>=128&&y<384)return (y-128)>>3;
 if(x>=544&&x<640&&y>=640&&y<896)return (896-y)>>3;
 return 0;
}

// Use continuous planes for drawing, and generate only the exposed heightfield.
// A ramp joining a platform has no vertical end-cap inside the drivable surface.
function plane(x,y){
 if(x>=384&&x<640&&y>=384&&y<640){
  if(x>=448&&x<576&&y<480)return()=>56;
  if(x>=464&&x<560&&y>=480&&y<576)return(_,y)=>(704-y)/4;
  return()=>32;
 }
 if(x>=128&&x<384&&y>=480&&y<576)return x=>(x-128)/8;
 if(x>=640&&x<896&&y>=480&&y<576)return x=>(896-x)/8;
 if(x>=544&&x<640&&y>=128&&y<384)return(_,y)=>(y-128)/8;
 if(x>=544&&x<640&&y>=640&&y<896)return(_,y)=>(896-y)/8;
 return()=>0;
}
export function terrainMesh(){
 const xs=[0,128,384,448,464,544,560,576,640,896,1024],ys=[0,128,384,480,576,640,896,1024],faces=[];
 const cells=ys.slice(0,-1).map((y,j)=>xs.slice(0,-1).map((x,i)=>plane((x+xs[i+1])/2,(y+ys[j+1])/2)));
 const wall=(a,b,high,low)=>{
  const ah=high(...a),bh=high(...b),al=low(...a),bl=low(...b);
  if(Math.abs(ah-al)+Math.abs(bh-bl)<.00001)return;
  if(ah+bh<al+bl){wall(b,a,low,high);return;}
  faces.push({wall:1,vertices:[[...a,al],[...b,bl],[...b,bh],[...a,ah]]});
 };
 for(let j=0;j<ys.length-1;j++)for(let i=0;i<xs.length-1;i++){
  const x=xs[i],r=xs[i+1],y=ys[j],b=ys[j+1],f=cells[j][i];
  faces.push({wall:0,vertices:[[x,y,f(x,y)],[r,y,f(r,y)],[r,b,f(r,b)],[x,b,f(x,b)]]});
  if(i+1<cells[j].length)wall([r,y],[r,b],f,cells[j][i+1]);
  if(j+1<cells.length)wall([r,b],[x,b],f,cells[j+1][i]);
 }
 return faces;
}

export function cameraFloor(memory,player){
 const p=0x1000+player*256,base=floorHeight(memory.u(p+0x18),memory.u(p+0x1c)),offset=memory.u(p+0xf6);
 return base+(offset===0xffff?0:Math.max(0,Math.floor((memory.u(p+0x1f)-offset)/64))/4);
}
