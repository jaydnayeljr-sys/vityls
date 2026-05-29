// Profile screen body (server component). Rendered inside the desktop
// AppShell and the mobile carousel. The sync card now exposes a Manual Sync
// button instead of a raw token — the Vityl app handles signing in.

import ProfileForm from "@/app/profile/ProfileForm";
import SyncButton from "@/app/profile/SyncButton";
import BiometricTrends from "@/components/BiometricTrends";
import { getProfile } from "@/lib/profile-store";
import { getBiometricHistory } from "@/lib/biometric-store";
import { supabaseConfigured } from "@/lib/supabase";

export default async function ProfileScreen({ userId }: { userId: string }) {
  const profile = await getProfile(userId);
  const biometricHistory = await getBiometricHistory(userId);

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

      <BiometricTrends
        history={biometricHistory}
        current={{
          weightKg: profile.weightKg,
          bodyFatPct: profile.bodyFatPct,
          vo2max: profile.vo2max,
        }}
      />

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-h">
          <div className="t">Activity Sync</div>
          <div className="x">
            Health Connect data flows in every 3 hours and each time you open
            the Vityl app
          </div>
        </div>
        <SyncButton />
      </div>
    </>
  );
}
