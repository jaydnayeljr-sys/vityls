// Activity screen (server component). Shows the metrics synced from Health
// Connect — steps, energy, heart rate, HRV and sleep — plus the 7-day calorie
// intake-vs-burn trend. Data arrives through POST /api/sync from the Android
// companion bridge; until then the screen shows sync-waiting states.

import AppShell from "@/components/AppShell";
import { getProfile } from "@/lib/profile-store";
import { deriveTargets } from "@/lib/calc";
import { getActivitySummary } from "@/lib/activity-store";
import { requireUser } from "@/lib/session";
import { supabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const fmt = (n: number) => Math.round(n).toLocaleString();

function hm(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function weekday(s: string): string {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short" });
}

export default async function ActivityPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const targets = deriveTargets(profile);
  const summary = await getActivitySummary(user.id, profile, 7);

  const t = summary.today;
  const sleep = summary.lastNight;

  const stats: { label: string; value: number | null; unit: string }[] = [
    { label: "Steps", value: t.steps, unit: "" },
    { label: "Active Calories", value: t.active_kcal, unit: "kcal" },
    { label: "Resting HR", value: t.rhr, unit: "bpm" },
    { label: "HRV", value: t.hrv, unit: "ms" },
  ];

  // --- 7-day calorie balance chart geometry --------------------------------
  const W = 720;
  const H = 260;
  const padL = 18;
  const padR = 14;
  const padT = 26;
  const padB = 38;
  const plotH = H - padT - padB;
  const baseY = padT + plotH;
  const balance = summary.balance;
  const n = balance.length;
  const slot = (W - padL - padR) / n;
  const barW = Math.min(20, slot / 3.6);

  const maxVal =
    Math.max(
      targets.targetKcal,
      ...balance.map((b) => b.intakeKcal),
      ...balance.map((b) => b.burnKcal ?? 0),
      1,
    ) * 1.18;
  const yOf = (v: number) => baseY - (v / maxVal) * plotH;
  const tgtY = yOf(targets.targetKcal);

  const bars = balance.map((b, i) => {
    const cx = padL + slot * i + slot / 2;
    const intakeH = (b.intakeKcal / maxVal) * plotH;
    const burnH = b.burnKcal != null ? (b.burnKcal / maxVal) * plotH : null;
    return {
      date: b.date,
      label: weekday(b.date),
      cx,
      ix: cx - barW - 2,
      iy: baseY - intakeH,
      intakeH,
      over: b.intakeKcal > targets.targetKcal,
      bx: cx + 2,
      by: burnH != null ? baseY - burnH : 0,
      burnH,
    };
  });
  const hasIntake = balance.some((b) => b.intakeKcal > 0);
  const hasBurn = balance.some((b) => b.burnKcal != null);

  // --- 7-day steps chart ---------------------------------------------------
  const stepDays = summary.days;
  const maxSteps = Math.max(1, ...stepDays.map((d) => d.steps ?? 0));
  const hasSteps = stepDays.some((d) => d.steps != null);

  return (
    <AppShell active="activity" userName={user.name}>
      <div className="topbar">
        <h1>Activity</h1>
        <p>
          Steps, energy, heart rate, HRV and sleep — synced daily from Health
          Connect.
        </p>
      </div>

      {!supabaseConfigured && (
        <div className="banner warn">
          Supabase is not configured — synced activity cannot be stored or
          shown.
        </div>
      )}
      {supabaseConfigured && !summary.hasAnyData && (
        <div className="banner ok">
          Waiting for the first push from the Vityl Android companion app. Add
          your personal sync token from the Profile screen into the app — once
          it sends data, it appears here automatically.
        </div>
      )}

      {/* ---------- Today's metrics ---------- */}
      <div className="stat-grid">
        {stats.map((s) => (
          <div className="card stat-card" key={s.label}>
            <div className="sl">{s.label}</div>
            {s.value == null ? (
              <>
                <div className="sv muted-v">—</div>
                <div className="sh">Waiting for sync</div>
              </>
            ) : (
              <>
                <div className="sv">
                  {fmt(s.value)}
                  {s.unit && <span className="su">{s.unit}</span>}
                </div>
                <div className="sh">today</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* ---------- Calorie balance ---------- */}
      <div className="card chart-card">
        <div className="card-h">
          <div className="t">Calorie Balance — Intake vs Burn</div>
          <div className="x">
            Last 7 days against your {profile.energyGoal} target of{" "}
            {fmt(targets.targetKcal)} kcal
          </div>
        </div>

        {!hasIntake && !hasBurn ? (
          <div className="chart-empty">
            No calories logged or burn data synced for the last 7 days yet.
          </div>
        ) : (
          <>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="act-chart"
              preserveAspectRatio="xMidYMid meet"
            >
              <line
                x1={padL}
                y1={baseY}
                x2={W - padR}
                y2={baseY}
                stroke="var(--border)"
              />
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
                Target {fmt(targets.targetKcal)}
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
                <i style={{ background: "var(--green)" }} /> Intake (within
                target)
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
                Burn bars appear once the Android app syncs active or total
                energy from Health Connect.
              </p>
            )}
          </>
        )}
      </div>

      {/* ---------- Sleep + Steps ---------- */}
      <div className="act-2col">
        <div className="card">
          <div className="card-h">
            <div className="t">Last Night&apos;s Sleep</div>
          </div>
          {sleep && sleep.totalMin != null ? (
            <SleepView
              total={sleep.totalMin}
              deep={sleep.deepMin ?? 0}
              rem={sleep.remMin ?? 0}
              light={sleep.lightMin ?? 0}
              awake={sleep.awakeMin ?? 0}
              score={sleep.score}
              night={sleep.night}
            />
          ) : (
            <p className="muted" style={{ fontSize: 12.5 }}>
              No sleep recorded yet. The Android companion app syncs each
              night&apos;s stages from Health Connect.
            </p>
          )}
        </div>

        <div className="card">
          <div className="card-h">
            <div className="t">Steps — Last 7 Days</div>
          </div>
          {!hasSteps ? (
            <p className="muted" style={{ fontSize: 12.5 }}>
              No step data synced yet.
            </p>
          ) : (
            <div className="steps-chart">
              {stepDays.map((d) => {
                const v = d.steps ?? 0;
                const pct = Math.round((v / maxSteps) * 100);
                return (
                  <div className="steps-col" key={d.date}>
                    <div className="steps-bar-wrap">
                      <div
                        className="steps-bar"
                        style={{ height: `${Math.max(2, pct)}%` }}
                      />
                    </div>
                    <div className="steps-v">
                      {d.steps == null ? "—" : fmt(v)}
                    </div>
                    <div className="steps-d">{weekday(d.date)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function SleepView({
  total,
  deep,
  rem,
  light,
  awake,
  score,
  night,
}: {
  total: number;
  deep: number;
  rem: number;
  light: number;
  awake: number;
  score: number | null;
  night: string;
}) {
  const sum = deep + rem + light + awake || 1;
  const segs = [
    { key: "Deep", min: deep, color: "var(--violet)" },
    { key: "REM", min: rem, color: "var(--blue)" },
    { key: "Light", min: light, color: "var(--green)" },
    { key: "Awake", min: awake, color: "var(--surface-3)" },
  ];
  return (
    <div className="sleep-view">
      <div className="sleep-head">
        <div>
          <div className="sleep-total">{hm(total)}</div>
          <div className="sleep-sub">night of {weekday(night)}</div>
        </div>
        {score != null && (
          <div className="sleep-score">
            <b>{score}</b>
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
    </div>
  );
}
