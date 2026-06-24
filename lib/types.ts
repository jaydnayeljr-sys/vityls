// Shared domain types for Vitals.

export type Sex = "male" | "female";

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";

export type EnergyGoal = "deficit" | "maintenance" | "surplus";

// Mirrors the `profile` table (camelCase in app code, snake_case in the DB).
export interface Profile {
  id: string;
  name: string;
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  bodyFatPct: number | null;
  vo2max: number | null;
  activityLevel: ActivityLevel;
  bmrOverride: number | null;
  energyGoal: EnergyGoal;
  energyAdjust: number;
  // User overrides for the calorie / macro targets. Null = use the recommended
  // value from the calculation engine. Set per-target (so a user can override
  // only protein, for example).
  customKcal: number | null;
  customProteinG: number | null;
  customCarbsG: number | null;
  customFatG: number | null;
}

// Output of the calculation engine — never stored on the Profile itself.
// "recommended*" are what the engine would set; "targetKcal" / "proteinG" /
// "carbsG" / "fatG" are the active values the rest of the app uses (custom
// override if set, otherwise the recommendation).
export interface DerivedTargets {
  bmr: number;
  bmrMethod: string;
  tdee: number;
  recommendedKcal: number;
  recommendedProteinG: number;
  recommendedCarbsG: number;
  recommendedFatG: number;
  targetKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  projectedWeeklyKg: number;
  hasCustomTargets: boolean;
}

export const DEFAULT_PROFILE: Profile = {
  id: "me",
  name: "Jay",
  age: 31,
  sex: "male",
  heightCm: 178,
  weightKg: 76.4,
  bodyFatPct: null,
  vo2max: null,
  activityLevel: "moderate",
  bmrOverride: null,
  energyGoal: "deficit",
  energyAdjust: 400,
  customKcal: null,
  customProteinG: null,
  customCarbsG: null,
  customFatG: null,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentary — little exercise",
  light: "Light — 1-3 days/week",
  moderate: "Moderate — 3-5 days/week",
  active: "Active — 6-7 days/week",
  very_active: "Very active — hard daily training",
};
