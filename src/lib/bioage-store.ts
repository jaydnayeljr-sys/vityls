// Server-side biological-age history. Computes one snapshot per day, with a
// 14-day rolling window of HRV / RHR / sleep ending at that day. Snapshots
// are cached in bio_age_snapshot, with `inputs_used` driving the confidence
// model (HIGH ≥4, MEDIUM 2-3, LOW ≤1).

import "server-only";
import { supabase, supabaseConfigured } from "./supabase";
import { nDatesEnding, todayLocal } from "./dates";
import { computeBioAge, type BioAgeResult } from "./bioage";
import { confidenceFromInputs, type Confidence } from "./bioage-confidence";
import type { Profile } from "./types";

export type { BioAgeResult } from "./bioage";
export { confidenceFromInputs, type Confidence } from "./bioage-confidence";

const WINDOW_DAYS = 14;
const BACKFILL_CAP = 90; // dates computed per page load
const TREND_LIMIT = 365 * 2;

export interface BioAgeTrendPoint {
  date: string;
  bioAge: number;
  chronological: number;
  inputsUsed: number;
  confidence: Confidence;
}

export interface BioAgeReport {
  result: BioAgeResult;
  trend: BioAgeTrendPoint[];
  dayDelta: number | null;
}

function average(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Computes the bio-age result for `date` from the user's stored markers. */
async function computeForDate(
  userId: string,
  profile: Profile,
  date: string,
): Promise<BioAgeResult> {
  const { rhr, hrv, sleep } = await gatherMarkers(userId, date);
  return computeBioAge({
    chronologicalAge: profile.age,
    sex: profile.sex,
    vo2max: profile.vo2max,
    restingHr: rhr,
    hrv,
    avgSleepMin: sleep,
    bodyFatPct: profile.bodyFatPct,
  });
}

/** Gathers RHR / HRV / sleep window markers for a user up to (and including) the given date. */
async function gatherMarkers(
  userId: string,
  endDate: string,
): Promise<{ rhr: number | null; hrv: number | null; sleep: number | null }> {
  if (!supabaseConfigured) return { rhr: null, hrv: null, sleep: null };
  const start = nDatesEnding(WINDOW_DAYS, endDate)[0];

  const [{ data: metricRows }, { data: sleepRows }] = await Promise.all([
    supabase
      .from("daily_metric")
      .select("metric, value")
      .eq("user_id", userId)
      .gte("metric_date", start)
      .lte("metric_date", endDate)
      .in("metric", ["rhr", "hrv"]),
    supabase
      .from("sleep_session")
      .select("total_min")
      .eq("user_id", userId)
      .gte("night_date", start)
      .lte("night_date", endDate),
  ]);

  const rhrVals: number[] = [];
  const hrvVals: number[] = [];
  for (const row of (metricRows ?? []) as Record<string, unknown>[]) {
    const v = Number(row.value);
    if (!Number.isFinite(v)) continue;
    if (row.metric === "rhr") rhrVals.push(v);
    else if (row.metric === "hrv") hrvVals.push(v);
  }

  const sleepVals = ((sleepRows ?? []) as Record<string, unknown>[])
    .map((r) => Number(r.total_min))
    .filter((v) => Number.isFinite(v) && v > 0);

  return {
    rhr: rhrVals.length > 0 ? average(rhrVals) : null,
    hrv: hrvVals.length > 0 ? average(hrvVals) : null,
    sleep: sleepVals.length > 0 ? average(sleepVals) : null,
  };
}

/** Returns every distinct date the user has at least one synced data point for. */
async function datesWithData(userId: string): Promise<Set<string>> {
  const out = new Set<string>();
  if (!supabaseConfigured) return out;

  const [{ data: m }, { data: s }] = await Promise.all([
    supabase.from("daily_metric").select("metric_date").eq("user_id", userId),
    supabase.from("sleep_session").select("night_date").eq("user_id", userId),
  ]);
  for (const row of (m ?? []) as Record<string, unknown>[]) {
    out.add(String(row.metric_date));
  }
  for (const row of (s ?? []) as Record<string, unknown>[]) {
    out.add(String(row.night_date));
  }
  return out;
}

/** Backfills bio-age snapshots for every past date with synced data that
 *  doesn't already have one. Bounded to BACKFILL_CAP per call. */
export async function backfillBioAgeHistory(
  userId: string,
  profile: Profile,
): Promise<number> {
  if (!supabaseConfigured) return 0;

  const today = todayLocal();
  const [present, { data: snapRows }] = await Promise.all([
    datesWithData(userId),
    supabase
      .from("bio_age_snapshot")
      .select("snapshot_date, inputs_used")
      .eq("user_id", userId),
  ]);

  const have = new Map<string, number | null>();
  for (const row of (snapRows ?? []) as Record<string, unknown>[]) {
    have.set(
      String(row.snapshot_date),
      row.inputs_used == null ? null : Number(row.inputs_used),
    );
  }

  // Dates needing backfill: any date with data that either has no snapshot,
  // or whose snapshot doesn't yet carry the inputs_used column (legacy).
  const todo: string[] = [];
  for (const d of present) {
    if (d > today) continue;
    const existing = have.get(d);
    if (existing == null) todo.push(d);
  }
  if (todo.length === 0) return 0;

  // Newest first so the chart's recent history fills in first if we hit the cap.
  todo.sort((a, b) => (a < b ? 1 : -1));
  const batch = todo.slice(0, BACKFILL_CAP);

  // Fetch the markers for every window in TWO range queries (instead of two
  // queries per backfilled date), then compute each date's rolling window
  // in memory.
  const newest = batch[0];
  const oldest = batch[batch.length - 1];
  const windowStart = nDatesEnding(WINDOW_DAYS, oldest)[0];

  const [{ data: metricRows }, { data: sleepRows }] = await Promise.all([
    supabase
      .from("daily_metric")
      .select("metric_date, metric, value")
      .eq("user_id", userId)
      .gte("metric_date", windowStart)
      .lte("metric_date", newest)
      .in("metric", ["rhr", "hrv"]),
    supabase
      .from("sleep_session")
      .select("night_date, total_min")
      .eq("user_id", userId)
      .gte("night_date", windowStart)
      .lte("night_date", newest),
  ]);

  const rhrByDate = new Map<string, number[]>();
  const hrvByDate = new Map<string, number[]>();
  for (const row of (metricRows ?? []) as Record<string, unknown>[]) {
    const v = Number(row.value);
    if (!Number.isFinite(v)) continue;
    const map = row.metric === "rhr" ? rhrByDate : hrvByDate;
    const key = String(row.metric_date);
    (map.get(key) ?? map.set(key, []).get(key)!).push(v);
  }
  const sleepByDate = new Map<string, number[]>();
  for (const row of (sleepRows ?? []) as Record<string, unknown>[]) {
    const v = Number(row.total_min);
    if (!Number.isFinite(v) || v <= 0) continue;
    const key = String(row.night_date);
    (sleepByDate.get(key) ?? sleepByDate.set(key, []).get(key)!).push(v);
  }

  const windowAvg = (map: Map<string, number[]>, dates: string[]) => {
    const vals: number[] = [];
    for (const d of dates) for (const v of map.get(d) ?? []) vals.push(v);
    return vals.length > 0 ? average(vals) : null;
  };

  const payload: Record<string, unknown>[] = [];
  for (const date of batch) {
    const win = nDatesEnding(WINDOW_DAYS, date);
    const result = computeBioAge({
      chronologicalAge: profile.age,
      sex: profile.sex,
      vo2max: profile.vo2max,
      restingHr: windowAvg(rhrByDate, win),
      hrv: windowAvg(hrvByDate, win),
      avgSleepMin: windowAvg(sleepByDate, win),
      bodyFatPct: profile.bodyFatPct,
    });
    if (result.inputsUsed === 0) continue;
    payload.push({
      user_id: userId,
      snapshot_date: date,
      bio_age: result.bioAge,
      chronological: result.chronological,
      contributions: result.contributions,
      inputs_used: result.inputsUsed,
    });
  }

  if (payload.length > 0) {
    // One batched write instead of one upsert per date.
    await supabase
      .from("bio_age_snapshot")
      .upsert(payload, { onConflict: "user_id,snapshot_date" });
  }
  return payload.length;
}

/** Builds a user's bio-age report. When viewDate is set, reads the cached
 *  snapshot for that date instead of recomputing or saving today's. Always
 *  triggers a bounded historical backfill before reading the trend. */
export async function getBioAgeReport(
  userId: string,
  profile: Profile,
  viewDate?: string,
): Promise<BioAgeReport> {
  const today = todayLocal();
  const date = viewDate ?? today;
  const trend: BioAgeTrendPoint[] = [];

  // Live result for the target date (today, or the past date being viewed),
  // computed in parallel with the bounded historical backfill.
  const [live] = await Promise.all([
    computeForDate(userId, profile, date),
    supabaseConfigured
      ? backfillBioAgeHistory(userId, profile)
      : Promise.resolve(0),
  ]);

  if (supabaseConfigured) {
    // Persist a fresh snapshot for the target date. This keeps the latest
    // day current even when only a single new metric just synced.
    if (live.inputsUsed > 0) {
      await supabase.from("bio_age_snapshot").upsert(
        {
          user_id: userId,
          snapshot_date: date,
          bio_age: live.bioAge,
          chronological: live.chronological,
          contributions: live.contributions,
          inputs_used: live.inputsUsed,
        },
        { onConflict: "user_id,snapshot_date" },
      );
    }

    const { data: snapRows } = await supabase
      .from("bio_age_snapshot")
      .select("snapshot_date, bio_age, chronological, inputs_used")
      .eq("user_id", userId)
      .lte("snapshot_date", today)
      .order("snapshot_date", { ascending: true })
      .limit(TREND_LIMIT);
    for (const row of (snapRows ?? []) as Record<string, unknown>[]) {
      const inputsUsed =
        row.inputs_used == null ? 0 : Number(row.inputs_used);
      trend.push({
        date: String(row.snapshot_date),
        bioAge: Number(row.bio_age),
        chronological: Number(row.chronological),
        inputsUsed,
        confidence: confidenceFromInputs(inputsUsed),
      });
    }
  }

  // Prefer the cached snapshot for that exact date (if any), so the page
  // shows the same number as the chart and calendar.
  let result = live;
  const snap = trend.find((p) => p.date === date);
  if (snap) {
    result = {
      ...live,
      bioAge: snap.bioAge,
      chronological: snap.chronological,
      delta: Number((snap.bioAge - snap.chronological).toFixed(2)),
      inputsUsed: snap.inputsUsed,
      confidence: snap.confidence,
    };
  }

  let dayDelta: number | null = null;
  if (trend.length >= 2) {
    const idx = viewDate
      ? trend.findIndex((p) => p.date === viewDate)
      : trend.length - 1;
    if (idx > 0) {
      dayDelta = Number((trend[idx].bioAge - trend[idx - 1].bioAge).toFixed(2));
    }
  }

  return { result, trend, dayDelta };
}
