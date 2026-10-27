const finite=(v,max=10000)=>Number.isFinite(v)&&Math.abs(v)<=max;
const position=p=>p&&finite(p.x,100)&&finite(p.z,100)&&finite(p.y,100);
const item=s=>['green shell','red shell','banana','boost'].includes(s);
export function validArenaFrame(s){
  return !!(s&&Number.isSafeInteger(s.tick)&&s.tick>=0&&finite(s.time,1e9)&&typeof s.teams==='boolean'&&(s.winner===null||typeof s.winner==='string'&&s.winner.length<80)&&
    Array.isArray(s.karts)&&s.karts.length===6&&s.karts.every((k,i)=>position(k)&&k.id===i&&finite(k.angle)&&finite(k.speed,100)&&Number.isInteger(k.hp)&&k.hp>=0&&k.hp<=3&&(k.item===null||item(k.item))&&typeof k.active==='boolean'&&finite(k.inv,3))&&
    Array.isArray(s.pickups)&&s.pickups.length===12&&s.pickups.every(p=>p&&typeof p.ready==='boolean'&&finite(p.clear,6))&&
    Array.isArray(s.shots)&&s.shots.length<=64&&s.shots.every(p=>position(p)&&Number.isSafeInteger(p.id)&&Number.isInteger(p.owner)&&p.owner>=0&&p.owner<6&&item(p.type)&&finite(p.angle)&&finite(p.life,20))&&
    Array.isArray(s.effects)&&s.effects.length<=24&&s.effects.every(p=>position(p)&&finite(p.life,1)));
}
