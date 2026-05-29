// POST /api/biometrics/log — log a single biometric value for the signed-in
// user on a specific calendar date. Used by the past-day editor on Today.
// Body: { metric: "weight" | "body_fat" | "vo2max", value: number, date: "YYYY-MM-DD" }

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import {
  logBiometricForDate,
  type BiometricMetric,
} from "@/lib/biometric-store";

export const dynamic = "force-dynamic";

const VALID_METRICS: BiometricMetric[] = ["weight", "body_fat", "vo2max"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const BOUNDS: Record<BiometricMetric, { min: number; max: number }> = {
  weight: { min: 25, max: 350 },
  body_fat: { min: 1, max: 70 },
  vo2max: { min: 10, max: 90 },
};

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Not signed in." },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const metric = String(body.metric ?? "") as BiometricMetric;
  const value = Number(body.value);
  const date = String(body.date ?? "");

  if (!VALID_METRICS.includes(metric)) {
    return NextResponse.json({ ok: false, error: "Bad metric." }, { status: 400 });
  }
  if (!Number.isFinite(value) || value <= 0) {
    return NextResponse.json({ ok: false, error: "Enter a value." }, { status: 400 });
  }
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ ok: false, error: "Bad date." }, { status: 400 });
  }

  const { min, max } = BOUNDS[metric];
  const clamped = Math.min(max, Math.max(min, value));

  try {
    await logBiometricForDate(user.id, metric, clamped, date);
    return NextResponse.json({ ok: true, value: clamped });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Save failed.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
