import {
  aggregate,
  HANDLING_LABELS,
  proofReady,
  type Check,
  type DeliveryPlan,
  type Equipment,
  type Route,
  type RouteResult,
  type Zone,
  type ZoneResult,
  type PlanResult,
  type Candidate,
  type Num,
} from "./types";
import {
  bodyExtents,
  bodyRectangle,
  unloadingRectangle,
  poseAt,
  routeMotion,
  rectangle,
  sweptHit,
  insideRectangle,
  intersects,
} from "./geometry";
import { ladderChecks } from "./ladder";
const positive = (n: Num): n is number =>
  n !== null && Number.isFinite(n) && n > 0;
function compare(
  available: Num,
  required: Num,
  margin: Num,
  ready: boolean,
): Check["status"] {
  if (!ready || !positive(available) || !positive(required)) return "unknown";
  if (available < required) return "fail";
  return margin === null
    ? "unknown"
    : available + 1e-8 >= required + margin
      ? "pass"
      : "fail";
}
function geometryReady(e: Equipment) {
  return (
    proofReady(e.proof) &&
    [e.length, e.width, e.height, e.wheelbase].every(positive) &&
    e.frontOverhang !== null &&
    e.rearOverhang !== null &&
    Math.abs(e.length! - e.wheelbase! - e.frontOverhang - e.rearOverhang) <
      0.05 &&
    (e.kind !== "forklift" ||
      [
        e.forkLength,
        e.loadLength,
        e.loadWidth,
        e.loadHeight,
        e.carryHeight,
      ].every((n) => n !== null))
  );
}
function equipmentChecks(e: Equipment): Check[] {
  const dims = [
    "length",
    "width",
    "height",
    "wheelbase",
    "minRadius",
    "clearance",
  ] as const;
  const missing = dims.filter((k) => !positive(e[k]));
  for (const k of ["frontOverhang", "rearOverhang"] as const)
    if (e[k] === null || e[k]! < 0) missing.push(k as (typeof dims)[number]);
  if (e.kind === "forklift")
    for (const k of [
      "forkLength",
      "loadLength",
      "loadWidth",
      "loadHeight",
      "carryHeight",
    ] as const)
      if (e[k] === null || e[k]! < 0) missing.push(k as (typeof dims)[number]);
  const ready = proofReady(e.proof),
    checks: Check[] = [
      {
        code: "equipment",
        label: `${e.name} 제원`,
        equipmentId: e.id,
        status: ready && !missing.length ? "pass" : "unknown",
        detail: !ready
          ? "실제 모델 제원의 출처·확인일과 검토 확인 필요"
          : missing.length
            ? `누락 제원: ${missing.join(", ")}`
            : "외형·조향 제원 확인",
      },
    ];
  if (
    ready &&
    [e.length, e.wheelbase, e.frontOverhang, e.rearOverhang].every(
      (x) => x !== null,
    )
  )
    checks.push({
      code: "body-length",
      label: "차체 길이 일치",
      equipmentId: e.id,
      status:
        Math.abs(
          e.length! - e.wheelbase! - e.frontOverhang! - e.rearOverhang!,
        ) < 0.05
          ? "pass"
          : "fail",
      detail: "전장 = 축간거리 + 앞 오버행 + 뒤 오버행 (허용 입력 오차 5cm)",
    });
  return checks;
}
export function evaluateRoute(
  plan: DeliveryPlan,
  route: Route,
  e: Equipment,
): RouteResult {
  const checks: Check[] = equipmentChecks(e).map((c) => ({
      ...c,
      routeId: route.id,
    })),
    motion = routeMotion(route, e),
    body = bodyExtents(e),
    equipmentReady = geometryReady(e);
  const add = (c: Check) =>
    checks.push({ ...c, routeId: route.id, equipmentId: e.id });
  add({
    code: "survey",
    label: `${route.name} 현장 확인`,
    status:
      route.surveyed &&
      proofReady(route.proof) &&
      route.points.length >= 2 &&
      route.sections.length === route.points.length - 1
        ? "pass"
        : "unknown",
    detail: "경로 위치·통행 허용 및 장애물 조사 완료 확인 필요",
  });
  for (const issue of motion.issues)
    add({
      code: "turn-path",
      label: "회전·방향 전환",
      status:
        proofReady(route.proof) && proofReady(e.proof)
          ? issue.status
          : "unknown",
      detail: issue.detail,
      point: issue.point,
    });
  for (let i = 0; i < route.sections.length; i++) {
    const s = route.sections[i],
      ready = proofReady(s.proof) && proofReady(e.proof),
      point = route.points[i],
      label = `구간 ${i + 1}`;
    const slope = s.slope === null ? null : Math.atan(s.slope / 100),
      projected =
        slope === null
          ? null
          : body.height * Math.cos(slope) +
            (body.front + body.rear) * Math.abs(Math.sin(slope));
    const widthComplete =
      positive(e.width) && (e.kind !== "forklift" || e.loadWidth !== null);
    const lengthComplete =
      [e.wheelbase, e.frontOverhang, e.rearOverhang].every((n) => n !== null) &&
      (e.kind !== "forklift" ||
        (e.forkLength !== null && e.loadLength !== null));
    const heightComplete =
      positive(e.height) &&
      (e.kind !== "forklift" ||
        (e.carryHeight !== null && e.loadHeight !== null)) &&
      (slope === 0 || lengthComplete);
    const widthStatus = compare(
      s.width,
      body.width,
      plan.margins.side === null ? null : plan.margins.side * 2,
      ready,
    );
    const heightStatus = compare(
      s.height,
      projected,
      plan.margins.vertical,
      ready,
    );
    add({
      code: "width",
      label: `${label} 유효 폭`,
      status:
        widthStatus === "pass" && !widthComplete ? "unknown" : widthStatus,
      detail: `공간 ${s.width ?? "?"}m / 장비 ${body.width.toFixed(2)}m + 좌우 여유 각 ${plan.margins.side ?? "?"}m`,
      point,
    });
    add({
      code: "height",
      label: `${label} 유효 높이`,
      status:
        heightStatus === "pass" && !heightComplete ? "unknown" : heightStatus,
      detail: `공간 ${s.height ?? "?"}m / 경사 반영 외형 ${projected?.toFixed(2) ?? "?"}m + 여유 ${plan.margins.vertical ?? "?"}m`,
      point,
    });
    const prev = i === 0 ? 0 : route.sections[i - 1].slope;
    const next = i === route.sections.length - 1 ? 0 : undefined;
    for (const [from, to] of [
      [prev, s.slope],
      ...(next === 0 ? [[s.slope, 0]] : []),
    ] as [Num, Num][]) {
      let status: Check["status"] = "unknown",
        detail = "경사와 지상고·축간거리·오버행 확인 필요";
      if (
        ready &&
        from !== null &&
        to !== null &&
        positive(e.clearance) &&
        positive(e.wheelbase) &&
        e.frontOverhang !== null &&
        e.rearOverhang !== null &&
        (e.kind !== "forklift" ||
          (e.carryHeight !== null &&
            e.forkLength !== null &&
            e.loadLength !== null))
      ) {
        const ground =
          e.kind === "forklift"
            ? Math.min(e.clearance, e.carryHeight ?? 0)
            : e.clearance;
        const change = Math.atan(from / 100) - Math.atan(to / 100),
          crest = change > 0,
          overhang = Math.max(
            e.frontOverhang ?? 0,
            e.rearOverhang ?? 0,
            e.kind === "forklift" ? body.front : 0,
          ),
          limit = crest
            ? 2 * Math.atan((2 * ground) / e.wheelbase)
            : Math.atan(ground / Math.max(overhang, 0.001));
        status = Math.abs(change) <= limit + 1e-8 ? "pass" : "fail";
        detail = `경사 전환 ${((Math.abs(change) * 180) / Math.PI).toFixed(1)}° / 평면 하부 모델 한계 ${((limit * 180) / Math.PI).toFixed(1)}°`;
      }
      add({
        code: "ramp",
        label: `${label} 경사 전환부`,
        status,
        detail,
        point,
      });
    }
  }
  for (const p of motion.pieces.filter((p) => p.center)) {
    const s = route.sections[p.section],
      next = route.sections[p.section + 1],
      r = p.radius!,
      side = plan.margins.side;
    const slopeExtra =
      body.height *
      Math.sin(
        Math.atan(
          Math.max(Math.abs(s?.slope ?? 0), Math.abs(next?.slope ?? 0)) / 100,
        ),
      );
    const required =
      2 *
      (Math.hypot(
        r + body.width / 2,
        Math.max(body.front, body.rear) + slopeExtra,
      ) -
        r);
    const width =
      s?.width === null || next?.width === null
        ? null
        : Math.min(s?.width ?? 0, next?.width ?? 0);
    add({
      code: "turn-width",
      label: "회전 시 차체 돌출",
      status: compare(
        width,
        required,
        side === null ? null : 2 * side,
        equipmentReady &&
          !!s &&
          !!next &&
          proofReady(s.proof) &&
          proofReady(next.proof),
      ),
      detail: `원호 중심선 주변 필요 폭 ${required.toFixed(2)}m + 좌우 여유 / 유효 폭 ${width ?? "?"}m`,
      point: p.a,
    });
  }
  for (const o of plan.obstacles) {
    const ready =
      equipmentReady &&
      motion.issues.length === 0 &&
      proofReady(route.proof) &&
      proofReady(o.proof) &&
      positive(o.width) &&
      positive(o.length) &&
      o.base !== null &&
      o.top !== null;
    if (!ready) {
      add({
        code: "obstacle",
        label: o.name,
        status: "unknown",
        detail: "장애물 위치·크기·노면 기준 하단/상단·출처 확인 필요",
        point: o.center,
      });
      continue;
    }
    const polygon = rectangle(
      o.center,
      o.length!,
      o.width!,
      (o.heading * Math.PI) / 180,
    );
    const hit = aggregate(
      motion.pieces.map((piece) => {
        const sections = [
          route.sections[piece.section],
          ...(piece.center ? [route.sections[piece.section + 1]] : []),
        ];
        if (
          sections.some((s) => !s || s.slope === null || !proofReady(s.proof))
        )
          return { status: "unknown" as const };
        const pitch = Math.atan(
          Math.max(...sections.map((s) => Math.abs(s.slope!))) / 100,
        );
        const horizontal = sweptHit(
          { pieces: [piece], issues: [], distance: piece.length },
          e,
          polygon,
          plan.margins.side ?? 0,
          pitch,
        );
        if (horizontal === "pass") return { status: "pass" as const };
        const high =
          Math.max(
            ...sections.map((s) => {
              const angle = Math.atan(s.slope! / 100);
              return (
                body.height * Math.cos(angle) +
                (body.front + body.rear) * Math.abs(Math.sin(angle))
              );
            }),
          ) + (plan.margins.vertical ?? 0);
        return {
          status: o.base! > high || o.top! < 0 ? ("pass" as const) : horizontal,
        };
      }),
    );
    add({
      code: "obstacle",
      label: `장애물 · ${o.name}`,
      status:
        hit === "pass" &&
        (plan.margins.side === null || plan.margins.vertical === null)
          ? "unknown"
          : hit,
      detail:
        hit === "fail"
          ? "경사를 반영한 보수적 이동 외형과 장애물이 겹칩니다."
          : hit === "unknown"
            ? "회전 경계와 근접합니다. 정밀 궤적·실측 재확인 필요"
            : "지정 장애물과 이동 외형 분리 확인",
      point: o.center,
    });
  }
  return { status: aggregate(checks), checks, distance: motion.distance };
}
export function evaluateZone(plan: DeliveryPlan, z: Zone): ZoneResult {
  const checks: Check[] = [],
    side = plan.margins.side,
    v = plan.margins.vertical,
    ready =
      proofReady(z.proof) &&
      plan.trucks.every((e) => proofReady(e.proof)) &&
      proofReady(plan.handling.proof);
  if (plan.handling.kind === "ladder") checks.push(...ladderChecks(plan, z));
  if (plan.handling.kind === "other")
    checks.push({
      code: "other-operation",
      label: "기타 장비 작업 조건",
      status: "unknown",
      detail: "이 장비의 설치·작동 범위는 별도 검토가 필요합니다.",
    });
  if (z.mode === "side")
    for (const e of plan.trucks.filter((e) => e.vehicleType !== "wing"))
      checks.push({
        code: "side-access",
        label: `${e.name} 측면 하역`,
        equipmentId: e.id,
        status:
          !proofReady(e.proof) || e.sideAccess === null
            ? "unknown"
            : e.sideAccess
              ? "pass"
              : "fail",
        detail:
          "탑차·카고는 실제 측면 개방 및 하역 가능 여부 확인이 필요합니다.",
      });
  const aisle = plan.handling.workingAisle,
    ext = bodyExtents(plan.handling),
    values = plan.trucks.map((e) =>
      z.mode === "side"
        ? [
            e.width,
            e.vehicleType === "wing" ? e.wingSide : 0,
            e.length,
            e.height,
            e.vehicleType === "wing" ? e.wingRise : 0,
          ]
        : [e.width, e.tailLift, e.length, e.height, 0],
    );
  const complete =
    values.every((a) => a.every((n) => n !== null)) &&
    positive(aisle) &&
    side !== null &&
    v !== null;
  let requiredWidth: Num = null,
    requiredLength: Num = null,
    requiredHeight: Num = null,
    capacity = 0,
    rotation: 0 | 90 = 0;
  if (complete) {
    requiredWidth =
      Math.max(
        ...values.map((a) =>
          z.mode === "side"
            ? a[0]! + a[1]! + aisle!
            : Math.max(a[0]!, ext.width),
        ),
      ) +
      2 * side!;
    requiredLength =
      Math.max(
        ...values.map((a) =>
          z.mode === "side" ? a[2]! : a[2]! + a[1]! + aisle!,
        ),
      ) +
      2 * side!;
    requiredHeight =
      Math.max(ext.height, ...values.map((a) => a[3]! + a[4]!)) + v!;
  }
  checks.push({
    code: "zone-survey",
    label: "하차 공간·운영조건",
    status: ready && z.accessConfirmed ? "pass" : "unknown",
    detail: "반입구 위치, 공간 실측, 사용 허용, 주변 장애물 확인 필요",
  });
  if (
    positive(z.width) &&
    positive(z.length) &&
    positive(requiredWidth) &&
    positive(requiredLength)
  ) {
    const normal =
        Math.floor((z.width + 1e-8) / requiredWidth) *
        Math.floor((z.length + 1e-8) / requiredLength),
      turned =
        Math.floor((z.width + 1e-8) / requiredLength) *
        Math.floor((z.length + 1e-8) / requiredWidth);
    capacity = Math.max(normal, turned);
    rotation = turned > normal ? 90 : 0;
  }
  checks.push({
    code: "unloading-space",
    label: "차량·반입 장비 하역 작업 공간",
    status:
      !ready || !complete || !positive(z.width) || !positive(z.length)
        ? "unknown"
        : capacity >= plan.concurrentTrucks
          ? "pass"
          : "fail",
    detail: `대당 ${requiredWidth?.toFixed(2) ?? "?"} × ${requiredLength?.toFixed(2) ?? "?"}m · 동시 ${plan.concurrentTrucks}대 필요 / 정렬 배치 ${capacity}대 가능`,
    point: z.center,
  });
  checks.push({
    code: "unloading-height",
    label: "특장 개방·하역 상부 공간",
    status:
      z.openSky && ready && positive(requiredHeight)
        ? "pass"
        : compare(z.height, requiredHeight, 0, ready),
    detail: `공간 ${z.openSky ? "개방 상공" : `${z.height ?? "?"}m`} / 장비 작동 외형 ${requiredHeight?.toFixed(2) ?? "?"}m`,
    point: z.center,
  });
  const truckRoute = plan.routes.find(
      (r) => r.id === z.truckRouteId && r.kind === "truck",
    ),
    forkRoute = plan.routes.find(
      (r) => r.id === z.handlingRouteId && r.kind === "handling",
    );
  const stoppingSection = truckRoute?.sections.at(-1),
    startingSection =
      plan.handling.kind === "forklift"
        ? forkRoute?.sections[0]
        : forkRoute?.sections.at(-1);
  checks.push({
    code: "loading-level",
    label: "하차 지점 노면",
    status:
      stoppingSection?.slope === 0 &&
      startingSection?.slope === 0 &&
      proofReady(stoppingSection.proof) &&
      proofReady(startingSection.proof)
        ? "pass"
        : "unknown",
    detail:
      "하역 영역은 수평 노면 모델입니다. 차량 종점과 장비 작업 지점 구간의 경사 0% 확인이 필요합니다.",
    point: z.center,
  });
  if (plan.concurrentTrucks > 1)
    checks.push({
      code: "concurrent-paths",
      label: "동시 정차 배치별 진입",
      status: "unknown",
      detail:
        "정렬 배치 대수는 공간 검토값입니다. 동시 정차 차량별 진입·퇴출 경로 확인이 추가로 필요합니다.",
    });
  if (truckRoute && positive(z.width) && positive(z.length))
    for (const e of plan.trucks) {
      const motion = routeMotion(truckRoute, e),
        pose = poseAt(motion, 1),
        valid =
          ready &&
          complete &&
          geometryReady(e) &&
          proofReady(truckRoute.proof) &&
          motion.pieces.length > 0 &&
          !motion.issues.length;
      const envelope = unloadingRectangle(
        e,
        pose,
        z.mode,
        aisle ?? 0,
        side ?? 0,
      );
      checks.push({
        code: "stop-envelope",
        label: `${e.name} 정차·하역 외형`,
        equipmentId: e.id,
        status: !valid
          ? "unknown"
          : envelope.every((p) =>
                insideRectangle(
                  p,
                  z.center,
                  z.length!,
                  z.width!,
                  (z.heading * Math.PI) / 180,
                ),
              )
            ? "pass"
            : "fail",
        detail:
          "실제 경로 종점의 차체 방향에서 특장/리프트·장비 작업 여유가 하차 영역 안에 들어가야 합니다.",
        point: [pose.x, pose.y],
      });
      if (forkRoute) {
        const fMotion = routeMotion(forkRoute, plan.handling),
          fReady =
            valid &&
            geometryReady(plan.handling) &&
            proofReady(forkRoute.proof) &&
            fMotion.pieces.length > 0 &&
            !fMotion.issues.length;
        const hit = fReady
          ? sweptHit(
              fMotion,
              plan.handling,
              bodyRectangle(e, pose, 0),
              side ?? 0,
            )
          : "unknown";
        checks.push({
          code: "parked-truck",
          label: `${HANDLING_LABELS[plan.handling.kind as keyof typeof HANDLING_LABELS]} ↔ 정차 ${e.name}`,
          equipmentId: e.id,
          routeId: forkRoute.id,
          status: hit,
          detail:
            hit === "pass"
              ? "지정 장비 동선과 정차 차체가 분리됩니다."
              : hit === "fail"
                ? "장비 이동 외형이 정차 차량과 겹칩니다."
                : "실제 차체·정차 방향·장비 경로 추가 확인 필요",
          point: [pose.x, pose.y],
        });
      }
    }
  for (const [id, kind, end] of [
    [z.truckRouteId, "truck", true],
    [z.handlingRouteId, "handling", plan.handling.kind !== "forklift"],
  ] as const) {
    const r = plan.routes.find((r) => r.id === id && r.kind === kind),
      p = end ? r?.points.at(-1) : r?.points[0];
    checks.push({
      code: "connection",
      label: kind === "truck" ? "차량 종점 연결" : "장비 작업 지점 연결",
      status:
        !p ||
        !positive(z.width) ||
        !positive(z.length) ||
        !proofReady(z.proof) ||
        !r ||
        !proofReady(r.proof)
          ? "unknown"
          : insideRectangle(
                p,
                z.center,
                z.length,
                z.width,
                (z.heading * Math.PI) / 180,
              )
            ? "pass"
            : "fail",
      detail:
        "차량 종점과 장비 작업 지점(지게차 시작점 / 사다리차 종점)이 지정 하차 영역 안에 있어야 합니다.",
      point: p ?? z.center,
    });
  }
  if (positive(z.width) && positive(z.length))
    for (const o of plan.obstacles) {
      if (
        !proofReady(o.proof) ||
        !positive(o.width) ||
        !positive(o.length) ||
        o.base === null ||
        o.top === null
      ) {
        checks.push({
          code: "zone-obstacle",
          label: o.name,
          status: "unknown",
          detail: "하차 공간 주변 장애물 확인 필요",
          point: o.center,
        });
        continue;
      }
      if (requiredHeight !== null && o.base > requiredHeight) continue;
      if (
        intersects(
          rectangle(z.center, z.length, z.width, (z.heading * Math.PI) / 180),
          rectangle(o.center, o.length, o.width, (o.heading * Math.PI) / 180),
        )
      )
        checks.push({
          code: "zone-obstacle",
          label: `하차 공간 장애물 · ${o.name}`,
          status: "unknown",
          detail:
            "후보 영역 안에 장애물이 있습니다. 장애물이 없는 유효 영역으로 나눠 다시 지정하세요.",
          point: o.center,
        });
    }
  return {
    status: aggregate(checks),
    checks,
    capacity,
    requiredWidth,
    requiredLength,
    requiredHeight,
    rotation,
  };
}
export function evaluatePlan(plan: DeliveryPlan): PlanResult {
  const site: Check = {
    code: "site",
    label: "작업 동·반입구 연결",
    status:
      proofReady(plan.site.proof) && !!plan.site.entrance.trim()
        ? "pass"
        : "unknown",
    detail: "정확한 건물·작업 동·출입구의 위치와 확인 출처 필요",
  };
  const candidates: Candidate[] = plan.zones.map((z) => {
    const zone = evaluateZone(plan, z),
      checks = [site, ...zone.checks];
    let d = 0;
    for (const [kind, id, equipments] of [
      ["truck", z.truckRouteId, plan.trucks],
      ["handling", z.handlingRouteId, [plan.handling]],
    ] as const) {
      const r = plan.routes.find((r) => r.id === id && r.kind === kind);
      if (!r) {
        checks.push({
          code: "route",
          label: kind === "truck" ? "차량 접근로" : "장비 반입로",
          status: "unknown",
          detail: "연결할 경로 후보를 지정하세요.",
        });
        continue;
      }
      for (const [i, e] of equipments.entries()) {
        const result = evaluateRoute(plan, r, e);
        checks.push(...result.checks);
        if (i === 0) d += result.distance;
      }
    }
    const status = aggregate(checks);
    return {
      ...zone,
      id: z.id,
      name: z.name,
      checks,
      status,
      distance: d,
      reason:
        status === "pass"
          ? `동시 ${plan.concurrentTrucks}대 작업 공간 확보 · 차량/장비 총 동선 ${d.toFixed(0)}m`
          : (checks.find((c) => c.status === status)?.detail ??
            "추가 조건 확인 필요"),
    };
  });
  const score = { pass: 0, unknown: 1, fail: 2 };
  candidates.sort(
    (a, b) =>
      score[a.status] - score[b.status] ||
      a.distance - b.distance ||
      b.capacity - a.capacity ||
      a.id.localeCompare(b.id),
  );
  const winner = candidates.find((c) => c.status === "pass");
  const status = winner
    ? "pass"
    : candidates.some((c) => c.status === "unknown")
      ? "unknown"
      : candidates.length
        ? "fail"
        : "unknown";
  return {
    status,
    candidates,
    recommendedId: winner?.id ?? null,
    realSiteApproved: plan.mode === "site" && !!winner,
    checks: candidates.flatMap((c) => c.checks),
  };
}
