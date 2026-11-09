import { createEquipment, type DeliveryPlan, type Equipment } from "./types";
export function resizeFleet(p: DeliveryPlan, count: number): DeliveryPlan {
  if (!Number.isInteger(count) || count < 1 || count > 20)
    throw Error("차량 대수는 1~20대입니다.");
  const trucks = [...p.trucks],
    inactive = [...p.inactiveTrucks];
  if (count < trucks.length) inactive.unshift(...trucks.splice(count));
  while (trucks.length < count)
    trucks.push(
      inactive.shift() ?? {
        ...createEquipment("truck", crypto.randomUUID()),
        name: `차량 ${trucks.length + 1}호`,
      },
    );
  return {
    ...p,
    trucks,
    inactiveTrucks: inactive,
    concurrentTrucks: Math.min(p.concurrentTrucks, count),
  };
}
export function switchHandling(
  p: DeliveryPlan,
  kind: Exclude<Equipment["kind"], "truck">,
): DeliveryPlan {
  if (!["forklift", "ladder", "other"].includes(kind))
    throw Error("지원하지 않는 장비 종류입니다.");
  if (p.handling.kind === kind) return p;
  const prior = p.handlingProfiles.find((e) => e.kind === kind),
    handling = prior ?? createEquipment(kind, crypto.randomUUID());
  return {
    ...p,
    handling,
    handlingProfiles: [
      ...p.handlingProfiles.filter((e) => e.id !== handling.id),
      p.handling,
    ],
    routes: p.routes.map((r) =>
      r.kind === "handling"
        ? {
            ...r,
            proof: { ...r.proof, confirmed: false },
            sections: r.sections.map((s) => ({
              ...s,
              proof: { ...s.proof, confirmed: false },
            })),
          }
        : r,
    ),
    zones: p.zones.map((z) => ({
      ...z,
      proof: { ...z.proof, confirmed: false },
    })),
  };
}
export function updateEquipmentProfile(
  e: Equipment,
  patch: Partial<Equipment>,
): Equipment {
  const changed = Object.keys(patch).some(
    (k) =>
      k !== "proof" &&
      k !== "workingPointConfirmed" &&
      JSON.stringify(e[k as keyof Equipment]) !==
        JSON.stringify(patch[k as keyof Equipment]),
  );
  return {
    ...e,
    ...patch,
    workingPointConfirmed:
      patch.workingPointConfirmed ??
      (changed ? false : e.workingPointConfirmed),
    proof: patch.proof ?? { ...e.proof, confirmed: false },
  };
}
