/**
 * JSON-LD (schema.org) builders for the public SEO surface — FAQPage on
 * channel pages, ItemList on hub pages, BreadcrumbList everywhere.
 *
 * Pure object builders (no React, no Next) so they're trivially unit-testable;
 * pages serialize them into a `<script type="application/ld+json">` tag via
 * `components/public/JsonLd`. URLs must be ABSOLUTE (Google requirement) —
 * callers prefix with `env.APP_URL`.
 */

import type { FaqItem } from "./publicCatalog";

export type JsonLd = Record<string, unknown>;

/** FAQPage — makes channel pages eligible for FAQ rich results. */
export function faqPageJsonLd(items: FaqItem[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.question,
      acceptedAnswer: { "@type": "Answer", text: i.answer },
    })),
  };
}

/** BreadcrumbList — position is 1-based, URLs absolute. */
export function breadcrumbJsonLd(
  crumbs: { name: string; url: string }[],
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  };
}

/** ItemList — for hub pages listing ranked channels. */
export function itemListJsonLd(
  items: { name: string; url: string }[],
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      url: c.url,
    })),
  };
}
