'use client';
import {equipmentLabel} from '@/lib/planning/types';
import InspectionPanel from './inspection-panel';
import PlanningPanel,{type Capture} from './planning-panel';
import {usePlanner} from './use-planner';
import {planningScene} from '@/lib/planning/scene';
import {toLocal,toWorld} from '@/lib/planning/geometry';
import {createSection,proofReady,LABELS,type Point} from '@/lib/planning/types';
import {emptyInspection,parseInspection,checkInspection,PILOT_SITE_ID,type Inspection} from '@/lib/observations';
import {portableData} from '@/lib/runtime';
import {useEffect,useMemo,useState} from 'react';
import dynamic from 'next/dynamic';
import type {SelectedBuilding,Target} from './map-canvas';
import {distanceMetres,parseCoordinates,searchPlaces,type SearchPlace} from '@/lib/domain';
const MapCanvas=dynamic(()=>import('./map-canvas'),{ssr:false,loading:()=> <div className="map-loading">실제 지역 지도를 준비하고 있습니다…</div>});
const base=process.env.NEXT_PUBLIC_BASE_PATH||'';
const pilot:Target={center:[127.299745,37.228360],label:'용인 양지 · 남평로 주변',zoom:15.8,nonce:0};
const regions:{label:string;center:[number,number]}[]=[{label:'서울',center:[126.978,37.5665]},{label:'인천',center:[126.705,37.456]},{label:'경기',center:[127.019,37.275]},{label:'강원',center:[128.876,37.752]},{label:'대전',center:[127.384,36.351]},{label:'세종',center:[127.289,36.48]},{label:'충북',center:[127.489,36.642]},{label:'충남',center:[127.113,36.815]}];
const emptyFields={clearHeight:'',vehicleHeight:'',margin:'',rampWidth:'',elevatorDoor:'',notes:''};
export default function Workspace(){
 const [target,setTarget]=useState<Target>(pilot),[is3D,set3D]=useState(true),[assumed,setAssumed]=useState(true),[status,setStatus]=useState('지역 지도 불러오는 중'),[archive,setArchive]=useState('수도권'),[count,setCount]=useState(0);
 const [query,setQuery]=useState(''),[places,setPlaces]=useState<SearchPlace[]>([]),[searchStatus,setSearchStatus]=useState('검색 자료 준비 중'),[results,setResults]=useState<ReturnType<typeof searchPlaces>|null>(null);
 const [selected,setSelected]=useState<SelectedBuilding|null>(null),[drawing,setDrawing]=useState(false),[points,setPoints]=useState<[number,number][]>([]),[tab,setTab]=useState<'site'|'conditions'|'sources'|'plan'>('plan');
 const planner=usePlanner();
 const [capture,setCapture]=useState<Capture>(null),[selectedZone,setSelectedZone]=useState(''),[progress,setProgress]=useState(0),[moving,setMoving]=useState<'truck'|'handling'>('truck');
 const activeZone=planner.plan.zones.some(z=>z.id===selectedZone)?selectedZone:planner.result.recommendedId??planner.result.candidates[0]?.id??'';
 const scene=useMemo(()=>planningScene(planner.plan,planner.result,activeZone,progress,moving),[planner.plan,planner.result,activeZone,progress,moving]);
 const [recovery,setRecovery]=useState<{raw:string;reason:string;backupKey?:string}|null>(null);
 const [inspection,setInspection]=useState<Inspection>(emptyInspection);
 const [fields,setFields]=useState(emptyFields),[saveMessage,setSaveMessage]=useState('이 기기에 저장할 수 있습니다');
 useEffect(()=>{let active=true;const embedded=portableData();(embedded?Promise.resolve(new Response(JSON.stringify(embedded.places))):fetch(`${base}/data/places.json`)).then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{if(active){setPlaces(data);setSearchStatus('검색 준비 완료');}}).catch(()=>{if(active)setSearchStatus('검색 자료 로드 실패 · 새로고침하세요');});
 try{
  const raw=localStorage.getItem('letus-pilot-notes-v1');
  if(raw){try{
   const saved=JSON.parse(raw);
   if(!saved||typeof saved!=='object'||Array.isArray(saved)||(!saved.fields&&!saved.inspection&&!Array.isArray(saved.points)))throw Error('저장 형식을 확인할 수 없습니다.');
   const restored=saved.inspection?parseInspection(JSON.stringify(saved.inspection)):emptyInspection();
   if(restored.siteId!==PILOT_SITE_ID)throw Error('다른 현장의 기록이므로 현재 현장에 적용하지 않았습니다.');
   if(saved.fields&&!Object.keys(emptyFields).every(k=>typeof saved.fields[k]==='string'))throw Error('이전 입력값의 형식이 잘못되었습니다.');
   if(saved.points&&(!Array.isArray(saved.points)||!saved.points.every((p:unknown)=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))))throw Error('동선 기록의 형식이 잘못되었습니다.');
   setInspection(restored);if(saved.fields)setFields(saved.fields);if(saved.points)setPoints(saved.points);
   if(typeof saved.recoveryKey==='string'&&/^letus-pilot-recovery-[0-9a-f-]{36}$/.test(saved.recoveryKey)){const backup=localStorage.getItem(saved.recoveryKey);if(backup)setRecovery({raw:backup,reason:'이전 기록의 복구 사본을 보관하고 있습니다.',backupKey:saved.recoveryKey});}
  }catch(e){setRecovery({raw,reason:(e as Error).message});setSaveMessage('기존 확인 기록을 적용하지 못했습니다. 원본을 보호하고 있습니다.');}}
 }catch{setSaveMessage('브라우저 저장 공간을 읽지 못했습니다. 기록 파일을 사용하세요.');}
 return()=>{active=false;};},[]);
 const total=useMemo(()=>points.slice(1).reduce((s,p,i)=>s+distanceMetres(points[i],p),0),[points]);
 function go(center:[number,number],label:string,zoom=15.8){setSelected(null);setTarget({center,label,zoom,nonce:Date.now()});}
 function search(){const coords=parseCoordinates(query);if(coords){go(coords,'입력 좌표 · 주소 미확인');setResults([]);return;}setResults(searchPlaces(query,places));}
 function save(){planner.save();try{
  let recoveryKey=recovery?.backupKey;
  if(recovery&&!recoveryKey){recoveryKey=`letus-pilot-recovery-${crypto.randomUUID()}`;localStorage.setItem(recoveryKey,recovery.raw);setRecovery({...recovery,backupKey:recoveryKey});}
  // The backup write must succeed before replacing a damaged or mismatched record.
  localStorage.setItem('letus-pilot-notes-v1',JSON.stringify({fields,points,inspection,savedAt:new Date().toISOString(),...(recoveryKey?{recoveryKey}:{})}));
  setSaveMessage(recoveryKey?'기록을 저장했습니다. 이전 원본은 복구 사본으로 보존했습니다.':'이 기기에 저장했습니다');
 }catch{setSaveMessage('저장하지 못했습니다. 기존 원본은 유지됩니다. 기록 내려받기를 이용하세요.');}}
 function exportRecovery(){if(!recovery)return;const url=URL.createObjectURL(new Blob([recovery.raw],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='LETUS-복구원본.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function exportRecord(){const record={site:'경기도 용인시 처인구 양지읍 남평로 111-73 · 9층',exactBuildingConfirmed:false,equipment:{trucks:planner.plan.trucks,handling:planner.plan.handling},legacyObservations:fields,inspection,inspectionResult:checkInspection(inspection),plan:planner.plan,planningResult:planner.result,routeSketch:points,routeStatus:'현장 실측 전 · 통과 판정 아님',mapSource:'OpenStreetMap / Protomaps · PLAYX1/playx-raven-maps',createdAt:new Date().toISOString()};const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='LETUS-용인-현장기록.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <div className="app-shell">
  <header className="app-header"><a className="brand" href={`${base}/`}><span className="brand-mark">L<span>↗</span></span><span>LETUS<small>FIELD PLANNER</small></span></a><div className="header-divider"/><div className="workspace-title">반입 현장 3D <span>사전 탐색</span></div><div className="header-actions"><span className="live-dot"/>실제 공개 지도<button className="small-button" onClick={()=>{setTab('plan');planner.issue(activeZone);}}>작업서 발행</button></div></header>
  <div className="main-layout">
   <aside className="sidebar">
    <div className="project-heading"><span className="eyebrow">DELIVERY PROJECT · 001</span><h1>용인 양지 반입 현장</h1><p>남평로 111-73 · 목적층 9층</p><span className="badge amber">{planner.plan.mode==='site'&&proofReady(planner.plan.site.proof)?'사용자 확인 반입구 연결':'111-73 건물 위치 미확인'}</span></div>
    <nav className="tabs" aria-label="현장 정보"><button className={tab==='plan'?'active':''} onClick={()=>setTab('plan')}>반입 계획</button><button className={tab==='site'?'active':''} onClick={()=>setTab('site')}>현장 개요</button><button className={tab==='conditions'?'active':''} onClick={()=>setTab('conditions')}>반입 조건</button><button className={tab==='sources'?'active':''} onClick={()=>setTab('sources')}>데이터 출처</button></nav>
    <div className="sidebar-content">
    {tab==='plan'&&<PlanningPanel plan={planner.plan} result={planner.result} onChange={planner.update} capture={capture} onCapture={setCapture} selectedId={activeZone} onSelect={id=>{setSelectedZone(id);setProgress(0);}} progress={progress} onProgress={setProgress} moving={moving} onMoving={setMoving} onFocus={point=>go(toWorld(point,planner.plan.origin),'반입 계획 · 지정 위치',18.5)} order={planner.order} onIssue={()=>planner.issue(activeZone)} onExample={()=>{planner.showExample();setCapture(null);setProgress(0);go(planner.plan.origin,'합성 계산 예제 · 실제 현장 아님',18);}} onExitExample={()=>{planner.exitExample();setCapture(null);go(pilot.center,pilot.label);}} recovery={planner.recovery}/>}

    {tab==='site'&&<>
     <section><div className="section-title"><h2>현장 위치</h2><span className="step-number">01</span></div><p className="address">경기도 용인시 처인구 양지읍<br/>남평로 111-73</p><p className="muted">공개 지도에서 남평로를 확인했습니다. 핀은 도로 주변이며, 실제 작업 동·출입구는 아직 연결되지 않았습니다.</p><button className="outline-button full" onClick={()=>go(pilot.center,pilot.label)}>⌖ 남평로 주변 보기</button></section>
     <section><div className="section-title"><h2>반입 장비</h2><span className="step-number">02</span></div><div className="equipment"><span className="equipment-icon">▰</span><div><strong>선택한 반입 차량</strong><p>{planner.plan.trucks.map(e=>equipmentLabel(e)).join(' / ')}</p></div><b>{planner.plan.trucks.length}<span>대</span></b></div><div className="equipment"><span className="equipment-icon">♧</span><div><strong>{equipmentLabel(planner.plan.handling)}</strong><p>실제 제원과 작업 조건 별도 확인</p></div><b>1<span>대</span></b></div><button className="outline-button full" onClick={()=>setTab('plan')}>반입 계획에서 차량·장비 선택</button></section>
     <section><div className="section-title"><h2>반입 경로 스케치</h2><span className="step-number">03</span></div><p className="muted">지도 위를 순서대로 눌러 접근 동선을 기록하세요. 거리는 지도상 수평 거리입니다.</p><button className={drawing?'primary-button full':'outline-button full'} onClick={()=>setDrawing(!drawing)}>{drawing?'✓ 경로 그리기 마침':'＋ 지도에 경로 그리기'}</button>{points.length>0&&<div className="route-summary"><span>{points.length}개 지점 · 약 {Math.round(total)}m</span><button onClick={()=>setPoints(points.slice(0,-1))}>되돌리기</button><button onClick={()=>setPoints([])}>초기화</button></div>}<div className={`notice compact status-${checkInspection(inspection).overall}`} data-testid="overview-inspection">기록 조건 비교: {LABELS[checkInspection(inspection).overall]}<br/><small>출처별 단일 차량 치수 비교 결과</small></div><div className={`notice compact status-${planner.result.status}`}>반입 후보: {LABELS[planner.result.status]}<br/><button className="text-button" onClick={()=>setTab('plan')}>경로·하차 후보 검사 보기</button></div></section>
    </>}
    {tab==='conditions'&&<><InspectionPanel store={inspection} onChange={next=>{setInspection(next);setSaveMessage('변경 사항을 저장하세요');}} hasLegacy={Object.entries(fields).some(([k,v])=>k!=='notes'&&!!v)}/><section><label className="field">현장 메모<textarea maxLength={10000} value={fields.notes} onChange={e=>setFields({...fields,notes:e.target.value})} placeholder="작업 동·반입구·변경 사항" rows={4}/></label></section></>}
    {tab==='sources'&&<>
     <section><h2>실제 지도 데이터</h2><span className={status==='지도 연결됨'?'badge green':'badge amber'}>{status==='지도 연결됨'?'실제 지도 연결 · API 키 불필요':'지도 연결 확인 필요'}</span><p className="muted">OpenStreetMap의 도로·건물 윤곽을 Protomaps가 가공한 지역 자료입니다. 사진 기반 모델이나 실내 도면은 포함하지 않습니다.</p><dl className="source-details"><dt>제공 자료</dt><dd>수도권 74MB · 강원 23MB · 충청 45MB</dd><dt>확보일</dt><dd>2026.11.09 · 자료별 해시 검증</dd><dt>원자료 갱신일</dt><dd>개별 건물별 확인 불가</dd><dt>표시 정밀도</dt><dd>수도권 z14 · 강원/충청 z13의 일반화된 윤곽</dd></dl><p className="muted">수도권 북부·섬과 지도 미등록 건물 등 빈 구역이 있습니다. 모든 주소의 건물이나 세부 치수가 확보된 상태는 아닙니다.</p><a href={portableData()?.manifestUrl??`${base}/data/map-sources.json`} target="_blank" rel="noreferrer">원본 주소·검증 해시 보기 ↗</a></section>
     <section><h2>높이 표시 기준</h2><p className="muted">청록색: 지도에 높이 값이 있는 건물. 회색: 높이가 없어 시각화를 위해 6m로 표시한 건물. 지도 높이도 실측 검증되지 않았습니다.</p><p className="muted">램프, 주차장 유효 높이, E/V 정보: 연동 미완료. 현재 화면에서 통과 가능한 것으로 표시하지 않습니다.</p></section>
     <section><h2>출처 및 이용조건</h2><p><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap · ODbL ↗</a></p><p><a href="https://github.com/PLAYX1/playx-raven-maps/tree/a30620ace8a174a0d7474c4785f564f22cdac064" target="_blank" rel="noreferrer">배포 원본 · PLAYX1 ↗</a></p></section>
    </>}
    </div>
    <footer className="sidebar-footer">{recovery&&<div className="recovery-notice"><small>{recovery.reason}</small><button className="text-button" onClick={exportRecovery}>복구 원본 내려받기</button></div>}<div className="save-row"><button className="primary-button" onClick={save}>기록 저장</button><button className="outline-button" onClick={exportRecord}>기록 내려받기</button></div><small role="status">{saveMessage}</small>{planner.storageMessage&&<small role="status">{planner.storageMessage}</small>}</footer>
   </aside>
   <main className="map-workspace">
    <div className="map-topbar"><form className="search" onSubmit={e=>{e.preventDefault();search();}}><span aria-hidden="true">⌕</span><input aria-label="주소·도로·장소 검색" placeholder="도로명·장소 또는 경도,위도 검색" value={query} onChange={e=>setQuery(e.target.value)}/><button type="submit" disabled={!places.length}>검색</button></form><span className="search-status" data-testid="search-ready">{searchStatus}</span></div>
    <div className="region-bar"><span>지역</span>{regions.map(r=><button key={r.label} onClick={()=>go(r.center,r.label+' · 중심부',15.5)}>{r.label}</button>)}<span className="region-meta">실제 건물 윤곽</span></div>
    <div className="map-stage">
     <MapCanvas target={target} is3D={is3D} assumed={assumed} drawing={drawing||!!capture} points={points} scene={scene} onPoint={point=>{
      if(!capture){setPoints(previous=>[...previous,point]);return;}
      const local=toLocal(point,planner.plan.origin);if(local.some(n=>Math.abs(n)>10000)){setSaveMessage('현장 기준점 10km 안에서 지정하세요.');return;}
      const p=planner.plan;
      if(capture.kind==='route')planner.update({...p,routes:p.routes.map(r=>r.id===capture.id&&r.points.length<24?{...r,points:[...r.points,local],sections:r.points.length?[...r.sections,createSection()]:[],surveyed:false,proof:{...r.proof,confirmed:false}}:r)});
      else if(capture.kind==='zone'){planner.update({...p,zones:p.zones.map(z=>z.id===capture.id?{...z,center:local,proof:{...z.proof,confirmed:false}}:z)});setCapture(null);}
      else{planner.update({...p,obstacles:p.obstacles.map(o=>o.id===capture.id?{...o,center:local,proof:{...o.proof,confirmed:false}}:o)});setCapture(null);}
     }} onBuilding={setSelected} onStatus={setStatus} onStats={setCount} onArchive={setArchive}/>
     <div className="map-location"><span className="live-dot"/><div><strong data-testid="current-location">{target.label}</strong><small>주변 탐색 · 정확한 반입구 미확인</small></div></div>
     {results!==null&&<div className="search-results" data-testid="search-results"><div><strong>지도 검색 결과</strong><button aria-label="검색 결과 닫기" onClick={()=>setResults(null)}>×</button></div><small>도로·장소의 주변 위치입니다. 건물 번호를 확정하지 않습니다.</small>{results.length?results.map((r,i)=><button className="search-result" key={`${r.name}-${i}`} onClick={()=>{go(r.center,`${r.name} 주변`);setResults(null);}}><strong>{r.name}</strong><span>{r.kind==='road'?'도로 주변':'장소 주변'} · {r.center.map(n=>n.toFixed(4)).join(', ')}</span></button>):<p>{parseCoordinates(query)?'입력한 좌표로 이동했습니다.':'검색 결과가 없습니다. 도로명 또는 경도,위도로 검색하세요.'}</p>}</div>}
     <div className="map-tools"><button className={is3D?'active':''} onClick={()=>set3D(true)}>3D</button><button className={!is3D?'active':''} onClick={()=>set3D(false)}>2D</button><button aria-label="용인 현장 주변으로 이동" title="용인 현장 주변" onClick={()=>go(pilot.center,pilot.label)}>⌖</button></div>
     {(drawing||capture)&&<div className="drawing-hint">{capture?'지도 클릭으로 계획 위치 지정 · 치수와 출처 확인 필요':'지도 클릭으로 동선 추가 · 통과 검사가 아닌 경로 스케치'}</div>}{planner.plan.mode==='example'&&<div className="map-example">합성 계산 예제 · 실제 현장의 경로·장비가 아닙니다</div>}
     {selected&&<div className="building-card"><button className="close" aria-label="건물 정보 닫기" onClick={()=>setSelected(null)}>×</button><span className="eyebrow">MAP BUILDING</span><h3>선택한 건물 윤곽</h3><dl><dt>지도 높이</dt><dd>{selected.height!==null?`${selected.height}m · 실측 미검증`:'정보 없음'}</dd><dt>건물 주소</dt><dd>연결되지 않음</dd><dt>내부·반입 조건</dt><dd>정보 부족</dd></dl><p>지도에서 일반화된 외형입니다. 건물 번호·실내 높이·램프 통과 치수로 사용할 수 없습니다.</p></div>}
     <div className="map-legend"><div><i className="legend-dot known"/>지도 높이 있음 <i className="legend-dot unknown"/>높이 미확인</div><label><input type="checkbox" checked={assumed} onChange={e=>setAssumed(e.target.checked)}/> 미확인 높이를 표시용 6m로 보기</label><small>건물 외형 탐색용 · 실측 및 통과 판정용 아님</small></div>
    </div>
    <div className="map-statusbar"><span data-testid="map-status"><i className={status==='지도 연결됨'?'live-dot':'loading-dot'}/>{status}</span><span>{archive} · 표시 윤곽 <b data-testid="building-count">{count}</b></span><span>© OpenStreetMap · Protomaps</span></div>
   </main>
  </div>
 </div>;
}
