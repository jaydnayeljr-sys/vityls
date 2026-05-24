// Profile screen (server component). Reads the profile, then hands it to the
// client form. The form recomputes targets live and saves via /api/profile.

import AppShell from "@/components/AppShell";
import ProfileForm from "./ProfileForm";
import { getProfile } from "@/lib/profile-store";
import { supabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const profile = await getProfile();

  return (
    <AppShell active="profile" userName={profile.name}>
      <div className="topbar">
        <h1>Your Profile</h1>
        <p>
          Your biometrics drive every calorie, macro and bio-age estimate in
          the app.
        </p>
      </div>

      {!supabaseConfigured && (
        <div className="banner warn">
          Supabase is not configured yet, so changes will not be saved. Add
          <b> SUPABASE_URL</b> and <b> SUPABASE_SERVICE_ROLE_KEY</b> to
          <b> .env.local</b> and run the schema — see the README. You can still
          explore the live calculations below.
        </div>
      )}

      <ProfileForm initial={profile} canSave={supabaseConfigured} />
    </AppShell>
  );
}
