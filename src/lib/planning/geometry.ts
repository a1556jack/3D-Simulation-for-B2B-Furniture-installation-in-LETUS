import type { Equipment, Point, Route } from "./types";
export type Pose = { x: number; y: number; heading: number };
export type Piece = {
  a: Point;
  b: Point;
  length: number;
  section: number;
  reverse: boolean;
  center?: Point;
  radius?: number;
  angle?: number;
  sweep?: number;
};
export type Motion = {
  pieces: Piece[];
  issues: { status: "fail" | "unknown"; detail: string; point: Point }[];
  distance: number;
};
const RAD = Math.PI / 180;
export const distance = (a: Point, b: Point) =>
  Math.hypot(b[0] - a[0], b[1] - a[1]);
export const toLocal = (p: Point, origin: Point): Point => [
  (p[0] - origin[0]) * 111320 * Math.cos(origin[1] * RAD),
  (p[1] - origin[1]) * 111320,
];
export const toWorld = (p: Point, origin: Point): Point => [
  origin[0] + p[0] / (111320 * Math.cos(origin[1] * RAD)),
  origin[1] + p[1] / 111320,
];
export function rectangle(
  center: Point,
  length: number,
  width: number,
  heading: number,
): Point[] {
  const c = Math.cos(heading),
    s = Math.sin(heading);
  return [
    [-length / 2, -width / 2],
    [length / 2, -width / 2],
    [length / 2, width / 2],
    [-length / 2, width / 2],
  ].map(([x, y]) => [center[0] + x * c - y * s, center[1] + x * s + y * c]);
}
export function bodyExtents(e: Equipment) {
  const extension =
    e.kind === "forklift" ? Math.max(e.forkLength ?? 0, e.loadLength ?? 0) : 0;
  return {
    front:
      (e.frontOverhang ?? 0) +
      (e.kind === "truck" ? (e.wheelbase ?? 0) : extension),
    rear:
      (e.rearOverhang ?? 0) + (e.kind === "forklift" ? (e.wheelbase ?? 0) : 0),
    width: Math.max(
      e.width ?? 0,
      e.kind === "forklift" ? (e.loadWidth ?? 0) : 0,
    ),
    height: Math.max(
      e.height ?? 0,
      e.kind === "forklift" ? (e.carryHeight ?? 0) + (e.loadHeight ?? 0) : 0,
    ),
  };
}
export function bodyRectangle(
  e: Equipment,
  pose: Pose,
  margin: number,
): Point[] {
  const b = bodyExtents(e),
    d = (b.front - b.rear) / 2;
  return rectangle(
    [pose.x + d * Math.cos(pose.heading), pose.y + d * Math.sin(pose.heading)],
    b.front + b.rear + 2 * margin,
    b.width + 2 * margin,
    pose.heading,
  );
}
export function unloadingRectangle(
  e: Equipment,
  pose: Pose,
  mode: "side" | "rear",
  aisle: number,
  margin: number,
): Point[] {
  const b = bodyExtents(e),
    extra = (mode === "side" ? e.wingSide : e.tailLift) ?? 0,
    extension = extra + aisle;
  const dx = (b.front - b.rear - (mode === "rear" ? extension : 0)) / 2,
    dy = mode === "side" ? extension / 2 : 0,
    c = Math.cos(pose.heading),
    s = Math.sin(pose.heading);
  return rectangle(
    [pose.x + dx * c - dy * s, pose.y + dx * s + dy * c],
    b.front + b.rear + (mode === "rear" ? extension : 0) + 2 * margin,
    b.width + (mode === "side" ? extension : 0) + 2 * margin,
    pose.heading,
  );
}
const cross = (a: Point, b: Point, c: Point) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
export function hull(points: Point[]): Point[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const lo: Point[] = [],
    hi: Point[] = [];
  for (const x of p) {
    while (
      lo.length >= 2 &&
      cross(lo[lo.length - 2], lo[lo.length - 1], x) <= 0
    )
      lo.pop();
    lo.push(x);
  }
  for (const x of p.reverse()) {
    while (
      hi.length >= 2 &&
      cross(hi[hi.length - 2], hi[hi.length - 1], x) <= 0
    )
      hi.pop();
    hi.push(x);
  }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}
