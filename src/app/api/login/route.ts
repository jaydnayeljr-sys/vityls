// POST /api/login — checks the passphrase and sets the session cookie.

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  let password = "";
  try {
    const body = await req.json();
    password = String(body?.password ?? "");
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "APP_PASSWORD is not set on the server." },
      { status: 500 },
    );
  }
  if (password !== expected) {
    return NextResponse.json(
      { ok: false, error: "Incorrect passphrase." },
      { status: 401 },
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("vitals_session", "ok", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
