"use client";

import { useMemo, useState } from "react";
import { deriveTargets, rateGuidance } from "@/lib/calc";
import {
  ACTIVITY_LABELS,
  type ActivityLevel,
  type EnergyGoal,
  type Profile,
} from "@/lib/types";

const fmt = (n: number) => Math.round(n).toLocaleString();

export default function ProfileForm({
  initial,
  canSave,
}: {
  initial: Profile;
  canSave: boolean;
}) {
  const [p, setP] = useState<Profile>(initial);
  const [manualBmr, setManualBmr] = useState<boolean>(initial.bmrOverride != null);
  const [status, setStatus] = useState<
    { kind: "ok" | "bad"; msg: string } | null
  >(null);
  const [busy, setBusy] = useState(false);

  // Live recompute — the engine runs in the browser as the user types.
  const targets = useMemo(() => deriveTargets(p), [p]);
  const guidance = useMemo(
    () => rateGuidance(targets.projectedWeeklyKg, p.weightKg),
    [targets.projectedWeeklyKg, p.weightKg],
  );

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setP((prev) => ({ ...prev, [key]: value }));
    setStatus(null);
  }
  const num = (v: string) => (v === "" ? 0 : Number(v));

  function toggleManualBmr(on: boolean) {
    setManualBmr(on);
    set("bmrOverride", on ? targets.bmr : null);
  }

  async function save() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setStatus({ kind: "bad", msg: data.error ?? "Save failed." });
      } else {
        setP(data.profile);
        setStatus({ kind: "ok", msg: "Profile saved." });
      }
    } catch {
      setStatus({ kind: "bad", msg: "Network error." });
    }
    setBusy(false);
  }

  const goals: EnergyGoal[] = ["deficit", "maintenance", "surplus"];
  const activities: ActivityLevel[] = [
    "sedentary",
    "light",
    "moderate",
    "active",
    "very_active",
  ];

  return (
    <>
      {status && (
        <div className={`banner ${status.kind}`}>{status.msg}</div>
      )}

      <div className="prof-grid">
        {/* ---------- Biometrics ---------- */}
        <div className="card">
          <div className="card-h">
            <div className="t">Biometrics</div>
          </div>

          <div className="field">
            <label>Name</label>
            <input
              className="inp"
              value={p.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label>Age</label>
              <input
                className="inp"
                type="number"
                value={p.age}
                onChange={(e) => set("age", num(e.target.value))}
              />
            </div>
            <div className="field">
              <label>Sex</label>
              <div className="seg">
                <button
                  type="button"
                  className={p.sex === "male" ? "on" : ""}
                  onClick={() => set("sex", "male")}
                >
                  Male
                </button>
                <button
                  type="button"
                  className={p.sex === "female" ? "on" : ""}
                  onClick={() => set("sex", "female")}
                >
                  Female
                </button>
              </div>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Height (cm)</label>
              <input
                className="inp"
                type="number"
                value={p.heightCm}
                onChange={(e) => set("heightCm", num(e.target.value))}
              />
            </div>
            <div className="field">
              <label>Weight (kg)</label>
              <input
                className="inp"
                type="number"
                step="0.1"
                value={p.weightKg}
                onChange={(e) => set("weightKg", num(e.target.value))}
              />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>
                Body fat % <span className="muted">— from a DEXA scan</span>
              </label>
              <input
                className="inp"
                type="number"
                step="0.1"
                placeholder="unknown"
                value={p.bodyFatPct ?? ""}
                onChange={(e) =>
                  set(
                    "bodyFatPct",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
              />
            </div>
            <div className="field">
              <label>
                VO2max <span className="muted">— from your watch</span>
              </label>
              <input
                className="inp"
                type="number"
                step="0.1"
                placeholder="unknown"
                value={p.vo2max ?? ""}
                onChange={(e) =>
                  set(
                    "vo2max",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
              />
            </div>
          </div>

          <div className="field">
            <label>Activity level</label>
            <select
              className="inp"
              value={p.activityLevel}
              onChange={(e) =>
                set("activityLevel", e.target.value as ActivityLevel)
              }
            >
              {activities.map((a) => (
                <option key={a} value={a}>
                  {ACTIVITY_LABELS[a]}
                </option>
              ))}
            </select>
          </div>

          {/* BMR */}
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Basal Metabolic Rate (BMR)</label>
            <div className="bmr-box">
              <div className="bh">
                <b>{manualBmr ? "Manual override" : "Computed for you"}</b>
                <div className="bv">{fmt(targets.bmr)} kcal</div>
              </div>
              {manualBmr && (
                <input
                  type="range"
                  min={1200}
                  max={2400}
                  step={10}
                  value={p.bmrOverride ?? targets.bmr}
                  onChange={(e) => set("bmrOverride", Number(e.target.value))}
                />
              )}
              <div className="note">
                Method: <b>{targets.bmrMethod}</b>.{" "}
                {manualBmr
                  ? "Drag to set your own value."
                  : "Add a body-fat % above (from a DEXA scan) to switch from the population estimate to the more accurate Katch-McArdle calculation."}
              </div>
              <label
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  marginTop: 10,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={manualBmr}
                  onChange={(e) => toggleManualBmr(e.target.checked)}
                  style={{ accentColor: "var(--amber)" }}
                />
                Override BMR with my own judgement
              </label>
            </div>
          </div>
        </div>

        {/* ---------- Energy goal + targets ---------- */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card">
            <div className="card-h">
              <div className="t">Energy Goal</div>
            </div>
            <div className="seg">
              {goals.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={p.energyGoal === g ? "on" : ""}
                  onClick={() => set("energyGoal", g)}
                  style={{ textTransform: "capitalize" }}
                >
                  {g === "maintenance" ? "Maintain" : g}
                </button>
              ))}
            </div>

            {p.energyGoal !== "maintenance" && (
              <div style={{ marginTop: 15 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-2)",
                    marginBottom: 8,
                  }}
                >
                  <span>Daily adjustment</span>
                  <span
                    style={{
                      color:
                        p.energyGoal === "deficit"
                          ? "var(--green)"
                          : "var(--amber)",
                    }}
                  >
                    {p.energyGoal === "deficit" ? "−" : "+"}
                    {fmt(p.energyAdjust)} kcal
                  </span>
                </div>
                <input
                  type="range"
                  min={100}
                  max={900}
                  step={25}
                  value={p.energyAdjust}
                  onChange={(e) => set("energyAdjust", Number(e.target.value))}
                  style={{ width: "100%", accentColor: "var(--green)" }}
                />
              </div>
            )}

            <div
              className={`banner ${guidance.ok ? "ok" : "warn"}`}
              style={{ margin: "14px 0 0" }}
            >
              {guidance.message}
              {p.energyGoal !== "maintenance" && (
                <>
                  {" "}
                  Projected: <b>{Math.abs(targets.projectedWeeklyKg)} kg/week</b>{" "}
                  {targets.projectedWeeklyKg < 0 ? "loss" : "gain"}.
                </>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <div className="t">Computed Targets</div>
              <div className="x">Recalculated live from your inputs</div>
            </div>
            <div className="targets">
              <div className="tg">
                <span>
                  Maintenance (TDEE)
                  <br />
                  <span className="src">BMR × activity factor</span>
                </span>
                <b>{fmt(targets.tdee)} kcal</b>
              </div>
              <div className="tg">
                <span>
                  Target intake
                  <br />
                  <span className="src">
                    {p.energyGoal === "maintenance"
                      ? "matched to expenditure"
                      : `${p.energyGoal}: ${p.energyGoal === "deficit" ? "−" : "+"}${fmt(p.energyAdjust)} kcal/day`}
                  </span>
                </span>
                <b
                  style={{
                    color:
                      p.energyGoal === "deficit"
                        ? "var(--green)"
                        : p.energyGoal === "surplus"
                          ? "var(--amber)"
                          : "var(--text)",
                  }}
                >
                  {fmt(targets.targetKcal)} kcal
                </b>
              </div>
              <div className="tg">
                <span>
                  Protein
                  <br />
                  <span className="src">
                    {p.energyGoal === "deficit"
                      ? "2.2 g/kg — protects lean mass in a deficit"
                      : "1.6 g/kg bodyweight"}
                  </span>
                </span>
                <b>{fmt(targets.proteinG)} g</b>
              </div>
              <div className="tg">
                <span>
                  Carbohydrate
                  <br />
                  <span className="src">remaining energy budget</span>
                </span>
                <b>{fmt(targets.carbsG)} g</b>
              </div>
              <div className="tg">
                <span>
                  Fat
                  <br />
                  <span className="src">0.8 g/kg floor for hormones</span>
                </span>
                <b>{fmt(targets.fatG)} g</b>
              </div>
            </div>
            <button
              className="save-btn"
              onClick={save}
              disabled={busy || !canSave}
              title={canSave ? "" : "Configure Supabase to enable saving"}
            >
              {busy ? "Saving…" : canSave ? "Save profile" : "Saving disabled — set up Supabase"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
