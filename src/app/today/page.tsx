// Today dashboard route (desktop layout). Accepts ?date=YYYY-MM-DD to view
// any past day; without it, defaults to today. The mobile layout lives at /m.

import AppShell from "@/components/AppShell";
import TodayScreen from "@/components/screens/TodayScreen";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function TodayPage({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string }>;
}) {
  const user = await requireUser();
  const params = (await searchParams) ?? {};
  const rawDate = typeof params.date === "string" ? params.date : undefined;
  const viewDate = rawDate && DATE_RE.test(rawDate) ? rawDate : undefined;

  return (
    <AppShell active="today" userName={user.name}>
      <TodayScreen userId={user.id} viewDate={viewDate} />
    </AppShell>
  );
}
