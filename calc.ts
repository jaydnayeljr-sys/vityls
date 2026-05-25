// Nutrition AI route (desktop layout). The mobile layout lives at /m.

import AppShell from "@/components/AppShell";
import NutritionScreen from "@/components/screens/NutritionScreen";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NutritionPage() {
  const user = await requireUser();
  return (
    <AppShell active="nutrition" userName={user.name}>
      <NutritionScreen userId={user.id} />
    </AppShell>
  );
}
