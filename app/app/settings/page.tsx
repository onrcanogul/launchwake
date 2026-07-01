import { redirect } from "next/navigation";
import { getWorkspace, displayName, projectSubtitle } from "@/lib/session";
import { AppShell } from "@/components/shell/AppShell";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SignOutButton } from "@/components/auth/SignOutButton";

export default async function SettingsPage() {
  const ws = await getWorkspace();
  if (!ws.project) redirect("/onboarding");

  const p = ws.project;

  return (
    <AppShell
      project={{ name: p.name, subtitle: projectSubtitle(p) }}
      user={{ name: displayName(ws.user), plan: ws.user.plan }}
      shipNav={ws.latestShip}
      channelsCount={ws.channelsCount}
      crumb="Settings"
    >
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

      <Panel title="Plan">
        <div className="setrow">
          <div className="l">
            <b>{ws.user.plan === "PRO" ? "Pro" : "Free"}</b>
            <span>
              {ws.user.plan === "PRO"
                ? "Unlimited projects · unlimited plans"
                : "1 project · 2 distribution plans / month"}
            </span>
          </div>
          {ws.user.plan === "PRO" ? (
            <Button variant="secondary">Manage billing</Button>
          ) : (
            <Button variant="primary">Upgrade to Pro — $29/mo</Button>
          )}
        </div>
      </Panel>
    </AppShell>
  );
}
