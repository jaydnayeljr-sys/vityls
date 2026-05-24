// The persistent sidebar + main layout. Every destination is now live.

import type { ReactNode } from "react";

const NAV = [
  { key: "today", label: "Today", soon: false, href: "/today" },
  { key: "nutrition", label: "Nutrition AI", soon: false, href: "/nutrition" },
  { key: "activity", label: "Activity", soon: false, href: "/activity" },
  { key: "profile", label: "Profile", soon: false, href: "/profile" },
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
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">V</div>
          <div className="name">
            Vitals<span>.</span>
          </div>
        </div>

        <div className="nav-label">Overview</div>
        {NAV.map((n) => {
          const cls =
            "nav-item" +
            (n.key === active ? " active" : "") +
            (n.soon ? " soon" : "");
          if (n.soon) {
            return (
              <div key={n.key} className={cls}>
                {n.label}
                <span className="tag">Soon</span>
              </div>
            );
          }
          return (
            <a key={n.key} className={cls} href={n.href}>
              {n.label}
            </a>
          );
        })}

        <div className="spacer" />
        <div className="userchip">
          <div className="av">{(userName || "J").charAt(0).toUpperCase()}</div>
          <div className="meta">
            <b>{userName || "You"}</b>
            <br />
            <small>Vitals prototype</small>
          </div>
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}
