import type { Verdict } from "../domain";
export type Point = [number, number];
export type Num = number | null;
export type Proof = { source: string; date: string; confirmed: boolean };
export const proof = (): Proof => ({ source: "", date: "", confirmed: false });
export function proofReady(p: Proof) {
  return (
    p.confirmed &&
    !!p.source.trim() &&
    /^\d{4}-\d{2}-\d{2}$/.test(p.date) &&
    Number.isFinite(Date.parse(p.date)) &&
    new Date(p.date).toISOString().slice(0, 10) === p.date
  );
}
export type Equipment = {
  id: string;
  name: string;
  kind: "truck" | "forklift" | "ladder" | "other";
  tonnage: Num;
  vehicleType: "wing" | "box" | "cargo";
  steering: "front" | "rear";
  sideAccess: boolean | null;
  outriggerWidth: Num;
  outriggerLength: Num;
  outriggerOffset: Num;
  targetHeight: Num;
  requiredReach: Num;
  maxWorkingHeight: Num;
  maxReach: Num;
  operatingLoadLimit: Num;
  workingPointConfirmed: boolean;
  aerialClearanceConfirmed: boolean;
  proof: Proof;
  length: Num;
  width: Num;
  height: Num;
  wheelbase: Num;
  frontOverhang: Num;
  rearOverhang: Num;
  minRadius: Num;
  clearance: Num;
  wingSide: Num;
  wingRise: Num;
  tailLift: Num;
  forkLength: Num;
  loadLength: Num;
  loadWidth: Num;
  loadHeight: Num;
  loadMass: Num;
  carryHeight: Num;
  workingAisle: Num;
  mass: Num;
  ratedCapacity: Num;
};
export type Section = {
  width: Num;
  height: Num;
  slope: Num;
  reverse: boolean;
  proof: Proof;
};
export type Route = {
  id: string;
  name: string;
  kind: "truck" | "handling";
  points: Point[];
  sections: Section[];
  turnRadius: Num;
  surveyed: boolean;
  proof: Proof;
};
export type Zone = {
  id: string;
  name: string;
  center: Point;
  width: Num;
  length: Num;
  height: Num;
  heading: number;
  mode: "side" | "rear";
  truckRouteId: string;
  handlingRouteId: string;
  accessConfirmed: boolean;
  openSky: boolean;
  proof: Proof;
};
export type Obstacle = {
  id: string;
  name: string;
  center: Point;
  width: Num;
  length: Num;
  heading: number;
  base: Num;
  top: Num;
  proof: Proof;
};
export type DeliveryPlan = {
  version: 2;
  mode: "site" | "example";
  origin: Point;
  site: { id: string; address: string; entrance: string; proof: Proof };
  trucks: Equipment[];
  handling: Equipment;
  inactiveTrucks: Equipment[];
  handlingProfiles: Equipment[];
  routes: Route[];
  zones: Zone[];
  obstacles: Obstacle[];
  margins: { side: Num; vertical: Num };
  concurrentTrucks: number;
};
export type Check = {
  code: string;
  label: string;
  status: Verdict;
  detail: string;
  routeId?: string;
  equipmentId?: string;
  point?: Point;
};
export type RouteResult = {
  status: Verdict;
  checks: Check[];
  distance: number;
};
export type ZoneResult = {
  status: Verdict;
  checks: Check[];
  capacity: number;
  requiredWidth: Num;
  requiredLength: Num;
  requiredHeight: Num;
  rotation: 0 | 90;
};
export type Candidate = ZoneResult & {
  id: string;
  name: string;
  distance: number;
  reason: string;
};
export type PlanResult = {
  status: Verdict;
  candidates: Candidate[];
  recommendedId: string | null;
  realSiteApproved: boolean;
  checks: Check[];
};
export const LABELS = {
  pass: "입력 조건상 통과",
  fail: "간섭·조건 초과",
  unknown: "정보 부족",
};
export const SITE_ID = "yongin-nampyeong-111-73-floor9";
export function createEquipment(
  kind: Equipment["kind"],
  id: string,
): Equipment {
  return {
    id,
    kind,
    tonnage: kind === "truck" ? 11 : kind === "forklift" ? 3 : null,
    vehicleType: "wing",
    steering: kind === "forklift" ? "rear" : "front",
    sideAccess: null,
    outriggerWidth: null,
    outriggerLength: null,
    outriggerOffset: null,
    targetHeight: null,
    requiredReach: null,
    maxWorkingHeight: null,
    maxReach: null,
    operatingLoadLimit: null,
    workingPointConfirmed: false,
    aerialClearanceConfirmed: false,
    name:
      kind === "truck"
        ? `차량 ${id.replace("truck-", "")}호`
        : HANDLING_LABELS[kind],
    proof: proof(),
    length: null,
    width: null,
    height: null,
    wheelbase: null,
    frontOverhang: null,
    rearOverhang: null,
    minRadius: null,
    clearance: null,
    wingSide: null,
    wingRise: null,
    tailLift: null,
    forkLength: null,
    loadLength: null,
    loadWidth: null,
    loadHeight: null,
    loadMass: null,
    carryHeight: null,
    workingAisle: null,
    mass: null,
    ratedCapacity: null,
  };
}
export function createSection(): Section {
  return {
    width: null,
    height: null,
    slope: null,
    reverse: false,
    proof: proof(),
  };
}
export function createRoute(
  kind: Route["kind"],
  id = crypto.randomUUID(),
): Route {
  return {
    id,
    name: kind === "truck" ? "차량 접근로" : "장비 이동 경로",
    kind,
    points: [],
    sections: [],
    turnRadius: null,
    surveyed: false,
    proof: proof(),
  };
}
export function createZone(id = crypto.randomUUID()): Zone {
  return {
    id,
    name: "하차 후보",
    center: [0, 0],
    width: null,
    length: null,
    height: null,
    heading: 0,
    mode: "side",
    truckRouteId: "",
    handlingRouteId: "",
    accessConfirmed: false,
    openSky: false,
    proof: proof(),
  };
}
export function createPlan(): DeliveryPlan {
  return {
    version: 2,
    mode: "site",
    origin: [127.299745, 37.22836],
    site: {
      id: SITE_ID,
      address: "경기도 용인시 처인구 양지읍 남평로 111-73 · 9층",
      entrance: "",
      proof: proof(),
    },
    trucks: Array.from({ length: 6 }, (_, i) =>
      createEquipment("truck", `truck-${i + 1}`),
    ),
    handling: createEquipment("forklift", "forklift-1"),
    inactiveTrucks: [],
    handlingProfiles: [],
    routes: [],
    zones: [],
    obstacles: [],
    margins: { side: null, vertical: null },
    concurrentTrucks: 1,
  };
}
export function aggregate(checks: { status: Verdict }[]): Verdict {
  return checks.some((c) => c.status === "fail")
    ? "fail"
    : !checks.length || checks.some((c) => c.status === "unknown")
      ? "unknown"
      : "pass";
}

export const BODY_LABELS = { wing: "윙바디", box: "탑차", cargo: "카고" };
export const HANDLING_LABELS = {
  forklift: "지게차",
  ladder: "사다리차",
  other: "기타 반입 장비",
};
export function equipmentLabel(e: Equipment) {
  const type =
    e.kind === "truck" ? BODY_LABELS[e.vehicleType] : HANDLING_LABELS[e.kind];
  return `${e.tonnage === null ? "" : `${e.tonnage}톤 `}${type}${e.name === type ? "" : ` · ${e.name}`}`;
}
