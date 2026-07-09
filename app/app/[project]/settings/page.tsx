import { Suspense } from "react";
import { getWorkspace } from "@/lib/session";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { TrackingSetup } from "@/components/settings/TrackingSetup";
import { EmailPrefs } from "@/components/settings/EmailPrefs";
import {
  TrackingHealthSection,
  TrackingHealthLoading,
} from "@/components/settings/TrackingHealth";
import { BillingPanel } from "@/components/settings/BillingPanel";
import { TeamPanel } from "@/components/settings/TeamPanel";
import { BrandPanel } from "@/components/settings/BrandPanel";
import { getBrand, clientReportUrl } from "@/lib/clientReport";
import { GithubWebhook } from "@/components/settings/GithubWebhook";
import { GithubConnect } from "@/components/github/GithubConnect";
import { ReleaseAction } from "@/components/settings/ReleaseAction";
import { SlackConnect } from "@/components/settings/SlackConnect";
import { LeaveTeamButton } from "@/components/settings/LeaveTeamButton";
import {
  getPlanUsage,
  billingConfigured,
  TEAM_PRICE_PER_SEAT_CENTS,
  TEAM_MIN_SEATS,
  TEAM_MAX_SEATS,
} from "@/lib/billing";
import { polarConfigured } from "@/lib/polar";
import { getTeamView } from "@/lib/team";
import { getTrackingStatus } from "@/lib/attribution";
import {
  getGithubStatus,
  githubAppConfigured,
  appInstallUrl,
  listInstallationRepos,
  type GithubRepo,
} from "@/lib/github";
import { env } from "@/lib/env";

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const { project } = await params;
  const ws = await getWorkspace(project);

  const { upgraded } = await searchParams;
  const usage = await getPlanUsage(ws.accountId);
  const tracking = await getTrackingStatus(ws.project.id);
  const github = await getGithubStatus(ws.project);
  const p = ws.project;
  const webhookUrl = `${env.APP_URL.replace(/\/$/, "")}/api/github/webhook`;

  // GitHub App repo picker: list the installation's repos (private included).
  // null = listing failed (surface a reconnect); [] = no App / no installation.
  const appConfigured = githubAppConfigured();
  let installationRepos: GithubRepo[] | null = [];
  if (appConfigured && p.githubInstallationId) {
    installationRepos = await listInstallationRepos(p.githubInstallationId).catch(
      () => null,
    );
  }
  const ghInstallUrl = appConfigured ? appInstallUrl(`project:${p.id}`) : null;
  const isOwner = ws.role === "OWNER";
  const isTeamOwner = isOwner && ws.plan === "TEAM";
  const team = isTeamOwner ? await getTeamView(ws.accountId, ws.user.id) : null;
  const brand = isTeamOwner ? await getBrand(ws.accountId) : null;

  return (
    <>
      <div className="phead">
        <div>
          <h1 className="pg">Settings</h1>
          <div className="psub">Connections, tracking and plan.</div>
        </div>
        <SignOutButton />
      </div>

      <Suspense fallback={<TrackingHealthLoading />}>
        <TrackingHealthSection projectId={p.id} />
      </Suspense>

      <Panel title="Connections">
        <div className="setrow">
          <div className="l">
            <b>GitHub{p.githubRepo ? ` — ${p.githubRepo}` : ""}</b>
            <span>Auto-detects ships from commits &amp; releases</span>
          </div>
          {p.githubRepo ? (
            <Badge dotColor="var(--ok)">Connected</Badge>
          ) : (
            <Badge>Set up below</Badge>
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
        <SlackConnect projectId={p.id} current={p.slackWebhookUrl} />
      </Panel>

      <Panel title="Connect your repository" right="private repos supported">
        <GithubConnect
          projectId={p.id}
          currentRepo={p.githubRepo}
          connected={Boolean(p.githubInstallationId)}
          repos={installationRepos ?? []}
          reposError={installationRepos === null}
          installUrl={ghInstallUrl}
        />
      </Panel>

      <Panel title="GitHub auto-detect" right="ships land in your feed">
        <GithubWebhook
          projectId={p.id}
          repo={p.githubRepo}
          webhookUrl={webhookUrl}
          initialSecret={p.webhookSecret}
          status={github}
        />
      </Panel>

      <Panel title="Comment plans on your releases" right="GitHub Action">
        <ReleaseAction hasSecret={Boolean(p.webhookSecret)} />
      </Panel>

      <Panel title="Emails">
        <EmailPrefs initialEnabled={ws.user.emailNotifications} />
      </Panel>

      <Panel title="Attribution — signups & revenue">
        <TrackingSetup
          appUrl={env.APP_URL}
          projectId={p.id}
          status={tracking}
          stripeSecretSet={Boolean(p.stripeWebhookSecret)}
          pixelVerifiedAt={p.pixelVerifiedAt}
        />
      </Panel>

      {team && (
        <Panel title="Team" right={<Badge accent>{team.seats.used}/{team.seats.purchased} seats</Badge>}>
          <TeamPanel team={team} />
        </Panel>
      )}

      {isTeamOwner ? (
        <BrandPanel
          brand={brand}
          projectId={p.id}
          reportEnabled={p.reportEnabled}
          reportUrl={p.reportToken ? clientReportUrl(p.reportToken) : null}
        />
      ) : (
        isOwner && (
          <Panel title="White-label client report">
            <div className="setrow">
              <div className="l">
                <b>Send clients a branded report</b>
                <span>
                  On Team, send your client a distribution report at a stable link —
                  your logo, your name. LaunchWake stays the invisible engine.
                </span>
              </div>
              <Badge accent>Team</Badge>
            </div>
          </Panel>
        )
      )}

      {isOwner ? (
        <Panel title="Plan">
          <BillingPanel
            usage={usage}
            billingConfigured={billingConfigured() || polarConfigured()}
            justUpgraded={upgraded === "1"}
            teamPricePerSeatCents={TEAM_PRICE_PER_SEAT_CENTS}
            teamMinSeats={TEAM_MIN_SEATS}
            teamMaxSeats={TEAM_MAX_SEATS}
          />
        </Panel>
      ) : (
        <Panel title="Plan">
          <div className="setrow">
            <div className="l">
              <b>You&apos;re on a Team seat</b>
              <span>
                You share this workspace on the {ws.plan} plan. Billing is managed by
                the team owner.
              </span>
            </div>
            <LeaveTeamButton />
          </div>
        </Panel>
      )}
    </>
  );
}
