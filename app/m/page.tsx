// Mobile route — the swipeable, bottom-tab-bar layout. The Vityl Android app
// loads this in a WebView; phone browsers are routed here by the middleware.
// All four screens are rendered on the server and handed to the client
// carousel.

import MobileShell from "@/components/MobileShell";
import TodayScreen from "@/components/screens/TodayScreen";
import ActivityScreen from "@/components/screens/ActivityScreen";
import NutritionScreen from "@/components/screens/NutritionScreen";
import ProfileScreen from "@/components/screens/ProfileScreen";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function MobilePage() {
  const user = await requireUser();
  return (
    <MobileShell
      screens={[
        {
          key: "today",
          label: "Today",
          node: <TodayScreen userId={user.id} />,
        },
        {
          key: "activity",
          label: "Activity",
          node: <ActivityScreen userId={user.id} />,
        },
        {
          key: "nutrition",
          label: "Nutrition",
          node: <NutritionScreen userId={user.id} />,
        },
        {
          key: "profile",
          label: "Profile",
          node: <ProfileScreen userId={user.id} />,
        },
      ]}
    />
  );
}
