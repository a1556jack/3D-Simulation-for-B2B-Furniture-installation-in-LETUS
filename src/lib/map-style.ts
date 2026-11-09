import {portableData} from './runtime';
import type { StyleSpecification, ExpressionSpecification } from 'maplibre-gl';
export const ARCHIVES = {
 'seoul-metro':{label:'수도권',bounds:[126.3,36.8,127.9,38.0],maxzoom:14},
 gangwon:{label:'강원',bounds:[127.4,37.0,129.6,38.7],maxzoom:13},
 chungcheong:{label:'충청',bounds:[125.9,35.8,128.4,37.2],maxzoom:13},
} as const;
export type Archive=keyof typeof ARCHIVES;
export function chooseArchive([x,y]:[number,number]):Archive|null{
 for(const [key,a] of Object.entries(ARCHIVES)){const [w,s,e,n]=a.bounds;if(x>=w&&x<=e&&y>=s&&y<=n)return key as Archive;}return null;
}
const hasHeight:ExpressionSpecification=['all',['==',['typeof',['get','height']],'number'],['>', ['to-number',['get','height'],0],0]];
export function buildingHeight(assumed:boolean):ExpressionSpecification{return ['case',hasHeight,['get','height'],assumed?6:0];}
export function createMapStyle(archive:Archive,origin:string,base:string):StyleSpecification{
 const a=ARCHIVES[archive],portable=portableData();
 return {version:8,'font-faces':{'Noto Sans Regular':[{url:portable?.fontUrl??`${origin}${base}/fonts/NotoSans-Regular.ttf`}]},
 sources:{regional:{type:'vector',url:`pmtiles://${portable?.mapRoot??`${origin}${base}/maps`}/${archive}.pmtiles`,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · <a href="https://protomaps.com">Protomaps</a>',bounds:[...a.bounds],minzoom:0,maxzoom:a.maxzoom}},
 light:{anchor:'viewport',position:[1.5,210,35],intensity:0.4},
 layers:[
 {id:'background',type:'background',paint:{'background-color':'#dce4df'}},
 {id:'land',type:'fill',source:'regional','source-layer':'earth',paint:{'fill-color':'#e9e8df'}},
 {id:'nature',type:'fill',source:'regional','source-layer':'landcover',paint:{'fill-color':'#cbd7c3','fill-opacity':0.7}},
 {id:'landuse',type:'fill',source:'regional','source-layer':'landuse',paint:{'fill-color':['match',['get','kind'],'industrial','#dbdce0','park','#c3d5bb','hospital','#e2d6cf','#d9ddce'],'fill-opacity':0.65}},
 {id:'water',type:'fill',source:'regional','source-layer':'water',paint:{'fill-color':'#a8cfd8'}},
 {id:'roads-casing',type:'line',source:'regional','source-layer':'roads',paint:{'line-color':'#c9c5bb','line-width':['interpolate',['linear'],['zoom'],8,0.5,14,4,18,20]}},
 {id:'roads',type:'line',source:'regional','source-layer':'roads',paint:{'line-color':['match',['get','kind'],'highway','#efe5bf','#fbfaf4'],'line-width':['interpolate',['linear'],['zoom'],8,0.4,14,2.5,18,17]}},
 {id:'building-footprints',type:'fill',source:'regional','source-layer':'buildings',minzoom:12,paint:{'fill-color':'#9baaaa','fill-opacity':0.65}},
 {id:'buildings',type:'fill-extrusion',source:'regional','source-layer':'buildings',minzoom:12,paint:{'fill-extrusion-color':['case',hasHeight,'#52928a','#a8b8b8'],'fill-extrusion-height':buildingHeight(true),'fill-extrusion-base':0,'fill-extrusion-opacity':0.94}},
 {id:'road-labels',type:'symbol',source:'regional','source-layer':'roads',minzoom:13,layout:{'symbol-placement':'line','text-field':['coalesce',['get','name:ko'],['get','name'],''],'text-font':['Noto Sans Regular'],'text-size':12,'symbol-spacing':240},paint:{'text-color':'#596963','text-halo-color':'#ffffff','text-halo-width':2}},
 {id:'place-labels',type:'symbol',source:'regional','source-layer':'places',layout:{'text-field':['coalesce',['get','name:ko'],['get','name'],''],'text-font':['Noto Sans Regular'],'text-size':['interpolate',['linear'],['zoom'],7,11,14,15]},paint:{'text-color':'#354d46','text-halo-color':'#ffffff','text-halo-width':2}},
 ]};
}
