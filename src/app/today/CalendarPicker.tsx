"use client";

// Custom date picker for the Today screen. Tap-friendly month grid, each
// number tinted by that date's bio-age confidence (green = high, amber =
// medium, grey = low, faint = no data). Works the same on desktop and mobile.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  confidenceColor,
  type Confidence,
} from "@/lib/bioage-confidence";
import { dateStr, parseDate as parse, todayLocal } from "@/lib/dates";

const DAY_HEADERS = ["S", "M", "T", "W", "T", "F", "S"];

export default function CalendarPicker({
  date,
  confidenceByDate,
}: {
  date: string;
  confidenceByDate: Record<string, Confidence>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const d = parse(date);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const wrapRef = useRef<HTMLDivElement>(null);
  const today = todayLocal();
  const isPast = date < today;

  useEffect(() => {
    if (!open) return;
    function onDoc(e: Event) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open]);

  function navigate(to: string) {
    setOpen(false);
    if (to === today) {
      router.push("/today");
    } else {
      router.push(`/today?date=${to}`);
    }
  }

  function shiftMonth(delta: number) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  }

  // Build the visible month grid.
  const firstWeekday = cursor.getDay(); // 0..6 (Sun..Sat)
  const daysInMonth = new Date(
    cursor.getFullYear(),
    cursor.getMonth() + 1,
    0,
  ).getDate();

  const cells: Array<{ date: string; day: number } | null> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const d = dateStr(new Date(cursor.getFullYear(), cursor.getMonth(), day));
    cells.push({ date: d, day });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = cursor.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const selectedLabel = parse(date).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="cal-wrap" ref={wrapRef}>
      <button
        type="button"
        className="cal-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
        <span>{selectedLabel}</span>
        <svg
          className="cal-chev"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isPast && (
        <button
          type="button"
          className="back-to-today"
          onClick={() => navigate(today)}
        >
          ← Back to today
        </button>
      )}

      {open && (
        <div className="cal-pop" role="dialog" aria-label="Pick a date">
          <div className="cal-pop-h">
            <button
              type="button"
              className="cal-nav"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
            >
              ‹
            </button>
            <div className="cal-pop-title">{monthLabel}</div>
            <button
              type="button"
              className="cal-nav"
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className="cal-grid cal-grid-h">
            {DAY_HEADERS.map((h, i) => (
              <div key={`h-${i}`} className="cal-day-h">
                {h}
              </div>
            ))}
          </div>

          <div className="cal-grid">
            {cells.map((c, idx) => {
              if (!c) return <div key={`e-${idx}`} className="cal-cell empty" />;
              const conf = confidenceByDate[c.date];
              const isFuture = c.date > today;
              const isSelected = c.date === date;
              const colour = conf ? confidenceColor(conf) : undefined;
              return (
                <button
                  key={c.date}
                  type="button"
                  className={
                    "cal-cell" +
                    (isFuture ? " future" : "") +
                    (isSelected ? " selected" : "") +
                    (conf ? ` conf-${conf}` : "")
                  }
                  onClick={() => !isFuture && navigate(c.date)}
                  disabled={isFuture}
                  style={colour ? { color: colour } : undefined}
                  title={conf ? `${conf} confidence` : "No data"}
                >
                  {c.day}
                </button>
              );
            })}
          </div>

          <div className="cal-pop-foot">
            <button
              type="button"
              className="cal-today-link"
              onClick={() => navigate(today)}
            >
              Jump to today
            </button>
            <div className="cal-legend">
              <span className="cal-dot conf-high" /> high
              <span className="cal-dot conf-medium" /> med
              <span className="cal-dot conf-low" /> low
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
