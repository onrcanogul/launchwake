import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import { env } from "./env";

/**
 * Edge-safe auth config: NO database adapter and NO db-touching providers, so it
 * can be imported by middleware (which runs on the edge runtime and cannot load
 * Prisma). The full config in lib/auth.ts extends this with the adapter, email,
 * and the dev demo provider for the Node runtime.
 */
export const authConfig = {
  providers:
    env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET
      ? [
          GitHub({
            clientId: env.AUTH_GITHUB_ID,
            clientSecret: env.AUTH_GITHUB_SECRET,
            // Link the GitHub sign-in to an existing user that shares the same
            // email (e.g. one created earlier via the magic-link flow) instead
            // of failing with OAuthAccountNotLinked. Safe here because GitHub
            // only returns verified primary emails, so ownership is proven —
            // the same guarantee the magic-link flow relies on.
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : [],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.uid && session.user) {
        session.user.id = token.uid as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
