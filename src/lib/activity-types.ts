// Shared activity types and constants.
// No "server-only" guard, so server modules and client components can both
// import these safely.

/** The per-day metrics synced from Health Connect via the Android bridge. */
export type MetricKey = "steps" | "active_kcal" | "total_kcal" | "rhr" | "hrv";

export const METRIC_KEYS: MetricKey[] = [
  "steps",
  "active_kcal",
  "total_kcal",
  "rhr",
  "hrv",
];

/** One calendar day's metric values. null = not synced for that day. */
export interface DayMetrics {
  date: string;
  steps: number | null;
  active_kcal: number | null;
  total_kcal: number | null;
  rhr: number | null;
  hrv: number | null;
}

/** One night of sleep with per-stage durations in minutes. */
export interface SleepNight {
  night: string;
  totalMin: number | null;
  deepMin: number | null;
  remMin: number | null;
  lightMin: number | null;
  awakeMin: number | null;
  score: number | null;
}

/** A single day on the intake-vs-burn chart. */
export interface DayBalance {
  date: string;
  intakeKcal: number; // calories logged through the nutrition assistant
  burnKcal: number | null; // total energy out — synced, or BMR + active kcal
}

/** Per-metric averages across every day the user has ever synced. */
export interface LifetimeAverages {
  steps: number | null;
  active_kcal: number | null;
  total_kcal: number | null;
  rhr: number | null;
  hrv: number | null;
  sleep_min: number | null;
}

/** Everything the Activity screen needs for the last N days. */
export interface ActivitySummary {
  days: DayMetrics[]; // oldest first
  today: DayMetrics;
  lastNight: SleepNight | null;
  balance: DayBalance[];
  averages: LifetimeAverages;
  hasAnyData: boolean; // true once any metric or sleep row exists
}
