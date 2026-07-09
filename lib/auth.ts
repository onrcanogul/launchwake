import NextAuth, { type NextAuthConfig } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import Nodemailer from "next-auth/providers/nodemailer";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { cookies } from "next/headers";
import { db } from "./db";
import { env } from "./env";
import { authConfig } from "./auth.config";
import { pickAccountColumns } from "./authAccount";
import { ensureDemoUser, DEMO_EMAIL } from "./demo";
import { captureUser, EVENTS } from "./analytics";
import { captureSignupRef } from "./attribution";
import { claimSignupSource, attachHeardVia } from "./signupSource";
import { captureError } from "./observability";

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
  events: {
    // Funnel: a brand-new account (magic link or OAuth), not a repeat sign-in.
    // LaunchWake dogfoods BOTH attribution lanes here: the self-reported source
    // (dark social, from the /login survey) and the tracked lw_ref (link/UTM,
    // for revenue). Each is best-effort and must never block account creation.
    async createUser({ user }) {
      if (!user.id) return;

      // Lane 1 — dark social: claim the "how did you hear about us?" answer
      // stashed at /login and stamp it on the User.
      let heardVia: string | null = null;
      if (user.email) {
        try {
          heardVia = await claimSignupSource(user.email);
          if (heardVia) await attachHeardVia(user.id, heardVia);
        } catch (err) {
          captureError(err, { at: "auth.createUser.heardVia", userId: user.id });
        }
      }

      // Signup event, tagged with the self-reported source when we have one.
      await captureUser(
        user.id,
        EVENTS.signup,
        heardVia ? { heard_via: heardVia } : undefined,
      );

      // Lane 2 — link/revenue: stash the lw_ref this visitor arrived with
      // (dropped as a first-party cookie by /r/{code}) so their eventual payment
      // credits the channel that drove the signup. Cookie read can throw outside
      // a request scope — best-effort, never blocks account creation.
      try {
        const store = await cookies();
        const ref = store.get("lw_ref")?.value;
        if (ref) {
          await captureSignupRef(user.id, ref);
          // One-time, client-readable flag → PixelSignupPing fires
          // launchwakeSignup() exactly once on the post-signup page, recording
          // the SIGNUP event through the pixel (the client-pixel path, not a
          // server-side ingest that would double-count it).
          store.set("lw_signup_ping", "1", {
            maxAge: 600,
            path: "/",
            sameSite: "lax",
          });
        }
      } catch {
        /* no request-scoped cookies (e.g. programmatic user creation) */
      }
    },
  },
});

export { DEMO_EMAIL };
