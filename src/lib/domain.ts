export type SearchPlace={name:string;region:string;kind:'road'|'place'|'poi';center:[number,number]};
export type Verdict='pass'|'fail'|'unknown';
export function heightInfo(p:Record<string,unknown>){
 const height=typeof p.height==='number'&&Number.isFinite(p.height)&&p.height>0?p.height:null;
 return {height,displayHeight:height??6,basis:height===null?'unknown' as const:'map' as const};
}
export function evaluateClearance(available:number|null,required:number|null,margin:number|null):Verdict{
 if(available===null||required===null||!Number.isFinite(available)||!Number.isFinite(required)||available<=0||required<=0)return 'unknown';
 if(available<required)return 'fail';
 if(margin===null||!Number.isFinite(margin)||margin<0)return 'unknown';
 return available>=required+margin?'pass':'fail';
}
export function parseCoordinates(query:string):[number,number]|null{
 const m=query.trim().match(/^(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)$/);if(!m)return null;
 const x=Number(m[1]),y=Number(m[2]);return x>=124&&x<=132&&y>=33&&y<=39?[x,y]:null;
}
export function searchPlaces(query:string,places:SearchPlace[]){
 const q=query.trim();if(q.length<2)return [];
 const road=q.match(/([가-힣A-Za-z0-9·]+(?:대로|로|길))(?:\s|$)/)?.[1];
 const term=road??q;
 return places.filter(p=>p.name.includes(term)).sort((a,b)=>Number(b.name===term)-Number(a.name===term)).slice(0,25).map(p=>({...p,confidence:'vicinity' as const}));
}
export function distanceMetres(a:[number,number],b:[number,number]){
 const rad=Math.PI/180,lat=(b[1]-a[1])*rad,lon=(b[0]-a[0])*rad;
 const q=Math.sin(lat/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(lon/2)**2;
 return 6371008.8*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));
}
