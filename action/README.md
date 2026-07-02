# LaunchWake Distribution Plan — GitHub Action

When you cut a release (or merge a PR), this Action asks LaunchWake to build a
**distribution plan** for it — which communities to post in, each one's ban
risk, and the safe way in — then comments the plan link right on the release/PR.

Two reasons it exists:

- **Retention:** the plan meets you in your workflow, where you already ship.
- **Reach:** the comment carries a link any reader can follow to plan their own
  launch (LaunchWake is a distribution co-pilot for technical founders).

## Setup

1. In LaunchWake → **Settings → GitHub auto-detect**, connect your repo and
   generate a **webhook secret**. That secret is the Action's `api-key`.
2. Add it as a repo secret, e.g. `LAUNCHWAKE_API_KEY`.
3. Add a workflow:

```yaml
# .github/workflows/launchwake.yml
name: LaunchWake
on:
  release:
    types: [published]
  # optional — also comment on merged PRs:
  # pull_request:
  #   types: [closed]
permissions:
  contents: write        # to append the plan to the release body
  pull-requests: write   # to comment on PRs
jobs:
  plan:
    runs-on: ubuntu-latest
    steps:
      - uses: onrcanogul/launchwake/action@v1
        with:
          api-key: ${{ secrets.LAUNCHWAKE_API_KEY }}
```

That's it. On the next release, LaunchWake builds the plan and posts the link.

## Inputs

| Input          | Required | Default                    | Description                                        |
| -------------- | -------- | -------------------------- | -------------------------------------------------- |
| `api-key`      | yes      | —                          | Your LaunchWake project webhook secret.            |
| `api-url`      | no       | `https://launchwake.com`   | LaunchWake base URL (for self-hosted deployments). |
| `github-token` | no       | `${{ github.token }}`      | Token used to comment.                             |

The Action never posts to your channels — it only comments the plan link.
LaunchWake generates drafts and plans; you press publish.
