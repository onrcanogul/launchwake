import { db } from "./db";

/**
 * The hard-coded example product used to demo Milestone 1 end-to-end.
 * Hookline = a webhook testing / debugging tool for developers.
 */
export const DEMO_EMAIL = "demo@launchwake.dev";

export const HOOKLINE = {
  name: "Hookline",
  subtitle: "webhook testing tool",
  description:
    "Hookline is a webhook testing and debugging tool for developers. It captures inbound webhooks, lets you inspect and replay any event to localhost, and alerts you the moment an endpoint starts failing in production. Audience: backend/full-stack developers and indie founders building on Stripe, GitHub, Twilio and other webhook-heavy APIs.",
  url: "https://hookline.dev",
  githubRepo: "hookline/api",
};

/** Upsert the demo user and ensure their Hookline project exists. Idempotent. */
export async function ensureDemoUser() {
  const user = await db.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      email: DEMO_EMAIL,
      name: "Onurcan",
      plan: "FREE",
    },
  });

  const existing = await db.project.findFirst({
    where: { userId: user.id, name: HOOKLINE.name },
  });
  if (!existing) {
    await db.project.create({
      data: {
        userId: user.id,
        name: HOOKLINE.name,
        description: HOOKLINE.description,
        url: HOOKLINE.url,
        githubRepo: HOOKLINE.githubRepo,
      },
    });
  }

  return user;
}
