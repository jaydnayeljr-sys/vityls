"use client";

// The editable food record for the current day. Shows everything logged,
// grouped into Breakfast / Lunch / Dinner / Snacks, and lets the user correct
// or remove any item. Edits and deletes go through /api/nutrition/item.

import { useMemo, useState } from "react";
import {
  SOURCE_LABELS,
  type DailyNutrition,
  type LoggedItem,
  type MealSlot,
} from "@/lib/nutrition-types";

const fmt = (n: number) => Math.round(n).toLocaleString();

const ORDER: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];
const LABEL: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

const NUM_FIELDS = [
  ["calories", "Calories"],
  ["protein_g", "Protein g"],
  ["carbs_g", "Carbs g"],
  ["fat_g", "Fat g"],
  ["fiber_g", "Fibre g"],
] as const;

type NumField = (typeof NUM_FIELDS)[number][0];

interface Draft {
  name: string;
  quantity: string;
  calories: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  fiber_g: string;
}

function toDraft(it: LoggedItem): Draft {
  return {
    name: it.name,
    quantity: it.quantity,
    calories: String(it.calories),
    protein_g: String(it.protein_g),
    carbs_g: String(it.carbs_g),
    fat_g: String(it.fat_g),
    fiber_g: String(it.fiber_g),
  };
}

export default function MealRecord({
  nutrition,
  onChange,
  ready,
}: {
  nutrition: DailyNutrition;
  onChange: (n: DailyNutrition) => void;
  ready: boolean;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const groups = useMemo(() => {
    const g: Record<MealSlot, LoggedItem[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    };
    for (const m of nutrition.meals) {
      for (const it of m.items) g[m.meal].push(it);
    }
    return g;
  }, [nutrition]);

  const anyLogged = ORDER.some((s) => groups[s].length > 0);

  function startEdit(it: LoggedItem) {
    setError("");
    setEditing(it.id);
    setDraft(toDraft(it));
  }

  function cancelEdit() {
    setEditing(null);
    setDraft(null);
  }

  async function saveEdit(id: number) {
    if (!draft) return;
    setBusyId(id);
    setError("");
    try {
      const res = await fetch("/api/nutrition/item", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...draft }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not save the change.");
      } else {
        onChange(data.nutrition);
        cancelEdit();
      }
    } catch {
      setError("Network error — please try again.");
    }
    setBusyId(null);
  }

  async function remove(id: number) {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch("/api/nutrition/item", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not delete the item.");
      } else {
        onChange(data.nutrition);
        if (editing === id) cancelEdit();
      }
    } catch {
      setError("Network error — please try again.");
    }
    setBusyId(null);
  }

  return (
    <div className="card meal-record">
      <div className="card-h">
        <div className="t">Today&apos;s Meals</div>
        <div className="x">Your food record — edit or remove any item</div>
      </div>

      {error && (
        <div className="banner bad" style={{ marginBottom: 14 }}>
          {error}
        </div>
      )}

      {!anyLogged ? (
        <p className="muted" style={{ fontSize: 13 }}>
          Nothing logged yet today. Describe a meal in the chat above and it
          will appear here.
        </p>
      ) : (
        ORDER.map((slot) => {
          const items = groups[slot];
          const kcal = items.reduce((s, i) => s + i.calories, 0);
          return (
            <div className="mr-group" key={slot}>
              <div className="mr-group-h">
                <b>{LABEL[slot]}</b>
                <span>{items.length === 0 ? "—" : `${fmt(kcal)} kcal`}</span>
              </div>

              {items.length === 0 ? (
                <div className="mr-empty">Not logged</div>
              ) : (
                items.map((it) =>
                  editing === it.id && draft ? (
                    <div className="mr-edit" key={it.id}>
                      <div className="mr-edit-grid">
                        <label className="mr-f mr-f-wide">
                          <span>Food</span>
                          <input
                            value={draft.name}
                            onChange={(e) =>
                              setDraft({ ...draft, name: e.target.value })
                            }
                          />
                        </label>
                        <label className="mr-f mr-f-wide">
                          <span>Portion</span>
                          <input
                            value={draft.quantity}
                            onChange={(e) =>
                              setDraft({ ...draft, quantity: e.target.value })
                            }
                          />
                        </label>
                        {NUM_FIELDS.map(([k, lbl]) => (
                          <label className="mr-f" key={k}>
                            <span>{lbl}</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              value={draft[k as NumField]}
                              onChange={(e) =>
                                setDraft({ ...draft, [k]: e.target.value })
                              }
                            />
                          </label>
                        ))}
                      </div>
                      <div className="mr-edit-actions">
                        <button
                          className="mr-btn ghost"
                          onClick={cancelEdit}
                          disabled={busyId === it.id}
                        >
                          Cancel
                        </button>
                        <button
                          className="mr-btn save"
                          onClick={() => saveEdit(it.id)}
                          disabled={busyId === it.id}
                        >
                          {busyId === it.id ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mr-item" key={it.id}>
                      <div className="mr-item-main">
                        <div className="mr-item-name">
                          <b>{it.name}</b>
                          <span className="src-tag">
                            {SOURCE_LABELS[it.source]}
                          </span>
                        </div>
                        <div className="mr-item-sub">
                          {it.quantity ? `${it.quantity} · ` : ""}P{" "}
                          {fmt(it.protein_g)}g · C {fmt(it.carbs_g)}g · F{" "}
                          {fmt(it.fat_g)}g
                          {it.fiber_g > 0
                            ? ` · Fibre ${fmt(it.fiber_g)}g`
                            : ""}
                        </div>
                      </div>
                      <div className="mr-item-kcal">
                        {fmt(it.calories)}
                        <small>kcal</small>
                      </div>
                      <div className="mr-item-actions">
                        <button
                          className="mr-btn ghost"
                          disabled={!ready || busyId === it.id}
                          onClick={() => startEdit(it)}
                        >
                          Edit
                        </button>
                        <button
                          className="mr-btn danger"
                          disabled={!ready || busyId === it.id}
                          onClick={() => remove(it.id)}
                        >
                          {busyId === it.id ? "…" : "Delete"}
                        </button>
                      </div>
                    </div>
                  ),
                )
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
