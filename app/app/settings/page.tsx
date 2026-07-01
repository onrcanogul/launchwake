import { redirect } from "next/navigation";
import { getWorkspace } from "@/lib/session";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { TrackingSetup } from "@/components/settings/TrackingSetup";
import { BillingPanel } from "@/components/settings/BillingPanel";
import { getPlanUsage, billingConfigured } from "@/lib/billing";
import { env } from "@/lib/env";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const ws = await getWorkspace();
  if (!ws.project) redirect("/onboarding");

  const { upgraded } = await searchParams;
  const usage = await getPlanUsage(ws.user.id);
  const p = ws.project;

  return (
    <>
      <div className="phead">
        <div>
          <h1 className="pg">Settings</h1>
          <div className="psub">Connections, tracking and plan.</div>
        </div>
        <SignOutButton />
      </div>

      <Panel title="Connections">
        <div className="setrow">
          <div className="l">
            <b>GitHub{p.githubRepo ? ` — ${p.githubRepo}` : ""}</b>
            <span>Auto-detects ships from commits &amp; releases</span>
          </div>
          {p.githubRepo ? (
            <Badge dotColor="var(--ok)">Connected</Badge>
          ) : (
            <Button variant="secondary">Connect</Button>
          )}
        </div>
        <div className="setrow">
          <div className="l">
            <b>Product URL</b>
            <span>{p.url ?? "Not set"}</span>
          </div>
          {p.url ? (
            <Badge dotColor="var(--ok)">Verified</Badge>
          ) : (
            <Button variant="secondary">Add</Button>
          )}
        </div>
        <div className="setrow">
          <div className="l">
            <b>Signup tracking</b>
            <span>Add the LaunchWake pixel to attribute signups</span>
          </div>
          <Button variant="secondary">Set up</Button>
        </div>
        <div className="setrow">
          <div className="l">
            <b>Slack</b>
            <span>Get a ping when a new ship is detected</span>
          </div>
          <Button variant="secondary">Connect</Button>
        </div>
      </Panel>

      <Panel title="Signup tracking">
        <TrackingSetup appUrl={env.APP_URL} />
      </Panel>

      <Panel title="Plan">
        <BillingPanel
          usage={usage}
          billingConfigured={billingConfigured()}
          justUpgraded={upgraded === "1"}
        />
      </Panel>
    </>
  );
}
