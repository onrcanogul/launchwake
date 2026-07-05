import { Icon } from "@/components/Icon";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

/**
 * Results empty state — a 3-step walkthrough of the attribution loop instead of
 * a dead end: mint a tracked link → post it yourself → watch clicks/signups
 * arrive. Step 3 reflects the live pixel state so "set up tracking" has a
 * visible finish line.
 */

function StepNumber({ n, done }: { n: number; done?: boolean }) {
  return (
    <div
      aria-hidden
      style={{
        width: 26,
        height: 26,
        borderRadius: 7,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12.5,
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
        color: done ? "var(--ok)" : "var(--tx2)",
        background: "var(--bg2)",
        border: `1px solid ${done ? "var(--ok)" : "var(--line2)"}`,
      }}
    >
      {done ? <Icon name="check" style={{ width: 13, height: 13 }} /> : n}
    </div>
  );
}

function StepRow({
  n,
  title,
  children,
  right,
  done,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  done?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 13,
        alignItems: "flex-start",
        padding: "15px 16px",
        borderTop: n > 1 ? "1px solid var(--line)" : undefined,
      }}
    >
      <StepNumber n={n} done={done} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--tx)", marginBottom: 3 }}>
          {title}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--tx2)", lineHeight: 1.6 }}>
          {children}
        </div>
      </div>
      {right && <div style={{ flexShrink: 0, marginTop: 2 }}>{right}</div>}
    </div>
  );
}

export function GetStartedSteps({
  pixelVerifiedAt,
}: {
  pixelVerifiedAt: Date | null;
}) {
  const pixelLive = Boolean(pixelVerifiedAt);
  return (
    <Panel
      title="Get your first attributed signup"
      right={<Badge accent>3 steps</Badge>}
    >
      <StepRow
        n={1}
        title="Mint a tracked link"
        right={
          <Button variant="primary" icon="where" href="/app/plan">
            Go to a plan
          </Button>
        }
      >
        Open your plan, pick a channel, and mark it as posted — LaunchWake mints
        a short <code className="mono">/r/</code> link that attributes every
        click to that channel.
      </StepRow>

      <StepRow n={2} title="Post it — you, not a bot">
        Use the tracked link as the link in your post. LaunchWake never posts
        for you; that&apos;s what keeps your accounts safe.
      </StepRow>

      <StepRow
        n={3}
        title="Watch clicks and signups arrive"
        done={pixelLive}
        right={
          pixelLive ? (
            <Badge dotColor="var(--ok)">Pixel detected</Badge>
          ) : (
            <Button variant="secondary" icon="settings" href="/app/settings">
              Set up tracking
            </Button>
          )
        }
      >
        Clicks show up here instantly.{" "}
        {pixelLive
          ? "Your pixel is live, so signups will be attributed automatically."
          : "Signups need the one-line pixel on your product — this step flips to done the moment it's detected."}
      </StepRow>
    </Panel>
  );
}
