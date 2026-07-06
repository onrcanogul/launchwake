import type { ReactNode } from "react";
import { getWorkspace, displayName, projectSubtitle } from "@/lib/session";
import { AppShell } from "@/components/shell/AppShell";
import { ToastProvider } from "@/components/ui/toast";

/**
 * Persistent project-scoped app shell. Rendered once per project and preserved
 * across navigations within it, so the sidebar never re-mounts — only the page
 * content (children) swaps, and each route's loading.tsx skeletons the content
 * area while the sidebar stays put. `getWorkspace` 404s when the route's project
 * isn't owned by the signed-in account.
 */
export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ project: string }>;
}) {
  const { project } = await params;
  const ws = await getWorkspace(project);

  return (
    <ToastProvider>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <AppShell
        projectId={ws.project.id}
        project={{ name: ws.project.name, subtitle: projectSubtitle(ws.project) }}
        projects={ws.projects}
        user={{ name: displayName(ws.user), plan: ws.plan }}
        ships={ws.ships}
        activeShip={ws.activeShip}
        channelsCount={ws.channelsCount}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
