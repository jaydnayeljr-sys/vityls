// Renders the cached end-of-day AI review on the Today screen. If no review
// exists yet (e.g. yesterday had no synced data, or the AI is not configured)
// the component renders nothing.

import type { DailyReview } from "@/lib/review-store";

function formatReviewDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function DailyReviewCard({ review }: { review: DailyReview }) {
  const delta = review.bioAgeDelta;
  let tag: { text: string; cls: string } | null = null;
  if (delta != null) {
    if (delta < -0.05) {
      tag = {
        text: `bio age ↓ ${Math.abs(delta).toFixed(2)} yrs`,
        cls: "good",
      };
    } else if (delta > 0.05) {
      tag = { text: `bio age ↑ ${delta.toFixed(2)} yrs`, cls: "bad" };
    } else {
      tag = { text: "bio age held steady", cls: "even" };
    }
  }

  return (
    <div className="card review-card">
      <div className="card-h">
        <div className="t">Yesterday&apos;s Review</div>
        <div className="x">
          {formatReviewDate(review.date)} · written by Vityl Coach
          {tag && (
            <span className={`review-tag ${tag.cls}`}>{tag.text}</span>
          )}
        </div>
      </div>

      <p className="review-summary">{review.summary}</p>

      <div className="review-cols">
        {review.wins.length > 0 && (
          <div className="review-col">
            <div className="review-h good">What you did well</div>
            <ul>
              {review.wins.map((w, i) => (
                <li key={`w${i}`}>{w}</li>
              ))}
            </ul>
          </div>
        )}
        {review.improvements.length > 0 && (
          <div className="review-col">
            <div className="review-h warn">To work on today</div>
            <ul>
              {review.improvements.map((w, i) => (
                <li key={`i${i}`}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
