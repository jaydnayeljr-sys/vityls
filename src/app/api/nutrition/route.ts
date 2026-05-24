// GET  /api/nutrition  — today's logged nutrition + the user's targets
// POST /api/nutrition  — log a meal from a free-text description

import { NextResponse } from "next/server";
import { extractNutrition, anthropicConfigured } from "@/lib/anthropic";
import { getTodayNutrition, logMeal } from "@/lib/nutrition-store";
import { getProfile } from "@/lib/profile-store";
import { deriveTargets } from "@/lib/calc";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";
// Web-search-backed extraction can take a while; give the route room on Vercel.
export const maxDuration = 60;

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "Not signed in." },
    { status: 401 },
  );
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const profile = await getProfile(user.id);
  const nutrition = await getTodayNutrition(user.id);
  return NextResponse.json({ targets: deriveTargets(profile), nutrition });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

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
          "The AI assistant is not configured. Add ANTHROPIC_API_KEY and restart.",
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

  if (meal.clarificationNeeded || meal.items.length === 0) {
    return NextResponse.json({
      ok: true,
      clarification:
        meal.clarificationQuestion ||
        "Could you add a little more detail about that meal?",
    });
  }

  try {
    await logMeal(user.id, meal);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not save the meal.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  const nutrition = await getTodayNutrition(user.id);
  return NextResponse.json({ ok: true, meal, nutrition });
}
