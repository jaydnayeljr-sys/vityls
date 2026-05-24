// POST /api/sync — ingest endpoint for the Vitals Android Health Connect
// bridge. Authenticated with a shared SYNC_TOKEN (not the password cookie),
// so it is exempt from the middleware password gate.
//
// Body: {
//   metrics?: [{ date: "YYYY-MM-DD", metric: "steps"|..., value: number }],
//   sleep?:   [{ night: "YYYY-MM-DD", totalMin, deepMin, remMin,
//                lightMin, awakeMin, score, startAt?, endAt? }]
// }
// Reply: { ok, metricsWritten, sleepWritten }  or  { ok: false, error }

import { NextResponse } from "next/server";
import {
  upsertMetrics,
  upsertSleep,
  type MetricInput,
  type SleepInput,
} from "@/lib/activity-store";
import { METRIC_KEYS, type MetricKey } from "@/lib/activity-types";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

export async function POST(req: Request) {
  const token = process.env.SYNC_TOKEN;
  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        error: "Sync is not configured — set SYNC_TOKEN on the server.",
      },
      { status: 503 },
    );
  }

  // Accept the token as a Bearer header or an x-sync-token header.
  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : (req.headers.get("x-sync-token") ?? "").trim();
  if (provided !== token) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
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
    return NextResponse.json(
      { ok: false, error: "Bad request" },
      { status: 400 },
    );
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

  if (metrics.length === 0 && sleep.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No valid metrics or sleep records in the payload." },
      { status: 400 },
    );
  }

  try {
    const metricsWritten = await upsertMetrics(metrics);
    const sleepWritten = await upsertSleep(sleep);
    return NextResponse.json({ ok: true, metricsWritten, sleepWritten });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not save the data.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
