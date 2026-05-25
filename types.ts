// Account creation page.

import type { Metadata } from "next";
import AuthForm from "@/app/login/AuthForm";

export const metadata: Metadata = {
  title: "Create your free account",
  description:
    "Create a free Vityl account and start tracking your biological age, nutrition, activity and sleep in one science-grounded dashboard.",
  alternates: { canonical: "/signup" },
};

export default function SignupPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand" style={{ padding: "0 0 6px" }}>
          <div className="mark">V</div>
          <div className="name">
            Vityl<span>.</span>
          </div>
        </div>
        <h1>Create your account</h1>
        <p className="auth-sub">
          Start tracking your biological age in minutes — it&apos;s free.
        </p>
        <AuthForm mode="signup" />
      </div>
    </div>
  );
}
