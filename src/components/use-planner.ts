"use client";
import { useEffect, useMemo, useState } from "react";
import { createPlan, type DeliveryPlan } from "@/lib/planning/types";
import { createExample } from "@/lib/planning/example";
import { evaluatePlan } from "@/lib/planning/evaluate";
import {
  parsePlan,
  makeWorkOrder,
  type WorkOrder,
} from "@/lib/planning/persistence";
const KEY = "letus-delivery-plan-v1";
export function usePlanner() {
  const [site, setSite] = useState<DeliveryPlan>(createPlan),
    [example, setExample] = useState<DeliveryPlan | null>(null),
    [siteOrder, setSiteOrder] = useState<WorkOrder | null>(null),
    [exampleOrder, setExampleOrder] = useState<WorkOrder | null>(null),
    [recovery, setRecovery] = useState<string | null>(null),
    [backupKey, setBackupKey] = useState<string | null>(null),
    [storageMessage, setStorageMessage] = useState("");
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(KEY);
      if (!raw) return;
      const data = JSON.parse(raw),
        plan = parsePlan(JSON.stringify(data.plan));
      if (plan.mode !== "site")
        throw Error(
          "실제 현장 저장소에 예제 데이터가 있어 적용하지 않았습니다.",
        );
      let order: WorkOrder | null = null;
      if (data.order) {
        const w = data.order;
        if (
          typeof w.id !== "string" ||
          w.id.length > 100 ||
          typeof w.createdAt !== "string" ||
          !Number.isFinite(Date.parse(w.createdAt))
        )
          throw Error("작업서 이력 형식을 확인할 수 없습니다.");
        order = {
          ...makeWorkOrder(
            parsePlan(JSON.stringify(w.plan)),
            typeof w.selectedId === "string" ? w.selectedId : undefined,
          ),
          id: w.id,
          createdAt: w.createdAt,
        };
      }
      setSite(plan);
      setSiteOrder(order);
      if (
        typeof data.recoveryKey === "string" &&
        /^letus-plan-recovery-[0-9a-f-]{36}$/.test(data.recoveryKey)
      ) {
        const backup = localStorage.getItem(data.recoveryKey);
        if (backup) {
          setRecovery(backup);
          setBackupKey(data.recoveryKey);
        }
      }
    } catch {
      if (raw) setRecovery(raw);
      setStorageMessage(
        "기존 반입 계획을 적용하지 못했습니다. 원본을 보호하고 있습니다.",
      );
    }
  }, []);
  const plan = example ?? site,
    order = example ? exampleOrder : siteOrder,
    result = useMemo(() => evaluatePlan(plan), [plan]);
  function update(next: DeliveryPlan) {
    if (next.mode === "example") setExample(next);
    else {
      setExample(null);
      setSite(next);
    }
    setStorageMessage("반입 계획 변경 사항을 저장하세요.");
  }
  function save() {
    try {
      let key = backupKey;
      if (recovery && !key) {
        key = `letus-plan-recovery-${crypto.randomUUID()}`;
        localStorage.setItem(key, recovery);
        setBackupKey(key);
      }
      localStorage.setItem(
        KEY,
        JSON.stringify({
          plan: site,
          order: siteOrder,
          ...(key ? { recoveryKey: key } : {}),
        }),
      );
      setStorageMessage(
        example
          ? "실제 현장 계획을 저장했습니다. 합성 예제는 별도입니다."
          : "반입 계획과 작업서 이력을 이 기기에 저장했습니다.",
      );
    } catch {
      setStorageMessage(
        "반입 계획을 저장하지 못했습니다. 기존 원본은 유지됩니다.",
      );
    }
  }
  function issue(selectedId?: string) {
    try {
      const w = makeWorkOrder(plan, selectedId || undefined);
      if (example) setExampleOrder(w);
      else setSiteOrder(w);
      setStorageMessage(
        "작업서를 발행했습니다. 기록 저장으로 이력을 보관하세요.",
      );
    } catch (e) {
      setStorageMessage((e as Error).message);
    }
  }
  return {
    plan,
    order,
    result,
    update,
    save,
    issue,
    recovery,
    storageMessage,
    showExample: () => {
      setExample(createExample());
      setExampleOrder(null);
    },
    exitExample: () => {
      setExample(null);
      setExampleOrder(null);
    },
  };
}
