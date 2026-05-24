// PATCH  /api/nutrition/item  — edit one logged food item
// DELETE /api/nutrition/item  — remove one logged food item
//
// Both reply with the refreshed daily totals so the UI can re-render:
//   { ok: true, nutrition }   or   { ok: false, error }

import { NextResponse } from "next/server";
import {
  deleteFoodItem,
  getTodayNutrition,
  updateFoodItem,
  type FoodItemPatch,
} from "@/lib/nutrition-store";

export const dynamic = "force-dynamic";

const NUM_KEYS = [
  "calories",
  "protein_g",
  "carbs_g",
  "fat_g",
  "fiber_g",
] as const;

function bad(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function PATCH(req: Request) {
  const body = await readBody(req);
  if (!body) return bad("Bad request");

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return bad("Missing a valid item id.");

  const patch: FoodItemPatch = {};
  if (typeof body.name === "string") patch.name = body.name;
  if (typeof body.quantity === "string") patch.quantity = body.quantity;
  for (const k of NUM_KEYS) {
    const v = body[k];
    if (v != null && v !== "") patch[k] = Number(v);
  }

  try {
    await updateFoodItem(id, patch);
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Could not save the change.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  const nutrition = await getTodayNutrition();
  return NextResponse.json({ ok: true, nutrition });
}

export async function DELETE(req: Request) {
  const body = await readBody(req);
  if (!body) return bad("Bad request");

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return bad("Missing a valid item id.");

  try {
    await deleteFoodItem(id);
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Could not delete the item.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  const nutrition = await getTodayNutrition();
  return NextResponse.json({ ok: true, nutrition });
}
