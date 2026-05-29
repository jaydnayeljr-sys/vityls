// ===========================================================================
// Vitals — calculation engine.
//
// Every formula here is grounded in the Architecture & Methodology spec
// (Section 8). The functions are pure, so they run identically on the server
// and in the browser (the Profile screen recomputes targets live as you type).
// ===========================================================================

import type {
  ActivityLevel,
  DerivedTargets,
  EnergyGoal,
  Profile,
  Sex,
} from "./types";

// Activity multipliers applied to BMR to estimate TDEE.
const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

// ~7,700 kcal is the energy equivalent of 1 kg of body mass.
const KCAL_PER_KG = 7700;

/**
 * Mifflin-St Jeor (1990) — used when body composition is unknown.
 * The most validated population equation; accurate to roughly +/- 8-10%.
 */
export function bmrMifflin(
  sex: Sex,
  weightKg: number,
  heightCm: number,
  age: number,
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(base + (sex === "male" ? 5 : -161));
}

/**
 * Katch-McArdle — used when body-fat % is known (e.g. from a DEXA scan).
 * Derives BMR from lean body mass, removing the confound of fat mass, so it
 * is more accurate for lean / athletic individuals.
 */
export function bmrKatchMcArdle(weightKg: number, bodyFatPct: number): number {
  const leanMass = weightKg * (1 - bodyFatPct / 100);
  return Math.round(370 + 21.6 * leanMass);
}

/**
 * Picks the most accurate BMR the available data supports:
 *   1. a manual override, if the user set one;
 *   2. else Katch-McArdle, if body-fat % is known;
 *   3. else the Mifflin-St Jeor estimate.
 */
export function resolveBmr(p: Profile): { bmr: number; method: string } {
  if (p.bmrOverride && p.bmrOverride > 0) {
    return { bmr: Math.round(p.bmrOverride), method: "Manual override" };
  }
  if (p.bodyFatPct && p.bodyFatPct > 0) {
    return {
      bmr: bmrKatchMcArdle(p.weightKg, p.bodyFatPct),
      method: "Katch-McArdle (from body composition)",
    };
  }
  return {
    bmr: bmrMifflin(p.sex, p.weightKg, p.heightCm, p.age),
    method: "Mifflin-St Jeor (estimate — upload a DEXA scan to refine)",
  };
}

/** Total Daily Energy Expenditure = BMR x activity factor. */
export function tdee(bmr: number, activity: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_FACTORS[activity]);
}

/** Daily calorie target given the user's energy goal. */
export function targetCalories(
  tdeeValue: number,
  goal: EnergyGoal,
  adjustment: number,
): number {
  const mag = Math.abs(adjustment);
  if (goal === "maintenance") return tdeeValue;
  return goal === "deficit" ? tdeeValue - mag : tdeeValue + mag;
}

/**
 * Macronutrient targets.
 * Protein: 2.2 g/kg in a deficit to protect lean mass (Helms et al. 2014);
 *          1.6 g/kg otherwise (Morton et al. 2018 plateau).
 * Fat:     0.8 g/kg floor for endocrine health.
 * Carbs:   the remaining energy budget.
 */
export function macroTargets(
  weightKg: number,
  targetKcal: number,
  goal: EnergyGoal,
): { proteinG: number; carbsG: number; fatG: number } {
  const proteinPerKg = goal === "deficit" ? 2.2 : 1.6;
  const proteinG = Math.round(weightKg * proteinPerKg);
  const fatG = Math.round(weightKg * 0.8);
  const kcalFromProteinFat = proteinG * 4 + fatG * 9;
  const carbsG = Math.max(0, Math.round((targetKcal - kcalFromProteinFat) / 4));
  return { proteinG, carbsG, fatG };
}

/** Projected weekly weight change in kg (negative = loss). */
export function projectedWeeklyKg(
  adjustment: number,
  goal: EnergyGoal,
): number {
  if (goal === "maintenance") return 0;
  const sign = goal === "deficit" ? -1 : 1;
  const kg = (Math.abs(adjustment) * 7) / KCAL_PER_KG;
  return Number((kg * sign).toFixed(2));
}

/** Runs the whole engine for a profile and returns every derived value.
 *  When the user has set a custom override for any target, that value wins;
 *  otherwise the engine's recommendation is used. The recommendations remain
 *  available alongside so the Profile screen can show them as reference. */
export function deriveTargets(p: Profile): DerivedTargets {
  const { bmr, method } = resolveBmr(p);
  const tdeeValue = tdee(bmr, p.activityLevel);
  const recommendedKcal = targetCalories(
    tdeeValue,
    p.energyGoal,
    p.energyAdjust,
  );
  const {
    proteinG: recommendedProteinG,
    carbsG: recommendedCarbsG,
    fatG: recommendedFatG,
  } = macroTargets(p.weightKg, recommendedKcal, p.energyGoal);

  const targetKcal =
    p.customKcal != null && p.customKcal > 0 ? p.customKcal : recommendedKcal;
  const proteinG =
    p.customProteinG != null && p.customProteinG >= 0
      ? p.customProteinG
      : recommendedProteinG;
  const carbsG =
    p.customCarbsG != null && p.customCarbsG >= 0
      ? p.customCarbsG
      : recommendedCarbsG;
  const fatG =
    p.customFatG != null && p.customFatG >= 0 ? p.customFatG : recommendedFatG;

  const hasCustomTargets =
    p.customKcal != null ||
    p.customProteinG != null ||
    p.customCarbsG != null ||
    p.customFatG != null;

  return {
    bmr,
    bmrMethod: method,
    tdee: tdeeValue,
    recommendedKcal,
    recommendedProteinG,
    recommendedCarbsG,
    recommendedFatG,
    targetKcal,
    proteinG,
    carbsG,
    fatG,
    projectedWeeklyKg: projectedWeeklyKg(p.energyAdjust, p.energyGoal),
    hasCustomTargets,
  };
}

/**
 * Sustainable-rate guidance. A deficit or surplus beyond ~1% of body weight
 * per week risks lean-mass loss / excess fat gain (spec Section 7).
 */
export function rateGuidance(
  weeklyKg: number,
  weightKg: number,
): { ok: boolean; message: string } {
  const pct = (Math.abs(weeklyKg) / weightKg) * 100;
  if (pct === 0) {
    return { ok: true, message: "Maintenance — energy matched to expenditure." };
  }
  if (pct <= 1.0) {
    return { ok: true, message: "Within a sustainable rate of change." };
  }
  return {
    ok: false,
    message: "Aggressive — above 1% of body weight per week. Consider a smaller adjustment.",
  };
}
