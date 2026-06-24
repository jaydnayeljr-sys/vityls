"use client";

// Manual sync trigger. Inside the Vityl Android WebView the page sees a
// global `window.VitylApp` object the app injects via a JavascriptInterface;
// tapping the button calls native SyncScheduler.syncNow(). On the desktop site
// (no bridge) the button explains that sync runs from the phone app.

import { useEffect, useState } from "react";

declare global {
  interface Window {
    VitylApp?: { syncNow?: () => void };
  }
}

type State = "idle" | "in-app" | "triggered" | "error";

export default function SyncButton() {
  const [state, setState] = useState<State>("idle");

  useEffect(() => {
    if (typeof window !== "undefined" && window.VitylApp?.syncNow) {
      setState("in-app");
    }
  }, []);

  function handleClick() {
    if (typeof window === "undefined") return;
    if (window.VitylApp?.syncNow) {
      try {
        window.VitylApp.syncNow();
        setState("triggered");
        setTimeout(() => setState("in-app"), 4000);
      } catch {
        setState("error");
      }
    }
  }

  const inApp = state === "in-app" || state === "triggered";

  return (
    <div>
      <button
        type="button"
        className="sync-btn"
        onClick={handleClick}
        disabled={!inApp || state === "triggered"}
      >
        {state === "triggered" ? "Sync started…" : "Sync now"}
      </button>
      {state === "error" && (
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          Sync could not be triggered. Open the Vityl app and try again from
          there.
        </p>
      )}
      {!inApp && state !== "error" && (
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          Manual sync runs from the Vityl Android app. Install it from the
          download section on the home page — the app reads Health Connect and
          pushes your latest data to this dashboard.
        </p>
      )}
    </div>
  );
}
