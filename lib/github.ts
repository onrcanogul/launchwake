import { createHmac, createSign, timingSafeEqual } from "crypto";
import { z } from "zod";
import { env } from "./env";
import { db } from "./db";
import type { ShipType } from "@prisma/client";

/**
 * GitHub read helpers for turning repo activity into a Ship. Milestone 1 is
 * manual-pull only (no webhook): fetch the latest release or commit on demand.
 */

const API = "https://api.github.com";

function headers(accessToken?: string): HeadersInit {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "LaunchWake",
  };
  const token = accessToken ?? env.GITHUB_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export type RepoRef = { owner: string; repo: string };

/** Parse "owner/repo" (or a full GitHub URL) into a RepoRef. */
export function parseRepo(input: string): RepoRef | null {
  const cleaned = input
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/, "")
    .replace(/\/$/, "");
  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  return { owner: parts[0], repo: parts[1] };
}

export type GithubRepo = {
  fullName: string;
  description: string | null;
  htmlUrl: string;
  private: boolean;
  /** ISO timestamp of the last push, for "most recently active first" sorting. */
  pushedAt?: string | null;
};

/**
 * Read a user's stored GitHub OAuth access token from the linked Account row.
 * (Auth.js persists it via the Prisma adapter on sign-in, even under the JWT
 * session strategy.) Null for email-only users. GitHub OAuth tokens don't
 * expire, so no refresh handling is needed.
 */
export async function getUserGithubToken(userId: string): Promise<string | null> {
  const account = await db.account.findFirst({
    where: { userId, provider: "github" },
    select: { access_token: true },
  });
  return account?.access_token ?? null;
}

/** List the authenticated user's repos (needs their OAuth access token). */
export async function listUserRepos(accessToken: string): Promise<GithubRepo[]> {
  const res = await fetch(
    `${API}/user/repos?per_page=100&sort=updated&affiliation=owner`,
    { headers: headers(accessToken), cache: "no-store" },
  );
  if (!res.ok) throw new Error(`GitHub listUserRepos failed: ${res.status}`);
  const data = (await res.json()) as Array<{
    full_name: string;
    description: string | null;
    html_url: string;
    private: boolean;
  }>;
  return data.map((r) => ({
    fullName: r.full_name,
    description: r.description,
    htmlUrl: r.html_url,
    private: r.private,
  }));
}

export type RepoMeta = {
  fullName: string;
  name: string;
  description: string | null;
  homepage: string | null;
  htmlUrl: string;
  stars: number;
  language: string | null;
  topics: string[];
  private: boolean;
};

/**
 * Fetch public metadata for a repo (name, description, homepage, topics).
 * No auth needed for public repos — the basis for the login-less Launch Checker.
 * Returns null for 404 (missing/private); throws on other transport errors.
 */
