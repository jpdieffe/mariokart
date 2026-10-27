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
