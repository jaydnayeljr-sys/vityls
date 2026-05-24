// Shared nutrition types and constants.
// No "server-only" guard here, so both server modules and client components
// can import these safely.

export const MICRO_KEYS = [
  "iron_mg",
  "calcium_mg",
  "magnesium_mg",
  "potassium_mg",
  "sodium_mg",
  "zinc_mg",
  "vitamin_d_iu",
  "vitamin_b12_ug",
  "vitamin_c_mg",
  "omega3_g",
] as const;

export type MicroKey = (typeof MICRO_KEYS)[number];
export type Micros = Partial<Record<MicroKey, number>>;

export const MICRO_LABELS: Record<MicroKey, string> = {
  iron_mg: "Iron",
  calcium_mg: "Calcium",
  magnesium_mg: "Magnesium",
  potassium_mg: "Potassium",
  sodium_mg: "Sodium",
  zinc_mg: "Zinc",
  vitamin_d_iu: "Vitamin D",
  vitamin_b12_ug: "Vitamin B12",
  vitamin_c_mg: "Vitamin C",
  omega3_g: "Omega-3",
};

export const MICRO_UNITS: Record<MicroKey, string> = {
  iron_mg: "mg",
  calcium_mg: "mg",
  magnesium_mg: "mg",
  potassium_mg: "mg",
  sodium_mg: "mg",
  zinc_mg: "mg",
  vitamin_d_iu: "IU",
  vitamin_b12_ug: "µg",
  vitamin_c_mg: "mg",
  omega3_g: "g",
};

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export interface ExtractedItem {
  name: string;
  source: "IFCT_2017" | "USDA_FDC" | "WEB" | "estimate";
  quantity: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  micros: Micros;
}

/** A food item that has been saved — carries its database row id so it can be
 *  edited or deleted from the meal record. */
export interface LoggedItem extends ExtractedItem {
  id: number;
}

export interface ExtractedMeal {
  meal: MealSlot;
  rawText: string;
  items: ExtractedItem[];
  summary: string;
  clarificationNeeded: boolean;
  clarificationQuestion: string;
}

export interface NutritionTotals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  micros: Micros;
}

export interface LoggedMeal {
  id: number;
  meal: MealSlot;
  rawText: string;
  createdAt: string;
  items: LoggedItem[];
}

export interface DailyNutrition {
  date: string;
  totals: NutritionTotals;
  meals: LoggedMeal[];
}

export const SOURCE_LABELS: Record<ExtractedItem["source"], string> = {
  IFCT_2017: "IFCT 2017",
  USDA_FDC: "USDA",
  WEB: "Web-verified",
  estimate: "Estimated",
};
