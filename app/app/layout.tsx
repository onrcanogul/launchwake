import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getWorkspace, displayName, projectSubtitle } from "@/lib/session";
import { AppShell } from "@/components/shell/AppShell";
import { ToastProvider } from "@/components/ui/toast";

/**
 * Persistent app shell. Rendered once and preserved across navigations, so the
 * sidebar never re-mounts — only the page content (children) swaps, and each
 * route's loading.tsx skeletons the content area while the sidebar stays put.
 */
export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const ws = await getWorkspace();
  if (!ws.project) redirect("/onboarding");

  return (
    <ToastProvider>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <AppShell
        project={{ name: ws.project.name, subtitle: projectSubtitle(ws.project) }}
        user={{ name: displayName(ws.user), plan: ws.user.plan }}
        ships={ws.ships}
        activeShip={ws.activeShip}
        channelsCount={ws.channelsCount}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
