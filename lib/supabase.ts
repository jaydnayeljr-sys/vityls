// Server-only Supabase client.
//
// Uses the service-role key, so this module must never be imported into a
// client component. It is used only by server components and API routes.

import "server-only";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** True once the Supabase environment variables have been configured. */
export const supabaseConfigured = Boolean(url && key);

if (!supabaseConfigured) {
  console.warn(
    "[vitals] Supabase not configured — set SUPABASE_URL and " +
      "SUPABASE_SERVICE_ROLE_KEY in .env.local. The app will run with " +
      "default data until then.",
  );
}

export const supabase = createClient(url ?? "http://localhost", key ?? "anon", {
  auth: { persistSession: false, autoRefreshToken: false },
});
