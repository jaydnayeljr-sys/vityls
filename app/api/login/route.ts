// Deprecated. The single-passphrase gate was replaced by accounts in Phase 5;
// sign-in now lives at /api/auth/login.

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { ok: false, error: "Use /api/auth/login." },
    { status: 410 },
  );
}
