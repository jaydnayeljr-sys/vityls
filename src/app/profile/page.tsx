// Profile route (desktop layout). The mobile layout lives at /m.

import AppShell from "@/components/AppShell";
import ProfileScreen from "@/components/screens/ProfileScreen";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();
  return (
    <AppShell active="profile" userName={user.name}>
      <ProfileScreen userId={user.id} />
    </AppShell>
  );
}
