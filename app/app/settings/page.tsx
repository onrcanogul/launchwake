import { redirect } from "next/navigation";
import { getWorkspace } from "@/lib/session";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { TrackingSetup } from "@/components/settings/TrackingSetup";
import { BillingPanel } from "@/components/settings/BillingPanel";
import { GithubWebhook } from "@/components/settings/GithubWebhook";
import { SlackConnect } from "@/components/settings/SlackConnect";
import { getPlanUsage, billingConfigured } from "@/lib/billing";
import { getTrackingStatus } from "@/lib/attribution";
import { getGithubStatus } from "@/lib/github";
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
  const tracking = await getTrackingStatus(ws.project.id);
  const github = await getGithubStatus(ws.project);
  const p = ws.project;
  const webhookUrl = `${env.APP_URL.replace(/\/$/, "")}/api/github/webhook`;

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
            <span>Ping you at the best time to post &amp; on new ships</span>
          </div>
          {p.slackWebhookUrl ? (
            <Badge dotColor="var(--ok)">Connected</Badge>
          ) : (
            <Badge>Not set</Badge>
          )}
        </div>
        <SlackConnect current={p.slackWebhookUrl} />
      </Panel>

      <Panel title="GitHub auto-detect" right="ships land in your feed">
        <GithubWebhook
          repo={p.githubRepo}
          webhookUrl={webhookUrl}
          initialSecret={p.webhookSecret}
          status={github}
        />
      </Panel>

      <Panel title="Signup tracking">
        <TrackingSetup appUrl={env.APP_URL} status={tracking} />
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
