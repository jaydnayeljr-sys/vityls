"use client";

// Sign-in / sign-up form. Used on the landing page (login) and /signup.

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isSignup = mode === "signup";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const endpoint = isSignup ? "/api/auth/signup" : "/api/auth/login";
      const body = isSignup ? { name, email, password } : { email, password };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong.");
        setBusy(false);
        return;
      }
      router.push("/today");
      router.refresh();
    } catch {
      setError("Network error — please try again.");
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {error && <div className="banner bad">{error}</div>}

      {isSignup && (
        <div className="field">
          <label>Name</label>
          <input
            className="inp"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
          />
        </div>
      )}

      <div className="field">
        <label>Email</label>
        <input
          className="inp"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
        />
      </div>

      <div className="field">
        <label>Password</label>
        <input
          className="inp"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={isSignup ? "At least 8 characters" : "Your password"}
          autoComplete={isSignup ? "new-password" : "current-password"}
        />
      </div>

      <button
        className="save-btn"
        type="submit"
        disabled={busy || !email || !password || (isSignup && !name)}
      >
        {busy
          ? "Please wait…"
          : isSignup
            ? "Create my account"
            : "Sign in"}
      </button>

      <p className="auth-switch">
        {isSignup ? (
          <>
            Already have an account? <a href="/login">Sign in</a>
          </>
        ) : (
          <>
            New to Vityl? <a href="/signup">Create a free account</a>
          </>
        )}
      </p>
    </form>
  );
}
