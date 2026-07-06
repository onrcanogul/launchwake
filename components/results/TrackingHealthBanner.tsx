import Link from "next/link";

/**
 * Compact warning shown on Results when webhook deliveries are failing in the
 * last 24h. Without it, a founder can read a gap in the numbers as "this channel
 * flopped" when it's really an ingestion problem. Rendered only when there's a
 * real failure so it never cries wolf.
 */
export function TrackingHealthBanner({
  projectId,
  failedCount,
}: {
  projectId: string;
  failedCount: number;
}) {
  if (failedCount <= 0) return null;
  return (
    <div className="track-status bad" role="status" style={{ marginBottom: 16 }}>
      <span className="dot" style={{ background: "var(--bad)" }} aria-hidden />
      <span>
        <b>
          {failedCount} webhook deliver{failedCount === 1 ? "y" : "ies"} failed in
          the last 24h.
        </b>{" "}
        Some numbers below may be delayed by an ingestion issue — not a dead
        channel. Failed deliveries retry automatically.{" "}
        <Link href={`/app/${projectId}/settings`}>Check tracking health</Link>.
      </span>
    </div>
  );
}
