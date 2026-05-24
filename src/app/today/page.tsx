// Today dashboard (server component) — the app's home screen. Visual hierarchy:
// Biological age, then calorie balance, macros, sleep and activity.

import AppShell from "@/components/AppShell";
import { getProfile } from "@/lib/profile-store";
import { deriveTargets } from "@/lib/calc";
import { getTodayNutrition } from "@/lib/nutrition-store";
import { getActivitySummary } from "@/lib/activity-store";
import { getBioAgeReport } from "@/lib/bioage-store";
import { supabaseConfigured } from "@/lib/supabase";
import type { BioAgeReport } from "@/lib/bioage-store";

export const dynamic = "force-dynamic";

const fmt = (n: number) => Math.round(n).toLocaleString();

function hm(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export default async function TodayPage() {
  const profile = await getProfile();
  const targets = deriveTargets(profile);
  const nutrition = await getTodayNutrition();
  const activity = await getActivitySummary(profile, 7);
  const bio = await getBioAgeReport(profile);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <AppShell active="today" userName={profile.name}>
      <div className="topbar">
        <h1>Today</h1>
        <p>{today} — your whole picture at a glance.</p>
      </div>

      {!supabaseConfigured && (
        <div className="banner warn">
          Supabase is not configured — the dashboard is showing default data
          only.
        </div>
      )}

      <BioAgeHero bio={bio} />

      <div className="act-2col">
        <CalorieCard
          eaten={nutrition.totals.calories}
          target={targets.targetKcal}
          goal={profile.energyGoal}
        />
        <MacroCard totals={nutrition.totals} targets={targets} />
      </div>

      <div className="act-2col" style={{ marginTop: 18 }}>
        <SleepCard night={activity.lastNight} />
        <ActivityCard today={activity.today} />
      </div>
    </AppShell>
  );
}

// --------------------------------------------------------------------------

