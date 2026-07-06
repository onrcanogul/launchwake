import { redirectLegacyShip, toQuery } from "@/lib/legacyRedirect";

// Legacy ship URL → project-scoped equivalent (308), preserving ?rec=.
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  await redirectLegacyShip(id, "kit", toQuery(await searchParams));
}