export async function getRepoMeta(
  ref: RepoRef,
  accessToken?: string,
): Promise<RepoMeta | null> {
  const res = await fetch(`${API}/repos/${ref.owner}/${ref.repo}`, {
    headers: headers(accessToken),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub getRepoMeta failed: ${res.status}`);
  const r = (await res.json()) as {
    full_name: string;
    name: string;
    description: string | null;
    homepage: string | null;
    html_url: string;
    stargazers_count?: number;
    language: string | null;
    topics?: string[];
    private: boolean;
  };
  return {
    fullName: r.full_name,
    name: r.name,
    description: r.description,
    homepage: r.homepage && r.homepage.trim() ? r.homepage.trim() : null,
    htmlUrl: r.html_url,
    stars: r.stargazers_count ?? 0,
    language: r.language,
    topics: r.topics ?? [],
    private: r.private,
  };
}

export type ShipSuggestion = {
  type: ShipType;
  title: string;
  summary: string | null;
  sourceUrl: string | null;
  commitSha: string | null;
};

type Release = {
  name: string | null;
  tag_name: string;
  body: string | null;
  html_url: string;
};

type Commit = {
  sha: string;
  html_url: string;
  commit: { message: string };
};

export async function getLatestRelease(
  ref: RepoRef,
  accessToken?: string,
): Promise<ShipSuggestion | null> {
  const res = await fetch(
    `${API}/repos/${ref.owner}/${ref.repo}/releases/latest`,
    { headers: headers(accessToken), cache: "no-store" },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub getLatestRelease failed: ${res.status}`);
  const r = (await res.json()) as Release;
  const title = r.name || r.tag_name;
  return {
    type: /\b(v?1\.0|beta|launch)\b/i.test(title) ? "LAUNCH" : "FEATURE",
    title,
    summary: truncate(r.body, 500),
    sourceUrl: r.html_url,
    commitSha: null,
  };
}

export async function getLatestCommit(
  ref: RepoRef,
  accessToken?: string,
): Promise<ShipSuggestion | null> {
  const res = await fetch(
    `${API}/repos/${ref.owner}/${ref.repo}/commits?per_page=1`,
    { headers: headers(accessToken), cache: "no-store" },
  );
  if (res.status === 404 || res.status === 409) return null; // 409 = empty repo
  if (!res.ok) throw new Error(`GitHub getLatestCommit failed: ${res.status}`);
  const list = (await res.json()) as Commit[];
  const c = list[0];
  if (!c) return null;
  const firstLine = c.commit.message.split("\n")[0];
  return {
    type: "FEATURE",
    title: firstLine,
    summary: truncate(c.commit.message.split("\n").slice(1).join("\n"), 500),
    sourceUrl: c.html_url,
    commitSha: c.sha,
  };
}

/** Best-effort ship suggestion: latest release, else latest commit. */
export async function suggestShip(
  ref: RepoRef,
  accessToken?: string,
): Promise<ShipSuggestion | null> {
  const release = await getLatestRelease(ref, accessToken).catch(() => null);
  if (release) return release;
  return getLatestCommit(ref, accessToken).catch(() => null);
}

function truncate(text: string | null, n: number): string | null {
  if (!text) return null;
  const t = text.trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

// ── Webhooks (ship auto-detect, Milestone 4) ───────────────

/** Verify a GitHub webhook HMAC-SHA256 signature (constant-time). */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader) return false;
  const expected =
    "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Verify against any of several candidate secrets — a manual webhook signs with
 * the per-project secret, while a GitHub App installation signs with the App's
 * webhook secret, and both can hit the same endpoint. Passes if any non-empty
 * secret matches (each check is constant-time).
 */
export function verifyWebhookSignatureAny(
  rawBody: string,
  signatureHeader: string | null,
  secrets: Array<string | null | undefined>,
): boolean {
  return secrets.some(
    (s) => !!s && verifyWebhookSignature(rawBody, signatureHeader, s),
  );
}

export type GithubStatus = {
  connected: boolean;
  hasSecret: boolean;
  autoShips: number;
  lastAt: Date | null;
  lastTitle: string | null;
};

/** Webhook auto-detect status for the Settings GitHub card. */
export async function getGithubStatus(project: {
  id: string;
  githubRepo: string | null;
  webhookSecret: string | null;
}): Promise<GithubStatus> {
  const filter = {
    projectId: project.id,
    OR: [
      { commitSha: { not: null } },
      { sourceUrl: { contains: "github.com" } },
    ],
  };
  const [autoShips, last] = await Promise.all([
    db.ship.count({ where: filter }),
    db.ship.findFirst({
      where: filter,
      orderBy: { detectedAt: "desc" },
      select: { detectedAt: true, title: true },
    }),
  ]);
  return {
    connected: Boolean(project.githubRepo),
    hasSecret: Boolean(project.webhookSecret),
    autoShips,
    lastAt: last?.detectedAt ?? null,
    lastTitle: last?.title ?? null,
  };
}

export type WebhookShip = ShipSuggestion & { repoFullName: string };

/**
 * Turn a GitHub webhook payload into a ship suggestion. Handles `release`
 * (published) and `push` (head commit on the default branch). Returns null for
 * events we ignore (ping, non-default-branch pushes, drafts, etc.). Pure.
 */
export function parseWebhookEvent(
  eventType: string | null,
  payload: unknown,
): WebhookShip | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const repo = p.repository as { full_name?: string } | undefined;
  const repoFullName = repo?.full_name;
  if (!repoFullName) return null;

  if (eventType === "release") {
    if (p.action !== "published") return null;
    const rel = p.release as
      | { name?: string | null; tag_name?: string; body?: string | null; html_url?: string; draft?: boolean }
      | undefined;
    if (!rel || rel.draft) return null;
    const title = rel.name || rel.tag_name || "New release";
    return {
      repoFullName,
      type: /\b(v?1\.0|beta|launch)\b/i.test(title) ? "LAUNCH" : "FEATURE",
      title,
      summary: truncate(rel.body ?? null, 500),
      sourceUrl: rel.html_url ?? null,
      commitSha: null,
    };
  }

  if (eventType === "push") {
    // Only the default branch's head commit.
    const ref = typeof p.ref === "string" ? p.ref : "";
    const defaultBranch =
      (p.repository as { default_branch?: string } | undefined)
        ?.default_branch ?? "main";
    if (ref !== `refs/heads/${defaultBranch}`) return null;
    const head = p.head_commit as
      | { id?: string; message?: string; url?: string }
      | undefined;
    if (!head?.message) return null;
    const firstLine = head.message.split("\n")[0];
    return {
      repoFullName,
      type: "FEATURE",
      title: firstLine,
      summary: truncate(head.message.split("\n").slice(1).join("\n"), 500),
      sourceUrl: head.url ?? null,
      commitSha: head.id ?? null,
    };
  }

  return null;
}

