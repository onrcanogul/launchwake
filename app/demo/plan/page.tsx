import { ChannelCard } from "@/components/channel/ChannelCard";
import { Note } from "@/components/ui/Note";
import { DemoCallout } from "@/components/demo/DemoCallout";
import { DEMO_RECS, DEMO_SHIP, DEMO_CHANNEL_TOTAL } from "@/lib/demoData";

export default function DemoPlanPage() {
  return (
    <>
      <div className="phead">
        <div>
          <h1 className="pg">Where to post</h1>
          <div className="psub">
            Distribution plan for{" "}
            <b style={{ color: "var(--tx)" }}>&ldquo;{DEMO_SHIP.title}&rdquo;</b> —{" "}
            {DEMO_RECS.length} channels ranked by fit, with rules and the safe way in.
          </div>
        </div>
      </div>

      <DemoCallout icon="where" title="This is the hero: where to post it">
        LaunchWake ranks {DEMO_CHANNEL_TOTAL}+ real communities by how well they fit{" "}
        {DEMO_SHIP.title}, flags the ban risk before you post, and gives you the one rule
        that gets people removed. It never invents a subreddit — every channel is a real,
        vetted place with real rules.
      </DemoCallout>

      {DEMO_RECS.map((rec) => (
        <ChannelCard
          key={rec.id}
          data={{
            name: rec.channelName,
            platform: rec.platform,
            audienceDesc: rec.audienceDesc,
            fitScore: rec.fitScore,
            banRisk: rec.banRisk,
            bestTime: rec.bestTime,
            whyText: rec.whyText,
            ruleNote: rec.ruleNote,
            outcomeNote: rec.outcomeNote,
            cost: rec.cost,
          }}
          draftHref="/demo/kit"
          settingsHref="/demo/settings"
          shortform={rec.shortform}
        />
      ))}

      <Note icon="results" className="note-flow">
        This plan re-ranks itself as results come in — LaunchWake learns which channels
        actually convert for products like yours, so every launch gets smarter.
      </Note>
    </>
  );
}
