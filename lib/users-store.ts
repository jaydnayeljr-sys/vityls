// Server-side account, session and sync-device storage.

import "server-only";
import { supabase, supabaseConfigured } from "./supabase";
import { hashPassword, randomToken, verifyPassword } from "./auth";

export interface AppUser {
  id: string;
  email: string;
  name: string;
}

const SESSION_DAYS = 30;

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Creates an account. Throws if the email is already registered. */
export async function createUser(
  email: string,
  password: string,
  name: string,
): Promise<AppUser> {
  if (!supabaseConfigured) throw new Error("Supabase is not configured.");
  const e = normaliseEmail(email);

  const { data: existing } = await supabase
    .from("app_user")
    .select("id")
    .eq("email", e)
    .maybeSingle();
  if (existing) throw new Error("An account with that email already exists.");

  const { data, error } = await supabase
    .from("app_user")
    .insert({ email: e, password: hashPassword(password), name: name.trim() })
    .select("id, email, name")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Could not create the account.");
  }
  return { id: String(data.id), email: String(data.email), name: String(data.name ?? "") };
}

/** Returns the user if the email/password pair is valid, else null. */
export async function authenticate(
  email: string,
  password: string,
): Promise<AppUser | null> {
  if (!supabaseConfigured) return null;
  const { data } = await supabase
    .from("app_user")
    .select("id, email, name, password")
    .eq("email", normaliseEmail(email))
    .maybeSingle();
  if (!data) return null;
  if (!verifyPassword(password, String(data.password))) return null;
  return { id: String(data.id), email: String(data.email), name: String(data.name ?? "") };
}

/** Creates a login session and returns its token. */
export async function createSession(userId: string): Promise<string> {
  if (!supabaseConfigured) throw new Error("Supabase is not configured.");
  const token = randomToken();
  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { error } = await supabase
    .from("session")
    .insert({ token, user_id: userId, expires_at: expiresAt });
  if (error) throw new Error(error.message);
  return token;
}

/** Resolves a session token to its user, or null if missing/expired. */
export async function getUserBySession(
  token: string | null | undefined,
): Promise<AppUser | null> {
  if (!token || !supabaseConfigured) return null;
  const { data: sess } = await supabase
    .from("session")
    .select("user_id, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!sess) return null;
  if (new Date(String(sess.expires_at)).getTime() < Date.now()) return null;

  const { data: user } = await supabase
    .from("app_user")
    .select("id, email, name")
    .eq("id", sess.user_id)
    .maybeSingle();
  if (!user) return null;
  return { id: String(user.id), email: String(user.email), name: String(user.name ?? "") };
}

/** Deletes a session (logout). */
export async function deleteSession(token: string): Promise<void> {
  if (!supabaseConfigured || !token) return;
  await supabase.from("session").delete().eq("token", token);
}

/** Returns the user's sync-device token, creating one on first use. */
export async function getOrCreateSyncToken(userId: string): Promise<string> {
  if (!supabaseConfigured) throw new Error("Supabase is not configured.");
  const { data } = await supabase
    .from("sync_device")
    .select("token")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) return String(data.token);

  const token = randomToken();
  const { error } = await supabase
    .from("sync_device")
    .insert({ token, user_id: userId });
  if (error) throw new Error(error.message);
  return token;
}

/** Resolves a sync-device token to a user id, or null. */
export async function getUserIdBySyncToken(
  token: string,
): Promise<string | null> {
  if (!token || !supabaseConfigured) return null;
  const { data } = await supabase
    .from("sync_device")
    .select("user_id")
    .eq("token", token)
    .maybeSingle();
  return data ? String(data.user_id) : null;
}
