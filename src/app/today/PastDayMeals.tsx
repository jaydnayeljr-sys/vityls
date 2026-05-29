"use client";

// Lightweight wrapper around MealRecord so a past day's logged meals appear
// on the Today screen with full edit / delete capability. Edits flow through
// the existing item-ID-based /api/nutrition/item endpoint.

import { useState } from "react";
import MealRecord from "@/app/nutrition/MealRecord";
import type { DailyNutrition } from "@/lib/nutrition-types";

export default function PastDayMeals({
  initial,
}: {
  initial: DailyNutrition;
}) {
  const [nutrition, setNutrition] = useState<DailyNutrition>(initial);
  if (nutrition.meals.length === 0) {
    return (
      <div className="card">
        <div className="card-h">
          <div className="t">Meals Logged</div>
          <div className="x">No meals were logged on this day.</div>
        </div>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="card-h">
        <div className="t">Meals Logged</div>
        <div className="x">
          Edit any number or remove an item — changes save immediately.
        </div>
      </div>
      <MealRecord nutrition={nutrition} onChange={setNutrition} ready={true} />
    </div>
  );
}
