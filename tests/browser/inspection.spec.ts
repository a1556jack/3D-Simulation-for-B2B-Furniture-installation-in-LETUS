import {expect,test} from '@playwright/test';
async function addRecord(page:import('@playwright/test').Page,field:string,value:string,unit:string){
 await page.getByRole('combobox',{name:'확인 항목',exact:true}).selectOption(field);await page.getByLabel('관측값',{exact:true}).fill(value);await page.getByRole('combobox',{name:'단위',exact:true}).selectOption(unit);await page.getByLabel('출처',{exact:true}).fill('테스트용 합성 실측');await page.getByLabel('확인일',{exact:true}).fill('2026-11-09');await page.getByRole('button',{name:'기록 추가',exact:true}).click();
}
test('reviewed measurements compare without approving the full route and survive reload',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'반입 조건',exact:true}).click();
 await addRecord(page,'parking_height','4500','mm');await addRecord(page,'vehicle_height','4','m');
 await expect(page.getByTestId('check-parking_height')).toContainText('정보 부족');
 await page.getByLabel('확인자',{exact:true}).fill('테스트 확인자');
 for(const id of ['parking_height','vehicle_height'])await page.getByTestId(`records-${id}`).getByRole('button',{name:'확인하여 사용',exact:true}).click();
 await page.getByLabel('높이 여유 (m)',{exact:true}).fill('0.3');
 await expect(page.getByTestId('check-parking_height')).toContainText('입력 조건상 충족');
 await expect(page.getByTestId('inspection-overall')).toContainText('정보 부족');
 await page.getByRole('button',{name:'기록 저장',exact:true}).click();await page.reload();await page.getByRole('button',{name:'반입 조건',exact:true}).click();
 await expect(page.getByTestId('check-parking_height')).toContainText('입력 조건상 충족');await expect(page.getByTestId('records-parking_height')).toContainText('4500 mm');
});
test('a record file from another site is rejected without adding measurements',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'반입 조건',exact:true}).click();
 const data={schemaVersion:1,siteId:'another-site',observations:[],selected:{},margins:{height:null,width:null}};
 await page.getByLabel('현장 기록 파일 가져오기').setInputFiles({name:'different-site.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
 await expect(page.getByTestId('import-status')).toContainText('다른 현장');
});
test('exported observations can be imported repeatedly without duplicates',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'반입 조건',exact:true}).click();await addRecord(page,'elevator_capacity','3','t');
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'기록 내려받기',exact:true}).click()]);
 const path=await download.path();expect(path).toBeTruthy();
 await page.getByLabel('현장 기록 파일 가져오기').setInputFiles(path!);await expect(page.getByTestId('import-status')).toContainText('중복 1건 제외');
 await page.getByLabel('현장 기록 파일 가져오기').setInputFiles(path!);await expect(page.getByTestId('records-elevator_capacity')).toContainText('3 t');await expect(page.getByTestId('records-elevator_capacity').locator('.observation-row')).toHaveCount(1);
});
test('mobile observation form and long source text stay within viewport',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByRole('button',{name:'반입 조건',exact:true}).click();await addRecord(page,'elevator_conditions','9층 운행 여부 확인 대기','text');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByTestId('records-elevator_conditions').scrollIntoViewIfNeeded();await page.screenshot({path:'.data/inspection-mobile.png'});
});
test('a delayed import does not overwrite edits made after leaving its panel',async({page})=>{
 await page.addInitScript(()=>{const original=File.prototype.text;File.prototype.text=function(){return new Promise(resolve=>{(window as unknown as {finishImport:()=>Promise<void>}).finishImport=async()=>{resolve(await original.call(this));await new Promise<void>(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done())));};});};});
 await page.goto('/');await page.getByRole('button',{name:'반입 조건',exact:true}).click();await page.getByLabel('높이 여유 (m)',{exact:true}).fill('0.3');
 const data={schemaVersion:1,siteId:'yongin-nampyeong-111-73-floor9',observations:[],selected:{},margins:{height:null,width:null}};
 await page.getByLabel('현장 기록 파일 가져오기').setInputFiles({name:'delayed.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
 await expect(page.getByLabel('높이 여유 (m)',{exact:true})).toBeDisabled();await page.getByRole('button',{name:'현장 개요',exact:true}).click();await page.getByRole('button',{name:'반입 조건',exact:true}).click();await page.getByLabel('높이 여유 (m)',{exact:true}).fill('0.8');
 await page.evaluate(()=>(window as unknown as {finishImport:()=>Promise<void>}).finishImport());
 await expect(page.getByLabel('높이 여유 (m)',{exact:true})).toHaveValue('0.8');
});
test('saving after corrupt local data retains an accessible original backup',async({page})=>{
 const original=JSON.stringify({inspection:{schemaVersion:99,important:'원본 기록 보존'}});
 await page.addInitScript(raw=>{if(!localStorage.getItem('letus-pilot-notes-v1'))localStorage.setItem('letus-pilot-notes-v1',raw);},original);
 await page.goto('/');await expect(page.getByRole('status').filter({hasText:'기존 확인 기록'})).toBeVisible();await page.getByRole('button',{name:'기록 저장',exact:true}).click();
 await page.reload();await expect(page.getByRole('button',{name:'복구 원본 내려받기',exact:true})).toBeVisible();
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'복구 원본 내려받기',exact:true}).click()]);const file=await download.path();
 const fs=await import('node:fs/promises');expect(await fs.readFile(file!,'utf8')).toBe(original);
});
test('a different site in local storage cannot become a pilot measurement',async({page})=>{
 const now=new Date().toISOString(),metadata={source:'합성 도면',checkedAt:'2026-11-09',method:'document',status:'reviewed',reviewer:'확인자',reviewedAt:now};
 const inspection={schemaVersion:1,siteId:'other-building',observations:[{id:'height',field:'parking_height',value:4.5,unit:'m',...metadata},{id:'truck',field:'vehicle_height',value:4,unit:'m',...metadata}],selected:{parking_height:'height',vehicle_height:'truck'},margins:{height:0.3,width:null}};
 await page.addInitScript(x=>localStorage.setItem('letus-pilot-notes-v1',JSON.stringify({inspection:x})),inspection);
 await page.goto('/');await page.getByRole('button',{name:'반입 조건',exact:true}).click();await expect(page.getByTestId('check-parking_height')).toContainText('정보 부족');
});
test('a failed backup write cannot replace the only original record',async({page})=>{
 const original=JSON.stringify({inspection:{schemaVersion:99,important:'원본'}});
 await page.addInitScript(raw=>{const write=Storage.prototype.setItem;write.call(localStorage,'letus-pilot-notes-v1',raw);Storage.prototype.setItem=function(key,value){if(key.startsWith('letus-pilot-recovery-'))throw new DOMException('Full','QuotaExceededError');return write.call(this,key,value);};},original);
 await page.goto('/');await expect(page.getByRole('status').filter({hasText:'기존 확인 기록'})).toBeVisible();await page.getByRole('button',{name:'기록 저장',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'저장하지 못했습니다'})).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('letus-pilot-notes-v1'))).toBe(original);
});
