import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseRepo, getRepoMeta, getLatestRelease } from "@/lib/github";
import { buildPublicPlan, type PublicPlanInput } from "@/lib/launchChecker";
import { rateLimitDurable, clientIp } from "@/lib/ratelimit";

/**
 * Public, login-less Launch Checker.
 *
 * POST { repo } — repo is "owner/repo" or a GitHub URL. Fetches public repo
 * metadata (incl. topics/language) and the latest RELEASE — never a raw commit,
 * since there's no human in the loop here to correct a noisy commit message.
 * Ranks the seeded catalog with the heuristic (no LLM → free + instant) and
 * returns a grounded mini distribution plan. IP rate-limited as an abuse guard.
 */

const BodySchema = z.object({ repo: z.string().min(1).max(200) });

// 10 checks / 10 min / IP — generous for a real user, annoying for a scraper.
const LIMIT = 10;
const WINDOW_MS = 10 * 60 * 1000;

export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  const rl = await rateLimitDurable(`launch-checker:${ip}`, LIMIT, WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit reached — try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide a GitHub repo (owner/repo or URL)." }, { status: 400 });
  }

  const ref = parseRepo(parsed.data.repo);
  if (!ref) {
    return NextResponse.json(
      { error: "That doesn't look like a repo. Use owner/repo or a github.com URL." },
      { status: 400 },
    );
  }

  let meta;
  try {
    meta = await getRepoMeta(ref);
  } catch {
    return NextResponse.json({ error: "Couldn't reach GitHub. Try again shortly." }, { status: 502 });
  }
  if (!meta) {
    return NextResponse.json(
      { error: "Repo not found (or it's private). Check the name and try again." },
      { status: 404 },
    );
  }

  // Release only — an intentional, human-curated ship. No commit fallback: the
  // plan is project-first, and a release (when present) merely refines it.
  const ship = await getLatestRelease(ref).catch(() => null);

  const catalog = await db.channel.findMany();
  const input: PublicPlanInput = {
    project: {
      name: meta.name,
      description: meta.description,
      url: meta.homepage,
      githubRepo: meta.fullName,
      topics: meta.topics,
      language: meta.language,
    },
    ship: ship ? { type: ship.type, title: ship.title, summary: ship.summary } : null,
  };

  const plan = buildPublicPlan(catalog, input);
  return NextResponse.json({ plan, repo: meta.fullName });
}
