// POST /api/auth/login — verify credentials and start a session.

import { NextResponse } from "next/server";
import { authenticate, createSession } from "@/lib/users-store";
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

  const token = await createSession(user.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, cookieOptions);
  return res;
}
