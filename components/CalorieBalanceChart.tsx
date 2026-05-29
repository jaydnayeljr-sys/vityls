// Shared 7-day intake-vs-burn chart. Rendered as a server component (pure
// JSX) so the Today and Activity screens can both use it without duplicating
// the geometry. Each pair of bars is labelled with the day's net energy
// (deficit in green, surplus in amber).

import type { DayBalance } from "@/lib/activity-types";

const fmt = (n: number) => Math.round(n).toLocaleString();

function weekday(s: string): string {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short" });
}

export default function CalorieBalanceChart({
  balance,
  targetKcal,
}: {
  balance: DayBalance[];
  targetKcal: number;
}) {
  const W = 720;
  const H = 260;
  const padL = 18;
  const padR = 14;
  const padT = 26;
  const padB = 38;
  const plotH = H - padT - padB;
  const baseY = padT + plotH;
  const n = balance.length;
  const slot = (W - padL - padR) / n;
  const barW = Math.min(20, slot / 3.6);

  const maxVal =
    Math.max(
      targetKcal,
      ...balance.map((b) => b.intakeKcal),
      ...balance.map((b) => b.burnKcal ?? 0),
      1,
    ) * 1.18;
  const yOf = (v: number) => baseY - (v / maxVal) * plotH;
  const tgtY = yOf(targetKcal);

  const bars = balance.map((b, i) => {
    const cx = padL + slot * i + slot / 2;
    const intakeH = (b.intakeKcal / maxVal) * plotH;
    const burnH = b.burnKcal != null ? (b.burnKcal / maxVal) * plotH : null;
    const showDelta = b.burnKcal != null && b.intakeKcal > 0;
    const net = showDelta ? b.intakeKcal - (b.burnKcal ?? 0) : null;
    return {
      date: b.date,
      label: weekday(b.date),
      cx,
      ix: cx - barW - 2,
      iy: baseY - intakeH,
      intakeH,
      over: b.intakeKcal > targetKcal,
      bx: cx + 2,
      by: burnH != null ? baseY - burnH : 0,
      burnH,
      net,
      deltaY: baseY - Math.max(intakeH, burnH ?? 0) - 8,
    };
  });

  const hasIntake = balance.some((b) => b.intakeKcal > 0);
  const hasBurn = balance.some((b) => b.burnKcal != null);

  if (!hasIntake && !hasBurn) {
    return (
      <div className="chart-empty">
        No calories logged or burn data synced for the last 7 days yet.
      </div>
    );
  }

  return (
    <>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="act-chart"
        preserveAspectRatio="xMidYMid meet"
      >
        <line x1={padL} y1={baseY} x2={W - padR} y2={baseY} stroke="var(--border)" />
        <line
          x1={padL}
          y1={tgtY}
          x2={W - padR}
          y2={tgtY}
          stroke="var(--amber)"
          strokeWidth="1.5"
          strokeDasharray="5 4"
        />
        <text x={padL} y={tgtY - 7} fill="var(--amber)" fontSize="11">
          Target {fmt(targetKcal)}
        </text>
        {bars.map((b) => (
          <g key={b.date}>
            {b.intakeH > 0.5 && (
              <rect
                x={b.ix}
                y={b.iy}
                width={barW}
                height={b.intakeH}
                rx="3"
                fill={b.over ? "var(--red)" : "var(--green)"}
              />
            )}
            {b.burnH != null && b.burnH > 0.5 && (
              <rect
                x={b.bx}
                y={b.by}
                width={barW}
                height={b.burnH}
                rx="3"
                fill="var(--blue)"
              />
            )}
            {b.net != null && (
              <text
                x={b.cx}
                y={b.deltaY}
                textAnchor="middle"
                fill={b.net <= 0 ? "var(--green)" : "var(--amber)"}
                fontSize="11"
                fontWeight="700"
              >
                {b.net > 0 ? "+" : ""}
                {fmt(b.net)}
              </text>
            )}
            <text
              x={b.cx}
              y={baseY + 22}
              textAnchor="middle"
              fill="var(--text-3)"
              fontSize="11"
            >
              {b.label}
            </text>
          </g>
        ))}
      </svg>
      <div className="chart-legend">
        <span className="legend-item">
          <i style={{ background: "var(--green)" }} /> Intake (within target)
        </span>
        <span className="legend-item">
          <i style={{ background: "var(--red)" }} /> Intake (over target)
        </span>
        <span className="legend-item">
          <i style={{ background: "var(--blue)" }} /> Energy burned
        </span>
      </div>
      {!hasBurn && (
        <p className="chart-note">
          Burn bars appear once the Android app syncs active or total energy
          from Health Connect.
        </p>
      )}
    </>
  );
}
