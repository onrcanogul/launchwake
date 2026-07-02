import { notFound, redirect } from "next/navigation";
import { getWorkspace } from "@/lib/session";
import { getShipWithPlan } from "@/lib/plans";
import { getShipPitches } from "@/lib/pitch";
import { NewsletterPitches, type PitchOppUI } from "@/components/pitch/NewsletterPitches";
import { EmptyState } from "@/components/ui/EmptyState";
import { Note } from "@/components/ui/Note";
import { ShipSwitcher } from "@/components/ship/ShipSwitcher";
import { SyncActiveShip } from "@/components/ship/SyncActiveShip";
import { llmConfigured } from "@/lib/llm";

export const metadata = { title: "Newsletter pitches · LaunchWake" };

export default async function PitchesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ws = await getWorkspace();
  if (!ws.project) redirect("/onboarding");

  const data = await getShipWithPlan(id, ws.accountId);
  if (!data) notFound();
  const { ship } = data;

  const opportunities = await getShipPitches(id);
  const now = new Date();
  const ui: PitchOppUI[] = opportunities.map((o) => ({
    channelId: o.channelId,
    channelName: o.channelName,
    audienceDesc: o.audienceDesc,
    url: o.url,
    rules: o.rules,
    pitch: o.pitch
      ? {
          id: o.pitch.id,
          subject: o.pitch.subject,
          body: o.pitch.body,
          status: o.pitch.status,
          followUpDue:
            o.pitch.status === "SENT" && o.pitch.followUpAt != null && o.pitch.followUpAt <= now,
        }
      : null,
  }));

  return (
    <>
      <SyncActiveShip id={ship.id} />
      <div className="phead">
        <div>
          <h1 className="pg">Newsletter pitches</h1>
          <div className="psub">
            You don&apos;t post to a newsletter — you pitch its curator. Personalized
            pitches for{" "}
            <b style={{ color: "var(--tx)" }}>&ldquo;{ship.title}&rdquo;</b>, tracked
            end to end.
          </div>
        </div>
        {ws.ships.length > 1 && (
          <ShipSwitcher ships={ws.ships} currentId={ship.id} mode="pitches" />
        )}
      </div>

      {!llmConfigured() && (
        <Note icon="mail">
          No LLM key set — pitches use an offline template. Add an API key in the
          environment for tailored, per-newsletter copy.
        </Note>
      )}

      {ui.length === 0 ? (
        <EmptyState
          icon="mail"
          title="No newsletters matched"
          message="We couldn't find newsletters that fit this product's category yet."
        />
      ) : (
        <>
          <NewsletterPitches shipId={ship.id} opportunities={ui} />
          <Note icon="shield">
            LaunchWake never emails anyone for you. Review each pitch, edit it in your
            voice, and send it from your own inbox — then mark it sent and we&apos;ll
            remind you to follow up.
          </Note>
        </>
      )}
    </>
  );
}
