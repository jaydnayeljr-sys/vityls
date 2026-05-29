// POST /api/sync — ingest endpoint for the Vityl Android Health Connect
// bridge. Authenticated by a per-user device token (no session cookie), so it
// is exempt from the password gate.
//
// Body: { metrics?: [...], sleep?: [...], biometrics?: [...] }
// Reply: { ok, metricsWritten, sleepWritten, biometricsWritten }

import { NextResponse } from "next/server";
import {
  upsertMetrics,
  upsertSleep,
  type MetricInput,
  type SleepInput,
} from "@/lib/activity-store";
import { METRIC_KEYS, type MetricKey } from "@/lib/activity-types";
import {
  logBiometricForDate,
  type BiometricMetric,
} from "@/lib/biometric-store";
import { getUserIdBySyncToken } from "@/lib/users-store";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BIOMETRIC_KEYS: BiometricMetric[] = ["weight", "body_fat", "vo2max"];

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : (req.headers.get("x-sync-token") ?? "").trim();

  const userId = await getUserIdBySyncToken(token);
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "Unrecognised sync token." },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    body =
      parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : {};
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const metrics: MetricInput[] = [];
  if (Array.isArray(body.metrics)) {
    for (const raw of body.metrics) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      const date = String(r.date ?? "");
      const metric = String(r.metric ?? "") as MetricKey;
      const value = Number(r.value);
      if (
        DATE_RE.test(date) &&
        METRIC_KEYS.includes(metric) &&
        Number.isFinite(value) &&
        value >= 0
      ) {
        metrics.push({ date, metric, value });
      }
    }
  }

  const sleep: SleepInput[] = [];
  if (Array.isArray(body.sleep)) {
    for (const raw of body.sleep) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      const night = String(r.night ?? "");
      if (!DATE_RE.test(night)) continue;
      sleep.push({
        night,
        startAt: r.startAt != null ? String(r.startAt) : null,
        endAt: r.endAt != null ? String(r.endAt) : null,
        totalMin: numOrNull(r.totalMin),
        deepMin: numOrNull(r.deepMin),
        remMin: numOrNull(r.remMin),
        lightMin: numOrNull(r.lightMin),
        awakeMin: numOrNull(r.awakeMin),
        score: numOrNull(r.score),
      });
    }
  }

  const biometrics: { date: string; metric: BiometricMetric; value: number }[] = [];
  if (Array.isArray(body.biometrics)) {
    for (const raw of body.biometrics) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      const date = String(r.date ?? "");
      const metric = String(r.metric ?? "") as BiometricMetric;
      const value = Number(r.value);
      if (
        DATE_RE.test(date) &&
        BIOMETRIC_KEYS.includes(metric) &&
        Number.isFinite(value) &&
        value > 0
      ) {
        biometrics.push({ date, metric, value });
      }
    }
  }

  if (metrics.length === 0 && sleep.length === 0 && biometrics.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No valid metrics, sleep, or biometrics in the payload." },
      { status: 400 },
    );
  }

  try {
    const metricsWritten = await upsertMetrics(userId, metrics);
    const sleepWritten = await upsertSleep(userId, sleep);
    let biometricsWritten = 0;
    for (const b of biometrics) {
      await logBiometricForDate(userId, b.metric, b.value, b.date, "health_connect");
      biometricsWritten++;
    }
    return NextResponse.json({
      ok: true,
      metricsWritten,
      sleepWritten,
      biometricsWritten,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not save the data.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
