import Link from "next/link";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/Icon";
import { dueLabel, type DueTask } from "@/lib/queue";

/**
 * "Due this week" on the ship feed — the distribution cadence surfaced where the
 * founder actually lands, not just in the weekly digest. Each task links to the
 * ship's launch kit (where the draft lives); LaunchWake never posts it for you.
 */
export function DueQueue({ tasks }: { tasks: DueTask[] }) {
  if (tasks.length === 0) return null;
  const now = new Date();

  return (
    <Panel
      title="Due this week"
      right={
        <Link href="/app/queue" style={{ color: "var(--ac)" }}>
          View queue →
        </Link>
      }
    >
      {tasks.map((t, i) => {
        const overdue = t.dueAt.getTime() < now.getTime();
        return (
          <Link
            key={`${t.shipId}-${t.phase}-${i}`}
            href={`/app/ships/${t.shipId}/kit`}
            className="li"
            style={{ color: "inherit" }}
          >
            <div className="lft">
              <span className="ico">
                <Icon name="rocket" />
              </span>
              <div>
                <div className="tt">
                  {t.phaseLabel} · {t.channelName}
                </div>
                <div className="st">
                  {t.shipTitle} · post it yourself
                </div>
              </div>
            </div>
            <Badge dotColor={overdue ? "var(--warn)" : "var(--ac)"}>
              {dueLabel(t.dueAt, now)}
            </Badge>
          </Link>
        );
      })}
    </Panel>
  );
}
