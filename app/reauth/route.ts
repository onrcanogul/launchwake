import { signOut } from "@/lib/auth";

// Full (Node) runtime — signOut pulls in the Prisma-backed auth, which cannot
// run on the edge. Also keeps this route off any accidental edge bundling.
export const runtime = "nodejs";

/**
 * Reap a "ghost session": a still-valid JWT session cookie that points at a user
 * who no longer exists in the database (e.g. after a DB reset/wipe). Such a user
 * is trapped — the app pages redirect them to /login, but middleware sees the
 * intact JWT and bounces every /login request back to /app, an endless loop.
 *
 * The only escape is to clear the stale cookie, which requires a Route Handler
 * (cookies can't be mutated during an RSC render). So the server-side guards
 * redirect here instead of straight to /login: we sign out (deleting the session
 * cookie), then land on a genuinely unauthenticated /login. `/reauth` is not in
 * the middleware matcher, so nothing interferes with the sign-out.
 */
export async function GET() {
  await signOut({ redirectTo: "/login" });
}
