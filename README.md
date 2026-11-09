# LETUS · 반입 현장 3D

[실행 링크와 화면 보기](docs/DELIVERY.md)

실제 공개 지도 기반으로 수도권·강원·충청의 도로와 건물 윤곽을 3D로 탐색합니다. 서울·인천·경기·강원·대전·세종·충북·충남 이동, 도로·장소 검색, 2D/3D, 지도상 동선 기록, 현장 메모, 출처별 현장·장비 기록, 확인된 높이·폭 비교와 JSON 기록 가져오기/내려받기를 지원합니다. [반입 조건 기록 안내](docs/OBSERVATIONS.md).

`반입 계획`에서는 차량 6대·지게차 제원을 각각 적용해 지정 경로와 하차 공간 후보를 비교합니다. 구간별 높이·폭, 회전 돌출, 경사 전환, 장애물, 윙·리프트 하역 공간과 정차 차량 간섭을 검사하고 3D 외형을 재생합니다. 선택한 후보는 조건을 고정한 작업서로 발행해 인쇄/PDF 저장할 수 있습니다. [반입 계획 사용법·검사 모델](docs/PLANNER.md). 추천은 지정·확인한 후보에 한정하며 자동 도로망 탐색이 아닙니다.

**용인 남평로 111-73의 정확한 건물 연결은 미확인입니다.** 첫 화면은 실제 남평로 주변입니다. 건물 높이·실내·램프·주차장·E/V 실측 정보와 차량 실제 모델은 확보되지 않았으며, 지도 외형을 통과 판정에 사용하지 않습니다. [데이터 범위와 출처](docs/SOURCES.md).

## 실행

Node 24+, curl이 필요합니다.

```sh
npm ci
npm run maps:prepare
npm run dev
```

브라우저에서 http://localhost:3000 을 엽니다. 지도 원본 135MiB를 최초 1회 내려받아 SHA-256을 검증합니다. 이후 기본 앱 지도와 검색에는 외부 API 키가 필요 없습니다.

```sh
npm run build
node scripts/serve-static.mjs out 4173
```

정적 배포는 `out/`을 HTTP Range(206)를 지원하는 서버에 올립니다. 하위 경로 배포는 빌드 때 `NEXT_PUBLIC_BASE_PATH=/경로`를 지정합니다.

## 설치 없이 실행본

`release/LETUS-3D.html`을 내려받아 최신 Chrome/Edge로 엽니다. 약 16MB이며 인터넷으로 실제 공개 지도 조각을 읽습니다. 파일을 브라우저에서 여는 기능이 제한된 기기에서는 정적 웹 배포본을 사용해야 합니다. 파일명만 바꾼 예시 3D가 아니라 앱과 같은 실제 지도 자료를 사용합니다.

재생성: `node scripts/build-portable.mjs`. 검색 자료 재생성: `node scripts/index-maps.mjs`.

## 검증

```sh
npm test
npm run typecheck
npm run build
npm run test:browser
```

브라우저 테스트는 Chromium(`/usr/bin/chromium`)과 실제 로컬 지도 파일을 사용합니다. 배포 주소의 접속 검증과 로컬 실행 검증은 별도로 기록합니다.
