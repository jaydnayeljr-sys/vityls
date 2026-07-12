// Today dashboard body (server component). Rendered inside the desktop
// AppShell and inside the mobile carousel. Accepts an optional viewDate prop;
// when set, all data is scoped to that past calendar date.

import { Suspense } from "react";
import CalorieBalanceChart from "@/components/CalorieBalanceChart";
import DailyReviewCard from "@/components/DailyReviewCard";
import BioAgeHistory from "@/components/BioAgeHistory";
import CalendarPicker from "@/app/today/CalendarPicker";
import PastBiometricEditor from "@/app/today/PastBiometricEditor";
import PastDayMeals from "@/app/today/PastDayMeals";
import { getProfile } from "@/lib/profile-store";
import { deriveTargets } from "@/lib/calc";
import { getNutritionForDate } from "@/lib/nutrition-store";
import { parseDate, todayLocal } from "@/lib/dates";
import { getActivitySummary } from "@/lib/activity-store";
import { getBioAgeReport } from "@/lib/bioage-store";
import { getReviewForDate, getYesterdayReview } from "@/lib/review-store";
import { getBiometricsOnOrBefore } from "@/lib/biometric-store";
import { supabaseConfigured } from "@/lib/supabase";
import type { BioAgeReport } from "@/lib/bioage-store";
import type { Confidence } from "@/lib/bioage-confidence";
import type { LifetimeAverages } from "@/lib/activity-types";
import type { Profile } from "@/lib/types";

const fmt = (n: number) => Math.round(n).toLocaleString();

