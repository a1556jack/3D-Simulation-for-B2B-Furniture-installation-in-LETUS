"use client";
import { proofReady, type Num, type Proof } from "@/lib/planning/types";
export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 500,
}: {
  label: string;
  value: Num;
  onChange: (v: Num) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="field">
      {label}
      <input
        type="number"
        step="any"
        min={min}
        max={max}
        value={value ?? ""}
        placeholder="미확인"
        onChange={(e) => {
          const n = e.target.value === "" ? null : Number(e.target.value);
          if (n === null || (Number.isFinite(n) && n >= min && n <= max))
            onChange(n);
        }}
      />
    </label>
  );
}
export function ProofFields({
  value,
  onChange,
  label = "이 자료",
}: {
  value: Proof;
  onChange: (v: Proof) => void;
  label?: string;
}) {
  const canConfirm = proofReady({ ...value, confirmed: true });
  return (
    <div className="proof-fields">
      <label className="field">
        출처 · {label}
        <input
          value={value.source}
          maxLength={500}
          placeholder="도면명 / 제원 문서 / 실측 기록"
          onChange={(e) =>
            onChange({ ...value, source: e.target.value, confirmed: false })
          }
        />
      </label>
      <label className="field">
        확인일 · {label}
        <input
          type="date"
          value={value.date}
          onChange={(e) =>
            onChange({ ...value, date: e.target.value, confirmed: false })
          }
        />
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={value.confirmed}
          disabled={!canConfirm}
          onChange={(e) => onChange({ ...value, confirmed: e.target.checked })}
        />{" "}
        입력한 위치·치수와 출처를 확인함
      </label>
      {!canConfirm && (
        <small>출처와 유효한 확인일을 입력하면 확인할 수 있습니다.</small>
      )}
    </div>
  );
}
export function downloadText(
  text: string,
  name: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
