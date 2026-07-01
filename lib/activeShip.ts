import { cookies } from "next/headers";

/**
 * The globally "active" ship — the one the ship-specific screens (Where to post,
 * Launch kit) operate on. Persisted in a cookie so it survives reloads and is
 * readable server-side. Project-wide screens (Feed, Channels, Results) ignore it.
 */
export const ACTIVE_SHIP_COOKIE = "lw_active_ship";

export async function readActiveShipId(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACTIVE_SHIP_COOKIE)?.value ?? null;
}
