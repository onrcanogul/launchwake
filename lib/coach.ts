import { z } from "zod";
import { db } from "./db";
import { completeJSON, llmConfigured } from "./llm";
import { checkDraft, type SafetyReport } from "./bansafety";

/**
 * Post-mortem coaching — the second LLM pass, and the moat. After a post has
 * data, combine the post text + the channel's rules + the deterministic
 * ban-safety checks + the REAL click/signup outcome into concrete, grounded
 * diagnosis: "your title was a statement, not a question", "posted off the best
 * window", "you didn't write the first comment". Competitors can copy the
 * prompt; they can't copy the outcome data.
 *
 * Pure prompt + heuristic fallback → unit-testable; orchestrator persists a
 * cached result on the Post so it isn't re-run on every view.
 */

export const CoachSchema = z.object({
  verdict: z.string().min(1).max(220),
  /** 0–100: how closely this post followed the channel's playbook. */
  playbookScore: z.number().int().min(0).max(100),
  diagnoses: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        detail: z.string().min(1).max(400),
        fix: z.string().min(1).max(240),
        severity: z.enum(["high", "medium", "low"]),
      }),
    )
    .max(6),
  nextTime: z.string().min(1).max(400),
});
export type CoachResult = z.infer<typeof CoachSchema>;

export type CoachOutcome = {
  clicks: number;
  signups: number;
  conversion: number; // 0..1
  removed: boolean;
};

export type CoachInput = {
  channel: { name: string; platform: string; rules: string | null };
  bestTime: string | null;
  postText: string;
  postedAtLabel: string | null;
  outcome: CoachOutcome;
  safety: SafetyReport;
};

/** System + user prompt for the coach. Pure → testable without a network call. */
export function buildCoachPrompt(input: CoachInput) {
  const system = [
    "You are LaunchWake's launch coach. A founder already posted to a community; you diagnose why it did (or didn't) perform and how to do better next time.",
    "You are given: the post text, the community's rules, deterministic rule checks, when it was posted vs the best time, and the REAL outcome (clicks, signups, whether it was removed).",
    "",
    "Hard rules:",
    "- Ground every point in the given data: the channel's rules, the rule checks, the timing, and the actual numbers. NEVER invent facts about the post or the channel.",
    "- Be specific and concrete. Prefer 'your title was a statement — HN rewards a curiosity gap' over generic advice.",
    "- Each diagnosis needs a one-line, actionable fix for next time.",
    "- If the post followed the playbook and converted, say what worked (severity 'low') — don't manufacture problems.",
    "- Tie diagnoses to the outcome when possible: e.g. clicks but zero signups → the landing/hook, not the channel choice.",
    "- Respond with ONLY a JSON object, no prose, no code fences.",
    "",
    'JSON shape: {"verdict":string,"playbookScore":0-100,"diagnoses":[{"title":string,"detail":string,"fix":string,"severity":"high"|"medium"|"low"}],"nextTime":string}',
  ].join("\n");

  const o = input.outcome;
  const safetyLines = input.safety.checks
    .map((c) => `   - [${c.level}] ${c.label}: ${c.detail}`)
    .join("\n");

  const prompt = [
    `== CHANNEL ==`,
    `${input.channel.name} [${input.channel.platform}]`,
    input.channel.rules ? `Rules: ${input.channel.rules}` : "",
    input.bestTime ? `Best time to post: ${input.bestTime}` : "",
    input.postedAtLabel ? `You recorded this post at: ${input.postedAtLabel}` : "",
    "",
    `== OUTCOME (real, tracked) ==`,
    `${o.clicks} clicks, ${o.signups} signups (${(o.conversion * 100).toFixed(1)}% conversion)${o.removed ? " — POST WAS REMOVED" : ""}`,
    "",
    `== RULE CHECKS (deterministic) ==`,
    safetyLines || "   (none)",
    "",
    `== POST TEXT ==`,
    input.postText || "(no draft text on record)",
  ]
    .filter((l) => l !== "")
    .join("\n");

  return { system, prompt };
}

