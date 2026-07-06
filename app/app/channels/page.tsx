import { redirectLegacySection } from "@/lib/legacyRedirect";

// Legacy flat path → project-scoped equivalent (308). Static segment, so Next
// matches this ahead of the `[project]` dynamic route.
export default async function Page() {
  await redirectLegacySection("channels");
}
