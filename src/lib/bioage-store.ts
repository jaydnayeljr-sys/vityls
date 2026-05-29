// Server-side biological-age report: gathers a user's recent synced markers,
// runs the engine, saves today's snapshot, and returns the dated trend.
// In past-day mode (viewDate set) the function only reads existing snapshots
// — no recompute, no write.

import "server-only";
import { supabase, supabaseConfigured } from "./supabase";
import { lastNDates, nDatesEnding } from "./activity-store";
import { computeBioAge, type BioAgeResult } from "./bioage";
import type { Profile } from "./types";

export type { BioAgeResult } from "./bioage";

const WINDOW_DAYS = 14;

export interface BioAgeTrendPoint {
  date: string;
  bioAge: number;
  chronological: number;
}

export interface BioAgeReport {
  result: BioAgeResult;
  trend: BioAgeTrendPoint[];
  /** Change in bio-age since the previous snapshot. Negative = improvement. */
  dayDelta: number | null;
}

function average(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Builds a user's bio-age report. When viewDate is set, reads the cached
 *  snapshot for that date instead of recomputing or saving today's. */
export async function getBioAgeReport(
  userId: string,
  profile: Profile,
  viewDate?: string,
): Promise<BioAgeReport> {
  const dates = viewDate
    ? nDatesEnding(WINDOW_DAYS, viewDate)
    : lastNDates(WINDOW_DAYS);
  const start = dates[0];
  const today = dates[dates.length - 1];

  let restingHr: number | null = null;
  let hrv: number | null = null;
  let avgSleepMin: number | null = null;
  const trend: BioAgeTrendPoint[] = [];

  if (supabaseConfigured) {
    const { data: metricRows } = await supabase
      .from("daily_metric")
      .select("metric, value")
      .eq("user_id", userId)
      .gte("metric_date", start)
      .lte("metric_date", today)
      .in("metric", ["rhr", "hrv"]);

    const rhrValues: number[] = [];
    const hrvValues: number[] = [];
    for (const row of (metricRows ?? []) as Record<string, unknown>[]) {
      const value = Number(row.value);
      if (!Number.isFinite(value)) continue;
      if (row.metric === "rhr") rhrValues.push(value);
      else if (row.metric === "hrv") hrvValues.push(value);
    }
    if (rhrValues.length > 0) restingHr = average(rhrValues);
    if (hrvValues.length > 0) hrv = average(hrvValues);

    const { data: sleepRows } = await supabase
      .from("sleep_session")
      .select("total_min")
      .eq("user_id", userId)
      .gte("night_date", start)
      .lte("night_date", today);
    const sleepValues = ((sleepRows ?? []) as Record<string, unknown>[])
      .map((r) => Number(r.total_min))
      .filter((v) => Number.isFinite(v) && v > 0);
    if (sleepValues.length > 0) avgSleepMin = average(sleepValues);
  }

  const result = computeBioAge({
    chronologicalAge: profile.age,
    sex: profile.sex,
    vo2max: profile.vo2max,
    restingHr,
    hrv,
    avgSleepMin,
    bodyFatPct: profile.bodyFatPct,
  });

  if (supabaseConfigured) {
    // Only write a fresh snapshot when viewing today.
    if (!viewDate) {
      await supabase.from("bio_age_snapshot").upsert(
        {
          user_id: userId,
          snapshot_date: today,
          bio_age: result.bioAge,
          chronological: result.chronological,
          contributions: result.contributions,
        },
        { onConflict: "user_id,snapshot_date" },
      );
    }

    const snapQuery = supabase
      .from("bio_age_snapshot")
      .select("snapshot_date, bio_age, chronological")
      .eq("user_id", userId)
      .order("snapshot_date", { ascending: true })
      .limit(60);
    if (viewDate) snapQuery.lte("snapshot_date", today);
    const { data: snapRows } = await snapQuery;
    for (const row of (snapRows ?? []) as Record<string, unknown>[]) {
      trend.push({
        date: String(row.snapshot_date),
        bioAge: Number(row.bio_age),
        chronological: Number(row.chronological),
      });
    }
  }

  // In past-day mode, prefer the cached snapshot for the viewed date over the
  // freshly computed result (which used today's profile + window data).
  let pastResult: BioAgeResult | null = null;
  if (viewDate) {
    const snap = trend.find((p) => p.date === viewDate);
    if (snap) {
      pastResult = {
        ...result,
        bioAge: snap.bioAge,
        chronological: snap.chronological,
        delta: Number((snap.bioAge - snap.chronological).toFixed(2)),
      };
    }
  }

  let dayDelta: number | null = null;
  if (trend.length >= 2) {
    const idx = viewDate
      ? trend.findIndex((p) => p.date === viewDate)
      : trend.length - 1;
    if (idx > 0) {
      const last = trend[idx];
      const prev = trend[idx - 1];
      dayDelta = Number((last.bioAge - prev.bioAge).toFixed(2));
    }
  }

  return {
    result: pastResult ?? result,
    trend,
    dayDelta,
  };
}
