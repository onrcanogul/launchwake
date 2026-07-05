import type { AdapterAccount } from "next-auth/adapters";

/**
 * Columns that actually exist on our Prisma `Account` model. Auth.js spreads the
 * raw OAuth token-endpoint response into the account passed to `linkAccount`
 * ({ ...tokens, provider, type, providerAccountId }); providers such as GitHub
 * include extra fields (e.g. `refresh_token_expires_in`) that have no column, and
 * Prisma rejects unknown args — failing sign-in the moment linking is reached.
 */
const ACCOUNT_COLUMNS = [
  "userId",
  "type",
  "provider",
  "providerAccountId",
  "refresh_token",
  "access_token",
  "expires_at",
  "token_type",
  "scope",
  "id_token",
  "session_state",
] as const satisfies ReadonlyArray<keyof AdapterAccount>;

/**
 * Keep only the fields our `Account` schema can persist, dropping any stray
 * token-response fields so `prisma.account.create` doesn't throw on unknown args.
 */
export function pickAccountColumns(account: AdapterAccount): AdapterAccount {
  const out: Record<string, unknown> = {};
  for (const key of ACCOUNT_COLUMNS) {
    if (account[key] !== undefined) out[key] = account[key];
  }
  return out as AdapterAccount;
}
