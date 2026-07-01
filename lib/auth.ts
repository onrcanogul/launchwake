import NextAuth, { type NextAuthConfig } from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "./db";
import { env } from "./env";
import { authConfig } from "./auth.config";
import { ensureDemoUser, DEMO_EMAIL } from "./demo";

/**
 * Full (Node runtime) auth. Extends the edge-safe base with the Prisma adapter,
 * email magic-link, and the dev-only demo credential. GitHub already comes from
 * the base config.
 */
const providers: NextAuthConfig["providers"] = [...authConfig.providers];

if (env.EMAIL_SERVER && env.EMAIL_FROM) {
  providers.push(
    Nodemailer({
      server: env.EMAIL_SERVER,
      from: env.EMAIL_FROM,
    }),
  );
}

if (env.NODE_ENV !== "production") {
  providers.push(
    Credentials({
      id: "demo",
      name: "Demo",
      credentials: {},
      async authorize() {
        const user = await ensureDemoUser();
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  providers,
});

export { DEMO_EMAIL };
