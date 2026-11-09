import {describe,test,expect} from 'vitest';
import {emptyInspection,makeObservation,reviewObservation,mergeInspection,parseInspection,checkInspection,normalizedValue, type FieldKey} from '../src/lib/observations';
const metadata={source:'관리사무소 도면 A-01',checkedAt:'2026-11-09',method:'document' as const};
function add(store:ReturnType<typeof emptyInspection>,field:FieldKey,value:number|string,unit:string,id:string=field){const o=makeObservation({id,field,value,unit,...metadata});return {...store,observations:[...store.observations,o]};}
function reviewed(store:ReturnType<typeof emptyInspection>,id:string){return reviewObservation(store,id,'현장 관리자');}
describe('source-backed observations',()=>{
 test('new records are pending and missing provenance cannot be reviewed',()=>{const s=add(emptyInspection(),'parking_height',4500,'mm');expect(s.observations[0].status).toBe('pending');expect(()=>reviewed({...s,observations:[{...s.observations[0],source:''}]},'parking_height')).toThrow();});
 test('unit conversion is explicit and validates matching dimensions',()=>{expect(normalizedValue(makeObservation({id:'a',field:'parking_height',value:4500,unit:'mm',...metadata}))).toBe(4.5);expect(normalizedValue(makeObservation({id:'b',field:'elevator_capacity',value:3,unit:'t',...metadata}))).toBe(3000);expect(()=>makeObservation({id:'c',field:'parking_height',value:4,unit:'kg',...metadata})).toThrow();});
 test.each([NaN,Infinity,-1,0])('invalid clear height %s is rejected',v=>{expect(()=>makeObservation({id:'a',field:'parking_height',value:v,unit:'m',...metadata})).toThrow();});
 test('impossible dates and invalid field keys are rejected',()=>{expect(()=>makeObservation({id:'a',field:'parking_height',value:4,unit:'m',...metadata,checkedAt:'2026-02-30'})).toThrow();expect(()=>makeObservation({id:'a',field:'__proto__' as FieldKey,value:4,unit:'m',...metadata})).toThrow();});
 test('review explicitly selects a record and requires reviewer identity',()=>{const s=add(emptyInspection(),'ramp_width',4,'m');expect(()=>reviewObservation(s,'ramp_width','')).toThrow();expect(reviewed(s,'ramp_width').selected.ramp_width).toBe('ramp_width');});
});
describe('file synchronization without overwrites',()=>{
 test('new imported records are pending and cannot replace selected local measurements',()=>{const local=reviewed(add(emptyInspection(),'parking_height',4.5,'m'),'parking_height');const remote=reviewed(add(emptyInspection(),'parking_height',5,'m','public-update'),'public-update');const result=mergeInspection(local,remote);expect(result.store.selected.parking_height).toBe('parking_height');expect(result.store.observations[1].status).toBe('pending');});
 test('duplicate submission is idempotent after local review',()=>{const s=reviewed(add(emptyInspection(),'parking_height',4.5,'m'),'parking_height');const result=mergeInspection(s,s);expect(result.store).toEqual(s);expect(result.duplicates).toBe(1);});
 test('changed content with same ID is reported as a conflict and preserved',()=>{const s=reviewed(add(emptyInspection(),'parking_height',4.5,'m'),'parking_height');const remote=add(emptyInspection(),'parking_height',3.5,'m');const result=mergeInspection(s,remote);expect(result.conflicts).toEqual(['parking_height']);expect(result.store.observations[0].value).toBe(4.5);});
 test('records from another building/site are rejected',()=>{expect(()=>mergeInspection(emptyInspection(),{...emptyInspection(),siteId:'another-site'})).toThrow(/현장/);});
 test('malformed selected IDs and corrupted input fail without partial changes',()=>{expect(()=>parseInspection('{broken')).toThrow();const s=add(emptyInspection(),'parking_height',4.5,'m');expect(()=>parseInspection(JSON.stringify({...s,selected:{vehicle_height:'parking_height'}}))).toThrow();});
 test('accepts exported record envelopes',()=>{expect(parseInspection(JSON.stringify({inspection:emptyInspection()}))).toEqual(emptyInspection());});
});
describe('scope and incomplete input',()=>{
 test('no data never passes and elevator is always outside automatic passage',()=>{const r=checkInspection(emptyInspection());expect(r.overall).toBe('unknown');expect(r.items.every(x=>x.status==='unknown')).toBe(true);expect(r.items.some(x=>x.id.startsWith('elevator'))).toBe(false);});
 test('reviewed dimensions plus explicit margin pass only the individual comparison',()=>{let s=reviewed(reviewed(add(add(emptyInspection(),'parking_height',4500,'mm'),'vehicle_height',4,'m'),'parking_height'),'vehicle_height');expect(checkInspection(s).items.find(x=>x.id==='parking_height')?.status).toBe('unknown');s={...s,margins:{...s.margins,height:0.3}};const r=checkInspection(s);expect(r.items.find(x=>x.id==='parking_height')?.status).toBe('pass');expect(r.overall).toBe('unknown');});
 test('confirmed failure dominates other unknown conditions and missing margin',()=>{const s=reviewed(reviewed(add(add(emptyInspection(),'parking_height',3.8,'m'),'vehicle_height',4,'m'),'parking_height'),'vehicle_height');expect(checkInspection(s).overall).toBe('fail');});
});
test('a valid maximum-size history can be exported and read again',()=>{
 const s=emptyInspection();s.observations=Array.from({length:500},(_,i)=>makeObservation({id:`history-${i}`,field:'elevator_conditions',value:'가'.repeat(2000),unit:'text',...metadata,source:'나'.repeat(500)}));
 expect(parseInspection(JSON.stringify(s)).observations).toHaveLength(500);
});
test('JSON arrays cannot masquerade as field or method enums',()=>{
 const o={id:'a',field:'parking_height',value:4.5,unit:'m',...metadata};
 expect(()=>makeObservation({...o,field:['parking_height']} as never)).toThrow();
 expect(()=>makeObservation({...o,method:['measurement']} as never)).toThrow();
});
