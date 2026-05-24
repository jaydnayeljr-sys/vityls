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
  activityLevel: ActivityLevel;
  bmrOverride: number | null;
  energyGoal: EnergyGoal;
  energyAdjust: number;
}

// Output of the calculation engine — never stored on the Profile itself.
export interface DerivedTargets {
  bmr: number;
  bmrMethod: string;
  tdee: number;
  targetKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  projectedWeeklyKg: number;
}

export const DEFAULT_PROFILE: Profile = {
  id: "me",
  name: "Jay",
  age: 31,
  sex: "male",
  heightCm: 178,
  weightKg: 76.4,
  bodyFatPct: null,
  activityLevel: "moderate",
  bmrOverride: null,
  energyGoal: "deficit",
  energyAdjust: 400,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentary — little exercise",
  light: "Light — 1-3 days/week",
  moderate: "Moderate — 3-5 days/week",
  active: "Active — 6-7 days/week",
  very_active: "Very active — hard daily training",
};
