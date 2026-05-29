"use client";

// Calendar picker for the Today screen. Selecting a date navigates to
// /today?date=YYYY-MM-DD. The "back to today" link appears when viewing a
// past date.

import { useRouter } from "next/navigation";

function todayLocal(): string {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function DatePicker({ date }: { date: string }) {
  const router = useRouter();
  const today = todayLocal();
  const isPast = date < today;

  function pick(next: string) {
    if (!next) return;
    if (next === today) {
      router.push("/today");
    } else {
      router.push(`/today?date=${next}`);
    }
  }

  return (
    <div className="date-picker">
      <label className="date-picker-btn" title="Pick a date">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 9h18M8 3v4M16 3v4" />
        </svg>
        <input
          type="date"
          className="date-picker-input"
          value={date}
          max={today}
          onChange={(e) => pick(e.target.value)}
        />
      </label>
      {isPast && (
        <a className="back-to-today" href="/today">
          ← Back to today
        </a>
      )}
    </div>
  );
}
