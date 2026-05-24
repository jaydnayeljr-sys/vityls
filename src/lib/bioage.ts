// ===========================================================================
// Vitals — biological-age engine.
//
// A transparent estimate, not a diagnosis. It starts from the user's
// chronological age and shifts it using markers that research links to the
// pace of ageing, each compared to an age/sex-referenced norm:
//
//   - VO2max          cardiorespiratory fitness — the strongest single anchor
//   - Resting HR      lower resting rate tracks better cardiovascular health
//   - HRV (RMSSD)     higher variability tracks autonomic / recovery health
//   - Sleep           duration away from the ~7.5 h optimum
//   - Body fat %      composition outside the healthy range
//
// Every contribution is capped so one noisy reading cannot dominate, and the
// total shift is capped at +/- 12 years. The functions are pure, so the engine
// runs identically on the server and in the browser.
// ===========================================================================

import type { Sex } from "./types";

export interface BioAgeInput {
  chronologicalAge: number;
  sex: Sex;
  vo2max: number | null;
  restingHr: number | null;
  hrv: number | null;
  avgSleepMin: number | null;
  bodyFatPct: number | null;
}

export interface BioAgeContribution {
  key: string;
  label: string;
  years: number; // positive = ages you, negative = makes you younger
  detail: string;
}

export interface BioAgeResult {
  bioAge: number;
  chronological: number;
  delta: number; // bioAge - chronological
  contributions: BioAgeContribution[];
  confidence: "low" | "medium" | "high";
  inputsUsed: number;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

/** Computes a biological-age estimate from the markers available. */
export function computeBioAge(input: BioAgeInput): BioAgeResult {
  const age = input.chronologicalAge;
  const sex = input.sex;
  const contributions: BioAgeContribution[] = [];

  // VO2max — the strongest anchor. Norm declines ~0.42 ml/kg/min per year.
  if (input.vo2max != null && input.vo2max > 0) {
    const norm = (sex === "male" ? 47 : 40) - 0.42 * Math.max(0, age - 25);
    const years = clamp(-(input.vo2max - norm) / 0.42, -8, 8);
    contributions.push({
      key: "vo2max",
      label: "Cardiorespiratory fitness (VO2max)",
      years: round1(years),
      detail: `${round1(input.vo2max)} ml/kg/min vs ~${Math.round(norm)} expected for your age`,
    });
  }

  // Resting heart rate — referenced to a healthy ~60 bpm.
  if (input.restingHr != null && input.restingHr > 0) {
    const years = clamp((input.restingHr - 60) * 0.18, -4, 5);
    contributions.push({
      key: "rhr",
      label: "Resting heart rate",
      years: round1(years),
      detail: `${Math.round(input.restingHr)} bpm average`,
    });
  }

  // HRV (RMSSD) — declines with age; higher is better.
  if (input.hrv != null && input.hrv > 0) {
    const norm = clamp(55 - 0.4 * Math.max(0, age - 20), 20, 70);
    const years = clamp(-(input.hrv - norm) * 0.06, -4, 4);
    contributions.push({
      key: "hrv",
      label: "Heart rate variability",
      years: round1(years),
      detail: `${Math.round(input.hrv)} ms RMSSD average`,
    });
  }

  // Sleep — deviation from a ~7.5 h optimum.
  if (input.avgSleepMin != null && input.avgSleepMin > 0) {
    const hours = input.avgSleepMin / 60;
    const deviation = Math.abs(hours - 7.5);
    const years = clamp((deviation - 0.5) * 1.1, -0.6, 3);
    contributions.push({
      key: "sleep",
      label: "Sleep",
      years: round1(years),
      detail: `${hours.toFixed(1)} h average per night`,
    });
  }

  // Body composition — penalised outside the healthy range.
  if (input.bodyFatPct != null && input.bodyFatPct > 0) {
    const healthyTop = sex === "male" ? 20 : 30;
    const healthyBottom = sex === "male" ? 8 : 16;
    let years = 0;
    if (input.bodyFatPct > healthyTop) {
      years = (input.bodyFatPct - healthyTop) * 0.13;
    } else if (input.bodyFatPct < healthyBottom) {
      years = (healthyBottom - input.bodyFatPct) * 0.06;
    }
    years = clamp(years, 0, 3.5);
    contributions.push({
      key: "bodyfat",
      label: "Body composition",
      years: round1(years),
      detail: `${round1(input.bodyFatPct)}% body fat`,
    });
  }

  const inputsUsed = contributions.length;
  const rawDelta = contributions.reduce((sum, c) => sum + c.years, 0);
  const delta = clamp(rawDelta, -12, 12);
  const bioAge = Math.max(18, round1(age + delta));

  const confidence: BioAgeResult["confidence"] =
    inputsUsed >= 4 ? "high" : inputsUsed >= 2 ? "medium" : "low";

  return {
    bioAge,
    chronological: age,
    delta: round1(bioAge - age),
    contributions,
    confidence,
    inputsUsed,
  };
}
