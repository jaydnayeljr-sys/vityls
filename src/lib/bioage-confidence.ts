// Shared bio-age confidence helpers — usable from both server modules and
// client components (no "server-only" guard).

export type Confidence = "high" | "medium" | "low";

export function confidenceFromInputs(n: number): Confidence {
  if (n >= 4) return "high";
  if (n >= 2) return "medium";
  return "low";
}

export function confidenceColor(c: Confidence): string {
  if (c === "high") return "var(--green)";
  if (c === "medium") return "var(--amber)";
  return "var(--text-3)";
}

export function confidenceLabel(c: Confidence): string {
  if (c === "high") return "High confidence";
  if (c === "medium") return "Medium confidence";
  return "Low confidence";
}
