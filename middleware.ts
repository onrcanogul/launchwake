import NextAuth from "next-auth";
import createIntlMiddleware from "next-intl/middleware";
import { authConfig } from "@/lib/auth.config";
import { routing } from "@/i18n/routing";

// Edge-safe instance (no adapter) purely to read/verify the session JWT.
const { auth } = NextAuth(authConfig);

// Locale detection + prefixing for the public marketing surface. On a first
// visit it redirects by `Accept-Language`; English URLs stay bare (as-needed).
const intlMiddleware = createIntlMiddleware(routing);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // The app is auth-gated and never localized — keep its behaviour untouched.
  if (pathname.startsWith("/app")) {
    if (!req.auth) {
      const url = new URL("/login", req.nextUrl.origin);
      url.searchParams.set("callbackUrl", pathname);
      return Response.redirect(url);
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
    "/login",
  ],
};
