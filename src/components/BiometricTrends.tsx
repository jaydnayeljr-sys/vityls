// Renders the three biometric trend cards (weight, body fat, VO2max). Each
// card shows the current value, the change since the first log, and a small
// sparkline — but only once the user has logged at least two values for that
// metric. Below two logs the card prompts to log again.

import type { BiometricHistory } from "@/lib/biometric-store";

interface TrendCardProps {
  label: string;
  unit: string;
  current: number | null;
  history: { date: string; value: number }[];
  /** Direction that counts as improvement. */
  goodDirection: "down" | "up";
}

const fmt = (n: number, places = 1) =>
  Number.isFinite(n) ? n.toFixed(places).replace(/\.0$/, "") : "—";

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(0, Math.round(ms / (24 * 60 * 60 * 1000)));
}

function formatSpan(days: number): string {
  if (days < 7) return `${days} day${days === 1 ? "" : "s"}`;
  if (days < 60) {
    const w = Math.round(days / 7);
    return `${w} week${w === 1 ? "" : "s"}`;
  }
  const m = Math.round(days / 30);
  return `${m} month${m === 1 ? "" : "s"}`;
}

function Sparkline({ values }: { values: number[] }) {
  const W = 240;
  const H = 60;
  const padX = 4;
  const padY = 6;
  const n = values.length;
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (hi - lo < 0.5) {
    const mid = (hi + lo) / 2;
    lo = mid - 0.5;
    hi = mid + 0.5;
  }
  const xOf = (i: number) => padX + (i / (n - 1)) * (W - 2 * padX);
  const yOf = (v: number) =>
    padY + (1 - (v - lo) / (hi - lo)) * (H - 2 * padY);

  const path = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="bm-sparkline"
      preserveAspectRatio="none"
    >
      <path
        d={path}
        fill="none"
        stroke="var(--green)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={xOf(0)}
        cy={yOf(values[0])}
        r="2.5"
        fill="var(--text-3)"
      />
      <circle
        cx={xOf(n - 1)}
        cy={yOf(values[n - 1])}
        r="3"
        fill="var(--green)"
      />
    </svg>
  );
}

function TrendCard({
  label,
  unit,
  current,
  history,
  goodDirection,
}: TrendCardProps) {
  const enoughLogs = history.length >= 2;

  if (!enoughLogs) {
    const remaining = 2 - history.length;
    return (
      <div className="bm-card">
        <div className="bm-h">
          <span className="bm-label">{label}</span>
          <span className="bm-val">
            {current == null ? "—" : `${fmt(current)} ${unit}`}
          </span>
        </div>
        <p className="bm-empty">
          Log {remaining === 2 ? "twice" : "once more"} to see a trend.
        </p>
      </div>
    );
  }

  const first = history[0];
  const last = history[history.length - 1];
  const delta = last.value - first.value;
  const span = formatSpan(daysBetween(first.date, last.date));

  let tone: "good" | "warn" | "even" = "even";
  if (Math.abs(delta) > 0.05) {
    const moved = delta < 0 ? "down" : "up";
    tone = moved === goodDirection ? "good" : "warn";
  }

  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  const deltaStr = `${sign}${fmt(Math.abs(delta))} ${unit}`;

  return (
    <div className="bm-card">
      <div className="bm-h">
        <span className="bm-label">{label}</span>
        <span className="bm-val">
          {fmt(last.value)} {unit}
        </span>
      </div>
      <Sparkline values={history.map((p) => p.value)} />
      <div className={`bm-delta ${tone}`}>
        <b>{deltaStr}</b> over {span} · {history.length} logs
      </div>
    </div>
  );
}

export default function BiometricTrends({
  history,
  current,
}: {
  history: BiometricHistory;
  current: {
    weightKg: number;
    bodyFatPct: number | null;
    vo2max: number | null;
  };
}) {
  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="card-h">
        <div className="t">Body Trends</div>
        <div className="x">
          A new point lands here every time you save a different weight, body
          fat % or VO2max.
        </div>
      </div>
      <div className="bm-grid">
        <TrendCard
          label="Weight"
          unit="kg"
          current={current.weightKg}
          history={history.weight}
          goodDirection="down"
        />
        <TrendCard
          label="Body fat"
          unit="%"
          current={current.bodyFatPct}
          history={history.body_fat}
          goodDirection="down"
        />
        <TrendCard
          label="VO2max"
          unit=""
          current={current.vo2max}
          history={history.vo2max}
          goodDirection="up"
        />
      </div>
    </div>
  );
}
