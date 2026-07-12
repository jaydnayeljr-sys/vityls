// Instant feedback for the mobile carousel while its screens are fetched —
// shown by Next.js the moment navigation (e.g. a calendar date pick) starts.

export default function Loading() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        minHeight: "80vh",
        color: "var(--text-3, #888)",
        fontSize: 13,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          border: "3px solid var(--border, #333)",
          borderTopColor: "var(--green, #4ade80)",
          animation: "vityl-spin 0.8s linear infinite",
        }}
      />
      Loading…
      <style>{`@keyframes vityl-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
