import {
  SITE_ID,
  createEquipment,
  equipmentLabel,
  type DeliveryPlan,
  type PlanResult,
  type Proof,
} from "./types";
import { evaluatePlan } from "./evaluate";
const obj = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, n = 500): v is string =>
  typeof v === "string" && v.length <= n;
const num = (v: unknown, min = -10000, max = 10000): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const point = (v: unknown) =>
  Array.isArray(v) && v.length === 2 && v.every((n) => num(n));
function assert(
  value: unknown,
  message = "지원하지 않는 반입 계획 파일입니다.",
): asserts value {
  if (!value) throw Error(message);
}
function checkProof(v: unknown): asserts v is Proof {
  assert(
    obj(v) &&
      str(v.source) &&
      str(v.date, 10) &&
      typeof v.confirmed === "boolean",
  );
  if (v.date)
    assert(
      /^\d{4}-\d{2}-\d{2}$/.test(v.date) &&
        Number.isFinite(Date.parse(v.date)) &&
        new Date(v.date).toISOString().slice(0, 10) === v.date,
      "확인일 형식이 잘못되었습니다.",
    );
  if (v.confirmed)
    assert(
      v.source.trim() && v.date,
      "확인된 값에는 출처와 확인일이 필요합니다.",
    );
}
const equipmentKeys = [
  "tonnage",
  "outriggerWidth",
  "outriggerLength",
  "outriggerOffset",
  "targetHeight",
  "requiredReach",
  "maxWorkingHeight",
  "maxReach",
  "operatingLoadLimit",
  "length",
  "width",
  "height",
  "wheelbase",
  "frontOverhang",
  "rearOverhang",
  "minRadius",
  "clearance",
  "wingSide",
  "wingRise",
  "tailLift",
  "forkLength",
  "loadLength",
  "loadWidth",
  "loadHeight",
  "loadMass",
  "carryHeight",
  "workingAisle",
  "mass",
  "ratedCapacity",
];
export function parsePlan(raw: string): DeliveryPlan {
  assert(
    new TextEncoder().encode(raw).byteLength <= 2_000_000,
    "계획 파일은 2MB 이하여야 합니다.",
  );
  let p: unknown;
  try {
    p = JSON.parse(raw);
  } catch {
    throw Error("계획 JSON을 읽을 수 없습니다.");
  }
  if (obj(p) && obj(p.plan)) p = p.plan;
  if (obj(p) && p.version === 1) {
    assert(Array.isArray(p.trucks) && p.trucks.length === 6 && obj(p.forklift));
    const migrateEquipment = (e: unknown, kind: "truck" | "forklift") => {
      assert(obj(e) && e.kind === kind && typeof e.id === "string");
      return { ...createEquipment(kind, e.id), ...e };
    };
    p.trucks = p.trucks.map((e) => migrateEquipment(e, "truck"));
    p.handling = migrateEquipment(p.forklift, "forklift");
    delete p.forklift;
    p.inactiveTrucks = [];
    p.handlingProfiles = [];
    assert(Array.isArray(p.routes) && Array.isArray(p.zones));
    for (const r of p.routes) {
      assert(obj(r));
      if (r.kind === "forklift") r.kind = "handling";
    }
    for (const z of p.zones) {
      assert(obj(z));
      z.handlingRouteId = z.forkliftRouteId;
      delete z.forkliftRouteId;
      z.openSky = false;
      z.aerialConfirmation = null;
    }
    p.version = 2;
  }
  assert(
    obj(p) &&
      p.version === 2 &&
      (p.mode === "site" || p.mode === "example") &&
      point(p.origin),
  );
  const origin = p.origin as number[];
  assert(
    num(origin[0], 124, 132) && num(origin[1], 33, 39),
    "지도 기준 좌표가 지원 지역 밖입니다.",
  );
  assert(
    obj(p.site) && p.site.id === SITE_ID,
    "다른 현장의 계획은 자동 연결하지 않습니다.",
  );
  assert(str(p.site.address, 300) && str(p.site.entrance, 200));
  checkProof(p.site.proof);
  assert(
    Array.isArray(p.trucks) &&
      p.trucks.length >= 1 &&
      p.trucks.length <= 20 &&
      obj(p.handling),
  );
  assert(
    Array.isArray(p.inactiveTrucks) &&
      p.trucks.length + p.inactiveTrucks.length <= 20,
  );
  assert(Array.isArray(p.handlingProfiles) && p.handlingProfiles.length <= 2);
  const ids = new Set<string>();
  function identity(v: unknown) {
    assert(obj(v) && str(v.id, 100) && v.id.trim() && str(v.name, 100));
    assert(!ids.has(v.id), "중복된 항목 ID입니다.");
    ids.add(v.id);
    checkProof(v.proof);
  }
  for (const e of [
    ...p.trucks,
    p.handling,
    ...p.inactiveTrucks,
    ...p.handlingProfiles,
  ]) {
    identity(e);
    assert(
      obj(e) &&
        ["truck", "forklift", "ladder", "other"].includes(String(e.kind)),
    );
    assert(
      ["wing", "box", "cargo"].includes(String(e.vehicleType)) &&
        ["front", "rear"].includes(String(e.steering)),
    );
    assert(e.sideAccess === null || typeof e.sideAccess === "boolean");
    assert(typeof e.workingPointConfirmed === "boolean");
    for (const key of equipmentKeys)
      assert(
        e[key] === null ||
          num(
            e[key],
            key === "outriggerOffset" ? -100 : 0,
            key === "operatingLoadLimit" ||
              key === "mass" ||
              key === "ratedCapacity" ||
              key === "loadMass"
              ? 1e6
              : 100,
          ),
        "장비 제원 범위를 확인하세요.",
      );
  }
  assert(
    [...p.trucks, ...p.inactiveTrucks].every((e) => e.kind === "truck") &&
      p.handling.kind !== "truck" &&
      p.handlingProfiles.every((e) => e.kind !== "truck"),
  );
  assert(
    new Set([p.handling, ...p.handlingProfiles].map((e) => e.kind)).size ===
      p.handlingProfiles.length + 1,
  );
  assert(
    Array.isArray(p.routes) &&
      p.routes.length <= 8 &&
      Array.isArray(p.zones) &&
      p.zones.length <= 8 &&
      Array.isArray(p.obstacles) &&
      p.obstacles.length <= 24,
    "후보 수 제한을 초과했습니다.",
  );
  for (const r of p.routes) {
    identity(r);
    assert(
      obj(r) &&
        (r.kind === "truck" || r.kind === "handling") &&
        Array.isArray(r.points) &&
        r.points.length <= 24 &&
        r.points.every(point) &&
        Array.isArray(r.sections) &&
        r.sections.length === Math.max(0, r.points.length - 1) &&
        typeof r.surveyed === "boolean" &&
        (r.turnRadius === null || num(r.turnRadius, 0, 100)),
    );
    for (const s of r.sections) {
      assert(obj(s) && typeof s.reverse === "boolean");
      checkProof(s.proof);
      for (const k of ["width", "height"])
        assert(s[k] === null || num(s[k], 0, 500));
      assert(s.slope === null || num(s.slope, -40, 40));
    }
  }
  for (const z of p.zones) {
    identity(z);
    assert(
      obj(z) &&
        point(z.center) &&
        num(z.heading, -360, 360) &&
        (z.mode === "side" || z.mode === "rear") &&
        str(z.truckRouteId, 100) &&
        str(z.handlingRouteId, 100) &&
        typeof z.accessConfirmed === "boolean" &&
        typeof z.openSky === "boolean" &&
        (z.aerialConfirmation === null || str(z.aerialConfirmation, 150000)),
    );
    for (const k of ["width", "length", "height"])
      assert(z[k] === null || num(z[k], 0, 500));
  }
  for (const o of p.obstacles) {
    identity(o);
    assert(obj(o) && point(o.center) && num(o.heading, -360, 360));
    for (const k of ["width", "length", "base", "top"])
      assert(o[k] === null || num(o[k], 0, 500));
    if (o.base !== null && o.top !== null)
      assert(
        (o.top as number) >= (o.base as number),
        "장애물 상단은 하단보다 높아야 합니다.",
      );
  }
  assert(obj(p.margins));
  for (const k of ["side", "vertical"])
    assert(p.margins[k] === null || num(p.margins[k], 0, 10));
  assert(
    num(p.concurrentTrucks, 1, p.trucks.length) &&
      Number.isInteger(p.concurrentTrucks),
  );
  return p as unknown as DeliveryPlan;
}
export type WorkOrder = {
  selectedId: string | null;
  id: string;
  createdAt: string;
  condition: string;
  plan: DeliveryPlan;
  result: PlanResult;
};
export function makeWorkOrder(
  plan: DeliveryPlan,
  selectedId?: string,
): WorkOrder {
  const copy = parsePlan(JSON.stringify(plan)),
    result = evaluatePlan(copy);
  if (selectedId && !copy.zones.some((z) => z.id === selectedId))
    throw Error("선택한 하차 후보가 없습니다.");
  return {
    selectedId:
      selectedId ?? result.recommendedId ?? result.candidates[0]?.id ?? null,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    condition: JSON.stringify(copy),
    plan: copy,
    result,
  };
}
export const isStale = (w: WorkOrder, p: DeliveryPlan) =>
  w.condition !== JSON.stringify(p);
