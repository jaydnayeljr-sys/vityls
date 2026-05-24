// GET  /api/nutrition  — today's logged nutrition + the user's targets
// POST /api/nutrition  — log a meal from a free-text description
//
// POST body: { text: string }
// POST reply (logged):        { ok, meal, nutrition }
// POST reply (need details):  { ok, clarification }

import { NextResponse } from "next/server";
import { extractNutrition, anthropicConfigured } from "@/lib/anthropic";
import { getTodayNutrition, logMeal } from "@/lib/nutrition-store";
import { getProfile } from "@/lib/profile-store";
import { deriveTargets } from "@/lib/calc";

export const dynamic = "force-dynamic";
// Web-search-backed extraction can take a while; give the route room on Vercel.
export const maxDuration = 60;

export async function GET() {
  const profile = await getProfile();
  const nutrition = await getTodayNutrition();
  return NextResponse.json({
    targets: deriveTargets(profile),
    nutrition,
  });
}

export async function POST(req: Request) {
  let text = "";
  try {
    const body = await req.json();
    text = String(body?.text ?? "").trim();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  if (!text) {
    return NextResponse.json(
      { ok: false, error: "Tell me what you ate." },
      { status: 400 },
    );
  }
  if (!anthropicConfigured) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "The AI assistant is not configured. Add ANTHROPIC_API_KEY to .env.local and restart.",
      },
      { status: 503 },
    );
  }

  let meal;
  try {
    meal = await extractNutrition(text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "The AI request failed.";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }

  // The model needs more detail — ask, don't store.
  if (meal.clarificationNeeded || meal.items.length === 0) {
    return NextResponse.json({
      ok: true,
      clarification:
        meal.clarificationQuestion ||
        "Could you add a little more detail about that meal?",
    });
  }

  try {
    await logMeal(meal);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not save the meal.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  const nutrition = await getTodayNutrition();
  return NextResponse.json({ ok: true, meal, nutrition });
}