/** Read the installation id off a webhook payload (present on App deliveries). */
export function installationIdFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const inst = (payload as { installation?: { id?: unknown } }).installation;
  const id = inst?.id;
  return typeof id === "number" || typeof id === "string" ? String(id) : null;
}

// ─────────────────────────────────────────────────────────────
// GitHub App — installation-based repo access (private repos)
//
// The login OAuth app stays profile+email only. Read-only repo access comes from
// a separate GitHub App the user *installs* (choosing which repos to grant on
// GitHub's own screen). We authenticate as the installation via a short-lived
// app JWT → installation access token, and never request write scopes.
// ─────────────────────────────────────────────────────────────

/** httpOnly cookie bridging the install callback → the onboarding repo picker
 *  (before a Project exists to hang the installation id on). */
export const GH_INSTALLATION_COOKIE = "lw_gh_installation";

/** All four App settings present → the App flow is usable. */
export function githubAppConfigured(): boolean {
  return Boolean(
    env.GITHUB_APP_ID && env.GITHUB_APP_PRIVATE_KEY && env.GITHUB_APP_SLUG,
  );
}

/** The GitHub App installation URL. `state` round-trips back to our callback. */
export function appInstallUrl(state: string): string {
  const slug = env.GITHUB_APP_SLUG ?? "";
  return `https://github.com/apps/${slug}/installations/new?state=${encodeURIComponent(state)}`;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** PEMs pasted into single-line env vars carry literal "\n" — restore them. */
function normalizePrivateKey(pem: string): string {
  return pem.includes("\\n") ? pem.replace(/\\n/g, "\n") : pem;
}

/**
 * A signed app JWT (RS256), valid ~10 min, used only to mint installation
 * tokens. `now` is injectable for tests. Throws if the App isn't configured.
 */
export function generateAppJwt(now: number = Date.now()): string {
  const appId = env.GITHUB_APP_ID;
  const key = env.GITHUB_APP_PRIVATE_KEY;
  if (!appId || !key) throw new Error("GitHub App is not configured.");
  const iat = Math.floor(now / 1000) - 60; // clock-skew cushion
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({ iat, exp: iat + 600, iss: appId }),
  );
  const data = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256")
    .update(data)
    .sign(normalizePrivateKey(key));
  return `${data}.${base64url(signature)}`;
}

