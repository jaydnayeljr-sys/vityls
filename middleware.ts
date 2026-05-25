// Today dashboard route (desktop layout). The mobile layout lives at /m.

import AppShell from "@/components/AppShell";
import TodayScreen from "@/components/screens/TodayScreen";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await requireUser();
  return (
    <AppShell active="today" userName={user.name}>
      <TodayScreen userId={user.id} />
    </AppShell>
  );
}
