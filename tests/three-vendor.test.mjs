import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('vendored Three.js matches the pinned package and includes its license',async()=>{
 for(const file of ['three.module.min.js','three.core.min.js'])assert.deepEqual(await readFile(new URL(`../site/vendor/three/${file}`,import.meta.url)),await readFile(new URL(`../node_modules/three/build/${file}`,import.meta.url)));
 assert.deepEqual(await readFile(new URL('../site/vendor/three/LICENSE',import.meta.url)),await readFile(new URL('../node_modules/three/LICENSE',import.meta.url)));
});
