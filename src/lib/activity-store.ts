// Server-side read/write for a user's synced activity data: daily metrics and
// sleep. Written by /api/sync; read by the Activity and Today screens.

import "server-only";
import { supabase, supabaseConfigured } from "./supabase";
import { resolveBmr } from "./calc";
import type { Profile } from "./types";
import {
  METRIC_KEYS,
  type ActivitySummary,
  type DayBalance,
  type DayMetrics,
  type MetricKey,
  type SleepNight,
} from "./activity-types";

export type { ActivitySummary } from "./activity-types";

export interface MetricInput {
  date: string;
  metric: MetricKey;
  value: number;
}

export interface SleepInput {
  night: string;
  startAt?: string | null;
  endAt?: string | null;
  totalMin?: number | null;
  deepMin?: number | null;
  remMin?: number | null;
  lightMin?: number | null;
  awakeMin?: number | null;
  score?: number | null;
}

function pad(x: number): string {
  return String(x).padStart(2, "0");
}

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The last n local calendar dates, oldest first, including today. */
export function lastNDates(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(dateStr(d));
  }
  return out;
}

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

/** Upserts daily metrics for a user; one row per (date, metric). */
export async function upsertMetrics(
  userId: string,
  rows: MetricInput[],
): Promise<number> {
  if (!supabaseConfigured) throw new Error("Supabase is not configured.");
  if (rows.length === 0) return 0;
  const payload = rows.map((r) => ({
    user_id: userId,
    metric_date: r.date,
    metric: r.metric,
    value: r.value,
    source: "health_connect",
    synced_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from("daily_metric")
    .upsert(payload, { onConflict: "user_id,metric_date,metric" });
  if (error) throw new Error(error.message);
  return payload.length;
}

/** Upserts sleep nights for a user; one row per night. */
export async function upsertSleep(
  userId: string,
  rows: SleepInput[],
): Promise<number> {
  if (!supabaseConfigured) throw new Error("Supabase is not configured.");
  if (rows.length === 0) return 0;
  const payload = rows.map((r) => ({
    user_id: userId,
    night_date: r.night,
    start_at: r.startAt ?? null,
    end_at: r.endAt ?? null,
    total_min: r.totalMin ?? null,
    deep_min: r.deepMin ?? null,
    rem_min: r.remMin ?? null,
    light_min: r.lightMin ?? null,
    awake_min: r.awakeMin ?? null,
    score: r.score ?? null,
  }));
  const { error } = await supabase
    .from("sleep_session")
    .upsert(payload, { onConflict: "user_id,night_date" });
  if (error) throw new Error(error.message);
  return payload.length;
}

function emptyDay(date: string): DayMetrics {
  return {
    date,
    steps: null,
    active_kcal: null,
    total_kcal: null,
    rhr: null,
    hrv: null,
  };
}

/** Sums a user's logged food calories per calendar date in [start, end]. */
async function caloriesByDate(
  userId: string,
  start: string,
  end: string,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!supabaseConfigured) return out;
  const { data } = await supabase
    .from("food_log")
    .select("logged_for, food_item(calories)")
    .eq("user_id", userId)
    .gte("logged_for", start)
    .lte("logged_for", end);
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const date = String(row.logged_for);
    const items = Array.isArray(row.food_item)
      ? (row.food_item as Record<string, unknown>[])
      : [];
    const sum = items.reduce((s, it) => s + Number(it.calories ?? 0), 0);
    out.set(date, (out.get(date) ?? 0) + sum);
  }
  return out;
}

/** Assembles the Activity-screen data for a user over the last `days` days. */
export async function getActivitySummary(
  userId: string,
  profile: Profile,
  days = 7,
): Promise<ActivitySummary> {
  const dates = lastNDates(days);
  const start = dates[0];
  const today = dates[dates.length - 1];

  const byDate = new Map<string, DayMetrics>();
  for (const d of dates) byDate.set(d, emptyDay(d));

  let lastNight: SleepNight | null = null;
  let hasAnyData = false;

  if (supabaseConfigured) {
    const { data: metricRows } = await supabase
      .from("daily_metric")
      .select("metric_date, metric, value")
      .eq("user_id", userId)
      .gte("metric_date", start)
      .lte("metric_date", today);
    for (const row of (metricRows ?? []) as Record<string, unknown>[]) {
      const day = byDate.get(String(row.metric_date));
      const metric = String(row.metric) as MetricKey;
      if (day && METRIC_KEYS.includes(metric)) {
        day[metric] = numOrNull(row.value);
        hasAnyData = true;
      }
    }

    const { data: sleepRows } = await supabase
      .from("sleep_session")
      .select("*")
      .eq("user_id", userId)
      .lte("night_date", today)
      .order("night_date", { ascending: false })
      .limit(1);
    const s = (sleepRows ?? [])[0] as Record<string, unknown> | undefined;
    if (s) {
      lastNight = {
        night: String(s.night_date),
        totalMin: numOrNull(s.total_min),
        deepMin: numOrNull(s.deep_min),
        remMin: numOrNull(s.rem_min),
        lightMin: numOrNull(s.light_min),
        awakeMin: numOrNull(s.awake_min),
        score: numOrNull(s.score),
      };
      hasAnyData = true;
    }
  }

  const intake = await caloriesByDate(userId, start, today);
  const dayList = dates.map((d) => byDate.get(d) as DayMetrics);
  const { bmr } = resolveBmr(profile);

  const balance: DayBalance[] = dayList.map((d) => {
    let burn: number | null = null;
    if (d.total_kcal != null) {
      burn = Math.round(d.total_kcal);
    } else if (d.active_kcal != null) {
      burn = Math.round(bmr + d.active_kcal);
    }
    return {
      date: d.date,
      intakeKcal: Math.round(intake.get(d.date) ?? 0),
      burnKcal: burn,
    };
  });

  return {
    days: dayList,
    today: byDate.get(today) as DayMetrics,
    lastNight,
    balance,
    hasAnyData,
  };
}
