import { test, expect } from "vitest";
import { createPlan, createEquipment } from "../src/lib/planning/types";
import { resizeFleet, switchHandling } from "../src/lib/planning/fleet";
import { createExample } from "../src/lib/planning/example";
import { evaluatePlan } from "../src/lib/planning/evaluate";
import {
  parsePlan,
  makeWorkOrder,
  workOrderHtml,
} from "../src/lib/planning/persistence";

test("vehicle count is configurable and temporarily removed profiles are retained", () => {
  let p = createPlan();
  p.trucks[5].name = "보존할 6호";
  p.trucks[5].height = 4.25;
  p = resizeFleet(p, 2);
  expect(p.trucks).toHaveLength(2);
  p = resizeFleet(p, 8);
  expect(p.trucks).toHaveLength(8);
  expect(p.trucks[5].name).toBe("보존할 6호");
  expect(p.trucks[5].height).toBe(4.25);
  expect(() => resizeFleet(p, 0)).toThrow();
  expect(() => resizeFleet(p, 21)).toThrow();
});
test("vehicle body and tonnage are persisted without inventing physical dimensions", () => {
  const p = resizeFleet(createPlan(), 2);
  p.trucks[0].vehicleType = "cargo";
  p.trucks[0].tonnage = 5;
  p.trucks[1].vehicleType = "box";
  p.trucks[1].tonnage = 2.5;
  const restored = parsePlan(JSON.stringify(p));
  expect(
    restored.trucks.map((e) => [e.vehicleType, e.tonnage, e.height]),
  ).toEqual([
    ["cargo", 5, null],
    ["box", 2.5, null],
  ]);
});
test("switching from forklift to ladder and back retains the original forklift settings", () => {
  let p = createPlan();
  p.handling.height = 2.85;
  p.handling.tonnage = 3;
  p = switchHandling(p, "ladder");
  expect(p.handling.kind).toBe("ladder");
  expect(p.handling.steering).toBe("front");
  expect(p.handling.height).toBeNull();
  p = switchHandling(p, "forklift");
  expect(p.handling.height).toBe(2.85);
  expect(p.handling.steering).toBe("rear");
});
test("v1 plans migrate their six existing trucks and forklift without requiring new fabricated values", () => {
  const p: any = createExample();
  p.version = 1;
  p.forklift = p.handling;
  delete p.handling;
  delete p.inactiveTrucks;
  delete p.handlingProfiles;
  for (const r of p.routes) if (r.kind === "handling") r.kind = "forklift";
  for (const z of p.zones) {
    z.forkliftRouteId = z.handlingRouteId;
    delete z.handlingRouteId;
    delete z.openSky;
  }
  for (const e of [...p.trucks, p.forklift])
    for (const k of [
      "tonnage",
      "vehicleType",
      "steering",
      "sideAccess",
      "outriggerWidth",
      "outriggerLength",
      "outriggerOffset",
      "targetHeight",
      "requiredReach",
      "maxWorkingHeight",
      "maxReach",
      "operatingLoadLimit",
      "workingPointConfirmed",
      "aerialClearanceConfirmed",
    ])
      delete e[k];
  const restored = parsePlan(JSON.stringify(p));
  expect(restored.version).toBe(2);
  expect(restored.trucks).toHaveLength(6);
  expect(restored.handling.height).toBe(2.5);
  expect(restored.handling.steering).toBe("rear");
  expect(evaluatePlan(restored).recommendedId).toBe("Z-wide");
});
function ladderPlan() {
  let p = switchHandling(createExample(), "ladder");
  p.mode = "site";
  p.zones = p.zones.filter((z) => z.id === "Z-wide");
  const proof = {
    source: "사다리차 작업표 · 합성 테스트",
    date: "2026-11-09",
    confirmed: true,
  };
  Object.assign(p.handling, {
    name: "합성 사다리차",
    length: 8,
    width: 2.3,
    height: 3.2,
    wheelbase: 4.5,
    frontOverhang: 1,
    rearOverhang: 2.5,
    minRadius: 7,
    clearance: 0.3,
    outriggerWidth: 5,
    outriggerLength: 6,
    outriggerOffset: 0,
    targetHeight: 25,
    requiredReach: 10,
    maxWorkingHeight: 30,
    maxReach: 15,
    operatingLoadLimit: 200,
    loadMass: 100,
    workingAisle: 4,
    workingPointConfirmed: false,
    aerialClearanceConfirmed: true,
    proof,
  });
  const r = p.routes.find((r) => r.kind === "handling")!;
  r.points = [
    [100, 12],
    [60, 12],
  ];
  r.turnRadius = 8;
  r.proof = { ...proof };
  r.sections[0].proof = { ...proof };
  p.zones[0].openSky = true;
  p.zones[0].proof = { ...proof };
  return p;
}
test("separate ladder height and reach maxima never establish a verified working point", () => {
  const p = ladderPlan();
  const c = evaluatePlan(p).candidates[0];
  expect(c.status).toBe("unknown");
  expect(
    c.checks.some((k) => k.code === "ladder-chart" && k.status === "unknown"),
  ).toBe(true);
  expect(c.checks.some((k) => k.detail.includes("누락 제원: forkLength"))).toBe(
    false,
  );
});
test("confirmed ladder working chart plus surveyed setup fits the candidate", () => {
  const p = ladderPlan();
  p.handling.workingPointConfirmed = true;
  expect(evaluatePlan(p).candidates[0].status).toBe("pass");
});
test.each(["targetHeight", "requiredReach", "loadMass"] as const)(
  "ladder %s beyond its confirmed chart blocks a candidate",
  (field) => {
    const p = ladderPlan();
    p.handling.workingPointConfirmed = true;
    p.handling[field] = field === "loadMass" ? 250 : 50;
    expect(evaluatePlan(p).candidates[0].status).toBe("fail");
  },
);
test("ladder outriggers outside the setup area cannot pass", () => {
  const p = ladderPlan();
  p.handling.workingPointConfirmed = true;
  p.handling.outriggerWidth = 70;
  expect(
    evaluatePlan(p).candidates[0].checks.some(
      (c) => c.code === "ladder-setup" && c.status === "fail",
    ),
  ).toBe(true);
});
test("other handling equipment stays pending an equipment-specific operation check", () => {
  const p = switchHandling(createExample(), "other");
  expect(evaluatePlan(p).recommendedId).toBeNull();
});
test("work sheet names selected vehicles and ladder and does not claim a fixed forklift fleet", () => {
  const p = resizeFleet(ladderPlan(), 2);
  p.trucks[0].vehicleType = "cargo";
  p.trucks[0].tonnage = 5;
  const html = workOrderHtml(makeWorkOrder(p));
  expect(html).toContain("전체 2대");
  expect(html).toContain("사다리차");
  expect(html).toContain("5톤");
  expect(html).toContain("카고");
  expect(html).not.toContain("차량/지게차 총 동선");
});

