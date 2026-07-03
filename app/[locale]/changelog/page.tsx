import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { alternatesFor, type Locale } from "@/i18n/paths";
import { PublicShell } from "@/components/public/PublicShell";
import { Icon } from "@/components/Icon";
import { getChangelog, formatChangelogDate, tagColor } from "@/lib/changelog";

export async function generateMetadata(props: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "Changelog" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      ...alternatesFor("/changelog", locale),
      types: { "application/rss+xml": "/changelog/rss.xml" },
    },
  };
}

export default async function ChangelogPage(props: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("Changelog");
  const entries = getChangelog();

  return (
    <PublicShell locale={locale}>
      <div className="phead" style={{ alignItems: "center" }}>
        <div>
          <div className="pub-eyebrow">
            <Icon name="rss" />
            {t("eyebrow")}
          </div>
          <h1 className="pub-h1">{t("title")}</h1>
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
                {e.tags.map((tag) => (
                  <span
                    className="clog-tag"
                    key={tag}
                    style={{ color: tagColor(tag), borderColor: tagColor(tag) }}
                  >
                    {tag}
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
