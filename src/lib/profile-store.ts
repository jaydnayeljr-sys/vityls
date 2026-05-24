// Server-side read/write helpers for the single profile row.
// Maps between the DB's snake_case columns and the app's camelCase Profile.

import "server-only";
import { supabase, supabaseConfigured } from "./supabase";
import { DEFAULT_PROFILE, type Profile } from "./types";

function rowToProfile(row: Record<string, unknown>): Profile {
  return {
    id: "me",
    name: (row.name as string) ?? DEFAULT_PROFILE.name,
    age: Number(row.age ?? DEFAULT_PROFILE.age),
    sex: (row.sex as Profile["sex"]) ?? DEFAULT_PROFILE.sex,
    heightCm: Number(row.height_cm ?? DEFAULT_PROFILE.heightCm),
    weightKg: Number(row.weight_kg ?? DEFAULT_PROFILE.weightKg),
    bodyFatPct:
      row.body_fat_pct == null ? null : Number(row.body_fat_pct),
    vo2max: row.vo2max == null ? null : Number(row.vo2max),
    activityLevel:
      (row.activity_level as Profile["activityLevel"]) ??
      DEFAULT_PROFILE.activityLevel,
    bmrOverride: row.bmr_override == null ? null : Number(row.bmr_override),
    energyGoal:
      (row.energy_goal as Profile["energyGoal"]) ??
      DEFAULT_PROFILE.energyGoal,
    energyAdjust: Number(row.energy_adjust ?? DEFAULT_PROFILE.energyAdjust),
  };
}

function profileToRow(p: Profile): Record<string, unknown> {
  return {
    id: "me",
    name: p.name,
    age: p.age,
    sex: p.sex,
    height_cm: p.heightCm,
    weight_kg: p.weightKg,
    body_fat_pct: p.bodyFatPct,
    vo2max: p.vo2max,
    activity_level: p.activityLevel,
    bmr_override: p.bmrOverride,
    energy_goal: p.energyGoal,
    energy_adjust: p.energyAdjust,
    updated_at: new Date().toISOString(),
  };
}

/** Reads the profile. Falls back to defaults if Supabase is not yet set up. */
export async function getProfile(): Promise<Profile> {
  if (!supabaseConfigured) return DEFAULT_PROFILE;
  const { data, error } = await supabase
    .from("profile")
    .select("*")
    .eq("id", "me")
    .maybeSingle();
  if (error || !data) return DEFAULT_PROFILE;
  return rowToProfile(data as Record<string, unknown>);
}

/** Upserts the profile row. Throws if Supabase is not configured. */
export async function saveProfile(p: Profile): Promise<void> {
  if (!supabaseConfigured) {
    throw new Error("Supabase is not configured — cannot save.");
  }
  const { error } = await supabase
    .from("profile")
    .upsert(profileToRow(p), { onConflict: "id" });
  if (error) throw new Error(error.message);
}
