import { PrismaClient } from "@prisma/client";
import { assembleCatalog } from "./channels";

const db = new PrismaClient();

/**
 * Seed the global channel catalog — the intelligence asset.
 *
 * These are REAL communities with REAL posting norms. The LLM may only rank and
 * justify channels from this set; it must never invent communities (inventing a
 * fake subreddit is how users get banned). Tags drive candidate matching in
 * lib/channels.ts before the LLM ranks.
 *
 * The catalog is assembled from category files under `prisma/channels/` and
 * validated (schema + duplicate-slug check) before anything touches the DB. To
 * grow it, edit a category file and re-run `pnpm db:seed`.
 */
async function main() {
  const { channels, issues, byCategory } = assembleCatalog();

  if (issues.length > 0) {
    console.error(`Refusing to seed — ${issues.length} catalog issue(s):`);
    for (const i of issues) console.error(`  • [${i.kind}] ${i.slug}: ${i.detail}`);
    process.exit(1);
  }

  for (const c of channels) {
    await db.channel.upsert({
      where: { slug: c.slug },
      update: {
        name: c.name,
        platform: c.platform,
        url: c.url,
        audienceDesc: c.audienceDesc,
        rules: c.rules,
        defaultBanRisk: c.defaultBanRisk,
        bestTime: c.bestTime,
        tags: c.tags,
      },
      create: c,
    });
  }

  const total = await db.channel.count();
  const byCat = Object.entries(byCategory)
    .map(([k, n]) => `${k}=${n}`)
    .join(", ");
  console.log(`Seeded channel catalog — ${channels.length} valid entries (${byCat}).`);
  console.log(`Channel table now holds ${total} channels.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
