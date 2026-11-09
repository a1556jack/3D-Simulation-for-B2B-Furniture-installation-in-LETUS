import {
  proofReady,
  type Check,
  type DeliveryPlan,
  type Equipment,
  type Zone,
} from "./types";
import {
  bodyRectangle,
  insideRectangle,
  intersects,
  poseAt,
  rectangle,
  routeMotion,
  unloadingRectangle,
  type Pose,
} from "./geometry";
export function outriggerRectangle(e: Equipment, pose: Pose, margin = 0) {
  const offset = e.outriggerOffset ?? 0;
  return rectangle(
    [
      pose.x + offset * Math.cos(pose.heading),
      pose.y + offset * Math.sin(pose.heading),
    ],
    (e.outriggerLength ?? 0) + 2 * margin,
    (e.outriggerWidth ?? 0) + 2 * margin,
    pose.heading,
  );
}
export function ladderChecks(p: DeliveryPlan, z: Zone): Check[] {
  const e = p.handling,
    checks: Check[] = [],
    proof = proofReady(e.proof),
    margin = p.margins.side;
  const add = (
    code: string,
    label: string,
    status: Check["status"],
    detail: string,
  ) =>
    checks.push({
      code,
      label,
      status,
      detail,
      equipmentId: e.id,
      point: z.center,
    });
  for (const [key, limit, label] of [
    ["targetHeight", "maxWorkingHeight", "목표 작업 높이"],
    ["requiredReach", "maxReach", "수평 도달 거리"],
    ["loadMass", "operatingLoadLimit", "작업점 적재 하중"],
  ] as const) {
    const value = e[key],
      max = e[limit];
    add(
      `ladder-${key}`,
      label,
      !proof || value === null || max === null || max <= 0
        ? "unknown"
        : value > max
          ? "fail"
          : "pass",
      `${value ?? "?"} / 한계 ${max ?? "?"}${key === "loadMass" ? "kg" : "m"} · 독립 한계 비교이며 작업점 조합은 별도 확인`,
    );
  }
  add(
    "ladder-chart",
    "높이·거리·하중 조합",
    proof &&
      e.workingPointConfirmed &&
      e.targetHeight !== null &&
      e.requiredReach !== null &&
      e.loadMass !== null &&
      e.operatingLoadLimit !== null
      ? "pass"
      : "unknown",
    "이 높이·수평 거리·적재 하중 조합이 실제 모델의 제조사 작업표에서 허용되는지 확인 필요",
  );
  add(
    "ladder-aerial",
    "사다리 전개 방향·상공 공간",
    proof && e.aerialClearanceConfirmed ? "pass" : "unknown",
    "작업 방향과 사다리 전개 영역의 건물·전선·수목 간섭을 현장에서 확인해야 합니다. 자동 붐 궤적 계산은 포함하지 않습니다.",
  );
  add(
    "ladder-overhead",
    "작업 높이 상부 공간",
    !proof ||
      !proofReady(z.proof) ||
      e.targetHeight === null ||
      p.margins.vertical === null
      ? "unknown"
      : z.openSky
        ? "pass"
        : z.height === null
          ? "unknown"
          : z.height >= e.targetHeight + p.margins.vertical
            ? "pass"
            : "fail",
    `작업 높이 ${e.targetHeight ?? "?"}m + 여유 ${p.margins.vertical ?? "?"}m / ${z.openSky ? "개방 상공 확인" : `상부 ${z.height ?? "?"}m`}`,
  );
  const r = p.routes.find(
      (r) => r.id === z.handlingRouteId && r.kind === "handling",
    ),
    m = r ? routeMotion(r, e) : null,
    pose = m ? poseAt(m, 1) : null;
  const ready =
    proof &&
    proofReady(z.proof) &&
    !!r &&
    proofReady(r.proof) &&
    !!m &&
    m.pieces.length > 0 &&
    !m.issues.length &&
    e.outriggerWidth !== null &&
    e.outriggerWidth > 0 &&
    e.outriggerLength !== null &&
    e.outriggerLength > 0 &&
    e.outriggerOffset !== null &&
    margin !== null &&
    !!z.width &&
    !!z.length &&
    !!e.length &&
    !!e.width &&
    e.frontOverhang !== null &&
    e.rearOverhang !== null &&
    e.wheelbase !== null;
  const footprint = pose
    ? [
        ...bodyRectangle(e, pose, margin ?? 0),
        ...outriggerRectangle(e, pose, margin ?? 0),
      ]
    : [];
  add(
    "ladder-setup",
    "사다리차·아웃트리거 설치 공간",
    !ready
      ? "unknown"
      : footprint.every((q) =>
            insideRectangle(
              q,
              z.center,
              z.length!,
              z.width!,
              (z.heading * Math.PI) / 180,
            ),
          )
        ? "pass"
        : "fail",
    "장비 경로 종점의 차체와 아웃트리거가 설치 영역 내부에 들어가야 합니다. 아웃트리거 중심은 비조향축 기준 앞 방향 오프셋을 사용합니다.",
  );
  const tr = p.routes.find(
    (r) => r.id === z.truckRouteId && r.kind === "truck",
  );
  if (ready && pose && tr)
    for (const t of p.trucks) {
      const tm = routeMotion(tr, t),
        tp = poseAt(tm, 1),
        valid =
          proofReady(t.proof) &&
          proofReady(tr.proof) &&
          tm.pieces.length > 0 &&
          !tm.issues.length &&
          e.workingAisle !== null &&
          p.margins.side !== null &&
          t.width !== null &&
          t.length !== null &&
          (z.mode === "side"
            ? t.vehicleType !== "wing" || t.wingSide !== null
            : t.tailLift !== null);
      add(
        "ladder-truck",
        `아웃트리거 ↔ ${t.name} 하역 영역`,
        !valid
          ? "unknown"
          : intersects(
                outriggerRectangle(e, pose, margin!),
                unloadingRectangle(t, tp, z.mode, e.workingAisle ?? 0, margin!),
              )
            ? "fail"
            : "pass",
        "사다리차 아웃트리거와 정차 차량·하역 통로가 겹치면 설치할 수 없습니다.",
      );
    }
  return checks;
}
