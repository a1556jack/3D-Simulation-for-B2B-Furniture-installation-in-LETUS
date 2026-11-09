import { describe, test, expect } from "vitest";
import {
  createPlan,
  createEquipment,
  createRoute,
  createZone,
  proofReady,
  type DeliveryPlan,
} from "../src/lib/planning/types";
import {
  evaluatePlan,
  evaluateRoute,
  evaluateZone,
} from "../src/lib/planning/evaluate";
import {
  bodyRectangle,
  routeMotion,
  poseAt,
  toWorld,
  toLocal,
} from "../src/lib/planning/geometry";
import {
  parsePlan,
  makeWorkOrder,
  isStale,
  workOrderHtml,
} from "../src/lib/planning/persistence";

const proof = {
  source: "합성 도면 — 테스트 전용",
  date: "2026-11-09",
  confirmed: true,
};
function fixture(): DeliveryPlan {
  const p = createPlan();
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
    carryHeight: 0.3,
    workingAisle: 5,
    proof: { ...proof },
  });
  const a = createRoute("truck", "A");
  a.points = [
    [0, 0],
    [50, 0],
  ];
  a.turnRadius = 9;
  a.surveyed = true;
  a.sections = [
    { width: 8, height: 8, slope: 0, reverse: false, proof: { ...proof } },
  ];
  a.proof = { ...proof };
  const f = createRoute("forklift", "F");
  f.points = [
    [50, 8],
    [80, 8],
  ];
  f.turnRadius = 4;
  f.surveyed = true;
  f.sections = [
    { width: 8, height: 8, slope: 0, reverse: false, proof: { ...proof } },
  ];
  f.proof = { ...proof };
  p.routes = [a, f];
  const z = createZone("Z");
  Object.assign(z, {
    center: [50, 0],
    width: 60,
    length: 60,
    height: 8,
    heading: 0,
    truckRouteId: a.id,
    forkliftRouteId: f.id,
    proof: { ...proof },
    accessConfirmed: true,
  });
  p.zones = [z];
  return p;
}
describe("measured delivery decision", () => {
  test("empty dimensions and unconfirmed source never produce a recommendation", () => {
    expect(evaluatePlan(createPlan()).recommendedId).toBeNull();
    const p = fixture();
    p.site.proof.confirmed = false;
    expect(evaluatePlan(p).candidates[0].status).toBe("unknown");
    p.site.proof = { ...proof };
    p.trucks[2].proof.confirmed = false;
    expect(evaluatePlan(p).recommendedId).toBeNull();
  });
  test("measured straight routes and sufficient loading envelope yield an explained candidate", () => {
    const r = evaluatePlan(fixture());
    expect(r.candidates[0].status).toBe("pass");
    expect(r.recommendedId).toBe("Z");
    expect(r.candidates[0].checks.length).toBeGreaterThan(10);
  });
  test("one of six taller trucks blocks the shared route and dominates missing fields", () => {
    const p = fixture();
    p.trucks[5].height = 9;
    p.trucks[0].width = null;
    const r = evaluatePlan(p);
    expect(r.candidates[0].status).toBe("fail");
    expect(
      r.candidates[0].checks.some(
        (c) => c.status === "fail" && c.equipmentId === p.trucks[5].id,
      ),
    ).toBe(true);
  });
  test("continuous sweep catches a 1cm obstacle between distant endpoints", () => {
    const p = fixture();
    p.obstacles = [
      {
        id: "thin",
        name: "얇은 벽",
        center: [24.137, 0],
        width: 0.01,
        length: 4,
        heading: 0,
        base: 0,
        top: 5,
        proof: { ...proof },
      },
    ];
    expect(evaluateRoute(p, p.routes[0], p.trucks[0]).status).toBe("fail");
    p.obstacles[0].base = 6;
    p.obstacles[0].top = 7;
    expect(evaluateRoute(p, p.routes[0], p.trucks[0]).status).toBe("pass");
  });
  test("front and rear steering locate the long overhang on different sides of the reference axle", () => {
    const t = fixture().trucks[0];
    expect(
      Math.max(
        ...bodyRectangle(t, { x: 0, y: 0, heading: 0 }, 0).map((p) => p[0]),
      ),
    ).toBe(7.5);
    t.kind = "forklift";
    t.forkLength = 0;
    t.loadLength = 0;
    t.loadWidth = 0;
    expect(
      Math.min(
        ...bodyRectangle(t, { x: 0, y: 0, heading: 0 }, 0).map((p) => p[0]),
      ),
    ).toBe(-8.5);
  });
  test("reverse changes body orientation while following the same axle path", () => {
    const p = fixture();
    p.routes[0].sections[0].reverse = true;
    const m = routeMotion(p.routes[0], p.trucks[0]);
    expect(Math.abs(poseAt(m, 0.5).heading)).toBeCloseTo(Math.PI);
  });
  test("sharp corners require both a valid steering radius and enough tangent length", () => {
    const p = fixture(),
      r = p.routes[0];
    r.points = [
      [0, 0],
      [30, 0],
      [30, 30],
    ];
    r.sections = [r.sections[0], structuredClone(r.sections[0])];
    r.turnRadius = 2;
    expect(evaluateRoute(p, r, p.trucks[0]).status).toBe("fail");
    r.turnRadius = 9;
    r.points = [
      [0, 0],
      [3, 0],
      [3, 3],
    ];
    expect(evaluateRoute(p, r, p.trucks[0]).status).toBe("fail");
  });
  test("a crest transition can fail ground clearance even when the ceiling is high", () => {
    const p = fixture(),
      r = p.routes[0];
    r.points = [
      [0, 0],
      [30, 0],
      [60, 0],
    ];
    r.sections = [
      { ...r.sections[0], slope: 15 },
      { ...r.sections[0], slope: -15 },
    ];
    expect(
      evaluateRoute(p, r, p.trucks[0]).checks.some(
        (c) => c.code === "ramp" && c.status === "fail",
      ),
    ).toBe(true);
  });
  test("side wing and forklift aisle consume unloading width; low canopy blocks opening", () => {
    const p = fixture(),
      z = p.zones[0];
    z.width = 6;
    z.length = 12;
    expect(evaluateZone(p, z).status).toBe("fail");
    z.width = 60;
    z.length = 60;
    z.height = 5;
    expect(
      evaluateZone(p, z).checks.some(
        (c) => c.code === "unloading-height" && c.status === "fail",
      ),
    ).toBe(true);
  });
  test("explicit simultaneous demand changes capacity verdict", () => {
    const p = fixture(),
      z = p.zones[0];
    z.center = [52.5, 3.5];
    z.width = 11;
    z.length = 12;
    p.concurrentTrucks = 1;
    expect(evaluateZone(p, z).status).toBe("pass");
    p.concurrentTrucks = 6;
    expect(evaluateZone(p, z).status).toBe("fail");
  });
  test("forklift route cannot pass through the stopped truck", () => {
    const p = fixture();
    p.routes[1].points = [
      [50, -8],
      [50, 8],
    ];
    expect(
      evaluatePlan(p).candidates[0].checks.some(
        (c) => c.code === "parked-truck" && c.status === "fail",
      ),
    ).toBe(true);
  });
  test("loading envelope must fit at the actual route endpoint, not just somewhere in the zone", () => {
    const p = fixture();
    p.routes[0].points[1] = [79, 0];
    expect(
      evaluateZone(p, p.zones[0]).checks.some(
        (c) => c.code === "stop-envelope" && c.status === "fail",
      ),
    ).toBe(true);
  });
  test("multiple concurrent slots are not approved without individual slot approach paths", () => {
    const p = fixture();
    p.concurrentTrucks = 6;
    expect(evaluatePlan(p).recommendedId).toBeNull();
  });
  test("disconnected loading space cannot be recommended", () => {
    const p = fixture();
    p.zones[0].center = [500, 500];
    expect(evaluatePlan(p).candidates[0].status).toBe("fail");
  });
  test("unknown candidates cannot outrank a checked alternative and missing margins cannot pass", () => {
    const p = fixture(),
      unknown = structuredClone(p.zones[0]);
    unknown.id = "unknown";
    unknown.proof.confirmed = false;
    p.zones.unshift(unknown);
    expect(evaluatePlan(p).recommendedId).toBe("Z");
    p.margins.side = null;
    expect(evaluatePlan(p).recommendedId).toBeNull();
  });
  test("a failing shorter approach does not contaminate another route candidate", () => {
    const p = fixture(),
      r = structuredClone(p.routes[0]);
    r.id = "short-low";
    r.points = [
      [40, 0],
      [50, 0],
    ];
    r.sections[0].height = 3;
    p.routes.push(r);
    const z = structuredClone(p.zones[0]);
    z.id = "short-zone";
    z.truckRouteId = r.id;
    p.zones.unshift(z);
    const result = evaluatePlan(p);
    expect(result.recommendedId).toBe("Z");
    expect(result.candidates.find((c) => c.id === "short-zone")?.status).toBe(
      "fail",
    );
  });
  test("a generous curved route passes and a body-side obstacle on that arc is caught", () => {
    const p = fixture(),
      r = p.routes[0];
    r.points = [
      [0, 0],
      [30, 0],
      [30, 30],
    ];
    r.sections = [
      { ...r.sections[0], width: 25 },
      { ...r.sections[0], width: 25 },
    ];
    r.turnRadius = 9;
    expect(evaluateRoute(p, r, p.trucks[0]).status).toBe("pass");
    p.obstacles = [
      {
        id: "corner",
        name: "회전 기둥",
        center: [29, 6],
        width: 1,
        length: 1,
        heading: 0,
        base: 0,
        top: 6,
        proof: { ...proof },
      },
    ];
    expect(evaluateRoute(p, r, p.trucks[0]).status).toBe("fail");
  });
  test("synthetic mode explicitly prevents a real-site recommendation", () => {
    const p = fixture();
    p.mode = "example";
    expect(evaluatePlan(p).realSiteApproved).toBe(false);
  });
  test("coordinate round trip is local in metres, not degrees", () => {
    const origin: [number, number] = [127.3, 37.2];
    const result = toLocal(toWorld([20, 30], origin), origin);
    expect(result[0]).toBeCloseTo(20, 5);
    expect(result[1]).toBeCloseTo(30, 5);
  });
});
test("pitched vehicle envelope cannot skip an overhead obstacle above its flat height", () => {
  const p = fixture();
  p.trucks[0].clearance = 1;
  p.routes[0].sections[0].slope = 15;
  p.obstacles = [
    {
      id: "roof",
      name: "램프 배관",
      center: [25, 0],
      width: 2,
      length: 5,
      heading: 0,
      base: 4.5,
      top: 5.5,
      proof: { ...proof },
    },
  ];
  expect(
    evaluateRoute(p, p.routes[0], p.trucks[0]).checks.some(
      (c) => c.code === "obstacle" && c.status === "fail",
    ),
  ).toBe(true);
});
test("forklift carried load clearance participates in ramp transition checks", () => {
  const p = fixture();
  p.forklift.clearance = 0.5;
  p.forklift.carryHeight = 0.02;
  p.routes[1].sections[0].slope = 5;
  expect(
    evaluateRoute(p, p.routes[1], p.forklift).checks.some(
      (c) => c.code === "ramp" && c.status === "fail",
    ),
  ).toBe(true);
});

