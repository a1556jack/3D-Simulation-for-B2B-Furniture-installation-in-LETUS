import type { FeatureCollection, Feature, Geometry } from "geojson";
import {
  aggregate,
  type DeliveryPlan,
  type PlanResult,
  type Point,
} from "./types";
import {
  rectangle,
  bodyRectangle,
  bodyExtents,
  routeMotion,
  poseAt,
  toWorld,
  piecePose,
  unloadingRectangle,
} from "./geometry";
const colors = { pass: "#23766b", fail: "#d75135", unknown: "#c29135" };
export function planningScene(
  p: DeliveryPlan,
  result: PlanResult,
  zoneId: string,
  progress: number,
  moving: "truck" | "forklift",
): FeatureCollection {
  const features: Feature<Geometry>[] = [],
    world = (q: Point) => toWorld(q, p.origin);
  const polygon = (
    points: Point[],
    kind: string,
    color: string,
    height = 0,
    base = 0,
  ) =>
    features.push({
      type: "Feature",
      properties: { kind, color, height, base },
      geometry: {
        type: "Polygon",
        coordinates: [[...points, points[0]].map(world)],
      },
    });
  for (const r of p.routes) {
    const e = r.kind === "truck" ? p.trucks[0] : p.forklift,
      m = routeMotion(r, e),
      points = m.pieces.length
        ? m.pieces.flatMap((s) =>
            Array.from({ length: s.center ? 20 : 2 }, (_, i) => {
              const pose = piecePose(s, i / (s.center ? 19 : 1));
              return world([pose.x, pose.y]);
            }),
          )
        : r.points.map(world);
    if (points.length < 2) continue;
    const checks = result.checks.filter((c) => c.routeId === r.id);
    features.push({
      type: "Feature",
      properties: {
        kind: "route",
        color: colors[aggregate(checks)],
        name: r.name,
      },
      geometry: { type: "LineString", coordinates: points },
    });
  }
  for (const z of p.zones)
    if (z.width && z.length)
      polygon(
        rectangle(z.center, z.length, z.width, (z.heading * Math.PI) / 180),
        "zone",
        z.id === zoneId ? "#458dba" : "#91aeb9",
      );
  for (const o of p.obstacles)
    if (o.width && o.length)
      polygon(
        rectangle(o.center, o.length, o.width, (o.heading * Math.PI) / 180),
        "volume",
        "#bc5c49",
        o.top ?? 1,
        o.base ?? 0,
      );
  const z = p.zones.find((z) => z.id === zoneId);
  if (z) {
    const truck = p.trucks[0],
      tr = p.routes.find((r) => r.id === z.truckRouteId),
      fr = p.routes.find((r) => r.id === z.forkliftRouteId);
    if (tr && truck.length && truck.width) {
      const m = routeMotion(tr, truck),
        pose = poseAt(m, moving === "truck" ? progress : 1),
        stop = poseAt(m, 1);
      polygon(
        bodyRectangle(truck, pose, 0),
        "volume",
        "#d99c46",
        bodyExtents(truck).height,
      );
      if (p.forklift.workingAisle !== null)
        polygon(
          unloadingRectangle(
            truck,
            stop,
            z.mode,
            p.forklift.workingAisle,
            p.margins.side ?? 0,
          ),
          "envelope",
          "#daa052",
        );
    }
    if (fr && p.forklift.length && p.forklift.width) {
      const m = routeMotion(fr, p.forklift),
        pose = poseAt(m, moving === "forklift" ? progress : 0);
      polygon(
        bodyRectangle(p.forklift, pose, 0),
        "volume",
        "#355f8b",
        bodyExtents(p.forklift).height,
      );
    }
  }
  const selected = result.candidates.find((c) => c.id === zoneId),
    seen = new Set<string>();
  for (const c of selected?.checks ?? []) {
    if (c.status === "pass" || !c.point) continue;
    const key = `${c.point.join(",")}:${c.status}`;
    if (seen.has(key)) continue;
    seen.add(key);
    features.push({
      type: "Feature",
      properties: { kind: "hazard", color: colors[c.status], name: c.label },
      geometry: { type: "Point", coordinates: world(c.point) },
    });
  }
  return { type: "FeatureCollection", features };
}
