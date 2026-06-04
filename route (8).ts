// POST /api/auth/app-signup — native account creation for the Vityl Android
// app. Creates the account, then returns the same token pair as app-login so
// the new user is signed straight in.

import { NextResponse } from "next/server";
import {
  createUser,
  createSession,
  getOrCreateSyncToken,
} from "@/lib/users-store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let email = "";
  let password = "";
  let name = "";
  try {
    const body = await req.json();
    email = String(body?.email ?? "").trim();
    password = String(body?.password ?? "");
    name = String(body?.name ?? "").trim();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: "Enter your email and password." },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { ok: false, error: "Use a password of at least 8 characters." },
      { status: 400 },
    );
  }

  let user;
  try {
    user = await createUser(email, password, name);
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Could not create the account.";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
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
    const msg =
      err instanceof Error
        ? err.message
        : "Account created, but sign-in failed.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
