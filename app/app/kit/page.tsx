import { redirectLegacySection, toQuery } from "@/lib/legacyRedirect";

// Legacy flat path → project-scoped equivalent (308), preserving ?rec=.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await redirectLegacySection("kit", toQuery(await searchParams));
}
