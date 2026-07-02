import { randomBytes } from "crypto";
import { db } from "./db";
import { env } from "./env";
import { getResultsRollup, type RoiSummary } from "./attribution";

/**
 * White-label client report (Team tier). An agency sets its brand once, flips a
 * project's report link on, and sends the client a stable /report/c/{token} page
 * that carries the agency's logo, name and accent — not LaunchWake's. LaunchWake
 * becomes the invisible engine behind "our report". Gated to Team: if the owner
 * isn't on Team, the link returns nothing.
 *
 * Pure sanitizers/formatters are unit-tested; loaders are thin DB glue.
 */

export const LAUNCHWAKE_ACCENT = "#3ecfb6";

/** Unguessable, URL-safe token. */
export function newReportToken(): string {
  return randomBytes(9).toString("base64url");
}

export function clientReportUrl(token: string): string {
  return `${env.APP_URL.replace(/\/$/, "")}/report/c/${token}`;
}

/** Validate a hex accent; returns normalized "#rrggbb" or null. Pure. */
export function sanitizeAccent(input: string | null | undefined): string | null {
  if (!input) return null;
  const m = input.trim().match(/^#?([0-9a-fA-F]{6})$/);
  return m ? `#${m[1].toLowerCase()}` : null;
}

/**
 * Only allow an https URL or an inline data:image — anything else (javascript:,
 * http:, etc.) is rejected so a logo field can't become an injection vector. Pure.
 */
export function sanitizeLogoUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = input.trim();
  if (s.length <= 2000 && /^https:\/\/[^\s"'<>]+$/i.test(s)) return s;
  if (
    s.length <= 500_000 &&
    /^data:image\/(png|jpe?g|svg\+xml|webp|gif);base64,[a-z0-9+/=]+$/i.test(s)
  ) {
    return s;
  }
  return null;
}

export type BrandView = { agencyName: string; logoUrl: string | null; accentColor: string };

/** Brand for display, accent validated + defaulted. Pure. */
export function brandView(
  brand: { agencyName: string; logoUrl: string | null; accentColor: string | null } | null,
): BrandView | null {
  if (!brand) return null;
  return {
    agencyName: brand.agencyName,
    logoUrl: sanitizeLogoUrl(brand.logoUrl),
    accentColor: sanitizeAccent(brand.accentColor) ?? LAUNCHWAKE_ACCENT,
  };
}

export type ClientReport = {
  /** null → report enabled but no brand configured yet (neutral header). */
  brand: BrandView | null;
  project: { name: string; url: string | null };
  generatedAt: Date;
  totals: {
    clicks: number;
    signups: number;
    conversion: number;
    revenueCents: number;
    mrrCents: number;
    currency: string;
  };
  perChannel: { name: string; clicks: number; signups: number; revenueCents: number }[];
  roi: RoiSummary;
  topRevenueChannel: { name: string; revenueCents: number } | null;
};

/**
 * Load a white-label client report by token, or null. Gated to Team: the link
 * only resolves while the owning account is on the Team plan and the report is
 * enabled — downgrading quietly turns the client link off.
 */
export async function getClientReport(
  token: string,
  now: Date = new Date(),
): Promise<ClientReport | null> {
  const project = await db.project.findFirst({
    where: { reportToken: token, reportEnabled: true },
    include: { user: { select: { plan: true, brand: true } } },
  });
  if (!project || project.user.plan !== "TEAM") return null;

  const rollup = await getResultsRollup(project.id);
  return {
    brand: brandView(project.user.brand),
    project: { name: project.name, url: project.url },
    generatedAt: now,
    totals: {
      clicks: rollup.totalClicks,
      signups: rollup.totalSignups,
      conversion: rollup.conversion,
      revenueCents: rollup.totalRevenueCents,
      mrrCents: rollup.mrrCents,
      currency: rollup.currency,
    },
    perChannel: rollup.perChannel.map((c) => ({
      name: c.channelName,
      clicks: c.clicks,
      signups: c.signups,
      revenueCents: c.revenueCents,
    })),
    roi: rollup.roi,
    topRevenueChannel: rollup.topRevenueChannel,
  };
}

// ── Settings (owner-scoped) ────────────────────────────────
export async function getBrand(accountId: string) {
  return db.brand.findUnique({ where: { userId: accountId } });
}

export type BrandInput = { agencyName: string; logoUrl?: string | null; accentColor?: string | null };

/** Create/update the agency brand. Sanitizes logo + accent. */
export async function saveBrand(accountId: string, input: BrandInput): Promise<void> {
  const agencyName = input.agencyName.trim().slice(0, 80);
  if (!agencyName) throw new Error("Agency name is required.");
  const logoUrl = sanitizeLogoUrl(input.logoUrl);
  const accentColor = sanitizeAccent(input.accentColor);
  await db.brand.upsert({
    where: { userId: accountId },
    update: { agencyName, logoUrl, accentColor },
    create: { userId: accountId, agencyName, logoUrl, accentColor },
  });
}

/**
 * Enable/disable a project's client report. Mints a stable token the first time
 * it's enabled and keeps it thereafter (so a paused link resumes unchanged).
 */
export async function setReportEnabled(
  projectId: string,
  accountId: string,
  enabled: boolean,
): Promise<{ token: string | null }> {
  const project = await db.project.findFirst({ where: { id: projectId, userId: accountId } });
  if (!project) throw new Error("Project not found.");
  const token = project.reportToken ?? (enabled ? newReportToken() : null);
  await db.project.update({
    where: { id: projectId },
    data: { reportEnabled: enabled, reportToken: token },
  });
  return { token };
}
