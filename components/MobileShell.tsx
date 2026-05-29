"use client";

// The mobile shell: a swipeable carousel of the four screens with a bottom
// tab bar. Each screen is a server component rendered on the server and passed
// in as `node`. Used by the /m route, which the Android app loads in a
// WebView. Tap a tab or swipe left/right to move between screens.

import { useRef, useState, type ReactNode, type TouchEvent } from "react";

export interface MobileScreen {
  key: string;
  label: string;
  node: ReactNode;
}

const ICONS: Record<string, ReactNode> = {
  today: (
    <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
  ),
  activity: <path d="M3 12h4l3 8 4-16 3 8h4" />,
  nutrition: (
    <path d="M7 3v8a3 3 0 0 0 6 0V3M10 3v18M17 3c-1.5 1-2.5 3-2.5 6 0 2 1 3 2.5 3s2.5-1 2.5-3c0-3-1-5-2.5-6zM17 12v9" />
  ),
  profile: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.5-6 8-6s8 2 8 6" />,
};

function TabIcon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[name]}
    </svg>
  );
}

export default function MobileShell({
  screens,
}: {
  screens: MobileScreen[];
}) {
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; axis: "h" | "v" | null }>({
    x: 0,
    y: 0,
    axis: null,
  });
  const viewportRef = useRef<HTMLDivElement>(null);

  const count = screens.length;
  const step = 100 / count; // % of the track per screen

  function onTouchStart(e: TouchEvent) {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY, axis: null };
  }

  function onTouchMove(e: TouchEvent) {
    const t = e.touches[0];
    const dx = t.clientX - start.current.x;
    const dy = t.clientY - start.current.y;

    if (start.current.axis === null) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        start.current.axis = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      }
    }
    if (start.current.axis !== "h") return;

    // Add resistance when dragging past the first or last screen.
    let d = dx;
    if ((index === 0 && d > 0) || (index === count - 1 && d < 0)) d /= 3.2;
    setDragging(true);
    setDrag(d);
  }

  function onTouchEnd() {
    if (start.current.axis === "h") {
      const w = viewportRef.current?.clientWidth ?? 1;
      const threshold = w * 0.2;
      if (drag < -threshold && index < count - 1) setIndex(index + 1);
      else if (drag > threshold && index > 0) setIndex(index - 1);
    }
    start.current.axis = null;
    setDragging(false);
    setDrag(0);
  }

  return (
    <div className="m-root">
      <header className="m-header">
        <div className="brand">
          <div className="mark">V</div>
          <div className="name">
            Vityl<span>.</span>
          </div>
        </div>
        <a className="m-signout" href="/api/auth/logout">
          Sign out
        </a>
      </header>

      <div
        className="m-viewport"
        ref={viewportRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <div
          className="m-track"
          style={{
            width: `${count * 100}%`,
            transform: `translateX(calc(${-index * step}% + ${drag}px))`,
            transition: dragging
              ? "none"
              : "transform .3s cubic-bezier(.22,.61,.36,1)",
          }}
        >
          {screens.map((s) => (
            <section
              className="m-panel"
              key={s.key}
              style={{ width: `${step}%` }}
            >
              {s.node}
            </section>
          ))}
        </div>
      </div>

      <nav className="m-nav">
        {screens.map((s, i) => (
          <button
            key={s.key}
            type="button"
            className={"m-tab" + (i === index ? " active" : "")}
            onClick={() => setIndex(i)}
          >
            <TabIcon name={s.key} />
            <span>{s.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
