import { redirectLegacySection, toQuery } from "@/lib/legacyRedirect";

// Legacy flat path → project-scoped equivalent (308). Preserves query so the
// Stripe checkout return (?upgraded=1) still triggers the "upgraded" banner.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await redirectLegacySection("settings", toQuery(await searchParams));
}
