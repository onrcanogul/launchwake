import NextAuth, { type NextAuthConfig } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import Nodemailer from "next-auth/providers/nodemailer";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "./db";
import { env } from "./env";
import { authConfig } from "./auth.config";
import { pickAccountColumns } from "./authAccount";
import { ensureDemoUser, DEMO_EMAIL } from "./demo";

/**
 * Wrap the Prisma adapter so `linkAccount` only writes columns our `Account`
 * model has. See `pickAccountColumns` for why this is necessary (GitHub returns
 * stray token fields that would otherwise make Prisma throw on unknown args).
 */
function scopedPrismaAdapter(): Adapter {
  const base = PrismaAdapter(db);
  return {
    ...base,
    linkAccount: (account) => base.linkAccount!(pickAccountColumns(account)),
  };
}

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
  adapter: scopedPrismaAdapter(),
  providers,
});

export { DEMO_EMAIL };
