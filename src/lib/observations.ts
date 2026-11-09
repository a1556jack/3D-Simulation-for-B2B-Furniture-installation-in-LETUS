import {evaluateClearance,type Verdict} from './domain';

export const FIELD_DEFINITIONS={
 ramp_width:{label:'램프 유효 폭',group:'램프',units:['m','mm'],kind:'length'},
 ramp_height:{label:'램프 유효 높이',group:'램프',units:['m','mm'],kind:'length'},
 ramp_slope:{label:'램프 경사',group:'램프',units:['%'],kind:'slope'},
 parking_height:{label:'주차장 유효 높이',group:'주차장',units:['m','mm'],kind:'length'},
 unloading_width:{label:'하차 공간 유효 폭',group:'하차 공간',units:['m','mm'],kind:'length'},
 unloading_length:{label:'하차 공간 유효 길이',group:'하차 공간',units:['m','mm'],kind:'length'},
 elevator_door_width:{label:'E/V 문 유효 폭',group:'E/V',units:['m','mm'],kind:'length'},
 elevator_cabin_width:{label:'E/V 내부 폭',group:'E/V',units:['m','mm'],kind:'length'},
 elevator_cabin_length:{label:'E/V 내부 깊이',group:'E/V',units:['m','mm'],kind:'length'},
 elevator_cabin_height:{label:'E/V 내부 높이',group:'E/V',units:['m','mm'],kind:'length'},
 elevator_capacity:{label:'E/V 정격하중',group:'E/V',units:['kg','t'],kind:'mass'},
 elevator_floors:{label:'E/V 운행층',group:'E/V',units:['text'],kind:'text'},
 elevator_conditions:{label:'E/V 이용조건·위치',group:'E/V',units:['text'],kind:'text'},
 vehicle_height:{label:'실제 차량 높이',group:'차량',units:['m','mm'],kind:'length'},
 vehicle_width:{label:'실제 차량 폭',group:'차량',units:['m','mm'],kind:'length'},
 vehicle_length:{label:'실제 차량 길이',group:'차량',units:['m','mm'],kind:'length'},
 forklift_height:{label:'지게차 하강 마스트 높이',group:'지게차',units:['m','mm'],kind:'length'},
 forklift_width:{label:'지게차 전폭',group:'지게차',units:['m','mm'],kind:'length'},
 forklift_length:{label:'지게차 전장',group:'지게차',units:['m','mm'],kind:'length'},
 forklift_mass:{label:'지게차 자중',group:'지게차',units:['kg','t'],kind:'mass'},
 forklift_capacity:{label:'지게차 정격인양하중',group:'지게차',units:['kg','t'],kind:'mass'},
 load_width:{label:'최대 적재물 폭',group:'적재물',units:['m','mm'],kind:'length'},
 load_length:{label:'최대 적재물 길이',group:'적재물',units:['m','mm'],kind:'length'},
 load_height:{label:'최대 적재물 높이',group:'적재물',units:['m','mm'],kind:'length'},
 load_mass:{label:'최대 적재물 무게',group:'적재물',units:['kg','t'],kind:'mass'},
} as const;
export type FieldKey=keyof typeof FIELD_DEFINITIONS;
export const METHODS={measurement:'현장 실측',document:'관리사무소·도면',manufacturer:'제조사 제원',public:'공개 자료'} as const;
export type Observation={id:string;field:FieldKey;value:number|string;unit:string;source:string;checkedAt:string;method:keyof typeof METHODS;status:'pending'|'reviewed';reviewer?:string;reviewedAt?:string};
export type ObservationInput=Omit<Observation,'status'|'reviewer'|'reviewedAt'>;
export type Inspection={schemaVersion:1;siteId:string;observations:Observation[];selected:Partial<Record<FieldKey,string>>;margins:{height:number|null;width:number|null}};
export const MAX_FILE_BYTES=8_000_000;
export const PILOT_SITE_ID='yongin-nampyeong-111-73-floor9';
export function emptyInspection():Inspection{return {schemaVersion:1,siteId:PILOT_SITE_ID,observations:[],selected:{},margins:{height:null,width:null}};}
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function validDate(s:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;}
function text(v:unknown,max:number,name:string,required=false){if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw Error(`${name} 형식을 확인하세요.`);return v.trim();}
export function makeObservation(input:ObservationInput):Observation{
 if(!record(input)||typeof input.field!=='string'||!Object.hasOwn(FIELD_DEFINITIONS,input.field))throw Error('지원하지 않는 확인 항목입니다.');
 const def=FIELD_DEFINITIONS[input.field];
 if(!(def.units as readonly string[]).includes(input.unit))throw Error('항목과 단위가 맞지 않습니다.');
 const id=text(input.id,100,'기록 ID',true);
 let value:number|string;
 if(def.kind==='text')value=text(input.value,2000,'기록 내용',true);
 else{if(typeof input.value!=='number'||!Number.isFinite(input.value)||input.value>1e7||input.value<0||(input.value===0&&def.kind!=='slope'))throw Error('유효한 수치를 입력하세요.');value=input.value;}
 const source=text(input.source,500,'출처');const checkedAt=text(input.checkedAt,10,'확인일');
 if(checkedAt&&!validDate(checkedAt))throw Error('올바른 확인일을 입력하세요.');
 if(typeof input.method!=='string'||!Object.hasOwn(METHODS,input.method))throw Error('확인 방법을 선택하세요.');
 return {id,field:input.field,value,unit:input.unit,source,checkedAt,method:input.method,status:'pending'};
}
export function normalizedValue(o:Observation):number|null{if(typeof o.value!=='number')return null;return o.unit==='mm'?o.value/1000:o.unit==='t'?o.value*1000:o.value;}
function hasProvenance(o:Observation){return !!o.source.trim()&&validDate(o.checkedAt);}
export function reviewObservation(store:Inspection,id:string,reviewer:string):Inspection{
 const name=text(reviewer,100,'확인자',true),o=store.observations.find(x=>x.id===id);
 if(!o||!hasProvenance(o))throw Error('출처와 확인일을 기록한 뒤 확인하세요.');
 // Revalidate values even if records were constructed outside the form.
 makeObservation(o);
 return {...store,observations:store.observations.map(x=>x.id===id?{...x,status:'reviewed',reviewer:name,reviewedAt:new Date().toISOString()}:x),selected:{...store.selected,[o.field]:id}};
}
export function parseInspection(input:string):Inspection{
 if(input.length>MAX_FILE_BYTES||new TextEncoder().encode(input).byteLength>MAX_FILE_BYTES)throw Error('기록 파일은 8MB 이하여야 합니다.');
 let data:unknown;try{data=JSON.parse(input);}catch{throw Error('JSON 기록 파일을 읽을 수 없습니다.');}
 if(record(data)&&record(data.inspection))data=data.inspection;
 if(!record(data)||data.schemaVersion!==1||!Array.isArray(data.observations)||data.observations.length>500||!record(data.selected)||!record(data.margins))throw Error('지원하지 않는 현장 기록 형식입니다.');
 const siteId=text(data.siteId,200,'현장 ID',true);
 const observations=data.observations.map((raw:unknown)=>{
  if(!record(raw))throw Error('관측값 형식을 확인하세요.');
  const o=makeObservation(raw as ObservationInput);
  if(raw.status!=='pending'&&raw.status!=='reviewed')throw Error('검토 상태가 올바르지 않습니다.');
  if(raw.status==='reviewed'){
   if(!hasProvenance(o)||typeof raw.reviewedAt!=='string'||!Number.isFinite(Date.parse(raw.reviewedAt)))throw Error('검토 이력이 불완전합니다.');
   return {...o,status:'reviewed' as const,reviewer:text(raw.reviewer,100,'확인자',true),reviewedAt:raw.reviewedAt};
  }return o;
 });
 if(new Set(observations.map(o=>o.id)).size!==observations.length)throw Error('파일 안에 중복된 기록 ID가 있습니다.');
 const selected:Inspection['selected']={};
 for(const [key,id] of Object.entries(data.selected)){
  const o=observations.find(x=>x.id===id);
  if(!Object.hasOwn(FIELD_DEFINITIONS,key)||!o||o.field!==key||o.status!=='reviewed')throw Error('선택한 기록의 항목이 맞지 않습니다.');
  selected[key as FieldKey]=o.id;
 }
 const margins:Inspection['margins']={height:null,width:null};
 for(const key of ['height','width'] as const){const v=data.margins[key];if(v!==null&&(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1000))throw Error('여유 치수 형식을 확인하세요.');margins[key]=v as number|null;}
 return {schemaVersion:1,siteId,observations,selected,margins};
}
function signature(o:Observation){return JSON.stringify([o.field,o.value,o.unit,o.source,o.checkedAt,o.method]);}
export function mergeInspection(local:Inspection,incoming:Inspection){
 const checked=parseInspection(JSON.stringify(incoming));
 if(checked.siteId!==local.siteId)throw Error('다른 현장의 기록입니다. 현재 현장에 자동 연결하지 않습니다.');
 const store:Inspection={...local,observations:[...local.observations],selected:{...local.selected},margins:{...local.margins}};
 const conflicts:string[]=[];let duplicates=0,added=0;
 for(const row of checked.observations){const prior=store.observations.find(x=>x.id===row.id);
  if(prior){if(signature(prior)===signature(row))duplicates++;else conflicts.push(row.id);continue;}
  store.observations.push(makeObservation(row));added++;
 }
 if(store.observations.length>500)throw Error('한 현장에는 최대 500개의 기록을 저장할 수 있습니다.');
 return {store,conflicts,duplicates,added};
}
export function selectedObservation(store:Inspection,key:FieldKey){return store.observations.find(o=>o.id===store.selected[key]&&o.field===key&&o.status==='reviewed'&&hasProvenance(o));}
export function checkInspection(store:Inspection){
 const definitions:[FieldKey,FieldKey,'height'|'width',string][]=[['ramp_height','vehicle_height','height','램프 높이 · 차량 이동 외형'],['ramp_width','vehicle_width','width','램프 폭 · 직선 구간'],['parking_height','vehicle_height','height','주차장 높이 · 차량 이동 외형']];
 const items=definitions.map(([id,equipment,margin,label])=>{const available=selectedObservation(store,id),required=selectedObservation(store,equipment);const status=evaluateClearance(available?normalizedValue(available):null,required?normalizedValue(required):null,store.margins[margin]);return {id,label,status,available,required,margin:store.margins[margin]};});
 // Even all individual straight-section checks cannot establish full-route passage.
 const overall:Verdict=items.some(i=>i.status==='fail')?'fail':'unknown';
 return {items,overall,missing:(Object.keys(FIELD_DEFINITIONS) as FieldKey[]).filter(key=>!selectedObservation(store,key))};
}
