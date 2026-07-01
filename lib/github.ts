import { env } from "./env";
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
};

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
