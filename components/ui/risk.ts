export type BanRiskValue = "LOW" | "MEDIUM" | "HIGH";

/** Ban-risk dot colours (Low=ok, Medium=warn, High=bad) + label. */
export const RISK: Record<BanRiskValue, { color: string; label: string }> = {
  LOW: { color: "var(--ok)", label: "Low" },
  MEDIUM: { color: "var(--warn)", label: "Medium" },
  HIGH: { color: "var(--bad)", label: "High" },
};