function hm(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function prettyDate(iso: string): string {
  return parseDate(iso).toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default async function TodayScreen({
  userId,
  viewDate,
}: {
  userId: string;
  viewDate?: string;
}) {
  const today = todayLocal();
  const isPast = !!viewDate && viewDate !== today;
  const date = viewDate ?? today;

  const profile = await getProfile(userId);
  const targets = deriveTargets(profile);

  // These reads are independent of each other — run them in parallel. The
  // daily review is NOT awaited here: generating it can involve a slow AI
  // call, so it streams in behind a Suspense boundary below.
  const [nutrition, activity, bio, pastBiometricsInitial] = await Promise.all([
    getNutritionForDate(userId, date),
    getActivitySummary(userId, profile, 7, isPast ? date : undefined),
    getBioAgeReport(userId, profile, isPast ? date : undefined),
    isPast ? getBiometricsOnOrBefore(userId, date) : Promise.resolve(null),
  ]);

  const dayBalance = activity.balance[activity.balance.length - 1];
  const dayBurn = dayBalance?.burnKcal ?? null;

  // Map of YYYY-MM-DD → confidence, for the calendar's day-number colours.
  const confidenceByDate: Record<string, Confidence> = {};
  for (const p of bio.trend) confidenceByDate[p.date] = p.confidence;

  return (
    <>
      <div className="topbar topbar-with-picker">
        <div>
          <h1>{isPast ? "Past Day" : "Today"}</h1>
          <p>
            {prettyDate(date)}
            {isPast ? " — viewing your history" : " — your whole picture at a glance."}
          </p>
        </div>
        <CalendarPicker date={date} confidenceByDate={confidenceByDate} />
      </div>

      {!supabaseConfigured && (
        <div className="banner warn">
          Supabase is not configured — the dashboard is showing default data
          only.
        </div>
      )}

      {isPast && (
        <div className="banner ok">
          You&apos;re viewing {prettyDate(date)}. Edit any logged meal or set
          your body metrics for this day below.
        </div>
      )}

      <BioAgeHero bio={bio} isPast={isPast} />

      <BioAgeHistory trend={bio.trend} />

      <Suspense fallback={<ReviewSkeleton isPast={isPast} />}>
        <ReviewSection
          userId={userId}
          profile={profile}
          date={date}
          isPast={isPast}
        />
      </Suspense>

      <div className="act-2col">
        <CalorieBalanceCard
          intake={nutrition.totals.calories}
          burn={dayBurn}
          target={targets.targetKcal}
          tdee={targets.tdee}
          goal={profile.energyGoal}
          isPast={isPast}
        />
        <MacroCard totals={nutrition.totals} targets={targets} />
      </div>

      <div className="card chart-card" style={{ marginTop: 18 }}>
        <div className="card-h">
          <div className="t">
            {isPast ? "7 days ending here" : "Last 7 days"} — Intake vs Burn
          </div>
          <div className="x">
            Each day&apos;s net energy labelled above the bars (deficit green,
            surplus amber)
          </div>
        </div>
        <CalorieBalanceChart
          balance={activity.balance}
          targetKcal={targets.targetKcal}
        />
      </div>

      <div className="act-2col" style={{ marginTop: 18 }}>
        <SleepCard
          night={activity.lastNight}
          avgSleepMin={activity.averages.sleep_min}
        />
        <ActivityCard today={activity.today} averages={activity.averages} />
      </div>

      {isPast && (
        <>
          <PastDayMeals initial={nutrition} />
          {pastBiometricsInitial && (
            <PastBiometricEditor
              date={date}
              initial={pastBiometricsInitial}
            />
          )}
        </>
      )}
    </>
  );
}

// --------------------------------------------------------------------------

/** Streams in after the rest of the page: fetching (or generating) the AI
 *  review can take several seconds when it isn't cached yet. */
async function ReviewSection({
  userId,
  profile,
  date,
  isPast,
}: {
  userId: string;
  profile: Profile;
  date: string;
  isPast: boolean;
}) {
  const review = isPast
    ? await getReviewForDate(userId, profile, date)
    : await getYesterdayReview(userId, profile);
  return review ? <DailyReviewCard review={review} /> : null;
}

function ReviewSkeleton({ isPast }: { isPast: boolean }) {
  return (
    <div className="card review-card">
      <div className="card-h">
        <div className="t">{isPast ? "Day Review" : "Yesterday's Review"}</div>
        <div className="x">Vityl Coach is writing this day&apos;s review…</div>
      </div>
    </div>
  );
}

function BioAgeHero({ bio, isPast }: { bio: BioAgeReport; isPast: boolean }) {
  const { result, trend, dayDelta } = bio;
  const delta = result.delta;
  const younger = delta < -0.1;
  const older = delta > 0.1;
  const tone = younger ? "good" : older ? "bad" : "even";

  let dayLine: { text: string; cls: string } | null = null;
  if (dayDelta != null) {
    const prevWord = isPast ? "the prior day" : "yesterday";
    if (dayDelta < -0.05) {
      dayLine = {
        text: `Down ${Math.abs(dayDelta).toFixed(2)} years since ${prevWord} — habits were working.`,
        cls: "good",
      };
    } else if (dayDelta > 0.05) {
      dayLine = {
        text: `Up ${dayDelta.toFixed(2)} years since ${prevWord} — sleep, HRV and resting HR worth a look.`,
        cls: "bad",
      };
    } else {
      dayLine = { text: `No meaningful change since ${prevWord}.`, cls: "even" };
    }
  }

  return (
    <div className="card bioage-card">
      <div className="card-h">
        <div className="t">Biological Age</div>
        <div className="x">
          {isPast
            ? "Snapshot for this date, from your stored markers."
            : "An estimate from your fitness, heart and sleep markers — not a diagnosis."}
        </div>
      </div>

      {result.inputsUsed === 0 ? (
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
          {isPast
            ? "No bio-age snapshot was recorded for this date."
            : "Your biological-age estimate needs at least a couple of markers. Add your VO2max or body-fat % on the Profile screen, and let the Activity sync gather a few days of resting heart rate, HRV and sleep."}
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
            {dayLine && (
              <div className={`bio-day-delta ${dayLine.cls}`}>
                {dayLine.text}
              </div>
            )}
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
                          ? { right: "50%", width: `${mag}%`, background: "var(--green)" }
                          : { left: "50%", width: `${mag}%`, background: isOlder ? "var(--red)" : "var(--surface-3)" }
                      }
                    />
                  </div>
                  <div className={"contrib-val " + (isYounger ? "good" : isOlder ? "bad" : "")}>
                    {c.years > 0 ? "+" : ""}
                    {c.years.toFixed(1)}
                  </div>
                </div>
              );
            })}

            {trend.length < 2 && (
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

function CalorieBalanceCard({
  intake,
  burn,
  target,
  tdee,
  goal,
  isPast,
}: {
  intake: number;
  burn: number | null;
  target: number;
  tdee: number;
  goal: string;
  isPast: boolean;
}) {
  const intakePct = target > 0 ? Math.min(100, (intake / target) * 100) : 0;
  const burnPct = tdee > 0 && burn != null ? Math.min(100, (burn / tdee) * 100) : null;
  const net = burn != null ? intake - burn : null;

  let netLabel: string;
  let netTone: "good" | "warn" | "even";
  if (net == null) {
    netLabel = isPast ? "No burn data for this day" : "Waiting for sync";
    netTone = "even";
  } else if (Math.abs(net) < 50) {
    netLabel = `Maintenance — within ${fmt(Math.abs(net))} kcal of balance`;
    netTone = "even";
  } else if (net < 0) {
    netLabel = `Deficit ${fmt(Math.abs(net))} kcal${isPast ? "" : " — your habits are on track"}`;
    netTone = "good";
  } else {
    netLabel = `Surplus +${fmt(net)} kcal`;
    netTone = "warn";
  }

  const scale = Math.max(1000, Math.abs(net ?? 0) * 1.4);
  const netPct = net != null ? (Math.abs(net) / scale) * 50 : 0;

  return (
    <div className="card">
      <div className="card-h">
        <div className="t">{isPast ? "Calorie Balance" : "Calorie Balance Today"}</div>
        <div className="x">
          Eaten vs burned — your {goal} target is {fmt(target)} kcal
        </div>
      </div>

      <div className="cb-row">
        <div className="cb-row-h">
          <span>Intake</span>
          <span className="cb-row-v">
            <b>{fmt(intake)}</b> / {fmt(target)} kcal
          </span>
        </div>
        <div className="bigtrack">
          <div
            className="bigtrack-fill"
            style={{
              width: `${intakePct}%`,
              background: intake > target ? "var(--red)" : "var(--green)",
            }}
          />
        </div>
      </div>

      <div className="cb-row">
        <div className="cb-row-h">
          <span>Burn</span>
          <span className="cb-row-v">
            {burn != null ? (
              <>
                <b>{fmt(burn)}</b> / {fmt(tdee)} kcal
              </>
            ) : (
              <span className="muted">—</span>
            )}
          </span>
        </div>
        <div className="bigtrack">
          {burnPct != null && (
            <div className="bigtrack-fill" style={{ width: `${burnPct}%`, background: "var(--blue)" }} />
          )}
        </div>
      </div>

      <div className="cb-row cb-net">
        <div className="cb-row-h">
          <span>Net</span>
          <span className={`net-label ${netTone}`}>{netLabel}</span>
        </div>
        <div className="net-track">
          <span className="net-zero" />
          {net != null && (
            <span
              className="net-fill"
              style={
                net <= 0
                  ? { right: "50%", width: `${netPct}%`, background: "var(--green)" }
                  : { left: "50%", width: `${netPct}%`, background: "var(--amber)" }
              }
            />
          )}
        </div>
        <div className="net-scale">
          <span>−{fmt(scale)}</span>
          <span>0</span>
          <span>+{fmt(scale)}</span>
        </div>
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
    { label: "Protein", v: totals.protein_g, goal: targets.proteinG, color: "var(--blue)" },
    { label: "Carbs", v: totals.carbs_g, goal: targets.carbsG, color: "var(--amber)" },
    { label: "Fat", v: totals.fat_g, goal: targets.fatG, color: "var(--violet)" },
  ];
  return (
    <div className="card">
      <div className="card-h">
        <div className="t">Macros</div>
        <div className="x">Logged for this day vs your targets</div>
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
              <div className="track-fill" style={{ width: `${pct}%`, background: m.color }} />
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
  avgSleepMin,
}: {
  night: {
    totalMin: number | null;
    deepMin: number | null;
    remMin: number | null;
    lightMin: number | null;
    awakeMin: number | null;
    score: number | null;
  } | null;
  avgSleepMin: number | null;
}) {
  return (
    <div className="card">
      <div className="card-h">
        <div className="t">Sleep</div>
        {avgSleepMin != null && (
          <div className="x">Lifetime average {hm(avgSleepMin)} per night</div>
        )}
      </div>
      {!night || night.totalMin == null ? (
        <p className="muted" style={{ fontSize: 12.5 }}>
          No sleep synced for this date.
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
                style={{ width: `${(s.min / sum) * 100}%`, background: s.color }}
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
  averages,
}: {
  today: {
    steps: number | null;
    total_kcal: number | null;
    rhr: number | null;
    hrv: number | null;
  };
  averages: LifetimeAverages;
}) {
  const stats = [
    { label: "Steps", value: today.steps, avg: averages.steps, unit: "" },
    {
      label: "Calories burned",
      value: today.total_kcal,
      avg: averages.total_kcal,
      unit: "",
    },
    {
      label: "Resting HR",
      value: today.rhr,
      avg: averages.rhr,
      unit: "bpm",
    },
    { label: "HRV", value: today.hrv, avg: averages.hrv, unit: "ms" },
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
            {s.avg != null && (
              <div className="mini-avg">
                avg {fmt(s.avg)}
                {s.unit}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
