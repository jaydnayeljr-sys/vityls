// Server-side read/write for per-user biometric history (weight, body-fat %,
// VO2max). The Profile screen draws sparkline trends from this table; past-
// day editing on Today writes log rows back at the chosen date.

import "server-only";
import { supabase, supabaseConfigured } from "./supabase";

export type BiometricMetric = "weight" | "body_fat" | "vo2max";

export interface BiometricPoint {
  date: string; // ISO timestamp
  value: number;
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

/** Appends a single biometric reading at "now". */
export async function logBiometric(
  userId: string,
  metric: BiometricMetric,
  value: number,
): Promise<void> {
  if (!supabaseConfigured) return;
  if (!Number.isFinite(value) || value <= 0) return;
  await supabase
    .from("biometric_log")
    .insert({ user_id: userId, metric, value });
}

/** Logs (or re-logs) a biometric for a specific past calendar date. Any
 *  existing log on that exact date for the same metric is replaced so each
 *  day holds at most one point per metric. */
export async function logBiometricForDate(
  userId: string,
  metric: BiometricMetric,
  value: number,
  date: string,
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
    .gte("logged_at", dayStart)
    .lte("logged_at", dayEnd);

  await supabase.from("biometric_log").insert({
    user_id: userId,
    metric,
    value,
    logged_at: `${date}T12:00:00.000Z`,
  });
}

/** Returns the user's full biometric history, grouped by metric, oldest first. */
export async function getBiometricHistory(
  userId: string,
): Promise<BiometricHistory> {
  const out = emptyHistory();
  if (!supabaseConfigured) return out;

  const { data } = await supabase
    .from("biometric_log")
    .select("metric, value, logged_at")
    .eq("user_id", userId)
    .in("metric", METRICS as readonly string[])
    .order("logged_at", { ascending: true });

  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const metric = String(row.metric) as BiometricMetric;
    if (!METRICS.includes(metric)) continue;
    out[metric].push({
      date: String(row.logged_at),
      value: Number(row.value),
    });
  }
  return out;
}

/** Returns the value logged on (or most recently before) `date` for each
 *  biometric. Useful as the initial value when editing a past day. */
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
    const { data } = await supabase
      .from("biometric_log")
      .select("value")
      .eq("user_id", userId)
      .eq("metric", m)
      .lte("logged_at", dayEnd)
      .order("logged_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      const v = Number((data as { value: unknown }).value);
      if (Number.isFinite(v)) out[m] = v;
    }
  }
  return out;
}

/** Returns the most recent value the user logged for a given metric, or null. */
export async function getLatestBiometric(
  userId: string,
  metric: BiometricMetric,
): Promise<number | null> {
  if (!supabaseConfigured) return null;
  const { data } = await supabase
    .from("biometric_log")
    .select("value")
    .eq("user_id", userId)
    .eq("metric", metric)
    .order("logged_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const v = Number((data as { value: unknown }).value);
  return Number.isFinite(v) ? v : null;
}