test("cargo side unloading uses explicit side access and has no wing dimensions requirement", () => {
  const p = createExample();
  for (const t of p.trucks) {
    t.vehicleType = "cargo";
    t.wingRise = null;
    t.wingSide = null;
    t.sideAccess = true;
  }
  expect(
    evaluatePlan(p).candidates.find((c) => c.id === "Z-wide")?.status,
  ).toBe("pass");
  p.trucks[0].sideAccess = false;
  expect(
    evaluatePlan(p).candidates.find((c) => c.id === "Z-wide")?.status,
  ).toBe("fail");
  p.trucks[0].sideAccess = null;
  expect(
    evaluatePlan(p).candidates.find((c) => c.id === "Z-wide")?.status,
  ).toBe("unknown");
});
test("box rear unloading accepts explicitly absent lift and ignores wing fields", () => {
  const p = createExample();
  for (const z of p.zones) z.mode = "rear";
  for (const t of p.trucks) {
    t.vehicleType = "box";
    t.wingRise = null;
    t.wingSide = null;
    t.tailLift = 0;
  }
  expect(
    evaluatePlan(p).candidates.find((c) => c.id === "Z-wide")?.status,
  ).toBe("pass");
});
test("untrusted v2 equipment enum values and excessive concurrent count are rejected", () => {
  for (const patch of [
    { vehicleType: "crane" },
    { steering: "articulated" },
    { workingPointConfirmed: "true" },
    { sideAccess: "false" },
  ]) {
    const p = createPlan();
    Object.assign(p.handling, patch);
    expect(() => parsePlan(JSON.stringify(p))).toThrow();
  }
  const p = resizeFleet(createPlan(), 2);
  p.concurrentTrucks = 3;
  expect(() => parsePlan(JSON.stringify(p))).toThrow();
});
test("ladder setup over parked delivery truck is rejected", () => {
  const p = ladderPlan();
  p.handling.workingPointConfirmed = true;
  p.routes.find((r) => r.kind === "handling")!.points = [
    [100, 0],
    [50, 0],
  ];
  expect(
    evaluatePlan(p).candidates[0].checks.some(
      (k) => k.code === "ladder-truck" && k.status === "fail",
    ),
  ).toBe(true);
});
