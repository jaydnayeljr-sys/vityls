// Single-user password gate. Any route except the login page and the login
// API is redirected to /login unless a valid session cookie is present.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// /api/sync is reached by the Android bridge, which has no session cookie —
// it authenticates itself with the SYNC_TOKEN instead, so it is public here.
const PUBLIC_PATHS = ["/login", "/api/login", "/api/sync"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const authed = req.cookies.get("vitals_session")?.value === "ok";

  if (!authed && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (authed && pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/profile";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
