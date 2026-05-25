import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Vityl — Know your biological age",
    template: "%s · Vityl",
  },
  description:
    "Vityl turns your nutrition, activity and sleep into one science-grounded health dashboard — with an estimated biological age that moves with your habits.",
  keywords: [
    "biological age",
    "health dashboard",
    "VO2max",
    "HRV",
    "calorie tracker",
    "nutrition AI",
    "Health Connect",
    "fitness age",
  ],
  authors: [{ name: "Vityl" }],
  openGraph: {
    title: "Vityl — Know your biological age",
    description:
      "One dashboard for nutrition, activity, sleep and an estimated biological age that moves with your habits.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
