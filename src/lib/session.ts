// Resolves the logged-in user for server components and route handlers.

import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserBySession, type AppUser } from "./users-store";

export const SESSION_COOKIE = "vityl_session";

/** The current user, or null if not signed in. */
export async function getCurrentUser(): Promise<AppUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return getUserBySession(token ?? null);
}

/** The current user, or a redirect to the login page. */
export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