export const escapeHtml = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const verdict = {
  pass: "입력 조건상 통과",
  fail: "간섭·조건 초과",
  unknown: "정보 부족",
};
function routeSvg(plan: DeliveryPlan) {
  const points = plan.routes.flatMap((r) => r.points);
  if (!points.length) return "<p>경로가 지정되지 않았습니다.</p>";
  const minX = Math.min(...points.map((p) => p[0])) - 10,
    maxX = Math.max(...points.map((p) => p[0])) + 10,
    minY = Math.min(...points.map((p) => p[1])) - 10,
    maxY = Math.max(...points.map((p) => p[1])) + 10;
  const scale = Math.min(740 / (maxX - minX), 360 / (maxY - minY)),
    x = (n: number) => 400 + (n - (minX + maxX) / 2) * scale,
    y = (n: number) => 215 - (n - (minY + maxY) / 2) * scale;
  return `<svg role="img" aria-label="지정 반입 경로 도식" viewBox="0 0 800 430" xmlns="http://www.w3.org/2000/svg"><rect width="800" height="430" fill="#f5f8f7"/>${plan.routes.map((r, i) => `<polyline points="${r.points.map((p) => `${x(p[0])},${y(p[1])}`).join(" ")}" fill="none" stroke="${r.kind === "truck" ? "#23766b" : "#cb762d"}" stroke-width="4"/><text x="20" y="${20 + i * 18}" font-size="12">${escapeHtml(r.name)}</text>`).join("")}${plan.zones.map((z) => `<circle cx="${x(z.center[0])}" cy="${y(z.center[1])}" r="9" fill="#4286ad"/><text x="${x(z.center[0]) + 12}" y="${y(z.center[1])}" font-size="12">${escapeHtml(z.name)}</text>`).join("")}</svg><p>지정 좌표의 경로 도식입니다. 가로·세로 동일 축척의 평면 도식이며 실제 배경 지도·실내 도면은 아닙니다.</p>`;
}
export function workOrderHtml(w: WorkOrder, stale = false) {
  const p = w.plan,
    result = w.result,
    selected = result.candidates.find((c) => c.id === w.selectedId),
    esc = escapeHtml;
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>LETUS 반입 작업서</title><style>body{font:14px/1.65 sans-serif;color:#183d38;max-width:960px;margin:30px auto;padding:20px}h1,h2{line-height:1.3}table{border-collapse:collapse;width:100%;margin:15px 0}td,th{padding:8px;border:1px solid #ccd9d5;text-align:left}tr{break-inside:avoid}small{color:#5e6c68}.fail{color:#a33220}.unknown{color:#8a600d}.pass{color:#236549}svg{width:100%;max-height:440px}@media print{button{display:none}body{margin:0;padding:0;font-size:11px}h2{break-after:avoid}}button{padding:12px;cursor:pointer}</style><button ${stale ? "disabled" : 'onclick="window.print()"'}>인쇄 / PDF 저장</button>${stale ? '<div style="border:3px solid #a33220;padding:18px;color:#a33220;font-size:22px;font-weight:bold">조건 변경 · 현장 사용 중지<br/>이전 조건의 참고용 기록입니다. 재검토·재발행이 필요합니다.</div>' : ""}<h1>LETUS 반입 작업서 ${p.mode === "example" ? "— 합성 예제 · 현장 사용 금지" : ""}</h1><p>${esc(p.site.address)}<br/>작업 동·반입구: ${esc(p.site.entrance || "미확인")}<br/>발행: ${esc(new Date(w.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }))} · 버전 ${esc(w.id)}</p><p>발행 당시 조건을 고정한 기록입니다. 이후 현장·장비 변경 여부를 원본 계획과 대조하세요. 전체 ${p.trucks.length}대 / 동시 ${p.concurrentTrucks}대 계획.</p>${routeSvg(p)}<h2>선택한 작업 대상: ${esc(selected?.name ?? "미지정")}</h2><table><tr><th>후보</th><th>판정</th><th>검토 이유</th></tr>${result.candidates.map((c) => `<tr><td>${esc(c.name)}</td><td>${verdict[c.status]}</td><td>${esc(c.reason)}</td></tr>`).join("")}</table><h2>선택 후보 검사 결과</h2>${selected ? [selected].map((c) => `<h3 class="${c.status}">${esc(c.name)} — ${verdict[c.status]}${result.recommendedId === c.id ? (stale ? " · 이전 조건 기록" : " · 조건상 추천") : ""}</h3><p>${esc(c.reason)}</p><table><thead><tr><th>검사</th><th>판정</th><th>이유 / 위치</th></tr></thead><tbody>${c.checks.map((k) => `<tr><td>${esc(k.label)}${k.equipmentId ? `<br/><small>${esc(k.equipmentId)}</small>` : ""}</td><td class="${k.status}">${verdict[k.status]}</td><td>${esc(k.detail)}${k.point ? ` · 기준점 동 ${k.point[0].toFixed(1)}m / 북 ${k.point[1].toFixed(1)}m` : ""}</td></tr>`).join("")}</tbody></table>`).join("") : "<p>후보가 없어 정보 부족입니다.</p>"}<h2>적용 장비</h2><table><tr><th>장비</th><th>전장 × 폭 × 높이(m)</th><th>축간거리 / 회전반경(m)</th><th>출처·확인일</th></tr>${[...p.trucks, p.handling].map((e) => `<tr><td>${esc(equipmentLabel(e))}</td><td>${e.length ?? "?"} × ${e.width ?? "?"} × ${e.height ?? "?"}</td><td>${e.wheelbase ?? "?"} / ${e.minRadius ?? "?"}<br/><small>${e.kind === "ladder" ? `아웃트리거 ${e.outriggerWidth ?? "?"} × ${e.outriggerLength ?? "?"}m · 기준축 앞 오프셋 ${e.outriggerOffset ?? "?"}m · 목표 높이 ${e.targetHeight ?? "?"}m / 수평 도달 ${e.requiredReach ?? "?"}m · 적재 ${e.loadMass ?? "?"}kg / 작업점 허용 ${e.operatingLoadLimit ?? "?"}kg · 작업표 ${e.workingPointConfirmed ? "확인" : "미확인"} · 상공은 후보별 검사 결과 참조` : e.kind === "other" ? "장비별 작업 검토 별도 필요" : e.kind === "truck" ? `${e.vehicleType === "wing" ? `윙 추가 폭 ${e.wingSide ?? "?"}m · 추가 높이 ${e.wingRise ?? "?"}m` : `측면 하역 ${e.sideAccess === null ? "미확인" : e.sideAccess ? "가능 확인" : "불가"}`} · 리프트 ${e.tailLift ?? "?"}m` : `적재물 ${e.loadWidth ?? "?"} × ${e.loadLength ?? "?"} × ${e.loadHeight ?? "?"}m / ${e.loadMass ?? "?"}kg · 운반 높이 ${e.carryHeight ?? "?"}m · 자중 ${e.mass ?? "?"}kg · 정격 ${e.ratedCapacity ?? "?"}kg (능력 판정 아님)`}</small></td><td>${esc(e.proof.source || "미기록")}<br/>${esc(e.proof.date || "미확인")}</td></tr>`).join("")}</table><h2>공간 자료 출처</h2><table><tr><th>대상</th><th>출처·확인일</th></tr>${[p.site, ...p.routes, ...p.routes.flatMap((r) => r.sections.map((s, i) => ({ ...s, name: `${r.name} 구간 ${i + 1}` }))), ...p.zones, ...p.obstacles].map((item) => `<tr><td>${esc("name" in item ? item.name : "작업 동·반입구")}</td><td>${esc(item.proof.source || "미기록")} · ${esc(item.proof.date || "미확인")} · ${item.proof.confirmed ? "확인함" : "검토 대기"}</td></tr>`).join("")}</table><h2>별도 확인</h2><p>바닥 구조·장비 전도 안정성·사다리차 지지력·실제 인양능력·유도자 배치·운영시간·통행 허가를 작업 전 확인하세요. E/V 탑승은 자동 판정에서 제외합니다. 계산은 입력한 강체 외형·평면 노면·원호 조향 모델에 한정하며 현장 실측을 대체하지 않습니다.</p></html>`;
}
