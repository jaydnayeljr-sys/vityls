// GET /api/auth/logout — end the session and return to the landing page.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteSession } from "@/lib/users-store";
import { SESSION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(token);

  const res = NextResponse.redirect(new URL("/login", req.url));
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