/** Deterministic coach when no LLM is configured (or as a floor). Pure. */
export function heuristicCoach(input: CoachInput): CoachResult {
  const { safety, outcome } = input;
  const diagnoses: CoachResult["diagnoses"] = [];

  if (outcome.removed) {
    diagnoses.push({
      title: "Your post was removed",
      detail: `${input.channel.name} took this down — usually a rules or self-promo violation.`,
      fix: "Re-read the community rules and lead with value, not a pitch. Post from an aged, active account.",
      severity: "high",
    });
  }

  for (const c of safety.checks) {
    if (c.level === "pass") continue;
    diagnoses.push({
      title: c.label,
      detail: c.detail,
      fix: c.detail,
      severity: c.level === "fail" ? "high" : "medium",
    });
  }

  if (!outcome.removed && outcome.clicks >= 8 && outcome.signups === 0) {
    diagnoses.push({
      title: "Traffic came, but nothing converted",
      detail: `${outcome.clicks} clicks and 0 signups — the click-through worked, the landing/offer didn't.`,
      fix: "Match the landing page to the post's promise, and tighten the call-to-action.",
      severity: "medium",
    });
  }

  if (diagnoses.length === 0 && outcome.signups > 0) {
    diagnoses.push({
      title: "Solid post — it converted",
      detail: `${outcome.signups} signups from ${outcome.clicks} clicks. It followed the channel's playbook.`,
      fix: "Do more of this: same format, same channel, next ship.",
      severity: "low",
    });
  }

  const playbookScore = Math.max(
    0,
    Math.min(100, 100 - safety.fails * 25 - safety.warns * 10 - (outcome.removed ? 30 : 0)),
  );

  const verdict = outcome.removed
    ? "Removed — fix the rule violation before you post here again."
    : safety.fails > 0
      ? `${safety.fails} rule issue${safety.fails === 1 ? "" : "s"} likely held this back.`
      : outcome.signups > 0
        ? "This one worked — repeat the format."
        : "Clean on the rules; iterate on the hook and the landing.";

  return {
    verdict,
    playbookScore,
    diagnoses: diagnoses.slice(0, 6),
    nextTime:
      diagnoses.find((d) => d.severity !== "low")?.fix ??
      "Keep the value-first framing and post in the recommended window.",
  };
}

function postedAtLabel(date: Date): string {
  return date.toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }) + " UTC";
}

/**
 * Coach a post: gather text + rules + outcome, run the checks + LLM (or
 * heuristic), cache and return. Idempotent-ish: re-running refreshes the result.
 */
export async function coachPost(postId: string): Promise<CoachResult> {
  const post = await db.post.findUnique({
    where: { id: postId },
    include: {
      channel: true,
      trackedLink: { include: { events: { select: { type: true } } } },
      ship: {
        include: {
          project: { select: { userId: true } },
          plan: { include: { recs: { include: { draft: true } } } },
        },
      },
    },
  });
  if (!post) throw new Error("Post not found");

  const rec = post.ship.plan?.recs.find((r) => r.channelId === post.channelId);
  const postText = rec?.draft?.body ?? "";

  const events = post.trackedLink?.events ?? [];
  const clicks = events.filter((e) => e.type === "CLICK").length;
  const signups = events.filter((e) => e.type === "SIGNUP").length;
  const outcome: CoachOutcome = {
    clicks,
    signups,
    conversion: clicks > 0 ? signups / clicks : 0,
    removed: post.status === "REMOVED",
  };

  const safety = checkDraft({
    body: postText,
    platform: post.channel.platform,
    channelRules: post.channel.rules,
  });

  const input: CoachInput = {
    channel: { name: post.channel.name, platform: post.channel.platform, rules: post.channel.rules },
    bestTime: rec?.bestTime ?? post.channel.bestTime,
    postText,
    postedAtLabel: postedAtLabel(post.postedAt),
    outcome,
    safety,
  };

  let result: CoachResult;
  if (llmConfigured()) {
    const { system, prompt } = buildCoachPrompt(input);
    try {
      result = await completeJSON({
        userId: post.ship.project.userId,
        system,
        prompt,
        schema: CoachSchema,
        label: "coach",
      });
    } catch {
      result = heuristicCoach(input);
    }
  } else {
    result = heuristicCoach(input);
  }

  await db.post.update({
    where: { id: postId },
    data: { coachingJson: result as object, coachedAt: new Date() },
  });

  return result;
}
