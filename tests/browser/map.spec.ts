import {expect,test} from '@playwright/test';
test('actual source tiles render around the pilot road without claiming an address match',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.getByTestId('map-status')).toContainText('지도 연결됨',{timeout:45000});
 await expect(page.getByText('111-73 건물 위치 미확인',{exact:true})).toBeVisible();
 await expect(page.getByTestId('building-count')).not.toHaveText('0');
 await page.getByRole('button',{name:'서울',exact:true}).click();
 await expect(page.getByTestId('current-location')).toContainText('서울');
 await expect(page.locator('.map-canvas')).toHaveAttribute('data-settled-label','서울 · 중심부',{timeout:45000});
 await page.getByRole('button',{name:'2D',exact:true}).click();
 await expect(page.getByTestId('map-status')).toContainText('지도 연결됨');
 await page.screenshot({path:'.data/real-map-desktop.png'});
 expect(errors).toEqual([]);
});
test('address search shows road candidates and never confirms house number',async({page})=>{
 await page.goto('/');await page.getByLabel('주소·도로·장소 검색').fill('경기도 용인시 처인구 양지읍 남평로 111-73');
 await expect(page.getByTestId('search-ready')).toContainText('검색 준비',{timeout:45000});
 await page.getByRole('button',{name:'검색',exact:true}).click();
 await expect(page.getByTestId('search-results')).toContainText('남평로');
 await expect(page.getByTestId('search-results')).toContainText('도로 주변');
 await page.getByLabel('주소·도로·장소 검색').fill('존재하지않는도로999');await page.getByRole('button',{name:'검색',exact:true}).click();
 await expect(page.getByTestId('search-results')).toContainText('검색 결과가 없습니다');
});
test('mobile renders real map with no horizontal overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 await expect(page.getByTestId('map-status')).toContainText('지도 연결됨',{timeout:45000});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'.data/real-map-mobile.png',fullPage:true});
});
test('camera settles on each requested region with actual buildings',async({page})=>{
 await page.goto('/');await expect(page.getByTestId('map-status')).toContainText('지도 연결됨',{timeout:45000});
 for(const name of ['서울','인천','경기','강원','대전','세종','충북','충남']){
  await page.getByRole('button',{name,exact:true}).click();
  await expect(page.locator('.map-canvas')).toHaveAttribute('data-settled-label',`${name} · 중심부`,{timeout:45000});
  await expect(page.getByTestId('map-status')).toContainText('지도 연결됨');
  expect(Number(await page.getByTestId('building-count').textContent())).toBeGreaterThan(0);
 }
});
test('failed map data is visible and never reports connected',async({page})=>{
 await page.route('**/maps/*.pmtiles',route=>route.abort());await page.goto('/');
 await expect(page.getByTestId('map-status')).toContainText('불러오지 못했습니다',{timeout:30000});
});
test('map failure remains visible after changing the view',async({page})=>{
 await page.route('**/maps/*.pmtiles',r=>r.abort());await page.goto('/');
 await expect(page.getByTestId('map-status')).toContainText('불러오지 못했습니다',{timeout:30000});
 await page.getByRole('button',{name:'2D',exact:true}).click();
 await expect(page.getByTestId('map-status')).toContainText('불러오지 못했습니다');
});
test('entered coordinates are not silently moved into the coverage area',async({page})=>{
 await page.goto('/');await expect(page.getByTestId('search-ready')).toContainText('검색 준비',{timeout:30000});await page.getByLabel('주소·도로·장소 검색').fill('127.3,33.5');await page.getByRole('button',{name:'검색',exact:true}).click();
 await expect(page.locator('.map-canvas')).toHaveAttribute('data-settled-label','입력 좌표 · 주소 미확인',{timeout:10000});
 await expect(page.getByTestId('map-status')).toContainText('자료 범위 밖');
});
test('source panel does not claim a failed map connection is working',async({page})=>{
 await page.route('**/maps/*.pmtiles',r=>r.abort());await page.goto('/');await expect(page.getByTestId('map-status')).toContainText('불러오지 못했습니다',{timeout:30000});await page.getByRole('button',{name:'데이터 출처',exact:true}).click();await expect(page.getByText('지도 연결 확인 필요',{exact:true})).toBeVisible();
});
