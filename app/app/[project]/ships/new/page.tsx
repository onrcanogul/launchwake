import { getWorkspace } from "@/lib/session";
import { getPlanUsage } from "@/lib/billing";
import { NewShipForm } from "@/components/ship/NewShipForm";
import { Note } from "@/components/ui/Note";
import { Icon, type IconName } from "@/components/Icon";

const GAINS: { icon: IconName; title: string; detail: string }[] = [
  {
    icon: "where",
    title: "Where to post",
    detail: "Channels ranked by fit for this ship's audience.",
  },
  {
    icon: "shield",
    title: "Ban-safety",
    detail: "Each community's rules, risk level and best time.",
  },
  {
    icon: "kit",
    title: "Platform-native drafts",
    detail: "Ready to edit — you press publish, never us.",
  },
];

export default async function NewShipPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project } = await params;
  const ws = await getWorkspace(project);

  const usage = await getPlanUsage(ws.accountId);
  const plansLeft =
    usage.planLimit === null
      ? null
      : Math.max(0, usage.planLimit - usage.plansThisMonth);

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

      <div className="newship">
        <div>
          <NewShipForm
            projectId={ws.project.id}
            githubRepo={ws.project.githubRepo}
            plansLeft={plansLeft}
          />
          <Note>
            LaunchWake never posts for you or uses bot accounts. You get the
            plan and the drafts — you press publish.
          </Note>
        </div>

        <aside className="newship-aside" aria-label="What you'll get">
          <h2>What you&apos;ll get</h2>
          {GAINS.map((g) => (
            <div className="gain" key={g.title}>
              <span className="gico">
                <Icon name={g.icon} />
              </span>
              <div>
                <b>{g.title}</b>
                <span>{g.detail}</span>
              </div>
            </div>
          ))}
          <div className="newship-eta">
            <Icon name="clock" />
            Grounded in the channel catalog — usually under a minute.
          </div>
        </aside>
      </div>
    </>
  );
}
