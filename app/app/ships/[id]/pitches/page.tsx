import { redirectLegacyShip } from "@/lib/legacyRedirect";

// Legacy ship URL → project-scoped equivalent (308).
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await redirectLegacyShip(id, "pitches");
}
