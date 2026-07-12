// Server-side read/write for a user's synced activity data: daily metrics and
// sleep. Written by /api/sync; read by the Activity and Today screens.

import "server-only";
import { cache } from "react";
import { supabase, supabaseConfigured } from "./supabase";
import { lastNDates, nDatesEnding } from "./dates";
import { resolveBmr } from "./calc";
import type { Profile } from "./types";
import {
  METRIC_KEYS,
  type ActivitySummary,
  type DayBalance,
  type DayMetrics,
  type LifetimeAverages,
  type MetricKey,
  type SleepNight,
} from "./activity-types";

export type { ActivitySummary, LifetimeAverages } from "./activity-types";

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

function emptyAverages(): LifetimeAverages {
  return {
    steps: null,
    active_kcal: null,
    total_kcal: null,
    rhr: null,
    hrv: null,
    sleep_min: null,
  };
}

/** Average value per metric across every day the user has synced.
 *  Wrapped in React cache() — multiple screens/sections request this in the
 *  same render, and it scans two whole tables. */
export const getLifetimeAverages = cache(async (
  userId: string,
): Promise<LifetimeAverages> => {
  const out = emptyAverages();
  if (!supabaseConfigured) return out;

  const [{ data: metricRows }, { data: sleepRows }] = await Promise.all([
    supabase
      .from("daily_metric")
      .select("metric, value")
      .eq("user_id", userId)
      .in("metric", METRIC_KEYS as readonly string[]),
    supabase.from("sleep_session").select("total_min").eq("user_id", userId),
  ]);

  const sums: Record<string, { total: number; count: number }> = {};
  for (const row of (metricRows ?? []) as Record<string, unknown>[]) {
    const metric = String(row.metric);
    const value = Number(row.value);
    if (!Number.isFinite(value)) continue;
    if (!sums[metric]) sums[metric] = { total: 0, count: 0 };
    sums[metric].total += value;
    sums[metric].count += 1;
  }
  for (const k of METRIC_KEYS) {
    const s = sums[k];
    if (s && s.count > 0) {
      out[k] = Math.round(s.total / s.count);
    }
  }

  const sleepValues = ((sleepRows ?? []) as Record<string, unknown>[])
    .map((r) => Number(r.total_min))
    .filter((v) => Number.isFinite(v) && v > 0);
  if (sleepValues.length > 0) {
    out.sleep_min = Math.round(
      sleepValues.reduce((s, v) => s + v, 0) / sleepValues.length,
    );
  }

  return out;
});

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

/** Assembles the Activity-screen data for a user for the `days` days ending
 *  on `endDate`. Defaults to the last 7 days through today. */
export async function getActivitySummary(
  userId: string,
  profile: Profile,
  days = 7,
  endDate?: string,
): Promise<ActivitySummary> {
  const dates = endDate
    ? nDatesEnding(days, endDate)
    : lastNDates(days);
  const start = dates[0];
  const last = dates[dates.length - 1];

  const byDate = new Map<string, DayMetrics>();
  for (const d of dates) byDate.set(d, emptyDay(d));

  let lastNight: SleepNight | null = null;
  let hasAnyData = false;

  // All four reads are independent — run them in parallel.
  const [metricRes, sleepRes, intake, averages] = await Promise.all([
    supabaseConfigured
      ? supabase
          .from("daily_metric")
          .select("metric_date, metric, value")
          .eq("user_id", userId)
          .gte("metric_date", start)
          .lte("metric_date", last)
      : Promise.resolve({ data: null }),
    supabaseConfigured
      ? supabase
          .from("sleep_session")
          .select("*")
          .eq("user_id", userId)
          .lte("night_date", last)
          .order("night_date", { ascending: false })
          .limit(1)
      : Promise.resolve({ data: null }),
    caloriesByDate(userId, start, last),
    getLifetimeAverages(userId),
  ]);

  for (const row of (metricRes.data ?? []) as Record<string, unknown>[]) {
    const day = byDate.get(String(row.metric_date));
    const metric = String(row.metric) as MetricKey;
    if (day && METRIC_KEYS.includes(metric)) {
      day[metric] = numOrNull(row.value);
      hasAnyData = true;
    }
  }

  const s = ((sleepRes.data ?? []) as Record<string, unknown>[])[0];
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

  const dayList = dates.map((d) => byDate.get(d) as DayMetrics);
  const { bmr } = resolveBmr(profile);

  // Derive active calories when Health Connect only reported a daily total.
  // Active energy = total energy out − resting energy (BMR), floored at zero.
  for (const d of dayList) {
    if (d.active_kcal == null && d.total_kcal != null) {
      d.active_kcal = Math.max(0, Math.round(d.total_kcal - bmr));
    }
  }

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
    today: byDate.get(last) as DayMetrics,
    lastNight,
    balance,
    averages,
    hasAnyData,
  };
}
