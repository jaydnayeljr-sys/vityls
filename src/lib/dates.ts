// Shared local-calendar-date helpers (YYYY-MM-DD strings, local timezone).
// No "server-only" guard, so server modules and client components can both
// use them. All app dates are *local* calendar dates — never UTC — so a meal
// logged at 11 pm lands on the right day.

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Formats a Date as a local YYYY-MM-DD string. */
export function dateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today's local calendar date (YYYY-MM-DD). */
export function todayLocal(): string {
  return dateStr(new Date());
}

/** Parses a YYYY-MM-DD string into a local-midnight Date. */
export function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** The date `delta` days after (or before, if negative) the given date. */
export function addDays(date: string, delta: number): string {
  const d = parseDate(date);
  d.setDate(d.getDate() + delta);
  return dateStr(d);
}

/** The n calendar dates ending on `endDate` (inclusive), oldest first. */
export function nDatesEnding(n: number, endDate: string): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(endDate, -i));
  return out;
}

/** The last n local calendar dates, oldest first, including today. */
export function lastNDates(n: number): string[] {
  return nDatesEnding(n, todayLocal());
}
