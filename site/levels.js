export const levels=[
 {id:'battle-terraces',name:'Raised Courtyard',description:'Original engine and artwork · three floors connected by five ramps'},
 {id:'grand-prix',name:'Grand Prix · 50cc',description:'Mario + Luigi · Mushroom Cup'},
 {id:'battle-original',name:'Original Balloon Battle',description:'Mario + Luigi · Battle Course 1'},
 {id:'battle-courtyard',name:'Grand Courtyard',description:'Flat SNES arena with cover, items, and jump bars'},
 {id:'battle-junction',name:'Jump Junction',description:'Flat SNES arena with wide crossings and jump bars'},
];
export async function levelData(id){if(!levels.some(level=>level.id===id))throw Error('Unknown race.');const r=await fetch(`levels/${id}.state`);if(!r.ok)throw Error('This starting point could not load.');return new Uint8Array(await r.arrayBuffer());}
