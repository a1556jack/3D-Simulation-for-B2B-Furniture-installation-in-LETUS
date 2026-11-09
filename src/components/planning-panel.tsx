"use client";
import { useEffect, useRef, useState } from "react";
import { NumberField as N, ProofFields, downloadText } from "./planning-fields";
import {
  createRoute,
  HANDLING_LABELS,
  createSection,
  createZone,
  proof,
  LABELS,
  type DeliveryPlan,
  type PlanResult,
  type Equipment,
  type Num,
  type Point,
} from "@/lib/planning/types";
import {
  parsePlan,
  isStale,
  workOrderHtml,
  type WorkOrder,
} from "@/lib/planning/persistence";
import EquipmentEditor from "./equipment-editor";
export type Capture = {
  kind: "route" | "zone" | "obstacle";
  id: string;
} | null;
type Props = {
  plan: DeliveryPlan;
  result: PlanResult;
  onChange: (p: DeliveryPlan) => void;
  capture: Capture;
  onCapture: (c: Capture) => void;
  selectedId: string;
  onSelect: (id: string) => void;
  progress: number;
  onProgress: (n: number) => void;
  moving: "truck" | "handling";
  onMoving: (v: "truck" | "handling") => void;
  onFocus: (p: Point) => void;
  order: WorkOrder | null;
  onIssue: () => void;
  onExample: () => void;
  onExitExample: () => void;
  recovery: string | null;
};
export default function PlanningPanel(props: Props) {
  const {
    plan: p,
    onChange: change,
    result,
    capture,
    onCapture,
    selectedId,
    onSelect,
    order,
  } = props;
  const [tab, setTab] = useState("결과"),
    [routeId, setRouteId] = useState(""),
    [zoneId, setZoneId] = useState(""),
    [message, setMessage] = useState(""),
    [reading, setReading] = useState(false),
    [playing, setPlaying] = useState(false);
  const current = useRef(p),
    active = useRef(true);
  current.current = p;
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(
      () =>
        props.onProgress(
          props.progress >= 1 ? 0 : Math.min(1, props.progress + 0.015),
        ),
      100,
    );
    return () => clearInterval(id);
  }, [playing, props.progress, props.onProgress]);
  const route = p.routes.find((r) => r.id === routeId) ?? p.routes[0],
    zone = p.zones.find((z) => z.id === zoneId) ?? p.zones[0];
  function updateRoute(patch: Partial<NonNullable<typeof route>>) {
    if (!route) return;
    change({
      ...p,
      routes: p.routes.map((r) =>
        r.id === route.id
          ? {
              ...r,
              ...patch,
              proof: patch.proof ?? { ...r.proof, confirmed: false },
            }
          : r,
      ),
    });
  }
  function updateZone(patch: Partial<NonNullable<typeof zone>>) {
    if (!zone) return;
    change({
      ...p,
      zones: p.zones.map((z) =>
        z.id === zone.id
          ? {
              ...z,
              ...patch,
              proof: patch.proof ?? { ...z.proof, confirmed: false },
            }
          : z,
      ),
    });
  }
  async function importFile(file?: File) {
    if (!file || reading) return;
    const before = current.current;
    setReading(true);
    try {
      if (file.size > 2_000_000)
        throw Error("계획 파일은 2MB 이하여야 합니다.");
      const next = parsePlan(await file.text());
      if (!active.current) return;
      if (current.current !== before)
        throw Error(
          "읽는 동안 계획이 바뀌어 적용하지 않았습니다. 다시 가져오세요.",
        );
      // Imported confirmations must be reviewed on this device, even if the file says approved.
      next.site.proof.confirmed = false;
      for (const x of [
        ...next.trucks,
        ...next.inactiveTrucks,
        ...next.handlingProfiles,
        next.handling,
        ...next.routes,
        ...next.zones,
        ...next.obstacles,
        ...next.routes.flatMap((r) => r.sections),
      ])
        x.proof.confirmed = false;
      change(next);
      onCapture(null);
      setMessage(
        "계획을 가져왔습니다. 출처·위치·치수를 재확인한 후 사용하세요.",
      );
    } catch (e) {
      if (active.current) setMessage((e as Error).message);
    } finally {
      if (active.current) setReading(false);
    }
  }
  const selected =
    result.candidates.find((c) => c.id === selectedId) ?? result.candidates[0];
  return (
    <div className="planning-panel">
      {p.mode === "example" && (
        <div className="example-banner" data-testid="example-banner">
          <strong>합성 계산 예제 · 실제 현장 판정 아님</strong>
          <p>
            지도 위 장비·경로·치수는 기능 설명용입니다. 실제 현장 기록은 따로
            보존됩니다.
          </p>
          <button
            className="outline-button"
            onClick={() => {
              setPlaying(false);
              onCapture(null);
              props.onExitExample();
            }}
          >
            실제 현장으로 돌아가기
          </button>
        </div>
      )}
      <div
        className={`plan-summary status-${result.status}`}
        data-testid="plan-overall"
      >
        <small>
          {p.mode === "example" ? "합성 예제 계산" : "반입 후보 종합"}
        </small>
        <strong>{LABELS[result.status]}</strong>
        <span>
          {result.recommendedId
            ? "입력 조건을 충족하는 후보가 있습니다."
            : "확인된 통과 후보가 없습니다."}
        </span>
      </div>
      <nav className="planner-tabs" aria-label="반입 계획 편집">
        {["결과", "장비", "경로", "하차 공간", "장애물", "현장·파일"].map(
          (t) => (
            <button
              className={tab === t ? "active" : ""}
              key={t}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ),
        )}
      </nav>
      <p className="form-message" role="status" data-testid="plan-message">
        {message}
      </p>
      {tab === "결과" && (
        <>
          <section>
            <h2>하차 공간·반입로 비교</h2>
            <p className="muted">
              지정한 후보별로 차량 {p.trucks.length}대와 선택한 반입 장비 동선을
              함께 검사합니다. 추천은 입력한 공간·운영조건 안에서의 비교입니다.
            </p>
            {!result.candidates.length && (
              <div className="empty-plan">
                <strong>반입 후보를 먼저 지정하세요</strong>
                <p>
                  ① 실제 장비 제원 → ② 차량·장비 경로 → ③ 연결할 하차 공간을
                  입력하세요.
                </p>
                <button
                  className="primary-button full"
                  onClick={() => setTab("장비")}
                >
                  장비 제원 입력
                </button>
                <button
                  className="outline-button full"
                  onClick={props.onExample}
                >
                  합성 예제로 기능 확인
                </button>
              </div>
            )}
            {result.candidates.map((c) => (
              <article
                key={c.id}
                className={`candidate status-${c.status} ${selectedId === c.id ? "selected" : ""}`}
                data-testid={`candidate-${c.id}`}
              >
                <div className="section-title">
                  <h3>{c.name}</h3>
                  <span
                    className={`badge ${c.status === "pass" ? "green" : "amber"}`}
                  >
                    {result.recommendedId === c.id
                      ? p.mode === "example"
                        ? "예제 추천"
                        : "조건상 추천"
                      : LABELS[c.status]}
                  </span>
                </div>
                <strong>{LABELS[c.status]}</strong>
                <p>{c.reason}</p>
                <small>
                  하역 외형 {c.requiredWidth?.toFixed(1) ?? "?"} ×{" "}
                  {c.requiredLength?.toFixed(1) ?? "?"}m · 상부{" "}
                  {c.requiredHeight?.toFixed(1) ?? "?"}m
                </small>
                <small>
                  정렬 배치 {c.capacity}대 / 계획 동시 {p.concurrentTrucks}대
                </small>
                <button
                  className="outline-button"
                  onClick={() => {
                    onSelect(c.id);
                    const z = p.zones.find((z) => z.id === c.id);
                    if (z) props.onFocus(z.center);
                  }}
                >
                  선택
                </button>
              </article>
            ))}
          </section>
          {selected && (
            <section>
              <h2>{selected.name} · 검사 상세</h2>
              <p className="muted">
                실패가 있으면 실패로 집계합니다. 필수값이 없으면 정보 부족으로
                남습니다.
              </p>
              <div className="check-counts">
                초과 {selected.checks.filter((c) => c.status === "fail").length}{" "}
                · 미확인{" "}
                {selected.checks.filter((c) => c.status === "unknown").length} ·
                충족 {selected.checks.filter((c) => c.status === "pass").length}
              </div>
              <details open>
                <summary>초과·미확인 항목</summary>
                {selected.checks
                  .filter((c) => c.status !== "pass")
                  .map((c, i) => (
                    <div className={`check-detail status-${c.status}`} key={i}>
                      <strong>{c.label}</strong>
                      <small>
                        {c.equipmentId} · {LABELS[c.status]}
                      </small>
                      <p>{c.detail}</p>
                      {c.point && (
                        <button
                          className="text-button"
                          onClick={() => props.onFocus(c.point!)}
                        >
                          지도에서 위치 보기
                        </button>
                      )}
                    </div>
                  ))}
                {selected.checks.every((c) => c.status === "pass") && (
                  <p>입력한 기하학 조건을 모두 충족합니다.</p>
                )}
              </details>
              <details>
                <summary>충족 항목과 근거</summary>
                {selected.checks
                  .filter((c) => c.status === "pass")
                  .map((c, i) => (
                    <p key={i}>
                      <strong>{c.label}</strong>
                      <br />
                      {c.equipmentId} · {c.detail}
                    </p>
                  ))}
              </details>
            </section>
          )}
          {selected && (
            <section>
              <h2>3D 이동 확인</h2>
              <p className="muted">
                주황: 차량 · 파랑: 반입 장비 · 금색 영역: 하역 공간. 비조향축
                경로를 따라 강체 외형을 표시합니다.
              </p>
              <div className="save-row">
                <button
                  className={
                    props.moving === "truck"
                      ? "primary-button"
                      : "outline-button"
                  }
                  onClick={() => props.onMoving("truck")}
                >
                  차량 이동
                </button>
                <button
                  className={
                    props.moving === "handling"
                      ? "primary-button"
                      : "outline-button"
                  }
                  onClick={() => props.onMoving("handling")}
                >
                  {
                    HANDLING_LABELS[
                      p.handling.kind as keyof typeof HANDLING_LABELS
                    ]
                  }{" "}
                  이동
                </button>
              </div>
              <input
                className="playback"
                aria-label="이동 재생 위치"
                type="range"
                min="0"
                max="100"
                value={Math.round(props.progress * 100)}
                onChange={(e) => {
                  setPlaying(false);
                  props.onProgress(Number(e.target.value) / 100);
                }}
              />
              <button
                className="outline-button full"
                onClick={() => setPlaying(!playing)}
              >
                {playing ? "재생 멈춤" : "이동 재생"}
              </button>
              <small>
                회전 경계가 모호하면 정보 부족으로 처리합니다. 바닥 구조·전도
                안정성·실제 인양능력은 별도 확인입니다.
              </small>
            </section>
          )}
          <section>
            <h2>시공팀 작업서</h2>
            <p className="muted">
              장비·경로·검사 결과·출처를 발행 시점으로 고정합니다. 미확인 항목도
              작업서에 포함됩니다.
            </p>
            <button className="primary-button full" onClick={props.onIssue}>
              현재 조건으로 작업서 발행
            </button>
            {order && (
              <>
                <p
                  data-testid="work-order-state"
                  className={isStale(order, p) ? "stale" : "muted"}
                >
                  {isStale(order, p)
                    ? "조건 변경 · 기존 작업서 재검토 / 재발행 필요"
                    : "현재 조건으로 발행됨"}
                  <br />
                  {new Date(order.createdAt).toLocaleString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  })}
                </p>
                <button
                  className="outline-button full"
                  disabled={isStale(order, p)}
                  onClick={() => {
                    const win = window.open("", "_blank");
                    if (win) {
                      win.document.write(workOrderHtml(order));
                      win.document.close();
                    } else
                      setMessage(
                        "팝업이 차단됐습니다. 작업서 파일을 내려받아 열어주세요.",
                      );
                  }}
                >
                  작업서 인쇄 / PDF
                </button>
                <button
                  className="text-button"
                  onClick={() =>
                    downloadText(
                      workOrderHtml(order, isStale(order, p)),
                      isStale(order, p)
                        ? "LETUS-이전조건-재검토본.html"
                        : "LETUS-반입작업서.html",
                      "text/html",
                    )
                  }
                >
                  {isStale(order, p)
                    ? "이전 조건 작업서 (재검토본) 내려받기"
                    : "발행한 작업서 파일 내려받기"}
                </button>
              </>
            )}
          </section>
        </>
      )}
      {tab === "장비" && <EquipmentEditor plan={p} onChange={change} />}
      {tab === "경로" && (
        <section>
          <h2>경로 후보와 구간 조건</h2>
          <div className="save-row">
            {(["truck", "handling"] as const).map((kind) => (
              <button
                className="outline-button"
                disabled={p.routes.length >= 8}
                key={kind}
                onClick={() => {
                  const r = createRoute(kind);
                  change({ ...p, routes: [...p.routes, r] });
                  setRouteId(r.id);
                  onCapture({ kind: "route", id: r.id });
                }}
              >
                {kind === "truck"
                  ? "차량 경로 추가"
                  : `${HANDLING_LABELS[p.handling.kind as keyof typeof HANDLING_LABELS]} 경로 추가`}
              </button>
            ))}
          </div>
          {route && (
            <>
              <label className="field">
                편집 경로
                <select
                  value={route.id}
                  onChange={(e) => {
                    setRouteId(e.target.value);
                    onCapture(null);
                  }}
                >
                  {p.routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                경로명
                <input
                  value={route.name}
                  maxLength={100}
                  onChange={(e) => updateRoute({ name: e.target.value })}
                />
              </label>
              <button
                className="primary-button full"
                onClick={() =>
                  onCapture(
                    capture?.id === route.id
                      ? null
                      : { kind: "route", id: route.id },
                  )
                }
              >
                {capture?.id === route.id
                  ? "지도 지점 지정 마침"
                  : "지도에서 경로 지점 지정"}
              </button>
              <p className="muted">
                비조향축 중심이 지날 점을 순서대로 지정하세요.{" "}
                {route.points.length}/24개 · 지도 도로에 자동 정렬되지 않습니다.
                곡선 구간 폭은 원호 중심선 주변의 유효 폭입니다.
              </p>
              <div className="save-row">
                <button
                  className="outline-button"
                  onClick={() =>
                    updateRoute({
                      points: route.points.slice(0, -1),
                      sections: route.sections.slice(0, -1),
                      surveyed: false,
                    })
                  }
                >
                  마지막 점 취소
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    change({
                      ...p,
                      routes: p.routes.filter((r) => r.id !== route.id),
                    });
                    onCapture(null);
                  }}
                >
                  경로 삭제
                </button>
              </div>
              <N
                label="계획 회전반경 (m)"
                value={route.turnRadius}
                max={100}
                onChange={(turnRadius) => updateRoute({ turnRadius })}
              />
              <details>
                <summary>좌표로 경로 지점 추가 (기준점 동·북 m)</summary>
                <PointAdder
                  onAdd={(point) => {
                    if (route.points.length >= 24) return;
                    updateRoute({
                      points: [...route.points, point],
                      sections: route.points.length
                        ? [...route.sections, createSection()]
                        : [],
                      surveyed: false,
                    });
                  }}
                />
              </details>
              {route.sections.map((s, i) => (
                <div className="segment-editor" key={i}>
                  <h3>구간 {i + 1}</h3>
                  <div className="plan-fields">
                    {(
                      [
                        ["width", "유효 폭 (m)"],
                        ["height", "유효 높이 (m)"],
                        ["slope", "진행방향 경사 (%)"],
                      ] as const
                    ).map(([key, label]) => (
                      <N
                        key={key}
                        label={`구간 ${i + 1} ${label}`}
                        value={s[key]}
                        min={key === "slope" ? -40 : 0}
                        max={key === "slope" ? 40 : 500}
                        onChange={(value) =>
                          updateRoute({
                            sections: route.sections.map((x, j) =>
                              i === j
                                ? {
                                    ...x,
                                    [key]: value,
                                    proof: { ...x.proof, confirmed: false },
                                  }
                                : x,
                            ),
                          })
                        }
                      />
                    ))}
                  </div>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={s.reverse}
                      onChange={(e) =>
                        updateRoute({
                          sections: route.sections.map((x, j) =>
                            i === j
                              ? {
                                  ...x,
                                  reverse: e.target.checked,
                                  proof: { ...x.proof, confirmed: false },
                                }
                              : x,
                          ),
                        })
                      }
                    />{" "}
                    후진 구간
                  </label>
                  <ProofFields
                    label={`구간 ${i + 1}`}
                    value={s.proof}
                    onChange={(proof) =>
                      updateRoute({
                        sections: route.sections.map((x, j) =>
                          i === j ? { ...x, proof } : x,
                        ),
                      })
                    }
                  />
                </div>
              ))}
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={route.surveyed}
                  onChange={(e) => updateRoute({ surveyed: e.target.checked })}
                />{" "}
                이 경로의 위치·통행 허용·장애물 조사를 완료함
              </label>
              <ProofFields
                label={route.name}
                value={route.proof}
                onChange={(proof) => updateRoute({ proof })}
              />
            </>
          )}
        </section>
      )}
      {tab === "하차 공간" && (
        <section>
          <h2>하차 공간 후보</h2>
          <button
            className="outline-button full"
            disabled={p.zones.length >= 8}
            onClick={() => {
              const z = createZone();
              change({ ...p, zones: [...p.zones, z] });
              setZoneId(z.id);
              onSelect(z.id);
              onCapture({ kind: "zone", id: z.id });
            }}
          >
            지도에 하차 후보 추가
          </button>
          {zone && (
            <>
              <label className="field">
                편집 하차 후보
                <select
                  value={zone.id}
                  onChange={(e) => {
                    setZoneId(e.target.value);
                    onSelect(e.target.value);
                    onCapture(null);
                  }}
                >
                  {p.zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                후보명
                <input
                  value={zone.name}
                  maxLength={100}
                  onChange={(e) => updateZone({ name: e.target.value })}
                />
              </label>
              <button
                className="outline-button full"
                onClick={() => onCapture({ kind: "zone", id: zone.id })}
              >
                지도에서 후보 중심 지정
              </button>
              <div className="plan-fields">
                <N
                  label="중심 동쪽 (m)"
                  value={zone.center[0]}
                  min={-10000}
                  max={10000}
                  onChange={(v) =>
                    updateZone({ center: [v ?? 0, zone.center[1]] })
                  }
                />
                <N
                  label="중심 북쪽 (m)"
                  value={zone.center[1]}
                  min={-10000}
                  max={10000}
                  onChange={(v) =>
                    updateZone({ center: [zone.center[0], v ?? 0] })
                  }
                />
                {(
                  [
                    ["width", "하차 공간 폭 (m)"],
                    ["length", "하차 공간 길이 (m)"],
                    ["height", "하차 공간 상부 높이 (m)"],
                    ["heading", "방향 (동쪽 0° / 북쪽 90°)"],
                  ] as const
                ).map(([k, label]) => (
                  <N
                    key={k}
                    label={label}
                    value={zone[k]}
                    min={k === "heading" ? -360 : 0}
                    max={k === "heading" ? 360 : 500}
                    onChange={(v) =>
                      updateZone({ [k]: k === "heading" ? (v ?? 0) : v })
                    }
                  />
                ))}
              </div>
              <label className="field">
                하역 방식
                <select
                  value={zone.mode}
                  onChange={(e) =>
                    updateZone({ mode: e.target.value as "side" | "rear" })
                  }
                >
                  <option value="side">
                    좌측 측면 하역 (윙 차량은 윙 개방)
                  </option>
                  <option value="rear">뒤 리프트 전개 · 후면 하역</option>
                </select>
              </label>
              {(["truck", "handling"] as const).map((kind) => (
                <label className="field" key={kind}>
                  {kind === "truck"
                    ? "차량 접근 경로"
                    : `${HANDLING_LABELS[p.handling.kind as keyof typeof HANDLING_LABELS]} 반입 경로`}
                  <select
                    value={
                      kind === "truck"
                        ? zone.truckRouteId
                        : zone.handlingRouteId
                    }
                    onChange={(e) =>
                      updateZone({
                        [kind === "truck" ? "truckRouteId" : "handlingRouteId"]:
                          e.target.value,
                      })
                    }
                  >
                    <option value="">경로 선택 필요</option>
                    {p.routes
                      .filter((r) => r.kind === kind)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                  </select>
                </label>
              ))}
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={zone.accessConfirmed}
                  onChange={(e) =>
                    updateZone({ accessConfirmed: e.target.checked })
                  }
                />{" "}
                사용 허용·운영조건·주변 장애물을 확인함
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={zone.openSky}
                  onChange={(e) => updateZone({ openSky: e.target.checked })}
                />
                하차·설치 영역 상부가 개방된 야외임을 확인함
              </label>
              <ProofFields
                label={zone.name}
                value={zone.proof}
                onChange={(proof) => updateZone({ proof })}
              />
              <button
                className="text-button"
                onClick={() => {
                  change({
                    ...p,
                    zones: p.zones.filter((z) => z.id !== zone.id),
                  });
                  onCapture(null);
                }}
              >
                후보 삭제
              </button>
            </>
          )}
        </section>
      )}
      {tab === "장애물" && (
        <section>
          <h2>실측 장애물</h2>
          <p className="muted">
            기둥·벽·상부 배관 등을 직육면체로 지정합니다. 하단·상단 높이는 해당
            위치 노면 기준입니다.
          </p>
          <button
            className="outline-button full"
            disabled={p.obstacles.length >= 24}
            onClick={() => {
              const o = {
                id: crypto.randomUUID(),
                name: "장애물",
                center: [0, 0] as Point,
                width: null,
                length: null,
                heading: 0,
                base: null,
                top: null,
                proof: proof(),
              };
              change({ ...p, obstacles: [...p.obstacles, o] });
              onCapture({ kind: "obstacle", id: o.id });
            }}
          >
            지도에 장애물 추가
          </button>
          {p.obstacles.map((o) => {
            const update = (patch: Partial<typeof o>) =>
              change({
                ...p,
                obstacles: p.obstacles.map((x) =>
                  x.id === o.id
                    ? {
                        ...x,
                        ...patch,
                        proof: patch.proof ?? { ...x.proof, confirmed: false },
                      }
                    : x,
                ),
              });
            return (
              <details key={o.id} open className="segment-editor">
                <summary>{o.name}</summary>
                <label className="field">
                  장애물명
                  <input
                    value={o.name}
                    maxLength={100}
                    onChange={(e) => update({ name: e.target.value })}
                  />
                </label>
                <button
                  className="outline-button"
                  onClick={() => onCapture({ kind: "obstacle", id: o.id })}
                >
                  지도에서 위치 지정
                </button>
                <div className="plan-fields">
                  {(
                    [
                      ["width", "폭 (m)"],
                      ["length", "길이 (m)"],
                      ["base", "하단 높이 (m)"],
                      ["top", "상단 높이 (m)"],
                      ["heading", "방향 (°)"],
                    ] as const
                  ).map(([k, label]) => (
                    <N
                      key={k}
                      label={`${o.name} ${label}`}
                      value={o[k]}
                      min={k === "heading" ? -360 : 0}
                      max={k === "heading" ? 360 : 500}
                      onChange={(v) =>
                        update({ [k]: k === "heading" ? (v ?? 0) : v })
                      }
                    />
                  ))}
                </div>
                <ProofFields
                  label={o.name}
                  value={o.proof}
                  onChange={(proof) => update({ proof })}
                />
                <button
                  className="text-button"
                  onClick={() => {
                    change({
                      ...p,
                      obstacles: p.obstacles.filter((x) => x.id !== o.id),
                    });
                    onCapture(null);
                  }}
                >
                  장애물 삭제
                </button>
              </details>
            );
          })}
        </section>
      )}
      {tab === "현장·파일" && (
        <section>
          <h2>현장 연결과 운영 조건</h2>
          <p>{p.site.address}</p>
          <label className="field">
            작업 동·반입구
            <input
              maxLength={200}
              value={p.site.entrance}
              placeholder="관리사무소와 확인한 작업 동·출입구"
              onChange={(e) =>
                change({
                  ...p,
                  site: {
                    ...p.site,
                    entrance: e.target.value,
                    proof: { ...p.site.proof, confirmed: false },
                  },
                })
              }
            />
          </label>
          <ProofFields
            label="작업 동·반입구"
            value={p.site.proof}
            onChange={(proof) => change({ ...p, site: { ...p.site, proof } })}
          />
          <h3>관리자가 정한 여유</h3>
          <div className="plan-fields">
            <N
              label="좌우 각각 여유 (m)"
              value={p.margins.side}
              max={10}
              onChange={(side) =>
                change({ ...p, margins: { ...p.margins, side } })
              }
            />
            <N
              label="상부 여유 (m)"
              value={p.margins.vertical}
              max={10}
              onChange={(vertical) =>
                change({ ...p, margins: { ...p.margins, vertical } })
              }
            />
          </div>
          <label className="field">
            동시 하역 차량 수 (전체 {p.trucks.length}대)
            <select
              value={p.concurrentTrucks}
              onChange={(e) =>
                change({ ...p, concurrentTrucks: Number(e.target.value) })
              }
            >
              {Array.from({ length: p.trucks.length }, (_, i) => i + 1).map(
                (n) => (
                  <option key={n} value={n}>
                    {n === 1 ? "1대씩 순차 반입" : `${n}대 동시 정차`}
                  </option>
                ),
              )}
            </select>
          </label>
          <p className="muted">
            동시 정차는 면적상 배치 대수까지 비교합니다. 각 정차 자리별
            진입·퇴출이 검증되기 전에는 전체 통과로 추천하지 않습니다.
          </p>
          <button
            className="outline-button full"
            onClick={() =>
              downloadText(JSON.stringify(p, null, 2), "LETUS-반입계획.json")
            }
          >
            반입 계획 내려받기
          </button>
          <label className="outline-button import-button">
            계획 파일 가져오기
            <input
              disabled={reading}
              aria-label="반입 계획 파일 가져오기"
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                void importFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {props.recovery && (
            <button
              className="outline-button full"
              onClick={() =>
                downloadText(props.recovery!, "LETUS-계획복구원본.json")
              }
            >
              계획 복구 원본 내려받기
            </button>
          )}
          <button className="text-button" onClick={props.onExample}>
            합성 예제로 기능 확인
          </button>
          <p className="muted">
            API 자동 취득은 미완료입니다. 여기서는 출처가 확인된 자료로 조건을
            계산합니다. 실제 승인·실측 완료를 대신하지 않습니다.
          </p>
        </section>
      )}
    </div>
  );
}
function PointAdder({ onAdd }: { onAdd: (p: Point) => void }) {
  const [x, setX] = useState<Num>(null),
    [y, setY] = useState<Num>(null);
  return (
    <div>
      <div className="plan-fields">
        <N
          label="경로 지점 동쪽 (m)"
          value={x}
          min={-10000}
          max={10000}
          onChange={setX}
        />
        <N
          label="경로 지점 북쪽 (m)"
          value={y}
          min={-10000}
          max={10000}
          onChange={setY}
        />
      </div>
      <button
        className="outline-button full"
        disabled={x === null || y === null}
        onClick={() => {
          if (x !== null && y !== null) onAdd([x, y]);
        }}
      >
        좌표 지점 추가
      </button>
    </div>
  );
}
