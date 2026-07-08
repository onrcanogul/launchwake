/**
 * Single source of truth for the legal / trust pages (`/terms`, `/privacy`) and
 * the sign-in consent line. Editing these constants updates every surface at
 * once — no legal string lives in the i18n message catalog (the long-form body
 * is deliberately English-only; see the pages for why).
 *
 * Founder TODO before Stripe live mode: confirm `ENTITY` matches your registered
 * business name and decide whether to name a specific governing-law jurisdiction
 * in `app/[locale]/terms/page.tsx` (it currently uses a jurisdiction-neutral
 * clause). Have a lawyer review both documents.
 */

/** Human-readable "last updated" date shown at the top of each legal page. */
export const LEGAL_LAST_UPDATED = "8 July 2026";

/** The legal/brand name of the operator, as referenced throughout the docs. */
export const LEGAL_ENTITY = "LaunchWake";

/** Mailbox that must be a real, monitored inbox (Stripe disputes land here too). */
export const LEGAL_CONTACT_EMAIL = "hello@launchwake.com";