function BioAgeHero({ bio }: { bio: BioAgeReport }) {
  const { result, trend } = bio;
  const delta = result.delta;
  const younger = delta < -0.1;
  const older = delta > 0.1;
  const tone = younger ? "good" : older ? "bad" : "even";

  return (
    <div className="card bioage-card">
      <div className="card-h">
        <div className="t">Biological Age</div>
        <div className="x">
          An estimate from your fitness, heart and sleep markers — not a
          diagnosis.
        </div>
      </div>

      {result.inputsUsed === 0 ? (
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
          Your biological-age estimate needs at least a couple of markers. Add
          your <b>VO2max</b> or <b>body-fat %</b> on the Profile screen, and let
          the Activity sync gather a few days of resting heart rate, HRV and
          sleep. It will appear here automatically.
        </p>
      ) : (
        <div className="bioage-grid">
          <div className="bioage-main">
            <div className={`bio-num ${tone}`}>{result.bioAge.toFixed(1)}</div>
            <div className="bio-label">estimated biological age</div>
            <div className={`bio-delta ${tone}`}>
              {younger || older ? (
                <>
                  <b>{Math.abs(delta).toFixed(1)} years</b>{" "}
                  {younger ? "younger" : "older"} than your actual age of{" "}
                  {result.chronological}
                </>
              ) : (
                <>Right on your actual age of {result.chronological}</>
              )}
            </div>
            <div className="bio-conf">
              {result.confidence} confidence · {result.inputsUsed} of 5 markers
            </div>
          </div>

          <div className="bioage-side">
            <div className="contrib-head">What is moving your estimate</div>
            {result.contributions.map((c) => {
              const mag = Math.min(1, Math.abs(c.years) / 6) * 50;
              const isYounger = c.years < -0.05;
              const isOlder = c.years > 0.05;
              return (
                <div className="contrib-row" key={c.key}>
                  <div className="contrib-label">
                    <b>{c.label}</b>
                    <small>{c.detail}</small>
                  </div>
                  <div className="contrib-track">
                    <span className="contrib-zero" />
                    <span
                      className="contrib-fill"
                      style={
                        isYounger
                          ? {
                              right: "50%",
                              width: `${mag}%`,
                              background: "var(--green)",
                            }
                          : {
                              left: "50%",
                              width: `${mag}%`,
                              background: isOlder
                                ? "var(--red)"
                                : "var(--surface-3)",
                            }
                      }
                    />
                  </div>
                  <div
                    className={
                      "contrib-val " +
                      (isYounger ? "good" : isOlder ? "bad" : "")
                    }
                  >
                    {c.years > 0 ? "+" : ""}
                    {c.years.toFixed(1)}
                  </div>
                </div>
              );
            })}

            {trend.length >= 2 ? (
              <BioTrend trend={trend} />
            ) : (
              <p className="contrib-note">
                A trend line will appear here as daily snapshots build up.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BioTrend({ trend }: { trend: BioAgeReport["trend"] }) {
  const W = 360;
  const H = 96;
  const padX = 8;
  const padT = 14;
  const padB = 24;
  const n = trend.length;
  const values = trend.flatMap((p) => [p.bioAge, p.chronological]);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (hi - lo < 4) {
    const mid = (hi + lo) / 2;
    lo = mid - 2;
    hi = mid + 2;
  }
  const xOf = (i: number) => padX + (i / (n - 1)) * (W - 2 * padX);
  const yOf = (v: number) =>
    padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);

  const line = (sel: (p: BioAgeReport["trend"][number]) => number) =>
    trend
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(sel(p)).toFixed(1)}`,
      )
      .join(" ");

  const last = trend[n - 1];
  const labelDate = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
    });
  };

  return (
    <div className="bio-trend">
      <div className="contrib-head" style={{ marginTop: 4 }}>
        Biological age over time
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <path
          d={line((p) => p.chronological)}
          fill="none"
          stroke="var(--text-3)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <path
          d={line((p) => p.bioAge)}
          fill="none"
          stroke="var(--green)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle
          cx={xOf(n - 1)}
          cy={yOf(last.bioAge)}
          r="3.5"
          fill="var(--green)"
        />
        <text x={padX} y={H - 6} fill="var(--text-3)" fontSize="10">
          {labelDate(trend[0].date)}
        </text>
        <text
          x={W - padX}
          y={H - 6}
          fill="var(--text-3)"
          fontSize="10"
          textAnchor="end"
        >
          {labelDate(last.date)}
        </text>
      </svg>
      <div className="trend-legend">
        <span>
          <i style={{ background: "var(--green)" }} /> Biological age
        </span>
        <span>
          <i className="dashed" /> Actual age
        </span>
      </div>
    </div>
  );
}

function CalorieCard({
  eaten,
  target,
  goal,
}: {
  eaten: number;
  target: number;
  goal: string;
}) {
  const remaining = target - eaten;
  const over = remaining < 0;
  const pct = target > 0 ? Math.min(100, (eaten / target) * 100) : 0;
  return (
    <div className="card">
      <div className="card-h">
        <div className="t">Calorie Balance</div>
        <div className="x">vs. your {goal} target</div>
      </div>
      <div className="balance">
        <div className="balance-num">
          <b className={over ? "over" : ""}>{fmt(Math.abs(remaining))}</b>
          <span>{over ? "kcal over target" : "kcal remaining"}</span>
        </div>
      </div>
      <div className="bigtrack">
        <div
          className="bigtrack-fill"
          style={{
            width: `${pct}%`,
            background: over ? "var(--red)" : "var(--green)",
          }}
        />
      </div>
      <div className="track-cap">
        <span>{fmt(eaten)} eaten</span>
        <span>{fmt(target)} target</span>
      </div>
    </div>
  );
}

function MacroCard({
  totals,
  targets,
}: {
  totals: { protein_g: number; carbs_g: number; fat_g: number; fiber_g: number };
  targets: { proteinG: number; carbsG: number; fatG: number };
}) {
  const rows = [
    {
      label: "Protein",
      v: totals.protein_g,
      goal: targets.proteinG,
      color: "var(--blue)",
    },
    {
      label: "Carbs",
      v: totals.carbs_g,
      goal: targets.carbsG,
      color: "var(--amber)",
    },
    { label: "Fat", v: totals.fat_g, goal: targets.fatG, color: "var(--violet)" },
  ];
  return (
    <div className="card">
      <div className="card-h">
        <div className="t">Macros</div>
        <div className="x">Today against your targets</div>
      </div>
      {rows.map((m) => {
        const pct = m.goal > 0 ? Math.min(100, (m.v / m.goal) * 100) : 0;
        return (
          <div className="macro-row" key={m.label}>
            <div className="macro-top">
              <span>{m.label}</span>
              <span className="macro-v">
                {fmt(m.v)} / {fmt(m.goal)} g
              </span>
            </div>
            <div className="track">
              <div
                className="track-fill"
                style={{ width: `${pct}%`, background: m.color }}
              />
            </div>
          </div>
        );
      })}
      <div className="macro-row">
        <div className="macro-top">
          <span>Fibre</span>
          <span className="macro-v">{fmt(totals.fiber_g)} g</span>
        </div>
      </div>
    </div>
  );
}

function SleepCard({
  night,
}: {
  night: {
    totalMin: number | null;
    deepMin: number | null;
    remMin: number | null;
    lightMin: number | null;
    awakeMin: number | null;
    score: number | null;
  } | null;
}) {
  return (
    <div className="card">
      <div className="card-h">
        <div className="t">Last Night&apos;s Sleep</div>
      </div>
      {!night || night.totalMin == null ? (
        <p className="muted" style={{ fontSize: 12.5 }}>
          No sleep synced yet — the Activity bridge fills this in each night.
        </p>
      ) : (
        <SleepBody night={night} />
      )}
    </div>
  );
}

function SleepBody({
  night,
}: {
  night: {
    totalMin: number | null;
    deepMin: number | null;
    remMin: number | null;
    lightMin: number | null;
    awakeMin: number | null;
    score: number | null;
  };
}) {
  const deep = night.deepMin ?? 0;
  const rem = night.remMin ?? 0;
  const light = night.lightMin ?? 0;
  const awake = night.awakeMin ?? 0;
  const sum = deep + rem + light + awake || 1;
  const segs = [
    { key: "Deep", min: deep, color: "var(--violet)" },
    { key: "REM", min: rem, color: "var(--blue)" },
    { key: "Light", min: light, color: "var(--green)" },
    { key: "Awake", min: awake, color: "var(--surface-3)" },
  ];
  return (
    <>
      <div className="sleep-head">
        <div>
          <div className="sleep-total">{hm(night.totalMin ?? 0)}</div>
          <div className="sleep-sub">total time asleep</div>
        </div>
        {night.score != null && (
          <div className="sleep-score">
            <b>{night.score}</b>
            <span>score</span>
          </div>
        )}
      </div>
      <div className="stage-bar">
        {segs.map(
          (s) =>
            s.min > 0 && (
              <div
                key={s.key}
                className="stage-seg"
                style={{
                  width: `${(s.min / sum) * 100}%`,
                  background: s.color,
                }}
              />
            ),
        )}
      </div>
      <div className="stage-legend">
        {segs.map((s) => (
          <div className="stage-key" key={s.key}>
            <i style={{ background: s.color }} />
            <span>{s.key}</span>
            <b>{hm(s.min)}</b>
          </div>
        ))}
      </div>
    </>
  );
}

function ActivityCard({
  today,
}: {
  today: {
    steps: number | null;
    active_kcal: number | null;
    rhr: number | null;
    hrv: number | null;
  };
}) {
  const stats = [
    { label: "Steps", value: today.steps, unit: "" },
    { label: "Active kcal", value: today.active_kcal, unit: "" },
    { label: "Resting HR", value: today.rhr, unit: "bpm" },
    { label: "HRV", value: today.hrv, unit: "ms" },
  ];
  return (
    <div className="card">
      <div className="card-h">
        <div className="t">Activity</div>
        <div className="x">Synced from Health Connect</div>
      </div>
      <div className="mini-stats">
        {stats.map((s) => (
          <div className="mini-stat" key={s.label}>
            <div className="mini-label">{s.label}</div>
            {s.value == null ? (
              <div className="mini-val muted-v">—</div>
            ) : (
              <div className="mini-val">
                {fmt(s.value)}
                {s.unit && <span>{s.unit}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
