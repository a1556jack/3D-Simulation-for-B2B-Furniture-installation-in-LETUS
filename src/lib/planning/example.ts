import {
  createPlan,
  createRoute,
  createZone,
  type DeliveryPlan,
} from "./types";
export function createExample(): DeliveryPlan {
  const p = createPlan(),
    proof = {
      source: "기능 확인용 합성 공간·장비 (실제 현장·제조사 제원 아님)",
      date: "2026-11-09",
      confirmed: true,
    };
  p.mode = "example";
  p.site.proof = { ...proof };
  p.site.entrance = "합성 반입구";
  p.margins = { side: 0.2, vertical: 0.2 };
  for (const t of p.trucks)
    Object.assign(t, {
      length: 10,
      width: 2.5,
      height: 4,
      wheelbase: 6,
      frontOverhang: 1.5,
      rearOverhang: 2.5,
      minRadius: 8,
      clearance: 0.3,
      wingSide: 2,
      wingRise: 2,
      tailLift: 1.5,
      proof: { ...proof },
    });
  Object.assign(p.forklift, {
    length: 4,
    width: 1.5,
    height: 2.5,
    wheelbase: 2,
    frontOverhang: 0.5,
    rearOverhang: 1.5,
    minRadius: 3,
    clearance: 0.15,
    forkLength: 1.2,
    loadLength: 1.2,
    loadWidth: 1.5,
    loadHeight: 1.5,
    loadMass: 800,
    carryHeight: 0.3,
    workingAisle: 5,
    mass: 4800,
    ratedCapacity: 3000,
    proof: { ...proof },
  });
  const r = createRoute("truck", "route-truck");
  Object.assign(r, {
    name: "차량 접근 · 합성",
    points: [
      [0, 0],
      [50, 0],
    ],
    turnRadius: 9,
    surveyed: true,
    proof: { ...proof },
    sections: [
      { width: 8, height: 8, slope: 0, reverse: false, proof: { ...proof } },
    ],
  });
  const f = createRoute("forklift", "route-forklift");
  Object.assign(f, {
    name: "하차 → 작업 종점 · 합성",
    points: [
      [50, 8],
      [80, 8],
    ],
    turnRadius: 4,
    surveyed: true,
    proof: { ...proof },
    sections: [
      { width: 8, height: 8, slope: 0, reverse: false, proof: { ...proof } },
    ],
  });
  p.routes = [r, f];
  const wide = createZone("Z-wide");
  Object.assign(wide, {
    name: "B · 여유 공간 (합성)",
    center: [50, 0],
    width: 60,
    length: 60,
    height: 8,
    heading: 0,
    truckRouteId: r.id,
    forkliftRouteId: f.id,
    accessConfirmed: true,
    proof: { ...proof },
  });
  const low = {
    ...structuredClone(wide),
    id: "Z-low",
    name: "A · 낮은 캐노피 (합성)",
    height: 5,
  };
  p.zones = [low, wide];
  return p;
}
