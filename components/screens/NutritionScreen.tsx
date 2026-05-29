// Nutrition AI screen body (server component). Rendered inside the desktop
// AppShell and the mobile carousel.

import NutritionChat from "@/app/nutrition/NutritionChat";
import { getProfile } from "@/lib/profile-store";
import { getTodayNutrition } from "@/lib/nutrition-store";
import { deriveTargets } from "@/lib/calc";
import { anthropicConfigured } from "@/lib/anthropic";
import { supabaseConfigured } from "@/lib/supabase";

export default async function NutritionScreen({
  userId,
}: {
  userId: string;
}) {
  const profile = await getProfile(userId);
  const targets = deriveTargets(profile);
  const nutrition = await getTodayNutrition(userId);

  return (
    <>
      <div className="topbar">
        <h1>Nutrition AI</h1>
        <p>
          Log meals in plain language — the assistant works out the calories,
          macros and micros.
        </p>
      </div>

      {!anthropicConfigured && (
        <div className="banner warn">
          The AI assistant is not configured. Add <b>ANTHROPIC_API_KEY</b> and
          restart the app to enable meal logging.
        </div>
      )}
      {!supabaseConfigured && (
        <div className="banner warn">
          Supabase is not configured — logged meals will not be saved.
        </div>
      )}

      <NutritionChat
        targets={targets}
        initialNutrition={nutrition}
        goal={profile.energyGoal}
        ready={anthropicConfigured && supabaseConfigured}
      />
    </>
  );
}
