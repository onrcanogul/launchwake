import type { JsonLd as JsonLdObject } from "@/lib/seoSchema";

/**
 * Serialize a schema.org object into a JSON-LD script tag. Server component —
 * renders once into the static HTML, which is exactly where crawlers want it.
 * `<` is escaped so catalog text can never close the script tag early.
 */
export function JsonLd({ data }: { data: JsonLdObject }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
