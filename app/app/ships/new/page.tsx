import { redirect } from "next/navigation";
import { getWorkspace } from "@/lib/session";
import { NewShipForm } from "@/components/ship/NewShipForm";
import { Note } from "@/components/ui/Note";

export default async function NewShipPage() {
  const ws = await getWorkspace();
  if (!ws.project) redirect("/onboarding");

  return (
    <>
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
    </>
  );
}
