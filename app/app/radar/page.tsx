import { redirect } from "next/navigation";
import { getWorkspace } from "@/lib/session";
import { getPlanUsage } from "@/lib/billing";
import { listIntentQueries } from "@/lib/intentQueries";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Note } from "@/components/ui/Note";
import { IntentRadar } from "@/components/radar/IntentRadar";

export const metadata = { title: "Intent Radar · LaunchWake" };

export default async function RadarPage() {
  const ws = await getWorkspace();
  if (!ws.project) redirect("/onboarding");

  const usage = await getPlanUsage(ws.accountId);
  const head = (
    <div className="phead">
      <div>
        <h1 className="pg">Intent Radar</h1>
        <div className="psub">
          People on HN &amp; Reddit describing a need {ws.project.name} fills — caught
          while the conversation is still warm.
        </div>
      </div>
      {usage.intentQueryLimit !== 0 && (
        <Badge accent>
          {usage.intentQueryCount}
          {usage.intentQueryLimit !== null ? `/${usage.intentQueryLimit}` : ""} watches
        </Badge>
      )}
    </div>
  );

  // Free plan: Intent Radar is a Pro feature → upsell instead of the tool.
  if (usage.intentQueryLimit === 0) {
    return (
      <>
        {head}
        <EmptyState
          icon="target"
          title="Launches end. Conversations don't."
          message={
            <>
              Every day, people on Hacker News and Reddit ask for a tool exactly like
              yours. Intent Radar catches those posts and hands you a ban-safe draft
              reply to post yourself. It&apos;s part of Pro.
            </>
          }
          actions={
            <Button variant="primary" href="/app/settings" icon="rocket">
              Upgrade to Pro
            </Button>
          }
        />
      </>
    );
  }

  const queries = await listIntentQueries(ws.project.id);
  const canAdd =
    usage.intentQueryLimit === null || usage.intentQueryCount < usage.intentQueryLimit;

  return (
    <>
      {head}
      <Note icon="shield">
        LaunchWake never posts for you. You review each draft, edit it, and reply in
        your own voice — the only ban-safe way to do this.
      </Note>
      <IntentRadar
        queries={queries}
        canAdd={canAdd}
        limit={usage.intentQueryLimit}
        used={usage.intentQueryCount}
        projectName={ws.project.name}
      />
    </>
  );
}
