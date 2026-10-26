export const levels=[
 {id:'grand-prix',name:'Grand Prix · 50cc',description:'Mario + Luigi · Mushroom Cup'},
 {id:'battle-original',name:'Original Balloon Battle',description:'Mario + Luigi · Battle Course 1'},
 {id:'battle-courtyard',name:'Grand Courtyard',description:'A larger arena with cover, items, and jump bars'},
 {id:'battle-junction',name:'Jump Junction',description:'Wide crossings, staggered cover, and native jumps'},
];
export async function levelData(id){if(!levels.some(level=>level.id===id))throw Error('Unknown race.');const r=await fetch(`levels/${id}.state`);if(!r.ok)throw Error('This starting point could not load.');return new Uint8Array(await r.arrayBuffer());}
