import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getPublicChannel,
  listPublicChannelSlugs,
  explainBanRisk,
  postingChecklist,
  seoQuestion,
} from "@/lib/publicCatalog";
import { PublicShell } from "@/components/public/PublicShell";
import { Icon } from "@/components/Icon";
import { platformIcon } from "@/components/ui/platform";
import { RISK, type BanRiskValue } from "@/components/ui/risk";

export const revalidate = 86400;

export async function generateStaticParams() {
  const slugs = await listPublicChannelSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const channel = await getPublicChannel(slug);
  if (!channel) return { title: "Channel not found — LaunchWake" };
  const risk = channel.defaultBanRisk.toLowerCase();
  return {
    title: `${seoQuestion(channel)} — Rules & ban risk | LaunchWake`,
    description: `${channel.name}: ${risk} ban risk. The posting rules, what gets removed, the safe way to share your launch, and the best time to post.`,
    alternates: { canonical: `/channels/${slug}` },
  };
}

export default async function ChannelPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const channel = await getPublicChannel(slug);
  if (!channel) notFound();

  const like = {
    slug: channel.slug,
    name: channel.name,
    platform: channel.platform,
    url: channel.url,
    audienceDesc: channel.audienceDesc,
    rules: channel.rules,
    defaultBanRisk: channel.defaultBanRisk as BanRiskValue,
    bestTime: channel.bestTime,
    tags: channel.tags,
  };

  const risk = explainBanRisk(like);
  const checklist = postingChecklist(like);
  const riskMeta = RISK[channel.defaultBanRisk as BanRiskValue];

  return (
    <PublicShell>
      <div style={{ marginBottom: 18, fontSize: 12, color: "var(--tx3)" }}>
        <Link href="/channels" style={{ color: "var(--tx2)" }}>
          Channels
        </Link>{" "}
        / {channel.name}
      </div>

      <div className="pub-eyebrow">
        <Icon name={platformIcon(channel.platform)} />
        {channel.platform}
      </div>
      <h1 className="pub-h1">{seoQuestion(like)}</h1>
      <p className="pub-lede">{risk.summary}</p>

      <div className="cd-facts">
        <div className="cd-fact">
          <div className="l">Ban risk</div>
          <div className="v">
            <span className="dot" style={{ background: riskMeta.color }} aria-hidden />
            {riskMeta.label}
          </div>
        </div>
        <div className="cd-fact">
          <div className="l">Best time to post</div>
          <div className="v">{channel.bestTime ?? "—"}</div>
        </div>
        <div className="cd-fact">
          <div className="l">Audience</div>
          <div className="v" style={{ fontSize: 12.5, fontWeight: 450, color: "var(--tx2)" }}>
            {channel.audienceDesc ?? "—"}
          </div>
        </div>
      </div>

      <section className="cd-sec">
        <h2>
          <Icon name="shield" />
          Why the ban risk is {riskMeta.label.toLowerCase()}
        </h2>
        <ul className="cd-factors">
          {risk.factors.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      </section>

      {channel.rules && (
        <section className="cd-sec">
          <h2>
            <Icon name="rules" />
            The rules, in plain English
          </h2>
          <div className="cd-rules">{channel.rules}</div>
        </section>
      )}

      <section className="cd-sec">
        <h2>
          <Icon name="check" />
          How to post here safely
        </h2>
        <div className="cd-cols">
          <div className="cd-do">
            <div className="hd">Do</div>
            <ul>
              {checklist.dos.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
          <div className="cd-dont">
            <div className="hd">Don&apos;t</div>
            <ul>
              {checklist.donts.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="gate">
        <h3>Is {channel.name} even the right channel for your launch?</h3>
        <p>
          Paste your GitHub repo into the free Launch Checker and get a ranked
          plan — which channels fit your product, their ban risk, and how to post
          in each. No account needed.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <Link href="/tools/launch-checker" className="btn btn-p">
            <Icon name="target" />
            Check my launch
          </Link>
          {channel.url && (
            <a
              href={channel.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="btn btn-s"
            >
              <Icon name="external" />
              Visit {channel.name}
            </a>
          )}
        </div>
      </div>
    </PublicShell>
  );
}
