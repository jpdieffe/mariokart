import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
for(const folder of ['site','scripts','tests'])for(const file of readdirSync(folder)){
 if(!/\.(m?js)$/.test(file))continue;
 const result=spawnSync(process.execPath,['--check',`${folder}/${file}`],{stdio:'inherit'});
 if(result.status)process.exit(result.status);
}
console.log('JavaScript syntax checks passed.');
