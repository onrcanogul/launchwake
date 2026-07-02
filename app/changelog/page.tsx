import type { Metadata } from "next";
import { PublicShell } from "@/components/public/PublicShell";
import { Icon } from "@/components/Icon";
import { getChangelog, formatChangelogDate, tagColor } from "@/lib/changelog";

export const metadata: Metadata = {
  title: "Changelog — LaunchWake",
  description:
    "What's new in LaunchWake — public launch reports, revenue attribution, launch-day run sheet, a 100+ channel catalog, and more.",
  alternates: {
    canonical: "/changelog",
    types: { "application/rss+xml": "/changelog/rss.xml" },
  },
};

export default function ChangelogPage() {
  const entries = getChangelog();

  return (
    <PublicShell>
      <div className="phead" style={{ alignItems: "center" }}>
        <div>
          <div className="pub-eyebrow">
            <Icon name="rss" />
            Changelog
          </div>
          <h1 className="pub-h1">What&apos;s new in LaunchWake</h1>
        </div>
        <a
          className="btn btn-s"
          href="/changelog/rss.xml"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="rss" /> RSS
        </a>
      </div>

      <div className="clog">
        {entries.map((e) => (
          <article className="clog-entry" id={e.slug} key={e.slug}>
            <div className="clog-meta">
              <time className="clog-date" dateTime={e.date}>
                {formatChangelogDate(e.date)}
              </time>
              <div className="clog-tags">
                {e.tags.map((t) => (
                  <span
                    className="clog-tag"
                    key={t}
                    style={{ color: tagColor(t), borderColor: tagColor(t) }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="clog-body">
              <h2 className="clog-title">
                <a href={`#${e.slug}`}>{e.title}</a>
              </h2>
              <ul className="clog-items">
                {e.items.map((it, i) => (
                  <li key={i}>{it}</li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </PublicShell>
  );
}
