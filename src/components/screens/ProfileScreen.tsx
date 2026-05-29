// Profile screen body (server component). Rendered inside the desktop
// AppShell and the mobile carousel. Sync is now triggered by pull-to-refresh
// on the Vityl Android app — no manual button needed.

import ProfileForm from "@/app/profile/ProfileForm";
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
    </>
  );
}
