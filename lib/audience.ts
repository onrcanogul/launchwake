/**
 * Target-audience language for a project's GENERATED content.
 *
 * A project targets an audience that speaks a given language (e.g. a Turkish
 * founder shipping to a Turkish audience). That choice localizes the OUTPUT —
 * the analysis "why"/ruleNote and the platform drafts — and biases channel
 * ranking toward that audience. It is NOT app-UI i18n: the LaunchWake interior
 * stays English; only the content the founder will post changes language.
 *
 * Resolution: a ship may override the project default per-plan, so the effective
 * language for any ship's outputs is `ship.audienceLanguage ?? project.audienceLanguage`
 * (falling back to English). Codes are BCP-47 primary subtags; the catalog is
 * intentionally small and extensible — add a row to grow it.
 */

export type AudienceLanguage = {
  /** BCP-47 primary subtag persisted on Project/Ship. */
  code: string;
  /** Native label shown in the picker (e.g. "Türkçe"). */
  label: string;
  /** English name injected into LLM prompts (e.g. "Turkish"). */
  englishName: string;
};

/** The selectable audience languages. English is the default/base. */
export const AUDIENCE_LANGUAGES: readonly AudienceLanguage[] = [
  { code: "en", label: "English", englishName: "English" },
  { code: "tr", label: "Türkçe", englishName: "Turkish" },
  { code: "de", label: "Deutsch", englishName: "German" },
  { code: "es", label: "Español", englishName: "Spanish" },
  { code: "fr", label: "Français", englishName: "French" },
  { code: "pt", label: "Português", englishName: "Portuguese" },
  { code: "it", label: "Italiano", englishName: "Italian" },
  { code: "nl", label: "Nederlands", englishName: "Dutch" },
  { code: "ru", label: "Русский", englishName: "Russian" },
  { code: "ja", label: "日本語", englishName: "Japanese" },
];

/** The base language: English needs no prompt injection and no ranking bias. */
export const DEFAULT_AUDIENCE = "en";

const BY_CODE = new Map(AUDIENCE_LANGUAGES.map((l) => [l.code, l]));

/** Narrowing guard: is `code` one of the catalog's known language codes? */
export function isAudienceLanguage(code: unknown): code is string {
  return typeof code === "string" && BY_CODE.has(code);
}

/** Resolve a stored code to its language record, falling back to English. */
export function resolveAudience(code: string | null | undefined): AudienceLanguage {
  return (code ? BY_CODE.get(code) : undefined) ?? BY_CODE.get(DEFAULT_AUDIENCE)!;
}

/**
 * Effective audience code for a ship's outputs: the ship's override when set to
 * a known language, else the project default, else English. Unknown/stale codes
 * degrade to English rather than leaking a raw code into a prompt.
 */
export function effectiveAudienceCode(
  shipCode: string | null | undefined,
  projectCode: string | null | undefined,
): string {
  if (isAudienceLanguage(shipCode)) return shipCode;
  if (isAudienceLanguage(projectCode)) return projectCode;
  return DEFAULT_AUDIENCE;
}

/**
 * System-prompt line for the analysis ranker: write rationale in the target
 * language AND weigh audience-language fit when ranking. Empty for English (the
 * catalog + prompt already default to English, so no instruction is needed).
 */
export function analysisLanguageRule(code: string): string {
  const lang = resolveAudience(code);
  if (lang.code === DEFAULT_AUDIENCE) return "";
  return (
    `- TARGET AUDIENCE: ${lang.englishName}-speaking. Write EVERY 'why' and 'ruleNote' in natural, native ${lang.englishName} (not translated-sounding). ` +
    `Also weigh audience-language fit when ranking: rank channels that reach a ${lang.englishName}-speaking audience HIGHER, and down-rank channels that are inherently English/US-centric (e.g. Hacker News, Show HN, Lobsters) for this audience — note it in 'why' when it changes the call. ` +
    `Keep channel slugs, product/brand names, and URLs exactly as given.`
  );
}

/**
 * System-prompt line for draft generation: write the draft in the target
 * language. Empty for English. Kept parallel to analysisLanguageRule so both
 * surfaces localize identically.
 */
export function draftLanguageRule(code: string): string {
  const lang = resolveAudience(code);
  if (lang.code === DEFAULT_AUDIENCE) return "";
  return (
    `Write the entire draft (body and safetyNote) in natural, native ${lang.englishName} — not a translation. ` +
    `Keep platform-mandated tokens (e.g. the 'Show HN:' prefix), product/brand names, and URLs exactly as-is.`
  );
}
