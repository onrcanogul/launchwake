"use client";

import { CodePrompt } from "@/components/settings/CodePrompt";

/**
 * Shows the GitHub Action workflow to copy — comments a distribution plan on
 * every release. The api-key is the project's webhook secret (set up above).
 */
export function ReleaseAction({ hasSecret }: { hasSecret: boolean }) {
  const workflow = `# .github/workflows/launchwake.yml
name: LaunchWake
on:
  release:
    types: [published]
permissions:
  contents: write
  pull-requests: write
jobs:
  plan:
    runs-on: ubuntu-latest
    steps:
      - uses: onrcanogul/launchwake/action@v1
        with:
          api-key: \${{ secrets.LAUNCHWAKE_API_KEY }}`;

  const prompt = `Add a GitHub Actions workflow to this repository that runs LaunchWake on every published release.

Create the file \`.github/workflows/launchwake.yml\`:
- Trigger on \`release\` with type \`published\`.
- Grant the job \`contents: write\` and \`pull-requests: write\` permissions.
- Add one job \`plan\` running on \`ubuntu-latest\` whose only step uses the action \`onrcanogul/launchwake/action@v1\`, passing \`api-key: \${{ secrets.LAUNCHWAKE_API_KEY }}\`.

Then remind me to add my LaunchWake webhook secret as a repository secret named \`LAUNCHWAKE_API_KEY\` (Repo → Settings → Secrets → Actions).

On each published release this builds the distribution plan and comments the link on the GitHub release. Do not add any auto-posting — LaunchWake only drafts plans; a human posts.`;

  return (
    <div style={{ padding: "14px 16px" }}>
      <p style={{ color: "var(--tx2)", fontSize: 12.5, marginBottom: 10 }}>
        Add this workflow to your repo. On every release, LaunchWake builds the
        plan and comments the link on the release — your distribution meets you
        where you ship.
      </p>
      {!hasSecret && (
        <div className="track-status warn" style={{ marginBottom: 10 }}>
          <span className="dot" style={{ background: "var(--warn)" }} />
          Generate a webhook secret above first — that&apos;s the Action&apos;s
          <code className="mono"> api-key</code>.
        </div>
      )}
      <p style={{ color: "var(--tx3)", fontSize: 11.5, marginBottom: 10 }}>
        Add your webhook secret as a repo secret named{" "}
        <code className="mono">LAUNCHWAKE_API_KEY</code> (Repo → Settings →
        Secrets → Actions).
      </p>
      <CodePrompt code={workflow} prompt={prompt} codeLabel="Workflow" />
    </div>
  );
}
