import { redirect } from "next/navigation";
import { getWorkspace, displayName } from "@/lib/session";
import { AppShell } from "@/components/shell/AppShell";
import { NewShipForm } from "@/components/ship/NewShipForm";
import { Note } from "@/components/ui/Note";
import { HOOKLINE } from "@/lib/demo";

export default async function NewShipPage() {
  const ws = await getWorkspace();
  if (!ws.project) redirect("/onboarding");

  return (
    <AppShell
      project={{ name: ws.project.name, subtitle: HOOKLINE.subtitle }}
      user={{ name: displayName(ws.user), plan: ws.user.plan }}
      shipNav={ws.latestShip}
      channelsCount={ws.channelsCount}
      crumb="New ship"
    >
      <div className="phead">
        <div>
          <h1 className="pg">New ship</h1>
          <div className="psub">
            Shipped something worth talking about? Drop it in and get a
            distribution plan. Nothing is posted automatically.
          </div>
        </div>
      </div>

      <NewShipForm githubRepo={ws.project.githubRepo} />

      <Note>
        LaunchWake never posts for you or uses bot accounts. You get the plan and
        the drafts — you press publish.
      </Note>
    </AppShell>
  );
}
