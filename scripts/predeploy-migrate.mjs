// Vercel build hook: apply pending Prisma migrations automatically, but ONLY on
// production builds — so preview deploys never mutate a shared database. Wired
// into `build` (see package.json); a no-op locally and on preview deploys.
//
// Requires DATABASE_URL + DIRECT_URL in the Vercel *Production* environment
// (migrations use the direct, unpooled Neon connection). If the migrate step
// fails, the build fails — the safe outcome: prod keeps serving the old code
// rather than running new code against an un-migrated schema.
import { execSync } from "node:child_process";

const target = process.env.VERCEL_ENV ?? "local";

if (target === "production") {
  console.log("[predeploy] production build — applying Prisma migrations…");
  execSync("prisma migrate deploy", { stdio: "inherit" });
} else {
  console.log(`[predeploy] ${target} build — skipping migrate deploy`);
}
