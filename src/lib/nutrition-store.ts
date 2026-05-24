// Server-side read/write for food logs. Stores meals extracted by the AI and
// rolls them up into daily totals for the dashboard.

import "server-only";
import { supabase, supabaseConfigured } from "./supabase";
import {
  MICRO_KEYS,
  type DailyNutrition,
  type ExtractedItem,
  type ExtractedMeal,
  type LoggedItem,
  type LoggedMeal,
  type MealSlot,
  type Micros,
  type NutritionTotals,
} from "./nutrition-types";

export type {
  DailyNutrition,
  LoggedItem,
  LoggedMeal,
  NutritionTotals,
} from "./nutrition-types";

/** Fields of a logged food item the user is allowed to edit by hand. */
export interface FoodItemPatch {
  name?: string;
  quantity?: string;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  fiber_g?: number;
}

/** Local calendar date (YYYY-MM-DD). The dev server runs on the user's
 *  machine, so local time is correct. Revisit if deployed to a UTC host. */
export function todayLocal(): string {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function emptyTotals(): NutritionTotals {
  return { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, micros: {} };
}

function addItem(t: NutritionTotals, item: ExtractedItem): void {
  t.calories += item.calories;
  t.protein_g += item.protein_g;
  t.carbs_g += item.carbs_g;
  t.fat_g += item.fat_g;
  t.fiber_g += item.fiber_g;
  for (const k of MICRO_KEYS) {
    const v = item.micros[k];
    if (v != null) t.micros[k] = (t.micros[k] ?? 0) + v;
  }
}

function rowToItem(row: Record<string, unknown>): LoggedItem {
  return {
    id: Number(row.id ?? 0),
    name: String(row.name ?? "Food"),
    source: (row.source as ExtractedItem["source"]) ?? "estimate",
    quantity: String(row.quantity ?? ""),
    calories: Number(row.calories ?? 0),
    protein_g: Number(row.protein_g ?? 0),
    carbs_g: Number(row.carbs_g ?? 0),
    fat_g: Number(row.fat_g ?? 0),
    fiber_g: Number(row.fiber_g ?? 0),
    micros: (row.micros as Micros) ?? {},
  };
}

/** Persists an extracted meal: one food_log row plus its food_item rows. */
export async function logMeal(meal: ExtractedMeal): Promise<void> {
  if (!supabaseConfigured) throw new Error("Supabase is not configured.");

  const { data: log, error: logErr } = await supabase
    .from("food_log")
    .insert({
      logged_for: todayLocal(),
      meal: meal.meal,
      raw_text: meal.rawText,
    })
    .select("id")
    .single();
  if (logErr || !log) throw new Error(logErr?.message ?? "Could not save the meal.");

  const rows = meal.items.map((it) => ({
    food_log_id: (log as { id: number }).id,
    name: it.name,
    source: it.source,
    quantity: it.quantity,
    calories: it.calories,
    protein_g: it.protein_g,
    carbs_g: it.carbs_g,
    fat_g: it.fat_g,
    fiber_g: it.fiber_g,
    micros: it.micros,
  }));
  if (rows.length > 0) {
    const { error: itemErr } = await supabase.from("food_item").insert(rows);
    if (itemErr) throw new Error(itemErr.message);
  }
}

/** Returns everything logged today plus the rolled-up totals. */
export async function getTodayNutrition(): Promise<DailyNutrition> {
  const date = todayLocal();
  if (!supabaseConfigured) {
    return { date, totals: emptyTotals(), meals: [] };
  }

  const { data, error } = await supabase
    .from("food_log")
    .select("id, meal, raw_text, created_at, food_item(*)")
    .eq("logged_for", date)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return { date, totals: emptyTotals(), meals: [] };
  }

  const totals = emptyTotals();
  const meals: LoggedMeal[] = data.map((row: Record<string, unknown>) => {
    const itemRows = Array.isArray(row.food_item)
      ? (row.food_item as Record<string, unknown>[])
      : [];
    const items = itemRows.map(rowToItem);
    items.forEach((it) => addItem(totals, it));
    return {
      id: Number(row.id),
      meal: (row.meal as MealSlot) ?? "snack",
      rawText: String(row.raw_text ?? ""),
      createdAt: String(row.created_at ?? ""),
      items,
    };
  });

  // Round totals for display.
  totals.calories = Math.round(totals.calories);
  totals.protein_g = Math.round(totals.protein_g);
  totals.carbs_g = Math.round(totals.carbs_g);
  totals.fat_g = Math.round(totals.fat_g);
  totals.fiber_g = Math.round(totals.fiber_g * 10) / 10;

  return { date, totals, meals };
}

const NUM_FIELDS = [
  "calories",
  "protein_g",
  "carbs_g",
  "fat_g",
  "fiber_g",
] as const;

function cleanNumber(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) && x >= 0 ? Math.round(x * 10) / 10 : 0;
}

/** Applies a user's manual edit to a single logged food item. */
export async function updateFoodItem(
  id: number,
  patch: FoodItemPatch,
): Promise<void> {
  if (!supabaseConfigured) throw new Error("Supabase is not configured.");

  const fields: Record<string, unknown> = {};
  if (typeof patch.name === "string") {
    fields.name = patch.name.trim().slice(0, 120) || "Food";
  }
  if (typeof patch.quantity === "string") {
    fields.quantity = patch.quantity.trim().slice(0, 120);
  }
  for (const k of NUM_FIELDS) {
    if (patch[k] != null) fields[k] = cleanNumber(patch[k]);
  }
  if (Object.keys(fields).length === 0) return;

  const { error } = await supabase
    .from("food_item")
    .update(fields)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Removes a single logged food item. If its parent meal log is left empty,
 *  the log row is removed too so the record stays tidy. */
export async function deleteFoodItem(id: number): Promise<void> {
  if (!supabaseConfigured) throw new Error("Supabase is not configured.");

  const { data: item } = await supabase
    .from("food_item")
    .select("food_log_id")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("food_item").delete().eq("id", id);
  if (error) throw new Error(error.message);

  const logId = (item as { food_log_id?: number } | null)?.food_log_id;
  if (logId != null) {
    const { count } = await supabase
      .from("food_item")
      .select("id", { count: "exact", head: true })
      .eq("food_log_id", logId);
    if ((count ?? 0) === 0) {
      await supabase.from("food_log").delete().eq("id", logId);
    }
  }
}
