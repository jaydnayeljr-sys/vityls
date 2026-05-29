// Server-side read/write for per-user biometric history (weight, body-fat %,
// VO2max). Each log row carries a `source`: 'manual' (the user saved it) or
// 'health_connect' (the Android bridge synced it). On dates where both
// exist, manual wins.

import "server-only";
import { supabase, supabaseConfigured } from "./supabase";

export type BiometricMetric = "weight" | "body_fat" | "vo2max";
export type BiometricSource = "manual" | "health_connect";

export interface BiometricPoint {
  date: string;
  value: number;
  source: BiometricSource;
}

export interface BiometricHistory {
  weight: BiometricPoint[];
  body_fat: BiometricPoint[];
  vo2max: BiometricPoint[];
}

const METRICS: BiometricMetric[] = ["weight", "body_fat", "vo2max"];

function emptyHistory(): BiometricHistory {
  return { weight: [], body_fat: [], vo2max: [] };
}

/** Appends a single biometric reading at "now" with a chosen source. */
export async function logBiometric(
  userId: string,
  metric: BiometricMetric,
  value: number,
  source: BiometricSource = "manual",
): Promise<void> {
  if (!supabaseConfigured) return;
  if (!Number.isFinite(value) || value <= 0) return;
  await supabase
    .from("biometric_log")
    .insert({ user_id: userId, metric, value, source });
}

/** Logs (or re-logs) a biometric for a specific calendar date and source.
 *  Any existing entry on that date for the same metric+source is replaced. */
export async function logBiometricForDate(
  userId: string,
  metric: BiometricMetric,
  value: number,
  date: string,
  source: BiometricSource = "manual",
): Promise<void> {
  if (!supabaseConfigured) return;
  if (!Number.isFinite(value) || value <= 0) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;

  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;

  await supabase
    .from("biometric_log")
    .delete()
    .eq("user_id", userId)
    .eq("metric", metric)
    .eq("source", source)
    .gte("logged_at", dayStart)
    .lte("logged_at", dayEnd);

  await supabase.from("biometric_log").insert({
    user_id: userId,
    metric,
    value,
    source,
    logged_at: `${date}T12:00:00.000Z`,
  });
}

/** Helper: bucket points by YYYY-MM-DD and pick the best per day (manual
 *  beats health_connect; otherwise latest wins). Returns a chronologically
 *  ordered list. */
function preferManualPerDate(
  rows: { logged_at: string; value: number; source: BiometricSource }[],
): BiometricPoint[] {
  const byDate = new Map<
    string,
    { value: number; source: BiometricSource; ts: string }
  >();
  for (const r of rows) {
    const date = r.logged_at.slice(0, 10);
    const existing = byDate.get(date);
    if (!existing) {
      byDate.set(date, { value: r.value, source: r.source, ts: r.logged_at });
      continue;
    }
    // Manual always beats Health Connect on the same day.
    if (existing.source === "manual" && r.source !== "manual") continue;
    if (existing.source !== "manual" && r.source === "manual") {
      byDate.set(date, { value: r.value, source: r.source, ts: r.logged_at });
      continue;
    }
    // Same source — latest wins.
    if (r.logged_at > existing.ts) {
      byDate.set(date, { value: r.value, source: r.source, ts: r.logged_at });
    }
  }
  return Array.from(byDate.entries())
    .map(([date, v]) => ({ date, value: v.value, source: v.source }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Returns the user's full biometric history, grouped by metric, oldest first.
 *  Per-day dedup with manual entries preferred over Health Connect. */
export async function getBiometricHistory(
  userId: string,
): Promise<BiometricHistory> {
  const out = emptyHistory();
  if (!supabaseConfigured) return out;

  const { data } = await supabase
    .from("biometric_log")
    .select("metric, value, source, logged_at")
    .eq("user_id", userId)
    .in("metric", METRICS as readonly string[])
    .order("logged_at", { ascending: true });

  const byMetric: Record<BiometricMetric, { logged_at: string; value: number; source: BiometricSource }[]> = {
    weight: [],
    body_fat: [],
    vo2max: [],
  };
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const metric = String(row.metric) as BiometricMetric;
    if (!METRICS.includes(metric)) continue;
    byMetric[metric].push({
      logged_at: String(row.logged_at),
      value: Number(row.value),
      source: (String(row.source ?? "manual") as BiometricSource),
    });
  }
  for (const m of METRICS) {
    out[m] = preferManualPerDate(byMetric[m]);
  }
  return out;
}

/** Returns the value to show on `date` for each biometric — the manual or
 *  HC entry on or before that date, with manual preferred. */
export async function getBiometricsOnOrBefore(
  userId: string,
  date: string,
): Promise<{
  weight: number | null;
  body_fat: number | null;
  vo2max: number | null;
}> {
  const out = { weight: null as number | null, body_fat: null as number | null, vo2max: null as number | null };
  if (!supabaseConfigured) return out;
  const dayEnd = `${date}T23:59:59.999Z`;

  for (const m of METRICS) {
    // Manual first
    const { data: manual } = await supabase
      .from("biometric_log")
      .select("value")
      .eq("user_id", userId)
      .eq("metric", m)
      .eq("source", "manual")
      .lte("logged_at", dayEnd)
      .order("logged_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (manual) {
      const v = Number((manual as { value: unknown }).value);
      if (Number.isFinite(v)) {
        out[m] = v;
        continue;
      }
    }
    // Fall back to HC
    const { data: hc } = await supabase
      .from("biometric_log")
      .select("value")
      .eq("user_id", userId)
      .eq("metric", m)
      .eq("source", "health_connect")
      .lte("logged_at", dayEnd)
      .order("logged_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (hc) {
      const v = Number((hc as { value: unknown }).value);
      if (Number.isFinite(v)) out[m] = v;
    }
  }
  return out;
}

/** Most recent value for a metric (manual preferred). */
export async function getLatestBiometric(
  userId: string,
  metric: BiometricMetric,
): Promise<number | null> {
  const all = await getBiometricsOnOrBefore(userId, new Date().toISOString().slice(0, 10));
  return all[metric];
}
