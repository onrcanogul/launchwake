import { redirectLegacySection } from "@/lib/legacyRedirect";

// Legacy flat path → project-scoped equivalent (308).
export default async function Page() {
  await redirectLegacySection("pitches");
}
