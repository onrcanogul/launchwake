import { redirectLegacyShip } from "@/lib/legacyRedirect";

// Legacy ship URL → project-scoped equivalent (308). The project is derived
// from the ship itself, scoped to the account (else 404).
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await redirectLegacyShip(id, "plan");
}
