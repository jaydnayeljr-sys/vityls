// Server-side read/write for per-user biometric history (weight, body-fat %,
// VO2max). The Profile screen draws sparkline trends from this table; the
// current value still lives on the profile row for fast reads.

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

/** Appends a single biometric reading. Silently no-ops if Supabase is off. */
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
