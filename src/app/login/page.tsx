"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Login failed.");
        setBusy(false);
        return;
      }
      router.push("/profile");
      router.refresh();
    } catch {
      setError("Network error.");
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="brand" style={{ padding: "0 0 18px" }}>
          <div className="mark">V</div>
          <div className="name">
            Vitals<span>.</span>
          </div>
        </div>
        <h1>Welcome back</h1>
        <p>Enter your passphrase to open your dashboard.</p>
        {error && (
          <div className="banner bad" style={{ marginBottom: 14 }}>
            {error}
          </div>
        )}
        <div className="field">
          <label>Passphrase</label>
          <input
            className="inp"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your passphrase"
            autoFocus
          />
        </div>
        <button className="save-btn" type="submit" disabled={busy || !password}>
          {busy ? "Checking…" : "Enter"}
        </button>
      </form>
    </div>
  );
}
