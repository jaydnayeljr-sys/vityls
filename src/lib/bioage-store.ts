// Server-side biological-age report: gathers the user's recent synced markers,
// runs the engine, saves today's snapshot, and returns the dated trend.

import "server-only";
import { supabase, supabaseConfigured } from "./supabase";
import { lastNDates } from "./activity-store";
import { computeBioAge, type BioAgeResult } from "./bioage";
import type { Profile } from "./types";

export type { BioAgeResult } from "./bioage";

// How many trailing days of synced data feed the marker averages.
const WINDOW_DAYS = 14;

export interface BioAgeTrendPoint {
  date: string;
  bioAge: number;
  chronological: number;
}

export interface BioAgeReport {
  result: BioAgeResult;
  trend: BioAgeTrendPoint[];
}

function average(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Builds the bio-age report and stores today's snapshot. */
export async function getBioAgeReport(profile: Profile): Promise<BioAgeReport> {
  const dates = lastNDates(WINDOW_DAYS);
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
    // Save (or overwrite) today's snapshot, then read the dated history.
    await supabase.from("bio_age_snapshot").upsert(
      {
        snapshot_date: today,
        bio_age: result.bioAge,
        chronological: result.chronological,
        contributions: result.contributions,
      },
      { onConflict: "snapshot_date" },
    );

    const { data: snapRows } = await supabase
      .from("bio_age_snapshot")
      .select("snapshot_date, bio_age, chronological")
      .order("snapshot_date", { ascending: true })
      .limit(60);
    for (const row of (snapRows ?? []) as Record<string, unknown>[]) {
      trend.push({
        date: String(row.snapshot_date),
        bioAge: Number(row.bio_age),
        chronological: Number(row.chronological),
      });
    }
  }

  return { result, trend };
}
