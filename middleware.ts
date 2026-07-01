import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Edge-safe instance (no adapter) purely to read/verify the session JWT.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/app") && !req.auth) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return Response.redirect(url);
  }
});

export const config = {
  // Protect the app; skip static assets, the auth API, and tracked-link redirects.
  matcher: ["/app/:path*"],
};
