// Profile screen body (server component). Includes the activity-sync token
// the Vityl Android app uses. Rendered inside the desktop AppShell and the
// mobile carousel.

import ProfileForm from "@/app/profile/ProfileForm";
import { getProfile } from "@/lib/profile-store";
import { getOrCreateSyncToken } from "@/lib/users-store";
import { supabaseConfigured } from "@/lib/supabase";

export default async function ProfileScreen({ userId }: { userId: string }) {
  const profile = await getProfile(userId);

  let syncToken = "";
  if (supabaseConfigured) {
    try {
      syncToken = await getOrCreateSyncToken(userId);
    } catch {
      syncToken = "";
    }
  }

  return (
    <>
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
            The Vityl app signs in with your account and syncs automatically —
            no setup needed. This token is only for the older Vityl Bridge app:
            paste it into its Sync Token field if you are still using it. Keep
            it private — it grants write access to your activity data.
          </p>
          <code className="sync-token">{syncToken}</code>
        </div>
      )}
    </>
  );
}
