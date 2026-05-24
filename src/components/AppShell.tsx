// The persistent sidebar + main layout.

import type { ReactNode } from "react";

const NAV = [
  { key: "today", label: "Today", href: "/today" },
  { key: "nutrition", label: "Nutrition AI", href: "/nutrition" },
  { key: "activity", label: "Activity", href: "/activity" },
  { key: "profile", label: "Profile", href: "/profile" },
];

export default function AppShell({
  active,
  userName,
  children,
}: {
  active: string;
  userName: string;
  children: ReactNode;
}) {
  const display = userName?.trim() || "You";
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">V</div>
          <div className="name">
            Vityl<span>.</span>
          </div>
        </div>

        <div className="nav-label">Overview</div>
        {NAV.map((n) => (
          <a
            key={n.key}
            className={"nav-item" + (n.key === active ? " active" : "")}
            href={n.href}
          >
            {n.label}
          </a>
        ))}

        <div className="spacer" />
        <div className="userchip">
          <div className="av">{display.charAt(0).toUpperCase()}</div>
          <div className="meta">
            <b>{display}</b>
            <br />
            <a className="logout-link" href="/api/auth/logout">
              Sign out
            </a>
          </div>
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}
