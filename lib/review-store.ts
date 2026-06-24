// End-of-day AI review. Cached one row per user per day. On Today's screen
// the default behavior shows yesterday's review (auto-generated on first
// load). When viewing a past date, the review for THAT date is shown — also
// generated on demand if it hasn't been written yet.

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { supabase, supabaseConfigured } from "./supabase";
import { anthropicConfigured } from "./anthropic";
import { deriveTargets } from "./calc";
import { getLifetimeAverages, lastNDates, nDatesEnding } from "./activity-store";
import type { Profile } from "./types";
import { METRIC_KEYS } from "./activity-types";

const MODEL = "claude-sonnet-4-6";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });

export interface DailyReview {
  date: string;
  summary: string;
  wins: string[];
  improvements: string[];
  bioAgeDelta: number | null;
}

interface ReviewData {
  date: string;
  chronologicalAge: number;
  bioAge: { yesterday: number | null; dayBefore: number | null; delta: number | null };
  metrics: Record<string, { yesterday: number | null; lifetimeAvg: number | null }>;
  sleep: {
    durationMin: number | null;
    deepMin: number | null;
    remMin: number | null;
    lightMin: number | null;
    awakeMin: number | null;
    score: number | null;
    lifetimeAvgMin: number | null;
  };
  nutrition: {
    intakeKcal: number;
    targetKcal: number;
    proteinG: number;
    targetProteinG: number;
    carbsG: number;
    targetCarbsG: number;
    fatG: number;
    targetFatG: number;
    fibreG: number;
  };
}

const REVIEW_TOOL = {
  name: "submit_daily_review",
  description: "Submit a short end-of-day review of the user's health markers.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: {
        type: "string",
        description: "Two to three sentences summarising how the day went.",
      },
      wins: {
        type: "array",
        description: "1-3 concrete things the user did well (12-22 words each).",
        items: { type: "string" },
      },
      improvements: {
        type: "array",
        description: "1-3 concrete things the user could improve to lower their biological age. 12-22 words each.",
        items: { type: "string" },
      },
    },
    required: ["summary", "wins", "improvements"],
  },
};

const SYSTEM_PROMPT = `You are Vityl Coach, an evidence-based health assistant.
You will receive one day's data for one user — bio-age delta, daily metrics
against their lifetime averages, sleep stages, and nutrition vs targets.

Write a short review of that day:
- Concise summary (2-3 sentences).
- 1-3 wins they should be proud of.
- 1-3 specific, actionable improvements that would lower their biological age
  the most. Cover any of: sleep duration and quality, HRV, resting heart rate,
  activity (steps / active calories), nutrition (calories vs target, protein,
  carbs, fat, fibre, micronutrients).

Be specific to the numbers in the data. Use plain language and approachable
tone — not clinical. Never tell them to consult a doctor unless data clearly
indicates a serious problem. Always call the submit_daily_review tool.`;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function yesterdayDate(): string {
  return lastNDates(2)[0];
}

function dayBeforeDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

async function nutritionTotalsForDate(
  userId: string,
  date: string,
): Promise<{
  intakeKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fibreG: number;
}> {
  const out = { intakeKcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fibreG: 0 };
  if (!supabaseConfigured) return out;
  const { data } = await supabase
    .from("food_log")
    .select("food_item(calories, protein_g, carbs_g, fat_g, fiber_g)")
    .eq("user_id", userId)
    .eq("logged_for", date);
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const items = Array.isArray(row.food_item)
      ? (row.food_item as Record<string, unknown>[])
      : [];
    for (const it of items) {
      out.intakeKcal += Number(it.calories ?? 0);
      out.proteinG += Number(it.protein_g ?? 0);
      out.carbsG += Number(it.carbs_g ?? 0);
      out.fatG += Number(it.fat_g ?? 0);
      out.fibreG += Number(it.fiber_g ?? 0);
    }
  }
  out.intakeKcal = Math.round(out.intakeKcal);
  out.proteinG = Math.round(out.proteinG);
  out.carbsG = Math.round(out.carbsG);
  out.fatG = Math.round(out.fatG);
  out.fibreG = Math.round(out.fibreG * 10) / 10;
  return out;
}

