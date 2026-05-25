// POST /api/auth/signup — create an account and start a session.

import { NextResponse } from "next/server";
import { createSession, createUser } from "@/lib/users-store";
import { SESSION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");
  const name = String(body.name ?? "").trim();

  if (!email.includes("@") || email.length < 5) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid email address." },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { ok: false, error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }
  if (!name) {
    return NextResponse.json(
      { ok: false, error: "Enter your name." },
      { status: 400 },
    );
  }

  let token: string;
  try {
    const user = await createUser(email, password, name);
    token = await createSession(user.id);
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Could not create the account.";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, cookieOptions);
  return res;
}
