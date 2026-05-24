// Nutrition screen (server component). Loads the user's targets and anything
// already logged today, then hands off to the client chat component.

import AppShell from "@/components/AppShell";
import NutritionChat from "./NutritionChat";
import { getProfile } from "@/lib/profile-store";
import { getTodayNutrition } from "@/lib/nutrition-store";
import { deriveTargets } from "@/lib/calc";
import { anthropicConfigured } from "@/lib/anthropic";
import { supabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function NutritionPage() {
  const profile = await getProfile();
  const targets = deriveTargets(profile);
  const nutrition = await getTodayNutrition();

  return (
    <AppShell active="nutrition" userName={profile.name}>
      <div className="topbar">
        <h1>Nutrition AI</h1>
        <p>
          Log meals in plain language — the assistant works out the calories,
          macros and micros.
        </p>
      </div>

      {!anthropicConfigured && (
        <div className="banner warn">
          The AI assistant is not configured. Add <b>ANTHROPIC_API_KEY</b> to
          <b> .env.local</b> and restart the app to enable meal logging.
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
    </AppShell>
  );
}
