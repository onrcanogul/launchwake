import Link from "next/link";
import type { Metadata } from "next";
import { listPublicChannels } from "@/lib/publicCatalog";
import { PublicShell } from "@/components/public/PublicShell";
import { Icon } from "@/components/Icon";
import { platformIcon } from "@/components/ui/platform";
import { RISK } from "@/components/ui/risk";

// The catalog is seeded/rarely changes — cache the page and revalidate daily.
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Where can I post my startup? Channel rules & ban risk — LaunchWake",
  description:
    "A directory of the communities technical founders launch in — Hacker News, Reddit, Product Hunt and more — with each one's posting rules, ban risk and best time to post.",
  alternates: { canonical: "/channels" },
};

export default async function PublicChannelsPage() {
  const channels = await listPublicChannels();

  return (
    <PublicShell wide>
      <div className="pub-eyebrow">
        <Icon name="shield" />
        Ban Risk Lookup
      </div>
      <h1 className="pub-h1">Where can you post your startup — safely?</h1>
      <p className="pub-lede">
        Every community has unwritten rules, and breaking them gets your post
        removed or your account banned. Here&apos;s the posting playbook for the
        channels technical founders actually launch in.
      </p>

      <div className="ch-grid">
        {channels.map((c) => (
          <Link key={c.slug} href={`/channels/${c.slug}`} className="ch-card">
            <div className="top">
              <Icon name={platformIcon(c.platform)} />
              <span className="nm">{c.name}</span>
            </div>
            {c.audienceDesc && <div className="aud">{c.audienceDesc}</div>}
            <div className="ft">
              <span
                className="dot"
                style={{ background: RISK[c.banRisk].color }}
                aria-hidden
              />
              {RISK[c.banRisk].label} ban risk
              {c.bestTime && (
                <>
                  <span style={{ color: "var(--tx3)" }}>·</span>
                  {c.bestTime}
                </>
              )}
            </div>
          </Link>
        ))}
      </div>
    </PublicShell>
  );
}
