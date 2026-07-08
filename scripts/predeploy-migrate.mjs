// Vercel build hook: apply pending Prisma migrations AND re-seed the channel
// catalog automatically, but ONLY on production builds — so preview deploys
// never mutate a shared database. Wired into `build` (see package.json); a
// no-op locally and on preview deploys.
//
// Requires DATABASE_URL + DIRECT_URL in the Vercel *Production* environment
// (migrations use the direct, unpooled Neon connection). If either step fails,
// the build fails — the safe outcome: prod keeps serving the old code rather
// than running new code against an un-migrated schema or a stale catalog.
//
// The catalog seed is a pure, idempotent upsert of the static channel catalog
// (prisma/seed.ts) — it never touches user data — so running it on every prod
// build is safe and means catalog edits (new channels, cost/readiness changes)
// reach prod on deploy without a manual seed step against encrypted Neon creds.
import { execSync } from "node:child_process";

const target = process.env.VERCEL_ENV ?? "local";

if (target === "production") {
  console.log("[predeploy] production build — applying Prisma migrations…");
  execSync("prisma migrate deploy", { stdio: "inherit" });
  console.log("[predeploy] seeding channel catalog (idempotent upsert)…");
  execSync("tsx prisma/seed.ts", { stdio: "inherit" });
} else {
  console.log(`[predeploy] ${target} build — skipping migrate deploy + seed`);
}