async function gatherReviewData(
  userId: string,
  profile: Profile,
  date: string,
): Promise<ReviewData | null> {
  if (!supabaseConfigured) return null;
  const dayBefore = dayBeforeDate(date);

  const { data: metricRows } = await supabase
    .from("daily_metric")
    .select("metric, value")
    .eq("user_id", userId)
    .eq("metric_date", date);
  const metricsForDay: Record<string, number> = {};
  for (const row of (metricRows ?? []) as Record<string, unknown>[]) {
    metricsForDay[String(row.metric)] = Number(row.value);
  }

  const { data: sleepRow } = await supabase
    .from("sleep_session")
    .select("*")
    .eq("user_id", userId)
    .eq("night_date", date)
    .maybeSingle();
  const sleep = sleepRow as Record<string, unknown> | null;

  const averages = await getLifetimeAverages(userId);

  const { data: snapRows } = await supabase
    .from("bio_age_snapshot")
    .select("snapshot_date, bio_age")
    .eq("user_id", userId)
    .in("snapshot_date", [date, dayBefore]);
  let bioYesterday: number | null = null;
  let bioDayBefore: number | null = null;
  for (const row of (snapRows ?? []) as Record<string, unknown>[]) {
    const d = String(row.snapshot_date);
    const v = Number(row.bio_age);
    if (d === date) bioYesterday = v;
    else if (d === dayBefore) bioDayBefore = v;
  }
  const bioDelta =
    bioYesterday != null && bioDayBefore != null
      ? Number((bioYesterday - bioDayBefore).toFixed(2))
      : null;

  const nut = await nutritionTotalsForDate(userId, date);
  const targets = deriveTargets(profile);

  const metrics: Record<
    string,
    { yesterday: number | null; lifetimeAvg: number | null }
  > = {};
  for (const k of METRIC_KEYS) {
    metrics[k] = {
      yesterday: metricsForDay[k] != null ? Math.round(metricsForDay[k]) : null,
      lifetimeAvg: averages[k] ?? null,
    };
  }

  const haveMetrics = Object.values(metricsForDay).length > 0;
  const haveSleep = sleep != null;
  const haveNutrition = nut.intakeKcal > 0;
  if (!haveMetrics && !haveSleep && !haveNutrition) return null;

  return {
    date,
    chronologicalAge: profile.age,
    bioAge: { yesterday: bioYesterday, dayBefore: bioDayBefore, delta: bioDelta },
    metrics,
    sleep: {
      durationMin: sleep ? Number(sleep.total_min ?? 0) || null : null,
      deepMin: sleep ? Number(sleep.deep_min ?? 0) || null : null,
      remMin: sleep ? Number(sleep.rem_min ?? 0) || null : null,
      lightMin: sleep ? Number(sleep.light_min ?? 0) || null : null,
      awakeMin: sleep ? Number(sleep.awake_min ?? 0) || null : null,
      score: sleep ? Number(sleep.score ?? 0) || null : null,
      lifetimeAvgMin: averages.sleep_min,
    },
    nutrition: {
      intakeKcal: nut.intakeKcal,
      targetKcal: targets.targetKcal,
      proteinG: nut.proteinG,
      targetProteinG: targets.proteinG,
      carbsG: nut.carbsG,
      targetCarbsG: targets.carbsG,
      fatG: nut.fatG,
      targetFatG: targets.fatG,
      fibreG: nut.fibreG,
    },
  };
}

async function callClaudeForReview(data: ReviewData): Promise<{
  summary: string;
  wins: string[];
  improvements: string[];
}> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [REVIEW_TOOL],
    tool_choice: { type: "tool", name: "submit_daily_review" },
    messages: [
      {
        role: "user",
        content: `Data for ${data.date}:\n\n${JSON.stringify(data, null, 2)}\n\nCall submit_daily_review.`,
      },
    ],
  });

  for (const block of response.content) {
    if (block.type === "tool_use" && block.name === "submit_daily_review") {
      const input = block.input as {
        summary?: string;
        wins?: unknown;
        improvements?: unknown;
      };
      const summary = String(input.summary ?? "").trim();
      const wins = Array.isArray(input.wins)
        ? input.wins.map((w) => String(w)).filter(Boolean).slice(0, 5)
        : [];
      const improvements = Array.isArray(input.improvements)
        ? input.improvements.map((w) => String(w)).filter(Boolean).slice(0, 5)
        : [];
      if (summary && (wins.length > 0 || improvements.length > 0)) {
        return { summary, wins, improvements };
      }
    }
  }
  throw new Error("Claude did not return a structured review.");
}

/** Returns the review for `date` for the user, generating + caching if needed. */
export async function getReviewForDate(
  userId: string,
  profile: Profile,
  date: string,
): Promise<DailyReview | null> {
  if (!supabaseConfigured) return null;

  const { data: cached } = await supabase
    .from("daily_review")
    .select("review_date, summary, wins, improvements, bio_age_delta")
    .eq("user_id", userId)
    .eq("review_date", date)
    .maybeSingle();
  if (cached) {
    const row = cached as Record<string, unknown>;
    return {
      date: String(row.review_date),
      summary: String(row.summary),
      wins: Array.isArray(row.wins) ? (row.wins as string[]) : [],
      improvements: Array.isArray(row.improvements)
        ? (row.improvements as string[])
        : [],
      bioAgeDelta:
        row.bio_age_delta == null ? null : Number(row.bio_age_delta),
    };
  }

  if (!anthropicConfigured) return null;

  const data = await gatherReviewData(userId, profile, date);
  if (!data) return null;

  let result: { summary: string; wins: string[]; improvements: string[] };
  try {
    result = await callClaudeForReview(data);
  } catch {
    return null;
  }

  await supabase.from("daily_review").upsert(
    {
      user_id: userId,
      review_date: date,
      summary: result.summary,
      wins: result.wins,
      improvements: result.improvements,
      bio_age_delta: data.bioAge.delta,
    },
    { onConflict: "user_id,review_date" },
  );

  return {
    date,
    summary: result.summary,
    wins: result.wins,
    improvements: result.improvements,
    bioAgeDelta: data.bioAge.delta,
  };
}

/** Convenience for the default Today view — review of yesterday. */
export async function getYesterdayReview(
  userId: string,
  profile: Profile,
): Promise<DailyReview | null> {
  return getReviewForDate(userId, profile, yesterdayDate());
}

// Silence unused import warning — kept for re-export consistency.
export type _NDates = typeof nDatesEnding;
