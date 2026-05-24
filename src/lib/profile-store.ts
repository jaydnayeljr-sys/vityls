// Server-side read/write helpers for a user's profile row.

import "server-only";
import { supabase, supabaseConfigured } from "./supabase";
import { DEFAULT_PROFILE, type Profile } from "./types";

function rowToProfile(row: Record<string, unknown>): Profile {
  return {
    id: String(row.user_id ?? "me"),
    name: (row.name as string) ?? "",
    age: Number(row.age ?? DEFAULT_PROFILE.age),
    sex: (row.sex as Profile["sex"]) ?? DEFAULT_PROFILE.sex,
    heightCm: Number(row.height_cm ?? DEFAULT_PROFILE.heightCm),
    weightKg: Number(row.weight_kg ?? DEFAULT_PROFILE.weightKg),
    bodyFatPct: row.body_fat_pct == null ? null : Number(row.body_fat_pct),
    vo2max: row.vo2max == null ? null : Number(row.vo2max),
    activityLevel:
      (row.activity_level as Profile["activityLevel"]) ??
      DEFAULT_PROFILE.activityLevel,
    bmrOverride: row.bmr_override == null ? null : Number(row.bmr_override),
    energyGoal:
      (row.energy_goal as Profile["energyGoal"]) ?? DEFAULT_PROFILE.energyGoal,
    energyAdjust: Number(row.energy_adjust ?? DEFAULT_PROFILE.energyAdjust),
  };
}

function profileToRow(userId: string, p: Profile): Record<string, unknown> {
  return {
    user_id: userId,
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

/** Reads a user's profile, creating a default row on first access. */
export async function getProfile(userId: string): Promise<Profile> {
  if (!supabaseConfigured) return { ...DEFAULT_PROFILE, id: userId };

  const { data } = await supabase
    .from("profile")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) return rowToProfile(data as Record<string, unknown>);

  const fresh: Profile = { ...DEFAULT_PROFILE, id: userId, name: "" };
  await supabase
    .from("profile")
    .upsert(profileToRow(userId, fresh), { onConflict: "user_id" });
  return fresh;
}

/** Upserts a user's profile row. */
export async function saveProfile(userId: string, p: Profile): Promise<void> {
  if (!supabaseConfigured) {
    throw new Error("Supabase is not configured — cannot save.");
  }
  const { error } = await supabase
    .from("profile")
    .upsert(profileToRow(userId, p), { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}
