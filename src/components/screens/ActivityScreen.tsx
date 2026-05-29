// Activity screen body (server component). Steps, energy, heart rate, HRV and
// sleep synced from Health Connect, plus the 7-day calorie intake-vs-burn
// trend. Rendered inside the desktop AppShell and the mobile carousel.

import CalorieBalanceChart from "@/components/CalorieBalanceChart";
import { getProfile } from "@/lib/profile-store";
import { deriveTargets } from "@/lib/calc";
import { getActivitySummary } from "@/lib/activity-store";
import { supabaseConfigured } from "@/lib/supabase";

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

export default async function ActivityScreen({ userId }: { userId: string }) {
  const profile = await getProfile(userId);
  const targets = deriveTargets(profile);
  const summary = await getActivitySummary(userId, profile, 7);

  const t = summary.today;
  const sleep = summary.lastNight;
  const avg = summary.averages;

  const stats: {
    label: string;
    value: number | null;
    avg: number | null;
    unit: string;
  }[] = [
    { label: "Steps", value: t.steps, avg: avg.steps, unit: "" },
    {
      label: "Calories burned",
      value: t.total_kcal,
      avg: avg.total_kcal,
      unit: "kcal",
    },
    { label: "Resting HR", value: t.rhr, avg: avg.rhr, unit: "bpm" },
    { label: "HRV", value: t.hrv, avg: avg.hrv, unit: "ms" },
  ];

  const stepDays = summary.days;
  const maxSteps = Math.max(1, ...stepDays.map((d) => d.steps ?? 0));
  const hasSteps = stepDays.some((d) => d.steps != null);

  return (
    <>
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
          Waiting for the first push from the Vityl Android companion app. Sign
          in on the app — once it sends data, it appears here automatically.
        </div>
      )}

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
            {s.avg != null && (
              <div className="sh stat-avg">
                Lifetime avg {fmt(s.avg)}
                {s.unit ? ` ${s.unit}` : ""}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card chart-card">
        <div className="card-h">
          <div className="t">Calorie Balance — Intake vs Burn</div>
          <div className="x">
            Last 7 days against your {profile.energyGoal} target of{" "}
            {fmt(targets.targetKcal)} kcal
          </div>
        </div>
        <CalorieBalanceChart
          balance={summary.balance}
          targetKcal={targets.targetKcal}
        />
      </div>

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
    </>
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
