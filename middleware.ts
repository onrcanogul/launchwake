import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { authConfig } from "@/lib/auth.config";
import { routing } from "@/i18n/routing";

// Edge-safe instance (no adapter) purely to read/verify the session JWT.
const { auth } = NextAuth(authConfig);

// Locale detection + prefixing for the public marketing surface. On a first
// visit it redirects by `Accept-Language`; English URLs stay bare (as-needed).
const intlMiddleware = createIntlMiddleware(routing);

// First path segment under /app that is a legacy flat section (not a project id).
// Keeps middleware from mistaking `/app/results` for a project when stamping the
// last-active-project cookie. Must stay in sync with the legacy stub routes.
const RESERVED_APP_SEGMENTS = new Set([
  "channels", "plan", "kit", "launch", "queue", "pitches",
  "radar", "results", "settings", "ships",
]);
// Kept literal (not imported from lib/projects) so no server-only code leaks
// into the edge runtime. Mirror of ACTIVE_PROJECT_COOKIE.
const ACTIVE_PROJECT_COOKIE = "lw_active_project";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // The app is auth-gated and never localized — keep its behaviour untouched.
  if (pathname.startsWith("/app")) {
    if (!req.auth) {
      const url = new URL("/login", req.nextUrl.origin);
      url.searchParams.set("callbackUrl", pathname);
      return Response.redirect(url);
    }
    // Remember the active project (the segment after /app) so bare `/app` and
    // legacy redirects resolve to where the user last was. Untrusted — every
    // reader re-validates ownership — so we can set it without a DB lookup.
    const seg = pathname.split("/")[2];
    if (seg && !RESERVED_APP_SEGMENTS.has(seg)) {
      const res = NextResponse.next();
      res.cookies.set(ACTIVE_PROJECT_COOKIE, seg, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
      return res;
    }
    return;
  }

  // An already-signed-in user has nothing to do on the login page. Send them to
  // the app. This also removes the trap where clicking "Continue with GitHub"
  // while holding a session for a *different* user (e.g. one created via the
  // magic-link email) makes Auth.js reject the sign-in as OAuthAccountNotLinked.
  if (req.auth && (pathname === "/login" || /^\/(en|tr)\/login$/.test(pathname))) {
    return Response.redirect(new URL("/app", req.nextUrl.origin));
  }

  // Everything else the matcher lets through is a marketing route → localize it.
  return intlMiddleware(req);
});

export const config = {
  // Auth-gate the app + run locale routing on the public marketing pages only.
  // APIs, tracked links (/r), reports, invites and onboarding are excluded so
  // they never get a locale prefix or an Accept-Language redirect.
  matcher: [
    "/app/:path*",
    "/",
    "/(en|tr)/:path*",
    "/pricing",
    "/channels/:path*",
    "/tools/:path*",
    "/state-of-developer-launches",
    "/changelog",
    "/terms",
    "/privacy",
    "/login",
  ],
};
