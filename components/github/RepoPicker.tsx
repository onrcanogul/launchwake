"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import type { GithubRepo } from "@/lib/github";

/**
 * Searchable repo select for the GitHub App installation. Lists granted repos
 * (private included, newest push first) with a private badge; selecting one calls
 * `onSelect`. Presentation only — the parent owns what "selected" means.
 */
export function RepoPicker({
  repos,
  onSelect,
  autoFocus,
}: {
  repos: GithubRepo[];
  onSelect: (repo: GithubRepo) => void;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? repos.filter(
          (r) =>
            r.fullName.toLowerCase().includes(q) ||
            (r.description ?? "").toLowerCase().includes(q),
        )
      : repos;
    return list.slice(0, 40);
  }, [repos, query]);

  return (
    <div className="repo-picker">
      <div className="repo-search">
        <Icon name="search" />
        <input
          className="inp"
          placeholder="Search your repositories…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus={autoFocus}
          aria-label="Search repositories"
        />
      </div>
      <div className="repo-menu" role="listbox">
        {filtered.length === 0 ? (
          <div className="repo-empty">No matching repos.</div>
        ) : (
          filtered.map((r) => (
            <button
              key={r.fullName}
              type="button"
              className="repo-opt"
              role="option"
              aria-selected="false"
              onClick={() => onSelect(r)}
            >
              <Icon name="github" />
              <span className="repo-opt-name">{r.fullName}</span>
              {r.private && (
                <span className="repo-badge">
                  <Icon name="lock" /> Private
                </span>
              )}
              {r.description && (
                <span className="repo-opt-desc">{r.description}</span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
