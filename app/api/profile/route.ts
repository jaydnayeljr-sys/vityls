// GET  /api/profile  — the signed-in user's profile + derived targets
// POST /api/profile  — save the profile, return freshly derived targets.
//                      Also appends a biometric_log row for any weight /
//                      body-fat / VO2max value that changed.

import { NextResponse } from "next/server";
import { getProfile, saveProfile } from "@/lib/profile-store";
import { deriveTargets } from "@/lib/calc";
import { DEFAULT_PROFILE, type Profile } from "@/lib/types";
import { getCurrentUser } from "@/lib/session";
import { logBiometric } from "@/lib/biometric-store";

export const dynamic = "force-dynamic";

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
  return NextResponse.json({ profile, targets: deriveTargets(profile) });
}

function sanitize(body: Record<string, unknown>, userId: string): Profile {
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
  const vo2 = num(body.vo2max, NaN);
  const override = num(body.bmrOverride, NaN);

  const optTarget = (raw: unknown, min: number, max: number) => {
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.min(max, Math.max(min, Math.round(n)));
  };

  return {
    id: userId,
    name: String(body.name ?? "").slice(0, 80),
    age: Math.max(10, Math.min(110, Math.round(num(body.age, DEFAULT_PROFILE.age)))),
    sex,
    heightCm: Math.max(80, Math.min(250, num(body.heightCm, DEFAULT_PROFILE.heightCm))),
    weightKg: Math.max(25, Math.min(350, num(body.weightKg, DEFAULT_PROFILE.weightKg))),
    bodyFatPct: Number.isFinite(bf) && bf > 0 ? Math.min(70, bf) : null,
    vo2max: Number.isFinite(vo2) && vo2 > 0 ? Math.min(90, vo2) : null,
    activityLevel: activity,
    bmrOverride: Number.isFinite(override) && override > 0 ? Math.round(override) : null,
    energyGoal: goal as Profile["energyGoal"],
    energyAdjust: Math.max(0, Math.min(1200, Math.round(num(body.energyAdjust, 400)))),
    customKcal: optTarget(body.customKcal, 800, 6000),
    customProteinG: optTarget(body.customProteinG, 20, 500),
    customCarbsG: optTarget(body.customCarbsG, 0, 800),
    customFatG: optTarget(body.customFatG, 20, 300),
  };
}

/** True if `next` represents a change worth recording in biometric_log. */
function changed(prev: number | null, next: number | null): boolean {
  if (next == null) return false;            // user cleared the field
  if (prev == null) return true;             // first time setting it
  return Math.abs(next - prev) > 0.001;      // ignore float jitter
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  // Snapshot the previous biometrics so we know what to log.
  const previous = await getProfile(user.id);
  const profile = sanitize(body, user.id);

  try {
    await saveProfile(user.id, profile);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Save failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  // Record any biometric changes — fire-and-forget so save latency stays low.
  if (changed(previous.weightKg, profile.weightKg)) {
    void logBiometric(user.id, "weight", profile.weightKg);
  }
  if (changed(previous.bodyFatPct, profile.bodyFatPct)) {
    void logBiometric(user.id, "body_fat", profile.bodyFatPct!);
  }
  if (changed(previous.vo2max, profile.vo2max)) {
    void logBiometric(user.id, "vo2max", profile.vo2max!);
  }

  return NextResponse.json({ ok: true, profile, targets: deriveTargets(profile) });
}
