'use client';
import {useEffect,useRef} from 'react';
import * as maplibregl from 'maplibre-gl';
import type {Map as MapType,GeoJSONSource} from 'maplibre-gl';
import {portableData} from '@/lib/runtime';
import {Protocol,PMTiles,FetchSource} from 'pmtiles';
import {ARCHIVES,buildingHeight,chooseArchive,createMapStyle,type Archive} from '@/lib/map-style';
import type {FeatureCollection} from 'geojson';
import {heightInfo} from '@/lib/domain';
const base=process.env.NEXT_PUBLIC_BASE_PATH||'';
const protocol=new Protocol();maplibregl.addProtocol('pmtiles',protocol.tile);
export type Target={center:[number,number];label:string;zoom?:number;nonce:number};
export type SelectedBuilding={height:number|null;basis:'map'|'unknown';point:[number,number]};
type Props={scene?:FeatureCollection;target:Target;is3D:boolean;assumed:boolean;drawing:boolean;points:[number,number][];onPoint:(p:[number,number])=>void;onBuilding:(b:SelectedBuilding)=>void;onStatus:(s:string)=>void;onStats:(n:number)=>void;onArchive:(s:string)=>void};
function routeData(points:[number,number][]){return {type:'FeatureCollection' as const,features:[...(points.length>1?[{type:'Feature' as const,properties:{},geometry:{type:'LineString' as const,coordinates:points}}]:[]),...points.map((p,i)=>({type:'Feature' as const,properties:{order:i+1},geometry:{type:'Point' as const,coordinates:p}}))]};}
function updateRoute(map:MapType,points:[number,number][]){
 const source=map.getSource('route') as GeoJSONSource|undefined;
 if(source){source.setData(routeData(points));return;}
 map.addSource('route',{type:'geojson',data:routeData(points)});
 map.addLayer({id:'route-line',type:'line',source:'route',filter:['==','$type','LineString'],paint:{'line-color':'#e78030','line-width':5,'line-dasharray':[2,1]}});
 map.addLayer({id:'route-points',type:'circle',source:'route',filter:['==','$type','Point'],paint:{'circle-radius':6,'circle-color':'#fff','circle-stroke-color':'#d9691e','circle-stroke-width':3}});
}
function updateScene(map:MapType,data?:FeatureCollection){
 const scene=data??{type:'FeatureCollection' as const,features:[]};
 const source=map.getSource('planning') as GeoJSONSource|undefined;if(source){source.setData(scene);return;}
 map.addSource('planning',{type:'geojson',data:scene});
 map.addLayer({id:'planning-areas',type:'fill',source:'planning',filter:['in',['get','kind'],['literal',['zone','envelope']]],paint:{'fill-color':['get','color'],'fill-opacity':0.18}});
 map.addLayer({id:'planning-outlines',type:'line',source:'planning',filter:['in',['get','kind'],['literal',['zone','envelope']]],paint:{'line-color':['get','color'],'line-width':2}});
 map.addLayer({id:'planning-routes',type:'line',source:'planning',filter:['==',['get','kind'],'route'],paint:{'line-color':['get','color'],'line-width':5}});
 map.addLayer({id:'planning-volumes',type:'fill-extrusion',source:'planning',filter:['==',['get','kind'],'volume'],paint:{'fill-extrusion-color':['get','color'],'fill-extrusion-height':['get','height'],'fill-extrusion-base':['get','base'],'fill-extrusion-opacity':0.85}});
 map.addLayer({id:'planning-hazards',type:'circle',source:'planning',filter:['==',['get','kind'],'hazard'],paint:{'circle-radius':8,'circle-color':['get','color'],'circle-stroke-color':'white','circle-stroke-width':2}});
}
export default function MapCanvas(props:Props){
 const container=useRef<HTMLDivElement>(null),mapRef=useRef<MapType|null>(null),latest=useRef(props),ready=useRef(false);
 latest.current=props;
 useEffect(()=>{
  if(!container.current)return;
  maplibregl.setWorkerUrl(portableData()?.workerUrl??`${location.origin}${base}/vendor/maplibre-worker.mjs`);
  // Chromium can reuse partial cached responses for overlapping byte ranges.
  // Keep PMTiles directory caching, but fetch archive bytes without the HTTP cache.
  const mapRoot=portableData()?.mapRoot??`${location.origin}${base}/maps`;
  for(const key of Object.keys(ARCHIVES)){const source=new FetchSource(`${mapRoot}/${key}.pmtiles`);source.chromeWindowsNoCache=true;protocol.add(new PMTiles(source));}
  let map:MapType;let archive:Archive=chooseArchive(latest.current.target.center)||'seoul-metro';let failed=false;
  try{map=new maplibregl.Map({container:container.current,style:createMapStyle(archive,location.origin,base),center:latest.current.target.center,zoom:latest.current.target.zoom??15.5,pitch:55,bearing:-28,maxZoom:20,minZoom:7,localIdeographFontFamily:'Noto Sans CJK KR, Malgun Gothic, Apple SD Gothic Neo, sans-serif',attributionControl:false});}catch{latest.current.onStatus('3D 표시 실패 · WebGL을 지원하는 브라우저로 열어주세요');return;}
  mapRef.current=map;map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),'top-right');map.addControl(new maplibregl.ScaleControl({unit:'metric'}),'bottom-right');map.addControl(new maplibregl.AttributionControl({compact:false}),'bottom-left');
  const markerEl=document.createElement('div');markerEl.className='location-pin';markerEl.setAttribute('aria-label','선택한 지도 주변 위치');
  const marker=new maplibregl.Marker({element:markerEl}).setLngLat(latest.current.target.center).addTo(map);
  // Keep marker at the requested vicinity, never at an inferred house number.
  const syncTarget=()=>{marker.setLngLat(latest.current.target.center);};
  map.on('style.load',()=>{ready.current=true;map.setPaintProperty('buildings','fill-extrusion-height',buildingHeight(latest.current.assumed));updateRoute(map,latest.current.points);updateScene(map,latest.current.scene);latest.current.onArchive(ARCHIVES[archive].label);});
  map.on('error',event=>{console.error('Map source error:',event.error.message);failed=true;latest.current.onStatus('지도 자료를 불러오지 못했습니다 · 새로고침해 다시 시도하세요');});
  map.on('idle',()=>{
   if(!ready.current||failed)return;
   const center=map.getCenter();
   if(container.current)container.current.dataset.center=JSON.stringify([center.lng,center.lat]);
   if(container.current&&Math.abs(center.lng-latest.current.target.center[0])<0.00001&&Math.abs(center.lat-latest.current.target.center[1])<0.00001)container.current.dataset.settledLabel=latest.current.target.label;
   const features=map.queryRenderedFeatures({layers:['buildings']});
   const count=features.reduce((s,f)=>s+(f.geometry.type==='MultiPolygon'?f.geometry.coordinates.length:1),0);
   latest.current.onStats(count);latest.current.onStatus(chooseArchive([map.getCenter().lng,map.getCenter().lat])?'지도 연결됨':'자료 범위 밖 · 다른 지역을 선택하세요');
  });
  map.on('movestart',()=>{syncTarget();if(!failed)latest.current.onStatus('지도 이동 중');latest.current.onStats(0);if(container.current)delete container.current.dataset.settledLabel;});
  map.on('moveend',()=>{
   const next=chooseArchive([map.getCenter().lng,map.getCenter().lat]);
   if(next&&next!==archive){archive=next;ready.current=false;failed=false;latest.current.onStatus('지역 지도 불러오는 중');map.setStyle(createMapStyle(archive,location.origin,base));}
  });
  map.on('click',event=>{
   const p:[number,number]=[event.lngLat.lng,event.lngLat.lat];
   if(latest.current.drawing){latest.current.onPoint(p);return;}
   if(!ready.current)return;
   const [f]=map.queryRenderedFeatures(event.point,{layers:['buildings','building-footprints']});
   if(f){const h=heightInfo(f.properties);latest.current.onBuilding({height:h.height,basis:h.basis,point:p});}
  });
  return ()=>{ready.current=false;mapRef.current=null;marker.remove();map.remove();};
 },[]);
 useEffect(()=>{mapRef.current?.jumpTo({center:props.target.center,zoom:props.target.zoom??15.5});},[props.target]);
 useEffect(()=>{mapRef.current?.easeTo({pitch:props.is3D?55:0,bearing:props.is3D?-28:0,duration:500});},[props.is3D]);
 useEffect(()=>{if(ready.current)mapRef.current?.setPaintProperty('buildings','fill-extrusion-height',buildingHeight(props.assumed));},[props.assumed]);
 useEffect(()=>{if(ready.current&&mapRef.current)updateRoute(mapRef.current,props.points);},[props.points]);
 useEffect(()=>{if(ready.current&&mapRef.current)updateScene(mapRef.current,props.scene);},[props.scene]);
 useEffect(()=>{if(mapRef.current)mapRef.current.getCanvas().style.cursor=props.drawing?'crosshair':'';},[props.drawing]);
 return <div className="map-canvas" ref={container} aria-label="실제 도로와 건물의 3D 지도"/>;
}