describe("durable decision records", () => {
  test("stale work sheet exports are visibly historical and cannot offer operational print", () => {
    const w = makeWorkOrder(fixture()),
      html = workOrderHtml(w, true);
    expect(html).toContain("조건 변경 · 현장 사용 중지");
    expect(html).not.toContain("조건상 추천");
    expect(html).not.toContain('onclick="window.print()"');
    expect(w.result.candidates[0].status).toBe("pass");
  });
  test("malformed and cross-site plans are rejected before applying", () => {
    const p = fixture();
    expect(parsePlan(JSON.stringify(p)).trucks).toHaveLength(6);
    p.trucks[0].width = -1;
    expect(() => parsePlan(JSON.stringify(p))).toThrow();
    const q = fixture();
    q.site.id = "other";
    expect(() => parsePlan(JSON.stringify(q))).toThrow();
  });
  test("duplicate IDs, oversized geometry and non-finite coordinates are rejected", () => {
    const p = fixture();
    p.trucks[1].id = p.trucks[0].id;
    expect(() => parsePlan(JSON.stringify(p))).toThrow();
    const q = fixture();
    q.routes[0].points[0][0] = Infinity;
    expect(() => parsePlan(JSON.stringify(q))).toThrow();
  });
  test("issued work sheet keeps exact conditions and detects subsequent edits", () => {
    const p = fixture(),
      w = makeWorkOrder(p);
    expect(isStale(w, p)).toBe(false);
    p.trucks[0].height = 9;
    expect(isStale(w, p)).toBe(true);
    expect(w.plan.trucks[0].height).toBe(4);
    expect(w.result.candidates[0].status).toBe("pass");
  });
  test("a work sheet pins the deliberately selected candidate even when another is recommended", () => {
    const p = fixture(),
      z = structuredClone(p.zones[0]);
    z.id = "low";
    z.name = "낮은 하차 후보";
    z.height = 2;
    p.zones.push(z);
    const w = makeWorkOrder(p, "low");
    expect(w.selectedId).toBe("low");
    expect(workOrderHtml(w)).toContain("선택한 작업 대상: 낮은 하차 후보");
  });
  test("printable work sheet escapes source text and includes reasons and route diagram", () => {
    const p = fixture();
    p.site.entrance = "<img src=x onerror=alert(1)>";
    const html = workOrderHtml(makeWorkOrder(p));
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
    expect(html).toContain("<svg");
    expect(html).toContain("11톤 윙바디");
  });
});

