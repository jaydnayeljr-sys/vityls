// Auth gate. Routes are private unless the request carries a session cookie;
// signed-out visitors are sent to the landing/login page. The /api/sync and
// /api/auth/app-* endpoints are public — they authenticate with their own
// tokens. Signed-in visitors on a phone are routed to the mobile view (/m).

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/app-login",
  "/api/auth/app-signup",
  "/api/sync",
];

// The desktop app routes that have a mobile-carousel equivalent at /m.
const APP_ROUTES = ["/today", "/activity", "/nutrition", "/profile"];

function isMobileUA(ua: string): boolean {
  return /Android|iPhone|iPod|Mobile/i.test(ua);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  const hasSession = Boolean(req.cookies.get("vityl_session")?.value);

  if (!hasSession && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Send phone visitors to the swipeable mobile view, and bounce desktop
  // visitors off it back to the standard layout.
  if (hasSession) {
    const mobile = isMobileUA(req.headers.get("user-agent") ?? "");
    if (mobile && APP_ROUTES.includes(pathname)) {
      const url = req.nextUrl.clone();
      url.pathname = "/m";
      return NextResponse.redirect(url);
    }
    if (!mobile && pathname === "/m") {
      const url = req.nextUrl.clone();
      url.pathname = "/today";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
