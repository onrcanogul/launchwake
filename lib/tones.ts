/**
 * Draft tone definitions — pure, client-safe (no db/env imports) so the Launch
 * kit client component can import DRAFT_TONES without pulling server modules.
 */
export type DraftTone = "founder" | "technical" | "punchy" | "professional";

export const DRAFT_TONES: { value: DraftTone; label: string }[] = [
  { value: "founder", label: "Founder" },
  { value: "technical", label: "Technical" },
  { value: "punchy", label: "Punchy" },
  { value: "professional", label: "B2B" },
];

export const TONE_GUIDE: Record<DraftTone, string> = {
  founder:
    "Voice: a technical founder sharing personally. First person, honest, build-in-public. Warm, never salesy.",
  technical:
    "Voice: precise and plain. Lead with the technical substance and the problem you hit. No fluff, no adjectives.",
  punchy:
    "Voice: tight and high-energy. Short sentences, a strong hook, momentum. Still concrete — no hype words.",
  professional:
    "Voice: measured and B2B. Clear business value, credible, professional. No slang, no emoji.",
};

export function isDraftTone(v: unknown): v is DraftTone {
  return typeof v === "string" && v in TONE_GUIDE;
}