test.each([
  [15, false, -3.05],
  [-15, false, 57.9],
  [15, true, -7.9],
  [-15, true, 53],
] as const)(
  "pitch expands horizontal sweep: grade %s reverse %s",
  (slope, reverse, x) => {
    const p = fixture();
    p.trucks[0].clearance = 1;
    Object.assign(p.routes[0].sections[0], { slope, reverse });
    p.obstacles = [
      {
        id: "pitch-wall",
        name: "경사 간섭",
        center: [x, 0],
        width: 0.1,
        length: 0.1,
        heading: 0,
        base: 0,
        top: 8,
        proof: { ...proof },
      },
    ];
    expect(
      evaluateRoute(p, p.routes[0], p.trucks[0]).checks.some(
        (c) => c.code === "obstacle" && c.status === "fail",
      ),
    ).toBe(true);
  },
);
test("missing steering radius does not mask a confirmed ceiling violation", () => {
  const p = fixture();
  p.forklift.minRadius = null;
  p.routes[1].sections[0].height = 2;
  const result = evaluatePlan(p);
  expect(result.candidates[0].status).toBe("fail");
  expect(
    result.candidates[0].checks.some(
      (c) => c.code === "height" && c.status === "fail",
    ),
  ).toBe(true);
});
test("inclined unloading does not receive a flat loading space recommendation", () => {
  const p = fixture();
  p.routes[0].sections[0].slope = 1;
  expect(
    evaluateZone(p, p.zones[0]).checks.some(
      (c) => c.code === "loading-level" && c.status === "unknown",
    ),
  ).toBe(true);
});
test("missing steering information cannot hide a confirmed straight-body collision", () => {
  const p = fixture();
  p.trucks[0].minRadius = null;
  p.obstacles = [
    {
      id: "wall",
      name: "실측 벽",
      center: [25, 0],
      width: 1,
      length: 4,
      heading: 0,
      base: 0,
      top: 6,
      proof: { ...proof },
    },
  ];
  expect(
    evaluateRoute(p, p.routes[0], p.trucks[0]).checks.some(
      (c) => c.code === "obstacle" && c.status === "fail",
    ),
  ).toBe(true);
});
