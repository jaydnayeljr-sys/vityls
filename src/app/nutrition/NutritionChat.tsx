"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DerivedTargets, EnergyGoal } from "@/lib/types";
import {
  MICRO_KEYS,
  MICRO_LABELS,
  MICRO_UNITS,
  SOURCE_LABELS,
  type DailyNutrition,
  type ExtractedItem,
  type MealSlot,
} from "@/lib/nutrition-types";
import MealRecord from "./MealRecord";

const fmt = (n: number) => Math.round(n).toLocaleString();

const MEAL_LABEL: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

interface MealCardData {
  meal: MealSlot;
  items: ExtractedItem[];
}

interface ChatMsg {
  id: number;
  role: "user" | "ai";
  text: string;
  card?: MealCardData;
}

let msgSeq = 1;

export default function NutritionChat({
  targets,
  initialNutrition,
  goal,
  ready,
}: {
  targets: DerivedTargets;
  initialNutrition: DailyNutrition;
  goal: EnergyGoal;
  ready: boolean;
}) {
  const [nutrition, setNutrition] = useState<DailyNutrition>(initialNutrition);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMsg[]>(() => {
    const seed: ChatMsg[] = [
      {
        id: msgSeq++,
        role: "ai",
        text:
          "Tell me what you've eaten — in plain language — and I'll work out the calories, macros and micros from the IFCT 2017 and USDA food tables. For branded or packaged products I'll look up the label online. Everything lands in Today's Meals below, where you can edit any number.",
      },
    ];
    for (const m of initialNutrition.meals) {
      seed.push({
        id: msgSeq++,
        role: "ai",
        text: `${MEAL_LABEL[m.meal]} — already logged today`,
        card: { meal: m.meal, items: m.items },
      });
    }
    return seed;
  });

  useEffect(() => {
    bodyRef.current?.scrollTo({
      top: bodyRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);

  function push(msg: Omit<ChatMsg, "id">) {
    setMessages((prev) => [...prev, { ...msg, id: msgSeq++ }]);
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    push({ role: "user", text });
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/nutrition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        push({ role: "ai", text: data.error ?? "Something went wrong." });
      } else if (data.clarification) {
        push({ role: "ai", text: data.clarification });
      } else {
        push({
          role: "ai",
          text: data.meal.summary,
          card: { meal: data.meal.meal, items: data.meal.items },
        });
        setNutrition(data.nutrition);
      }
    } catch {
      push({ role: "ai", text: "Network error — please try again." });
    }
    setBusy(false);
  }

  // ---- today's totals ----
  const t = nutrition.totals;
  const eaten = t.calories;
  const target = targets.targetKcal;
  const remaining = target - eaten;
  const calPct = target > 0 ? Math.min(100, (eaten / target) * 100) : 0;
  const over = remaining < 0;

  const macros = [
    { label: "Protein", v: t.protein_g, goal: targets.proteinG, color: "var(--blue)" },
    { label: "Carbs", v: t.carbs_g, goal: targets.carbsG, color: "var(--amber)" },
    { label: "Fat", v: t.fat_g, goal: targets.fatG, color: "var(--violet)" },
  ];

  const loggedMicros = useMemo(
    () => MICRO_KEYS.filter((k) => (t.micros[k] ?? 0) > 0),
    [t.micros],
  );

  return (
    <>
    <div className="chat-wrap">
      {/* ---------- Chat ---------- */}
      <div className="chat-panel">
        <div className="chat-head">
          <div className="ai-mark">V</div>
          <div>
            <b>Vityl Coach</b>
            <small>Meal logging · IFCT 2017 · USDA · brands online</small>
          </div>
        </div>

        <div className="chat-body" ref={bodyRef}>
          {messages.map((m) => (
            <div key={m.id} className={`msg ${m.role}`}>
              <div className="mav">{m.role === "ai" ? "V" : "J"}</div>
              <div className="msg-content">
                {m.text && <div className="bub">{m.text}</div>}
                {m.card && <MealCard data={m.card} />}
              </div>
            </div>
          ))}
          {busy && (
            <div className="msg ai">
              <div className="mav">V</div>
              <div className="msg-content">
                <div className="bub typing">Analysing…</div>
              </div>
            </div>
          )}
        </div>

        <div className="chat-input">
          <input
            type="text"
            value={input}
            disabled={!ready || busy}
            placeholder={
              ready
                ? "e.g. 2 rotis, dal, a bowl of curd and a banana"
                : "Configure the AI key and Supabase to start logging"
            }
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
          />
          <button
            className="send-btn"
            onClick={send}
            disabled={!ready || busy || !input.trim()}
          >
            Log
          </button>
        </div>
      </div>

      {/* ---------- Today's totals ---------- */}
      <div className="side-stack">
        <div className="card">
          <div className="card-h">
            <div className="t">Today&apos;s Energy</div>
            <div className="x">vs. your {goal} target</div>
          </div>
          <div className="balance">
            <div className="balance-num">
              <b className={over ? "over" : ""}>{fmt(Math.abs(remaining))}</b>
              <span>{over ? "kcal over target" : "kcal remaining"}</span>
            </div>
          </div>
          <div className="bigtrack">
            <div
              className="bigtrack-fill"
              style={{
                width: `${calPct}%`,
                background: over ? "var(--red)" : "var(--green)",
              }}
            />
          </div>
          <div className="track-cap">
            <span>{fmt(eaten)} eaten</span>
            <span>{fmt(target)} target</span>
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <div className="t">Macros</div>
          </div>
          {macros.map((m) => {
            const pct =
              m.goal > 0 ? Math.min(100, (m.v / m.goal) * 100) : 0;
            return (
              <div className="macro-row" key={m.label}>
                <div className="macro-top">
                  <span>{m.label}</span>
                  <span className="macro-v">
                    {fmt(m.v)} / {fmt(m.goal)} g
                  </span>
                </div>
                <div className="track">
                  <div
                    className="track-fill"
                    style={{ width: `${pct}%`, background: m.color }}
                  />
                </div>
              </div>
            );
          })}
          <div className="macro-row">
            <div className="macro-top">
              <span>Fibre</span>
              <span className="macro-v">{fmt(t.fiber_g)} g</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <div className="t">Micronutrients logged</div>
          </div>
          {loggedMicros.length === 0 ? (
            <p className="muted" style={{ fontSize: 12.5 }}>
              Nothing logged yet today.
            </p>
          ) : (
            <div className="micro-grid">
              {loggedMicros.map((k) => (
                <div className="micro-pill" key={k}>
                  <small>{MICRO_LABELS[k]}</small>
                  <b>
                    {fmt(t.micros[k] ?? 0)} {MICRO_UNITS[k]}
                  </b>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>

    <MealRecord nutrition={nutrition} onChange={setNutrition} ready={ready} />
    </>
  );
}

function MealCard({ data }: { data: MealCardData }) {
  const total = data.items.reduce((s, i) => s + i.calories, 0);
  return (
    <div className="food-card">
      <div className="fc-h">
        <b>{MEAL_LABEL[data.meal]}</b>
        <span className="kc">{fmt(total)} kcal</span>
      </div>
      {data.items.map((it, idx) => (
        <div className="fc-item" key={idx}>
          <div className="fc-item-top">
            <b>{it.name}</b>
            <span>{fmt(it.calories)} kcal</span>
          </div>
          <div className="fc-item-sub">
            {it.quantity ? `${it.quantity} · ` : ""}P {fmt(it.protein_g)}g · C{" "}
            {fmt(it.carbs_g)}g · F {fmt(it.fat_g)}g
            <span className="src-tag">{SOURCE_LABELS[it.source]}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
