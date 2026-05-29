// End-of-day AI review. Generated once per user per day, on the first Today-
// screen load the next morning. Claude looks at yesterday's metrics,
// nutrition and sleep against the user's lifetime averages and writes a short
// summary plus 1-3 wins and 1-3 improvements aimed at lowering bio-age.

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { supabase, supabaseConfigured } from "./supabase";
import { anthropicConfigured } from "./anthropic";
import { deriveTargets } from "./calc";
import { getLifetimeAverages, lastNDates } from "./activity-store";
import type { Profile } from "./types";
import { METRIC_KEYS } from "./activity-types";

const MODEL = "claude-sonnet-4-6";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });

export interface DailyReview {
  date: string;            // YYYY-MM-DD of the day being reviewed
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
  description:
    "Submit a short end-of-day review of the user's health markers.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: {
        type: "string",
        description:
          "Two to three sentences summarising how yesterday went overall.",
      },
      wins: {
        type: "array",
        description:
          "One to three concrete things the user did well yesterday (each one short, 12-22 words).",
        items: { type: "string" },
      },
      improvements: {
        type: "array",
        description:
          "One to three concrete things the user could improve today to lower their biological age. Each one short, 12-22 words.",
        items: { type: "string" },
      },
    },
    required: ["summary", "wins", "improvements"],
  },
};

const SYSTEM_PROMPT = `You are Vityl Coach, an evidence-based health assistant.
You will receive yesterday's data for one user — bio-age delta, daily metrics
against their lifetime averages, sleep stages, and nutrition vs targets.

Write a short end-of-day review:
- Concise summary (2-3 sentences).
- 1-3 wins they should be proud of.
- 1-3 specific, actionable improvements that would lower their biological age
  the most. Cover any of: sleep duration and quality, HRV, resting heart rate,
  activity (steps / active calories), nutrition (calories vs target, protein,
  carbs, fat, fibre, micronutrients).

Be specific to the numbers in the data. Use plain language and approachable
tone — not clinical. Never tell them to consult a doctor unless data clearly
indicates a serious problem. Always call the submit_daily_review tool.`;

function yyyymmdd(d: Date): string {
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function yesterdayDate(): string {
  const dates = lastNDates(2);
  return dates[0]; // oldest of [yesterday, today]
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
    .select(
      "food_item(calories, protein_g, carbs_g, fat_g, fiber_g)",
    )
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
  const dates = lastNDates(2);
  const dayBefore = dates[0] === date ? yyyymmdd(new Date(Date.parse(date + "T00:00:00") - 86400000)) : dates[0];

  // Metrics for the target date.
  const { data: metricRows } = await supabase
    .from("daily_metric")
    .select("metric, value")
    .eq("user_id", userId)
    .eq("metric_date", date);
  const metricsForDay: Record<string, number> = {};
  for (const row of (metricRows ?? []) as Record<string, unknown>[]) {
    const k = String(row.metric);
    metricsForDay[k] = Number(row.value);
  }

  // Sleep for the night.
  const { data: sleepRow } = await supabase
    .from("sleep_session")
    .select("*")
    .eq("user_id", userId)
    .eq("night_date", date)
    .maybeSingle();
  const sleep = sleepRow as Record<string, unknown> | null;

  // Lifetime averages.
  const averages = await getLifetimeAverages(userId);

  // Bio-age snapshots for the date and the one before.
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

  // Nutrition for the day.
  const nut = await nutritionTotalsForDate(userId, date);
  const targets = deriveTargets(profile);

  // Build the metrics map keyed by METRIC_KEYS, with lifetime averages.
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

  // Bail if there is essentially no data for the day.
  const haveMetrics = Object.values(metricsForDay).length > 0;
  const haveSleep = sleep != null;
  const haveNutrition = nut.intakeKcal > 0;
  if (!haveMetrics && !haveSleep && !haveNutrition) return null;

  return {
    date,
    chronologicalAge: profile.age,
    bioAge: {
      yesterday: bioYesterday,
      dayBefore: bioDayBefore,
      delta: bioDelta,
    },
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
        content: `Yesterday's data:\n\n${JSON.stringify(data, null, 2)}\n\nCall submit_daily_review.`,
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

/** Returns yesterday's review for a user, generating + caching it on demand. */
export async function getYesterdayReview(
  userId: string,
  profile: Profile,
): Promise<DailyReview | null> {
  if (!supabaseConfigured) return null;
  const date = yesterdayDate();

  // Cached?
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

  // Cache the result. Fire-and-forget the response shape so a write failure
  // doesn't block the render.
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
