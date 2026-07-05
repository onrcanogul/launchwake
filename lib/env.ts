import { z } from "zod";

/**
 * Environment validation. Runs once at module load (boot).
 *
 * Philosophy: infra the app cannot run without (DB, auth secret, app url) is
 * REQUIRED and fails fast. Third-party integration keys (Anthropic, GitHub,
 * Stripe, email) are OPTIONAL so the app boots in every environment; each
 * feature guards its own key at the point of use via `requireEnv`.
 */

const OptionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

const schema = z.object({
  // ── Core infra (required) ─────────────────────────────
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // ── Auth providers (optional to boot) ─────────────────
  AUTH_GITHUB_ID: OptionalString,
  AUTH_GITHUB_SECRET: OptionalString,
  EMAIL_SERVER: OptionalString,
  EMAIL_FROM: OptionalString,

  // ── LLM provider selection ────────────────────────────
  // OpenAI is the deployed default (that's the key set in prod); set
  // LLM_PROVIDER=anthropic to switch to Claude when an ANTHROPIC_API_KEY exists.
  LLM_PROVIDER: z.enum(["anthropic", "openai"]).default("openai"),

  // ── Anthropic Claude ──────────────────────────────────
  ANTHROPIC_API_KEY: OptionalString,
  ANTHROPIC_MODEL: z.string().default("claude-opus-4-8"),

  // ── OpenAI (default provider) ─────────────────────────
  OPENAI_API_KEY: OptionalString,
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),

  LLM_MAX_TOKENS_PER_REQUEST: z.coerce.number().int().positive().default(8000),
  LLM_MAX_TOKENS_PER_USER_DAY: z.coerce
    .number()
    .int()
    .positive()
    .default(200000),

  // ── GitHub API ────────────────────────────────────────
  GITHUB_TOKEN: OptionalString,
  // Shared secret for verifying inbound GitHub webhooks (ship auto-detect).
  GITHUB_WEBHOOK_SECRET: OptionalString,

  // ── Stripe (later) ────────────────────────────────────
  STRIPE_SECRET_KEY: OptionalString,
  STRIPE_WEBHOOK_SECRET: OptionalString,

  // ── Inngest (later) ───────────────────────────────────
  INNGEST_EVENT_KEY: OptionalString,
  INNGEST_SIGNING_KEY: OptionalString,

  // ── Cron (reminder delivery) ──────────────────────────
  // Shared secret; the scheduler must send it to /api/cron/reminders.
  CRON_SECRET: OptionalString,

  // ── Product analytics (optional) ──────────────────────
  // PostHog project API key for server-side event capture (activation funnel).
  // When absent, lib/analytics.ts is a no-op — the app runs identically.
  POSTHOG_API_KEY: OptionalString,
  POSTHOG_HOST: z.string().url().default("https://us.i.posthog.com"),

  // ── Error tracking (optional) ─────────────────────────
  // Set to forward captured errors to Sentry. Both are optional so the app boots
  // without them; when absent, Sentry init is skipped and the build plugin is not
  // applied (see next.config.ts). SENTRY_DSN → server/edge; NEXT_PUBLIC_SENTRY_DSN
  // → browser (must be a NEXT_PUBLIC_ var so it's inlined into the client bundle).
  SENTRY_DSN: OptionalString,
  NEXT_PUBLIC_SENTRY_DSN: OptionalString,

  // ── SEO (optional) ────────────────────────────────────
  // Google Search Console verification token → rendered as a <meta> tag.
  GOOGLE_SITE_VERIFICATION: OptionalString,
});

function loadEnv() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment variables:\n${issues}\n\nCheck your .env.local against .env.example.`,
    );
  }
  return parsed.data;
}

export const env = loadEnv();

export type Env = typeof env;

/**
 * Assert an optional integration key is present at the point of use.
 * Gives a clear, feature-scoped error instead of a null-deref later.
 */
export function requireEnv<K extends keyof Env>(
  key: K,
  feature: string,
): NonNullable<Env[K]> {
  const value = env[key];
  if (value === undefined || value === null || value === "") {
    throw new Error(
      `${feature} requires ${String(key)} to be set. Add it to your .env.local.`,
    );
  }
  return value as NonNullable<Env[K]>;
}
