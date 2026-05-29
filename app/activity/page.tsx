// Activity route (desktop layout). The mobile layout lives at /m.

import AppShell from "@/components/AppShell";
import ActivityScreen from "@/components/screens/ActivityScreen";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const user = await requireUser();
  return (
    <AppShell active="activity" userName={user.name}>
      <ActivityScreen userId={user.id} />
    </AppShell>
  );
}