// Per-installation access-token cache. Tokens live ~1h; we refresh a minute
// early. Module-level, so it survives across requests on a warm serverless
// instance (and resets harmlessly on cold start).
type CachedToken = { token: string; expiresAtMs: number };
const installationTokenCache = new Map<string, CachedToken>();
const TOKEN_SKEW_MS = 60_000;

/** For tests: clear the installation-token cache. */
export function __clearInstallationTokenCache(): void {
  installationTokenCache.clear();
}

/**
 * An installation access token, cached until shortly before it expires. Mints a
 * fresh one via the app JWT on a miss. Read-only usage only (contents/metadata).
 */
export async function getInstallationToken(
  installationId: string,
  now: number = Date.now(),
): Promise<string> {
  const cached = installationTokenCache.get(installationId);
  if (cached && cached.expiresAtMs - TOKEN_SKEW_MS > now) return cached.token;

  const res = await fetch(
    `${API}/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        ...headers(generateAppJwt(now)),
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    },
  );
  if (!res.ok) {
    throw new Error(`GitHub installation token failed: ${res.status}`);
  }
  const data = (await res.json()) as { token: string; expires_at: string };
  installationTokenCache.set(installationId, {
    token: data.token,
    expiresAtMs: new Date(data.expires_at).getTime(),
  });
  return data.token;
}

type InstallationRepoApi = {
  full_name: string;
  description: string | null;
  html_url: string;
  private: boolean;
  pushed_at: string | null;
};

/** Pure: map + sort the installations API payload (newest push first). */
export function mapInstallationRepoList(data: {
  repositories?: InstallationRepoApi[];
}): GithubRepo[] {
  const repos = (data.repositories ?? []).map((r) => ({
    fullName: r.full_name,
    description: r.description,
    htmlUrl: r.html_url,
    private: r.private,
    pushedAt: r.pushed_at,
  }));
  return repos.sort(
    (a, b) =>
      new Date(b.pushedAt ?? 0).getTime() - new Date(a.pushedAt ?? 0).getTime(),
  );
}

/**
 * List the repos an installation has granted us (private included), newest push
 * first. Uses the cached installation token. Read-only.
 */
export async function listInstallationRepos(
  installationId: string,
): Promise<GithubRepo[]> {
  const token = await getInstallationToken(installationId);
  const res = await fetch(`${API}/installation/repositories?per_page=100`, {
    headers: headers(token),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`GitHub listInstallationRepos failed: ${res.status}`);
  }
  return mapInstallationRepoList(
    (await res.json()) as { repositories?: InstallationRepoApi[] },
  );
}

/**
 * Setup/callback params GitHub appends to our Setup URL after an install. `state`
 * is what we round-tripped (where to return the user); `installation_id` is the
 * new/confirmed installation. Zod-validated — never trust these raw.
 */
export const SetupCallbackSchema = z.object({
  installation_id: z.coerce.number().int().positive(),
  setup_action: z.string().optional(),
  state: z.string().max(200).optional(),
});
export type SetupCallback = z.infer<typeof SetupCallbackSchema>;

/** Validate the setup-callback query. Returns null on anything malformed. */
export function parseSetupCallback(
  params: URLSearchParams | Record<string, string | undefined>,
): SetupCallback | null {
  const get = (k: string) =>
    params instanceof URLSearchParams ? params.get(k) ?? undefined : params[k];
  const parsed = SetupCallbackSchema.safeParse({
    installation_id: get("installation_id"),
    setup_action: get("setup_action"),
    state: get("state"),
  });
  return parsed.success ? parsed.data : null;
}
