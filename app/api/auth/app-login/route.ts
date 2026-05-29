// POST /api/auth/app-login — native sign-in for the Vityl Android app.
// Returns the login session token (the app injects it into its WebView cookie
// store) and the device sync token (used by background Health Connect sync).
// No cookie is set here — the native app manages its own WebView session.

import { NextResponse } from "next/server";
import {
  authenticate,
  createSession,
  getOrCreateSyncToken,
} from "@/lib/users-store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let email = "";
  let password = "";
  try {
    const body = await req.json();
    email = String(body?.email ?? "").trim();
    password = String(body?.password ?? "");
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: "Enter your email and password." },
      { status: 400 },
    );
  }

  const user = await authenticate(email, password);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Incorrect email or password." },
      { status: 401 },
    );
  }

  try {
    const sessionToken = await createSession(user.id);
    const syncToken = await getOrCreateSyncToken(user.id);
    return NextResponse.json({
      ok: true,
      sessionToken,
      syncToken,
      name: user.name,
      userId: user.id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sign-in failed.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
