// The search index is a derived ODbL database. Keep source attribution with it.
import {PMTiles,FileSource} from 'pmtiles';import {VectorTile} from '@mapbox/vector-tile';import {PbfReader} from 'pbf';import {readFile,writeFile} from 'node:fs/promises';
const configs=[['seoul-metro','수도권'],['gangwon','강원'],['chungcheong','충청']];
const xyz=(lon,lat,z)=>[Math.floor((lon+180)/360*2**z),Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*2**z)];
const groups=new Map();let tiles=0;
for(const [file,region] of configs){
const archive=new PMTiles(new FileSource(new File([await readFile(`public/maps/${file}.pmtiles`)],file)));const h=await archive.getHeader();const z=h.maxZoom,a=xyz(h.minLon,h.maxLat,z),b=xyz(h.maxLon,h.minLat,z);
for(let x=a[0];x<=b[0];x++)for(let y=a[1];y<=b[1];y++){
 const tile=await archive.getZxy(z,x,y);if(!tile)continue;tiles++;const vt=new VectorTile(new PbfReader(new Uint8Array(tile.data)));
 for(const [layerName,kind] of [['roads','road'],['places','place'],['pois','poi']]){
 const layer=vt.layers[layerName];if(!layer)continue;
 for(let i=0;i<layer.length;i++){
 const f=layer.feature(i);const name=f.properties['name:ko']||f.properties.name;if(typeof name!=='string'||name.length<2)continue;
 const geo=f.toGeoJSON(x,y,z);let pts=[];function collect(a){if(typeof a[0]==='number')pts.push(a);else a.forEach(collect);}collect(geo.geometry.coordinates);if(!pts.length)continue;
 const center=[pts.reduce((s,p)=>s+p[0],0)/pts.length,pts.reduce((s,p)=>s+p[1],0)/pts.length];
 const key=[region,kind,name,Math.floor(center[0]*10),Math.floor(center[1]*10)].join('|');
 const prior=groups.get(key);if(prior){prior.x+=center[0];prior.y+=center[1];prior.n++;}else groups.set(key,{name,region,kind,x:center[0],y:center[1],n:1});
 }
 }
}
console.log(`${file}: indexed (${tiles} tiles total)`);
}
const places=Array.from(groups.values(),p=>({name:p.name,region:p.region,kind:p.kind,center:[+(p.x/p.n).toFixed(6),+(p.y/p.n).toFixed(6)]}));
await writeFile('public/data/places.json',JSON.stringify(places));console.log(JSON.stringify({entries:places.length,pilot:places.filter(p=>p.name==='남평로')}));
