/**
 * Framework-agnostic app-route helpers for the `/app/[project]/…` layout. No
 * server, DB, or React imports — so the client shell and the unit tests can both
 * use them. IO (cookies, DB) lives in lib/projects.ts and calls these.
 */

/** The path after the `/app/[project]` prefix: "/results", "/ships/x/plan", or "". */
export function sectionRest(pathname: string): string {
  return pathname.replace(/^\/app\/[^/]+/, "");
}

const WIDE_SECTIONS =
  /^\/(channels|radar|results|settings|plan|kit|launch|queue|pitches)(\/|$)/;
const DEEP_SHIP_SECTION = /^\/ships\/[^/]+\/(plan|kit|launch|queue|pitches)/;

/**
 * Where to land when switching from the current section (`rest`) to `otherId`:
 * keep a project-wide section or the new-ship form; map a ship-scoped deep link
 * down to its bare section (the "select a ship" page in the target project);
 * otherwise the target project's feed. Ship ids never carry across projects, so
 * this only preserves what actually exists in the target.
 */
export function switchTarget(otherId: string, rest: string): string {
  const base = `/app/${otherId}`;
  if (rest === "") return base;
  if (rest.startsWith("/ships/new")) return `${base}/ships/new`;
  const deep = rest.match(DEEP_SHIP_SECTION);
  if (deep) return `${base}/${deep[1]}`;
  const wide = rest.match(WIDE_SECTIONS);
  if (wide) return `${base}/${wide[1]}`;
  return base;
}

/**
 * Pure "which project should we land on" decision, shared by bare `/app` and the
 * legacy redirects: the requested id if owned, else the cookie's last-active if
 * owned, else the oldest project (`orderedIds[0]`). Null when there are none.
 */
export function pickActiveProjectId(
  orderedIds: string[],
  requested: string | null | undefined,
  cookieId: string | null,
): string | null {
  if (orderedIds.length === 0) return null;
  const owned = new Set(orderedIds);
  if (requested && owned.has(requested)) return requested;
  if (cookieId && owned.has(cookieId)) return cookieId;
  return orderedIds[0];
}

/** Build a `?a=b` suffix from resolved searchParams (empty string when none). */
export function toQuery(
  sp: Record<string, string | string[] | undefined>,
): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) v.forEach((x) => usp.append(k, x));
    else if (v !== undefined) usp.set(k, v);
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}
