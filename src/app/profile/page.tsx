// Profile screen (server component). Includes the activity-sync token the
// Vityl Android app needs.

import AppShell from "@/components/AppShell";
import ProfileForm from "./ProfileForm";
import { requireUser } from "@/lib/session";
import { getProfile } from "@/lib/profile-store";
import { getOrCreateSyncToken } from "@/lib/users-store";
import { supabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);

  let syncToken = "";
  if (supabaseConfigured) {
    try {
      syncToken = await getOrCreateSyncToken(user.id);
    } catch {
      syncToken = "";
    }
  }

  return (
    <AppShell active="profile" userName={user.name}>
      <div className="topbar">
        <h1>Your Profile</h1>
        <p>
          Your biometrics drive every calorie, macro and bio-age estimate in
          the app.
        </p>
      </div>

      {!supabaseConfigured && (
        <div className="banner warn">
          Supabase is not configured yet, so changes will not be saved. See the
          README. You can still explore the live calculations below.
        </div>
      )}

      <ProfileForm initial={profile} canSave={supabaseConfigured} />

      {syncToken && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-h">
            <div className="t">Activity Sync</div>
            <div className="x">
              Connect the Vityl Android app to sync Health Connect data
            </div>
          </div>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
            Open the Vityl Bridge app on your phone, paste this token into its
            Sync Token field, and your steps, heart rate, HRV and sleep flow in
            automatically. Keep it private — it grants write access to your
            account&apos;s activity data.
          </p>
          <code className="sync-token">{syncToken}</code>
        </div>
      )}
    </AppShell>
  );
}
