"use client";

// Bio Age History chart with Daily / Monthly / Yearly toggle. Two lines:
//   dashed grey  = chronological age
//   solid        = biological age, segment-coloured by data confidence
// HIGH (4-5 markers) → green, MEDIUM (2-3) → amber, LOW (≤1) → grey.

import { useMemo, useState } from "react";
import {
  confidenceFromInputs,
  confidenceColor,
  confidenceLabel,
  type Confidence,
} from "@/lib/bioage-confidence";

export interface BioAgeHistoryPoint {
  date: string;
  bioAge: number;
  chronological: number;
  inputsUsed: number;
}

type View = "daily" | "monthly" | "yearly";

interface AggregatedPoint {
  key: string;
  date: string;
  label: string;
  bioAge: number;
  chronological: number;
  inputsUsed: number;
  confidence: Confidence;
}

function avg(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function monthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split("-").map(Number);
  const dt = new Date(y, m - 1, 1);
  return dt.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function fullDateLabel(s: string): string {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function aggregate(points: BioAgeHistoryPoint[], view: View): AggregatedPoint[] {
  if (view === "daily") {
    return points.map((p) => ({
      key: p.date,
      date: p.date,
      label: fullDateLabel(p.date),
      bioAge: p.bioAge,
      chronological: p.chronological,
      inputsUsed: p.inputsUsed,
      confidence: confidenceFromInputs(p.inputsUsed),
    }));
  }
  const buckets = new Map<
    string,
    { bioAges: number[]; chronos: number[]; inputs: number[]; date: string }
  >();
  for (const p of points) {
    const key = view === "monthly" ? p.date.slice(0, 7) : p.date.slice(0, 4);
    const bucketDate = view === "monthly" ? `${key}-01` : `${key}-01-01`;
    if (!buckets.has(key)) {
      buckets.set(key, { bioAges: [], chronos: [], inputs: [], date: bucketDate });
    }
    const b = buckets.get(key)!;
    b.bioAges.push(p.bioAge);
    b.chronos.push(p.chronological);
    b.inputs.push(p.inputsUsed);
  }
  return Array.from(buckets.entries())
    .map(([key, b]) => {
      const inputsAvg = Math.round(avg(b.inputs));
      const label = view === "monthly" ? monthLabel(key) : key;
      return {
        key,
        date: b.date,
        label,
        bioAge: Number(avg(b.bioAges).toFixed(2)),
        chronological: Number(avg(b.chronos).toFixed(2)),
        inputsUsed: inputsAvg,
        confidence: confidenceFromInputs(inputsAvg),
      };
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

const W = 760;
const H = 290;
const PAD_L = 38;
const PAD_R = 18;
const PAD_T = 18;
const PAD_B = 40;

export default function BioAgeHistory({
  trend,
}: {
  trend: BioAgeHistoryPoint[];
}) {
  const [view, setView] = useState<View>("daily");

  const points = useMemo(() => aggregate(trend, view), [trend, view]);

  if (trend.length === 0) {
    return (
      <div className="card chart-card">
        <div className="card-h">
          <div className="t">Biological Age — History</div>
          <div className="x">
            A line of bio-age over time will appear as snapshots build up.
          </div>
        </div>
        <p className="muted" style={{ fontSize: 13 }}>
          No history yet. As you sync sleep, HRV and resting heart rate, your
          past days will be filled in automatically.
        </p>
      </div>
    );
  }

  const n = points.length;
  const allVals = points.flatMap((p) => [p.bioAge, p.chronological]);
  let lo = Math.min(...allVals) - 1.5;
  let hi = Math.max(...allVals) + 1.5;
  if (hi - lo < 4) {
    const mid = (hi + lo) / 2;
    lo = mid - 2;
    hi = mid + 2;
  }
  const xOf = (i: number) =>
    n === 1 ? (W - PAD_L - PAD_R) / 2 + PAD_L : PAD_L + (i / (n - 1)) * (W - PAD_L - PAD_R);
  const yOf = (v: number) =>
    PAD_T + (1 - (v - lo) / (hi - lo)) * (H - PAD_T - PAD_B);

  // X-axis tick labels — show ~6 evenly spaced.
  const ticks: number[] = [];
  const tickCount = Math.min(6, n);
  for (let i = 0; i < tickCount; i++) {
    ticks.push(Math.round((i / Math.max(1, tickCount - 1)) * (n - 1)));
  }

  // Y-axis: 3 horizontal grid lines at lo, mid, hi (rounded to integers).
  const yTicks = [Math.ceil(lo), Math.round((lo + hi) / 2), Math.floor(hi)];

  const chronoPath = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(p.chronological).toFixed(1)}`,
    )
    .join(" ");

  return (
    <div className="card chart-card">
      <div className="card-h bah-h">
        <div>
          <div className="t">Biological Age — History</div>
          <div className="x">
            Line colour reflects data confidence — green = high, amber =
            medium, grey = low.
          </div>
        </div>
        <div className="bah-toggle">
          {(["daily", "monthly", "yearly"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              className={v === view ? "on" : ""}
              onClick={() => setView(v)}
            >
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="bah-chart"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Y-axis grid */}
        {yTicks.map((tv) => (
          <g key={tv}>
            <line
              x1={PAD_L}
              y1={yOf(tv)}
              x2={W - PAD_R}
              y2={yOf(tv)}
              stroke="var(--border-soft)"
              strokeDasharray="2 4"
            />
            <text
              x={PAD_L - 6}
              y={yOf(tv) + 3}
              fontSize="10"
              textAnchor="end"
              fill="var(--text-3)"
            >
              {tv}
            </text>
          </g>
        ))}

        {/* Chronological age (dashed) */}
        <path
          d={chronoPath}
          fill="none"
          stroke="var(--text-3)"
          strokeWidth="1.5"
          strokeDasharray="5 4"
        />

        {/* Bio-age segments coloured by confidence */}
        {points.map((p, i) => {
          if (i === 0) return null;
          const prev = points[i - 1];
          const conf = p.confidence;
          return (
            <line
              key={`seg-${p.key}`}
              x1={xOf(i - 1)}
              y1={yOf(prev.bioAge)}
              x2={xOf(i)}
              y2={yOf(p.bioAge)}
              stroke={confidenceColor(conf)}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          );
        })}

        {/* Bio-age dots */}
        {points.map((p, i) => (
          <circle
            key={`dot-${p.key}`}
            cx={xOf(i)}
            cy={yOf(p.bioAge)}
            r={view === "daily" ? 2 : 3.5}
            fill={confidenceColor(p.confidence)}
          />
        ))}

        {/* X-axis tick labels */}
        {ticks.map((idx) => {
          const p = points[idx];
          if (!p) return null;
          return (
            <text
              key={`xt-${idx}`}
              x={xOf(idx)}
              y={H - 14}
              textAnchor="middle"
              fontSize="10.5"
              fill="var(--text-3)"
            >
              {p.label}
            </text>
          );
        })}
      </svg>

      <div className="bah-legend">
        <span className="bah-key">
          <i className="bah-line bah-dashed" /> Actual age
        </span>
        <span className="bah-key">
          <i
            className="bah-line"
            style={{ background: confidenceColor("high") }}
          />{" "}
          {confidenceLabel("high")}
        </span>
        <span className="bah-key">
          <i
            className="bah-line"
            style={{ background: confidenceColor("medium") }}
          />{" "}
          {confidenceLabel("medium")}
        </span>
        <span className="bah-key">
          <i
            className="bah-line"
            style={{ background: confidenceColor("low") }}
          />{" "}
          {confidenceLabel("low")}
        </span>
      </div>
    </div>
  );
}
