import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validMatch} from '../site/protocol.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url));
test('published native ROM variants and launch states match the verified build',()=>{
 const manifest=JSON.parse(read('site/game-manifest.json'));
 for(const entry of [...manifest.variants,...manifest.states]){
  const data=read(entry.path);assert.equal(createHash('sha256').update(data).digest('hex'),entry.sha256,entry.path);
  if(entry.path.endsWith('.sfc')){assert.equal(data.length,524288);assert.equal(data.reduce((a,b)=>a+b,0)&65535,data.readUInt16LE(0xffde));}
  else {assert.equal(data.subarray(0,7).toString(),'RASTATE');const ram=data.indexOf('RAM:131072:')+11;assert.equal(data.readUInt16LE(ram+0x2e),0);}
 }
});
test('match messages bound display data and reject malformed room input',()=>{
 const good={mode:'battle-teams',racing:true,track:22,lines:['Mario: 3/3'],winner:null};assert.ok(validMatch(good));
 for(const change of [{track:24},{track:-1},{mode:'other'},{lines:['x'.repeat(101)]},{lines:Array(9).fill('x')},{winner:{}},{racing:'yes'}])assert.ok(!validMatch({...good,...change}));
});
test('native elevation collision guards return to the original rejection paths',()=>{
 const rom=read('site/roms/enhanced-terraces.sfc');
 for(const [hook,target]of [[0x1979d,0x197e0],[0x197e1,0x19829],[0x1982a,0x19866]]){
  assert.equal(rom[hook],0x22,'JSL elevation guard');
  assert.equal(rom[hook+4],0xb0,'BCS original rejection path');
  assert.equal(hook+6+rom.readInt8(hook+5),target,'branch displacement must resolve to RTS');
  assert.equal(rom[target],0x60);
 }
});
