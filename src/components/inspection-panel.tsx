'use client';
import {useEffect,useRef,useState} from 'react';
import {FIELD_DEFINITIONS,METHODS,MAX_FILE_BYTES,checkInspection,makeObservation,mergeInspection,parseInspection,reviewObservation,type FieldKey,type Inspection,type Observation} from '@/lib/observations';
const fields=Object.entries(FIELD_DEFINITIONS) as [FieldKey,(typeof FIELD_DEFINITIONS)[FieldKey]][];
const groups=[...new Set(fields.map(([,v])=>v.group))];
const verdicts={pass:'입력 조건상 충족',fail:'조건 초과',unknown:'정보 부족'};
export default function InspectionPanel({store,onChange,hasLegacy}:{store:Inspection;onChange:(s:Inspection)=>void;hasLegacy:boolean}){
 const [field,setField]=useState<FieldKey>('ramp_height');
 const [value,setValue]=useState(''),[unit,setUnit]=useState('m'),[source,setSource]=useState(''),[date,setDate]=useState(''),[method,setMethod]=useState<keyof typeof METHODS>('measurement');
 const [reviewer,setReviewer]=useState(''),[message,setMessage]=useState(''),[importMessage,setImportMessage]=useState('');
 const [reading,setReading]=useState(false);const active=useRef(true),readingRef=useRef(false);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 const result=checkInspection(store),def=FIELD_DEFINITIONS[field];
 function add(){try{
  if(!value.trim())throw Error('관측값을 입력하세요.');if(store.observations.length>=500)throw Error('한 현장에는 최대 500개의 기록을 저장할 수 있습니다.');
  const observation=makeObservation({id:crypto.randomUUID(),field,value:def.kind==='text'?value:Number(value),unit,source,checkedAt:date,method});
  onChange({...store,observations:[...store.observations,observation]});setValue('');setMessage('검토 대기 기록을 추가했습니다. 출처를 확인한 후 사용할 값을 선택하세요.');
 }catch(e){setMessage(e instanceof Error?e.message:'기록을 추가하지 못했습니다.');}}
 function review(o:Observation){try{onChange(reviewObservation(store,o.id,reviewer));setMessage(`${FIELD_DEFINITIONS[o.field].label}: 이 기록을 선택했습니다. 다른 기록은 이력으로 보존됩니다.`);}catch(e){setMessage((e as Error).message);}}
 function margin(key:'height'|'width',raw:string){const v=raw.trim()===''?null:Number(raw);if(v!==null&&(!Number.isFinite(v)||v<0||v>1000)){setMessage('여유 치수는 0 이상 1000 이하로 입력하세요.');return;}onChange({...store,margins:{...store.margins,[key]:v}});}
 async function importFile(file:File|undefined){if(!file||readingRef.current)return;readingRef.current=true;setReading(true);setImportMessage('기록 파일을 읽는 중입니다.');try{
  if(file.size>MAX_FILE_BYTES)throw Error('기록 파일은 8MB 이하여야 합니다.');
  const text=await file.text();if(!active.current)return;const incoming=parseInspection(text),merged=mergeInspection(store,incoming);onChange(merged.store);
  setImportMessage(`검토 대기 ${merged.added}건 추가 · 중복 ${merged.duplicates}건 제외${merged.conflicts.length?` · ID 충돌 ${merged.conflicts.length}건: 기존 값 유지 (${merged.conflicts.join(', ')})`:''}. 선택된 실측값과 여유 설정은 유지했습니다.`);
 }catch(e){if(active.current)setImportMessage((e as Error).message);}finally{readingRef.current=false;if(active.current)setReading(false);}}
 return <fieldset className="inspection-form" disabled={reading} aria-busy={reading}>
  <section>
   <div className="section-title"><h2>출처별 반입 조건</h2><span className="badge amber">현장 자료 입력</span></div>
   <p className="muted">이 현장의 작업 동·출입구는 아직 지도에 확정 연결되지 않았습니다. 아래 기록은 등록 현장에 보관하며, 지도 높이를 실측값으로 가져오지 않습니다.</p>
   {hasLegacy&&<p className="notice compact">이전 간단 입력값은 내보내기 파일에 보존됩니다. 출처가 없어 확인된 실측값으로 승격하지 않았습니다.</p>}
   <label className="field">확인 항목<select value={field} onChange={e=>{const k=e.target.value as FieldKey;setField(k);setUnit(FIELD_DEFINITIONS[k].units[0]);setValue('');}}>{groups.map(g=><optgroup key={g} label={g}>{fields.filter(([,d])=>d.group===g).map(([k,d])=><option key={k} value={k}>{d.label}</option>)}</optgroup>)}</select></label>
   <div className="observation-input-row"><label className="field">관측값{def.kind==='text'?<textarea value={value} onChange={e=>setValue(e.target.value)} maxLength={2000} rows={2} placeholder="위치·운행층·시간 등 확인한 내용을 입력"/>:<input type="number" value={value} onChange={e=>setValue(e.target.value)} min={def.kind==='slope'?0:0.001} step="any" placeholder="미확인"/>}</label><label className="field">단위<select value={unit} onChange={e=>setUnit(e.target.value)}>{def.units.map(u=><option key={u} value={u}>{u==='text'?'내용':u}</option>)}</select></label></div>
   <label className="field">출처<input value={source} onChange={e=>setSource(e.target.value)} maxLength={500} placeholder="도면명·관리사무소 확인자·공식 제원 주소"/></label>
   <div className="observation-input-row equal"><label className="field">확인일<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label className="field">확인 방법<select value={method} onChange={e=>setMethod(e.target.value as keyof typeof METHODS)}>{Object.entries(METHODS).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label></div>
   <button className="outline-button full record-add" onClick={add}>기록 추가</button>
   <p className="form-message" role="status">{message}</p>
  </section>
  <section>
   <div className="section-title"><h2>기록 확인 및 선택</h2><span className="step-number">{store.observations.length}건</span></div>
   <label className="field">확인자<input value={reviewer} onChange={e=>setReviewer(e.target.value)} placeholder="이 기기에서 자료를 확인하는 담당자" maxLength={100}/></label>
   <p className="muted">출처·확인일을 검토한 후 사용할 값을 선택하세요. 가져온 기록의 검토 상태는 자동으로 신뢰하지 않습니다.</p>
   {fields.filter(([key])=>store.observations.some(o=>o.field===key)).map(([key,d])=><article className="observation-group" data-testid={`records-${key}`} key={key}><h3>{d.label}</h3>{store.observations.filter(o=>o.field===key).map(o=><div className={store.selected[key]===o.id?'observation-row selected':'observation-row'} key={o.id}>
    <div className="observation-value"><strong>{o.value}{o.unit==='text'?'':` ${o.unit}`}</strong><span className={o.status==='reviewed'?'badge green':'badge amber'}>{store.selected[key]===o.id?'선택됨':o.status==='reviewed'?'확인 이력':'검토 대기'}</span></div>
    <p>{o.source||'출처 미기록'}<br/>{o.checkedAt||'확인일 미기록'} · {METHODS[o.method]}</p>
    {o.reviewer&&<small>확인자 {o.reviewer} · {o.reviewedAt?.slice(0,10)}</small>}
    {store.selected[key]!==o.id?<button className="outline-button" onClick={()=>review(o)}>확인하여 사용</button>:<button className="text-button" onClick={()=>{const selected={...store.selected};delete selected[key];onChange({...store,selected});}}>선택 해제</button>}
   </div>)}</article>)}
   {store.observations.length===0&&<p className="muted">아직 출처가 기록된 현장 정보가 없습니다.</p>}
   <label className="outline-button import-button">기록 파일 가져오기<input aria-label="현장 기록 파일 가져오기" type="file" accept="application/json,.json" onChange={e=>{void importFile(e.target.files?.[0]);e.target.value='';}}/></label>
   <p className="form-message" data-testid="import-status" role="status">{importMessage}</p>
  </section>
  <section>
   <h2>입력 조건 비교</h2><p className="muted">아래 비교는 선택한 차량의 직선 구간 외형에 한정합니다. 6대의 실제 제원이 다르면 차량마다 별도로 확인해야 합니다.</p>
   <div className="observation-input-row equal"><label className="field">높이 여유 (m)<input type="number" min="0" step="0.01" value={store.margins.height??''} onChange={e=>margin('height',e.target.value)} placeholder="관리자 설정 필요"/></label><label className="field">폭 여유 (m)<input type="number" min="0" step="0.01" value={store.margins.width??''} onChange={e=>margin('width',e.target.value)} placeholder="관리자 설정 필요"/></label></div>
   {result.items.map(item=><div className={`verdict ${item.status}`} key={item.id} data-testid={`check-${item.id}`}><small>{item.label}</small><strong>{verdicts[item.status]}</strong><small>{item.available&&item.required?`${item.available.value} ${item.available.unit} / 차량 ${item.required.value} ${item.required.unit}`:'출처를 확인하고 공간 치수와 실제 차량 제원을 선택하세요.'}{item.margin===null?' · 여유 미설정':` · 여유 ${item.margin}m`}</small></div>)}
   <div className={`notice ${result.overall}`} data-testid="inspection-overall"><strong>전체 반입: {verdicts[result.overall]}</strong><br/><small>회전·경사 전환부·윙 개방·지게차 하역·바닥 하중은 별도 확인 대상입니다. E/V 탑승은 자동 통과 판정에 포함하지 않습니다.</small></div>
  </section>
  <section><h2>추가 확인할 데이터 · {result.missing.length}개</h2><details className="missing-observations"><summary>미확인 항목 보기</summary><ul className="checklist">{result.missing.map(k=><li key={k}>{FIELD_DEFINITIONS[k].label}</li>)}</ul></details><p className="muted">지게차 정격인양하중과 장비 자중은 별도 항목입니다. E/V 하중만으로 지게차의 탑승 가능 여부를 판단하지 않습니다.</p><p className="muted">공공 API의 램프·주차장·E/V 연동은 미완료입니다. 이 기록은 현재 기기에 저장되며 팀 서버로 자동 공유되지 않습니다.</p></section>
 </fieldset>;
}