export function intersects(a: Point[], b: Point[]) {
  for (const polygon of [a, b])
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i],
        q = polygon[(i + 1) % polygon.length],
        axis: Point = [q[1] - p[1], p[0] - q[0]];
      const ap = a.map((v) => v[0] * axis[0] + v[1] * axis[1]),
        bp = b.map((v) => v[0] * axis[0] + v[1] * axis[1]);
      if (
        Math.max(...ap) < Math.min(...bp) - 1e-8 ||
        Math.max(...bp) < Math.min(...ap) - 1e-8
      )
        return false;
    }
  return true;
}
export function insideRectangle(
  p: Point,
  center: Point,
  length: number,
  width: number,
  heading: number,
) {
  const dx = p[0] - center[0],
    dy = p[1] - center[1],
    c = Math.cos(heading),
    s = Math.sin(heading);
  return (
    Math.abs(dx * c + dy * s) <= length / 2 + 1e-8 &&
    Math.abs(-dx * s + dy * c) <= width / 2 + 1e-8
  );
}
export function routeMotion(route: Route, e: Equipment): Motion {
  const points = route.points,
    issues: Motion["issues"] = [],
    pieces: Piece[] = [];
  if (points.length < 2)
    return {
      pieces,
      issues: [
        {
          status: "unknown",
          detail: "경로를 두 지점 이상 지정하세요.",
          point: points[0] ?? [0, 0],
        },
      ],
      distance: 0,
    };
  const entries = points.map((p) => p),
    exits = points.map((p) => p),
    arcs = new Map<number, Piece>();
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1],
      p = points[i],
      b = points[i + 1],
      la = distance(a, p),
      lb = distance(p, b);
    if (la < 0.01 || lb < 0.01) {
      issues.push({
        status: "fail",
        detail: "중복 또는 지나치게 가까운 경로 지점",
        point: p,
      });
      continue;
    }
    const u: Point = [(p[0] - a[0]) / la, (p[1] - a[1]) / la],
      v: Point = [(b[0] - p[0]) / lb, (b[1] - p[1]) / lb];
    const angle = Math.atan2(
        u[0] * v[1] - u[1] * v[0],
        u[0] * v[0] + u[1] * v[1],
      ),
      change =
        !!route.sections[i - 1]?.reverse !== !!route.sections[i]?.reverse;
    if (change && Math.abs(Math.abs(angle) - Math.PI) < 0.001) continue;
    if (change) {
      issues.push({
        status: "unknown",
        detail: "전진·후진 전환은 같은 차체 방향의 직선에서 지정하세요.",
        point: p,
      });
      continue;
    }
    if (Math.abs(angle) < 0.001) continue;
    const r = route.turnRadius;
    if (r === null || e.minRadius === null) {
      issues.push({
        status: "unknown",
        detail: "경로 회전반경과 장비의 비조향축 최소 회전반경 필요",
        point: p,
      });
      continue;
    }
    if (Math.abs(angle) > Math.PI - 0.01 || r <= 0) {
      issues.push({
        status: "fail",
        detail: "이 경로의 급회전은 지정 반경으로 연결할 수 없습니다.",
        point: p,
      });
      continue;
    }
    if (r < e.minRadius)
      issues.push({
        status: "fail",
        detail: `경로 반경 ${r}m < 장비 최소 반경 ${e.minRadius}m`,
        point: p,
      });
    const tangent = r * Math.tan(Math.abs(angle) / 2),
      entry: Point = [p[0] - u[0] * tangent, p[1] - u[1] * tangent],
      exit: Point = [p[0] + v[0] * tangent, p[1] + v[1] * tangent],
      sign = Math.sign(angle),
      center: Point = [entry[0] - u[1] * r * sign, entry[1] + u[0] * r * sign];
    entries[i] = entry;
    exits[i] = exit;
    arcs.set(i, {
      a: entry,
      b: exit,
      length: r * Math.abs(angle),
      section: i - 1,
      reverse: !!route.sections[i - 1]?.reverse,
      center,
      radius: r,
      angle: Math.atan2(entry[1] - center[1], entry[0] - center[0]),
      sweep: angle,
    });
  }
  for (let i = 0; i < points.length - 1; i++) {
    const a = exits[i],
      b = entries[i + 1],
      origA = points[i],
      origB = points[i + 1],
      l = distance(origA, origB);
    if (
      l < 0.01 ||
      (b[0] - a[0]) * (origB[0] - origA[0]) +
        (b[1] - a[1]) * (origB[1] - origA[1]) <
        -1e-7
    )
      issues.push({
        status: "fail",
        detail: "회전 원호를 넣기에 직선 길이가 부족합니다.",
        point: origB,
      });
    else if (distance(a, b) > 1e-7)
      pieces.push({
        a,
        b,
        length: distance(a, b),
        section: i,
        reverse: !!route.sections[i]?.reverse,
      });
    if (arcs.has(i + 1)) pieces.push(arcs.get(i + 1)!);
  }
  return {
    pieces,
    issues,
    distance: pieces.reduce((sum, p) => sum + p.length, 0),
  };
}
export function piecePose(p: Piece, t: number): Pose {
  if (
    p.center &&
    p.radius !== undefined &&
    p.angle !== undefined &&
    p.sweep !== undefined
  ) {
    const a = p.angle + p.sweep * t;
    return {
      x: p.center[0] + p.radius * Math.cos(a),
      y: p.center[1] + p.radius * Math.sin(a),
      heading:
        a + (Math.sign(p.sweep) * Math.PI) / 2 + (p.reverse ? Math.PI : 0),
    };
  }
  return {
    x: p.a[0] + (p.b[0] - p.a[0]) * t,
    y: p.a[1] + (p.b[1] - p.a[1]) * t,
    heading:
      Math.atan2(p.b[1] - p.a[1], p.b[0] - p.a[0]) + (p.reverse ? Math.PI : 0),
  };
}
export function poseAt(m: Motion, t: number): Pose {
  let d = Math.max(0, Math.min(1, t)) * m.distance;
  for (const p of m.pieces) {
    if (d <= p.length) return piecePose(p, p.length ? d / p.length : 0);
    d -= p.length;
  }
  return m.pieces.length
    ? piecePose(m.pieces.at(-1)!, 1)
    : { x: 0, y: 0, heading: 0 };
}
export function sweptHit(
  m: Motion,
  e: Equipment,
  obstacle: Point[],
  margin: number,
): "fail" | "unknown" | "pass" {
  let uncertain = false;
  const extent = bodyExtents(e);
  for (const piece of m.pieces) {
    if (!piece.center) {
      const sweep = hull([
        ...bodyRectangle(e, piecePose(piece, 0), margin),
        ...bodyRectangle(e, piecePose(piece, 1), margin),
      ]);
      if (intersects(sweep, obstacle)) return "fail";
      continue;
    }
    const n = Math.max(1, Math.ceil(Math.abs(piece.sweep!) / (Math.PI / 72))),
      maxR =
        piece.radius! +
        Math.hypot(
          Math.max(extent.front, extent.rear) + margin,
          extent.width / 2 + margin,
        ),
      guard = maxR * (1 - Math.cos(Math.abs(piece.sweep!) / n / 2));
    for (let j = 0; j <= n; j++)
      if (
        intersects(bodyRectangle(e, piecePose(piece, j / n), margin), obstacle)
      )
        return "fail";
    for (let j = 0; j < n; j++) {
      const a = bodyRectangle(e, piecePose(piece, j / n), margin),
        b = bodyRectangle(e, piecePose(piece, (j + 1) / n), margin);
      const expanded = hull(
        [...a, ...b].flatMap(
          ([x, y]) =>
            [
              [x - guard, y - guard],
              [x + guard, y - guard],
              [x + guard, y + guard],
              [x - guard, y + guard],
            ] as Point[],
        ),
      );
      if (intersects(expanded, obstacle)) uncertain = true;
    }
  }
  return uncertain ? "unknown" : "pass";
}
