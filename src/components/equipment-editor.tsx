"use client";
import { useState } from "react";
import { NumberField as N, ProofFields } from "./planning-fields";
import {
  BODY_LABELS,
  HANDLING_LABELS,
  equipmentLabel,
  type DeliveryPlan,
  type Equipment,
  type Num,
} from "@/lib/planning/types";
import { resizeFleet, switchHandling } from "@/lib/planning/fleet";
const common: [keyof Equipment, string][] = [
  ["length", "차체 전장 (m)"],
  ["width", "차체 폭 (m)"],
  ["height", "차량 높이 (m)"],
  ["wheelbase", "축간거리 (m)"],
  ["frontOverhang", "앞 오버행 (m)"],
  ["rearOverhang", "뒤 오버행 (m)"],
  ["minRadius", "비조향축 최소 회전반경 (m)"],
  ["clearance", "최저 지상고 (m)"],
];
export default function EquipmentEditor({
  plan: p,
  onChange: change,
}: {
  plan: DeliveryPlan;
  onChange: (p: DeliveryPlan) => void;
}) {
  const [selected, setSelected] = useState(p.trucks[0].id),
    [message, setMessage] = useState("");
  const e =
    [...p.trucks, p.handling].find((e) => e.id === selected) ?? p.trucks[0];
  function update(patch: Partial<Equipment>) {
    const next = {
      ...e,
      ...patch,
      proof: patch.proof ?? { ...e.proof, confirmed: false },
    };
    change({
      ...p,
      trucks: p.trucks.map((t) => (t.id === e.id ? next : t)),
      handling: p.handling.id === e.id ? next : p.handling,
    });
  }
  const special: [keyof Equipment, string][] =
    e.kind === "truck"
      ? [
          ...(e.vehicleType === "wing"
            ? ([
                ["wingSide", "좌측 윙 수평 추가 폭 (m)"],
                ["wingRise", "윙 개방 추가 높이 (m)"],
              ] as [keyof Equipment, string][])
            : []),
          ["tailLift", "뒤 리프트 전개 길이 (m)"],
        ]
      : e.kind === "forklift"
        ? [
            ["forkLength", "포크 돌출 길이 (m)"],
            ["loadLength", "적재물 앞 돌출 길이 (m)"],
            ["loadWidth", "적재물 폭 (m)"],
            ["loadHeight", "적재물 높이 (m)"],
            ["loadMass", "적재물 최대 무게 (kg)"],
            ["carryHeight", "운반 높이 (m)"],
            ["workingAisle", "적재 상태 작업 통로 폭 (m)"],
            ["mass", "장비 자중 (kg)"],
            ["ratedCapacity", "정격인양하중 (kg)"],
          ]
        : e.kind === "ladder"
          ? [
              ["outriggerWidth", "아웃트리거 전개 폭 (m)"],
              ["outriggerLength", "아웃트리거 전개 길이 (m)"],
              ["outriggerOffset", "아웃트리거 중심: 기준축 앞 오프셋 (m)"],
              ["targetHeight", "목표 작업 높이 (m)"],
              ["requiredReach", "필요 수평 도달 거리 (m)"],
              ["maxWorkingHeight", "제조사 최대 작업 높이 (m)"],
              ["maxReach", "제조사 최대 수평 도달 거리 (m)"],
              ["loadMass", "적재물 최대 무게 (kg)"],
              ["operatingLoadLimit", "해당 작업점 허용 하중 (kg)"],
              ["workingAisle", "차량 사이 이송 작업 통로 폭 (m)"],
              ["mass", "장비 자중 (kg)"],
            ]
          : [
              ["workingAisle", "작업 통로 폭 (m)"],
              ["mass", "장비 자중 (kg)"],
            ];
  return (
    <section>
      <h2>차량·반입 장비 선택</h2>
      <div className="plan-fields">
        <label className="field">
          반입 차량 대수
          <select
            value={p.trucks.length}
            onChange={(ev) => change(resizeFleet(p, Number(ev.target.value)))}
          >
            {Array.from({ length: 20 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}대
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          하역 장비 종류
          <select
            value={p.handling.kind}
            onChange={(ev) => {
              const next = switchHandling(
                p,
                ev.target.value as "forklift" | "ladder" | "other",
              );
              change(next);
              setSelected(next.handling.id);
              setMessage(
                "장비별 제원은 보존했습니다. 변경한 장비의 경로와 하차 공간을 다시 확인하세요.",
              );
            }}
          >
            {Object.entries(HANDLING_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted">
        차량마다 톤수·차종·실제 모델을 지정합니다. 하역 장비는 선택한 1대
        기준입니다. 대수를 줄이거나 장비 종류를 전환해도 입력한 제원은
        보관됩니다.
      </p>
      <label className="field">
        적용 장비
        <select value={e.id} onChange={(ev) => setSelected(ev.target.value)}>
          {[...p.trucks, p.handling].map((x) => (
            <option key={x.id} value={x.id}>
              {equipmentLabel(x)}
            </option>
          ))}
        </select>
      </label>
      <div className="plan-fields">
        {e.kind === "truck" && (
          <label className="field">
            차량 종류
            <select
              value={e.vehicleType}
              onChange={(ev) =>
                update({
                  vehicleType: ev.target.value as Equipment["vehicleType"],
                })
              }
            >
              {Object.entries(BODY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          톤급 빠른 선택
          <select
            value={
              [1, 2.5, 3, 3.5, 5, 8, 11, 14, 18, 25].includes(e.tonnage ?? -1)
                ? String(e.tonnage)
                : ""
            }
            onChange={(ev) =>
              update({
                tonnage: ev.target.value ? Number(ev.target.value) : null,
              })
            }
          >
            <option value="">직접 입력 / 미확인</option>
            {[1, 2.5, 3, 3.5, 5, 8, 11, 14, 18, 25].map((t) => (
              <option key={t} value={t}>
                {t}톤
              </option>
            ))}
          </select>
        </label>
        <N
          label="톤수 직접 입력 (t)"
          value={e.tonnage}
          max={100}
          onChange={(tonnage) => update({ tonnage })}
        />
      </div>
      <p className="muted">
        톤급은 장비 구분용입니다. 실제 크기·정격하중·자중은 별도 제원을 입력해야
        합니다.
      </p>
      <label className="field">
        장비 모델·식별명
        <input
          maxLength={100}
          value={e.name}
          onChange={(ev) => update({ name: ev.target.value })}
        />
      </label>
      <label className="field">
        조향 방식
        <select
          value={e.steering}
          onChange={(ev) =>
            update({ steering: ev.target.value as Equipment["steering"] })
          }
        >
          <option value="front">전륜 조향 · 후축 기준</option>
          <option value="rear">후륜 조향 · 전축 기준</option>
        </select>
      </label>
      <p className="muted">
        최소 회전반경은 비조향축 중심 기준입니다. 장비 설명서의 외측 회전반경과
        구분하세요.
      </p>
      <div className="plan-fields">
        {common.map(([key, label]) => (
          <N
            key={key}
            label={
              e.kind === "forklift" && key === "height"
                ? "하강 마스트 높이 (m)"
                : label
            }
            value={e[key] as Num}
            max={100}
            onChange={(v) => update({ [key]: v })}
          />
        ))}
      </div>
      <h3>
        {e.kind === "ladder"
          ? "사다리차 설치·작업 조건"
          : e.kind === "truck"
            ? "특장·하역 조건"
            : "적재물·작업 공간"}
      </h3>
      <div className="plan-fields">
        {special.map(([key, label]) => (
          <N
            key={key}
            label={label}
            value={e[key] as Num}
            min={key === "outriggerOffset" ? -100 : 0}
            max={
              [
                "mass",
                "ratedCapacity",
                "loadMass",
                "operatingLoadLimit",
              ].includes(key)
                ? 1e6
                : 100
            }
            onChange={(v) => update({ [key]: v })}
          />
        ))}
      </div>
      {e.kind === "truck" && e.vehicleType !== "wing" && (
        <label className="field">
          측면 하역 가능 여부
          <select
            value={e.sideAccess === null ? "unknown" : String(e.sideAccess)}
            onChange={(ev) =>
              update({
                sideAccess:
                  ev.target.value === "unknown"
                    ? null
                    : ev.target.value === "true",
              })
            }
          >
            <option value="unknown">미확인</option>
            <option value="true">실제 측면 개방·하역 가능</option>
            <option value="false">측면 하역 불가</option>
          </select>
        </label>
      )}
      {e.kind === "truck" && (
        <p className="muted">리프트가 없으면 전개 길이에 0을 입력하세요.</p>
      )}
      {e.kind === "ladder" && (
        <>
          <p className="muted">
            층수에서 높이를 추정하지 않습니다. 실제 목표 높이·수평 거리·하중
            조합을 제조사 작업표로 확인하세요. 최대 높이와 최대 도달 거리는
            동시에 달성 가능한 값이 아닐 수 있습니다.
          </p>
          {(
            [
              [
                "workingPointConfirmed",
                "이 높이·거리·하중 조합이 제조사 작업표에서 허용됨을 확인함",
              ],
              [
                "aerialClearanceConfirmed",
                "실제 전개 방향과 작업 영역의 건물·전선·수목 간섭을 확인함",
              ],
            ] as const
          ).map(([key, label]) => (
            <label className="check-row" key={key}>
              <input
                type="checkbox"
                checked={e[key]}
                onChange={(ev) => update({ [key]: ev.target.checked })}
              />
              {label}
            </label>
          ))}
        </>
      )}
      {e.kind === "other" && (
        <p className="muted">
          외형에 따른 접근 경로를 검사합니다. 이 장비의 설치·작동 조건은 별도
          검토 항목으로 남습니다.
        </p>
      )}
      <ProofFields
        value={e.proof}
        label={e.name}
        onChange={(proof) => update({ proof })}
      />
      {e.kind === "truck" && p.trucks.length > 1 && (
        <button
          className="outline-button full"
          onClick={() => {
            change({
              ...p,
              trucks: p.trucks.map((t) =>
                t.id === e.id
                  ? t
                  : {
                      ...structuredClone(e),
                      id: t.id,
                      name: t.name,
                      proof: { ...e.proof, confirmed: false },
                    },
              ),
            });
            setMessage(
              `제원을 나머지 ${p.trucks.length - 1}대로 복사했습니다. 각 차량의 실제 제원을 확인하세요.`,
            );
          }}
        >
          동일 제원을 나머지 {p.trucks.length - 1}대에 복사
        </button>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
