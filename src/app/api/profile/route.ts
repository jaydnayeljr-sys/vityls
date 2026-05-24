// GET  /api/profile  — current profile + derived targets
// POST /api/profile  — save the profile, return freshly derived targets

import { NextResponse } from "next/server";
import { getProfile, saveProfile } from "@/lib/profile-store";
import { deriveTargets } from "@/lib/calc";
import { DEFAULT_PROFILE, type Profile } from "@/lib/types";

export async function GET() {
  const profile = await getProfile();
  return NextResponse.json({ profile, targets: deriveTargets(profile) });
}

// Coerces an untrusted request body into a valid Profile.
function sanitize(body: Record<string, unknown>): Profile {
  const num = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const sex = body.sex === "female" ? "female" : "male";
  const goal =
    body.energyGoal === "maintenance" || body.energyGoal === "surplus"
      ? body.energyGoal
      : "deficit";
  const validActivity = [
    "sedentary",
    "light",
    "moderate",
    "active",
    "very_active",
  ];
  const activity = validActivity.includes(String(body.activityLevel))
    ? (body.activityLevel as Profile["activityLevel"])
    : "moderate";
  const bf = num(body.bodyFatPct, NaN);
  const override = num(body.bmrOverride, NaN);

  return {
    id: "me",
    name: String(body.name ?? DEFAULT_PROFILE.name).slice(0, 80),
    age: Math.max(10, Math.min(110, Math.round(num(body.age, DEFAULT_PROFILE.age)))),
    sex,
    heightCm: Math.max(80, Math.min(250, num(body.heightCm, DEFAULT_PROFILE.heightCm))),
    weightKg: Math.max(25, Math.min(350, num(body.weightKg, DEFAULT_PROFILE.weightKg))),
    bodyFatPct: Number.isFinite(bf) && bf > 0 ? Math.min(70, bf) : null,
    activityLevel: activity,
    bmrOverride: Number.isFinite(override) && override > 0 ? Math.round(override) : null,
    energyGoal: goal as Profile["energyGoal"],
    energyAdjust: Math.max(0, Math.min(1200, Math.round(num(body.energyAdjust, 400)))),
  };
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const profile = sanitize(body);
  try {
    await saveProfile(profile);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Save failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
  return NextResponse.json({ ok: true, profile, targets: deriveTargets(profile) });
}
