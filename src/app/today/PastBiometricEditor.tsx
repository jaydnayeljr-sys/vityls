"use client";

// Inline editor for weight / body-fat / VO2max on a past date. Each save
// upserts a single biometric_log row at noon UTC of the chosen date.

import { useState } from "react";

type Metric = "weight" | "body_fat" | "vo2max";

interface Row {
  metric: Metric;
  label: string;
  unit: string;
  step: string;
}

const ROWS: Row[] = [
  { metric: "weight", label: "Weight", unit: "kg", step: "0.1" },
  { metric: "body_fat", label: "Body fat %", unit: "%", step: "0.1" },
  { metric: "vo2max", label: "VO2max", unit: "", step: "0.1" },
];

export default function PastBiometricEditor({
  date,
  initial,
}: {
  date: string;
  initial: { weight: number | null; body_fat: number | null; vo2max: number | null };
}) {
  const [values, setValues] = useState<Record<Metric, string>>({
    weight: initial.weight != null ? String(initial.weight) : "",
    body_fat: initial.body_fat != null ? String(initial.body_fat) : "",
    vo2max: initial.vo2max != null ? String(initial.vo2max) : "",
  });
  const [status, setStatus] = useState<Record<Metric, "idle" | "busy" | "ok" | "bad">>({
    weight: "idle",
    body_fat: "idle",
    vo2max: "idle",
  });

  async function save(metric: Metric) {
    const v = Number(values[metric]);
    if (!Number.isFinite(v) || v <= 0) {
      setStatus((s) => ({ ...s, [metric]: "bad" }));
      return;
    }
    setStatus((s) => ({ ...s, [metric]: "busy" }));
    try {
      const res = await fetch("/api/biometrics/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metric, value: v, date }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setStatus((s) => ({ ...s, [metric]: "bad" }));
      } else {
        setStatus((s) => ({ ...s, [metric]: "ok" }));
        setTimeout(
          () => setStatus((s) => ({ ...s, [metric]: "idle" })),
          1800,
        );
      }
    } catch {
      setStatus((s) => ({ ...s, [metric]: "bad" }));
    }
  }

  return (
    <div className="card pb-card">
      <div className="card-h">
        <div className="t">Body Metrics for This Day</div>
        <div className="x">
          Set or correct your weight, body fat % or VO2max on this date — each
          save logs a single point for the trend.
        </div>
      </div>
      <div className="pb-rows">
        {ROWS.map((row) => {
          const s = status[row.metric];
          return (
            <div className="pb-row" key={row.metric}>
              <span className="pb-label">{row.label}</span>
              <div className="pb-input">
                <input
                  type="number"
                  className="inp"
                  step={row.step}
                  inputMode="decimal"
                  value={values[row.metric]}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [row.metric]: e.target.value }))
                  }
                />
                {row.unit && <span className="pb-unit">{row.unit}</span>}
              </div>
              <button
                type="button"
                className="pb-btn"
                onClick={() => save(row.metric)}
                disabled={s === "busy"}
              >
                {s === "busy"
                  ? "Saving…"
                  : s === "ok"
                    ? "Saved"
                    : s === "bad"
                      ? "Retry"
                      : "Save"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
