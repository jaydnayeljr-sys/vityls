// Public landing + sign-in page. This is the SEO entry point for Vityl.

import type { Metadata } from "next";
import AuthForm from "./AuthForm";

export const metadata: Metadata = {
  title: "Sign in — know your biological age",
  description:
    "Sign in to Vityl, the science-grounded health dashboard that turns your nutrition, activity and sleep into an estimated biological age. Create a free account in minutes.",
  alternates: { canonical: "/login" },
  openGraph: {
    title: "Vityl — know your biological age",
    description:
      "Nutrition, activity, sleep and an estimated biological age, in one dashboard.",
    type: "website",
  },
};

const FEATURES = [
  {
    title: "Your biological age",
    body: "Vityl estimates how old your body really is from your VO2max, resting heart rate, HRV, sleep and body composition — and shows exactly which habits are moving the number.",
  },
  {
    title: "AI nutrition tracking",
    body: "Describe a meal in plain language. The assistant works out calories, macros and micronutrients from trusted food databases, and verifies branded products online.",
  },
  {
    title: "Automatic activity sync",
    body: "The companion app streams steps, calories, heart rate, HRV and sleep from Health Connect, so your dashboard stays current without any manual logging.",
  },
  {
    title: "One clear picture",
    body: "Calorie balance, macros, sleep quality and a biological-age trend — every signal that matters, in a single science-grounded view you can check each morning.",
  },
];

export default function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="brand" style={{ padding: 0 }}>
          <div className="mark">V</div>
          <div className="name">
            Vityl<span>.</span>
          </div>
        </div>
        <a className="nav-cta" href="#signin">
          Sign in
        </a>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <h1>Know your biological age. Then change it.</h1>
          <p>
            Vityl is a science-grounded health dashboard. It brings your
            nutrition, activity and sleep together and turns them into one
            number that actually matters — an estimate of how old your body is,
            not how old your birthday says you are.
          </p>
          <ul className="hero-points">
            <li>An estimated biological age that moves with your habits</li>
            <li>AI-powered calorie, macro and micronutrient tracking</li>
            <li>Automatic step, heart-rate, HRV and sleep sync</li>
          </ul>
        </div>

        <div className="hero-auth" id="signin">
          <div className="auth-card">
            <h2>Sign in to Vityl</h2>
            <p className="auth-sub">
              Open your dashboard and pick up where you left off.
            </p>
            <AuthForm mode="login" />
          </div>
        </div>
      </section>

      <section className="features">
        <h2>One dashboard for your whole health picture</h2>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <article className="feature" key={f.title}>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="download" id="download">
        <h2>Get the Vityl mobile app</h2>
        <p>
          The Vityl Android app keeps your dashboard in sync and puts your
          whole health picture in your pocket. Sign in once — it reads steps,
          heart rate, HRV and sleep from Health Connect and streams them to
          your account automatically.
        </p>
        <div className="download-card">
          <div className="download-meta">
            <b>Vityl for Android</b>
            <span>APK · Android 9.0+ · Health Connect required</span>
          </div>
          <a className="download-btn" href="/vityl.apk" download>
            Download APK
          </a>
        </div>
        <p className="download-note">
          After the download finishes, open the file and allow your browser to
          install apps when Android asks. Then sign in with your Vityl account.
        </p>
      </section>

      <footer className="landing-foot">
        <span>
          Vityl<span className="dot">.</span>
        </span>
        <span>Your biological age, tracked.</span>
      </footer>
    </div>
  );
}
