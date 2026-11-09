import {mkdir,readFile,copyFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
const manifest=JSON.parse(await readFile('public/data/map-sources.json','utf8'));
await mkdir('public/maps',{recursive:true});await mkdir('public/vendor',{recursive:true});
for(const item of manifest.files){
 const destination=`public/maps/${item.file}`;let bytes;
 for(const path of [destination,`.data/maps/${item.file}`]){try{const b=await readFile(path);if(createHash('sha256').update(b).digest('hex')===item.sha256){bytes=b;break;}}catch{}}
 if(!bytes){console.log(`Downloading licensed map: ${item.file}`);const result=spawnSync('curl',['--fail','--location','--retry','2','--output',destination,item.source],{stdio:'inherit'});if(result.status!==0)throw Error('Map download failed');bytes=await readFile(destination);}
 if(createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw Error(`Source integrity check failed: ${item.file}`);
 await writeFile(destination,bytes);console.log(`${item.file}: verified ${bytes.length} bytes`);
}
await copyFile('node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs','public/vendor/maplibre-worker.mjs');
await copyFile('node_modules/maplibre-gl/LICENSE.txt','public/vendor/MAPLIBRE-LICENSE.txt');
