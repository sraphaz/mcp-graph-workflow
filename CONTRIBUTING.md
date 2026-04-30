<!--
  SPDX-License-Identifier: AGPL-3.0-or-later
  Copyright © 2026 Diego Lima Nogueira de Paula
-->

# Contributing to mcp-graph

Thanks for your interest. This guide is short on purpose: the goal is to
make sure your PR lands in CI green on the first try.

## Setup

```bash
git clone https://github.com/DiegoNogueiraDev/mcp-graph-workflow
cd mcp-graph-workflow
npm install
```

`npm install` triggers husky to register the local git hooks (`pre-commit`,
`pre-push`, `commit-msg`). Don't skip it.

## Daily loop

1. Branch off `master` with a descriptive name (`feat/<thing>`,
   `fix/<thing>`, `chore/<thing>`).
2. Make your change. Tests live next to the source under
   `src/tests/<file>.test.ts`.
3. Commit with a conventional-commit subject and a `Signed-off-by` trailer
   (your editor's git plugin or `git commit -s -m "feat(scope): subject"`
   adds it).
4. `git push` triggers the **preflight** gate (see below).

## The preflight gate

Before every `git push`, husky runs `npm run preflight` which mirrors what
CI runs, in the same order:

| # | Gate | What it catches |
|---|------|-----------------|
| 1 | `npm run typecheck` | TS errors |
| 2 | `npm run lint` | ESLint warnings (max 20 baseline) |
| 3 | `npm run spdx:check` | Files in `src/` missing the SPDX header |
| 4 | `npx commitlint --from origin/master --to HEAD` | Bad commit subjects, missing `Signed-off-by` |
| 5 | `npx vitest run` | Failing tests |

A failing step prints a one-line hint pointing to the fix.

**Skip flags** (use sparingly — they undo the safety net):

```bash
MCP_GRAPH_PREFLIGHT_SKIP_TESTS=1 git push       # skip step 5
MCP_GRAPH_PREFLIGHT_SKIP_COMMITLINT=1 git push  # skip step 4
git push --no-verify                            # skip everything
```

## SPDX headers

Every `.ts`/`.tsx` file in `src/` must carry the SPDX header from
`.license-header.tpl`. The good news: you don't have to type it. When you
`git commit`, lint-staged auto-runs
`scripts/license/headers.mjs --apply` on the staged file and stamps the
header for you. New files just work.

If you ever see CI fail on `check-spdx`, run locally:

```bash
npm run spdx:apply
git add .
git commit -s -m "chore: stamp SPDX headers"
```

## Commit message format

We use Conventional Commits with a few project-specific rules:

```text
<type>(<optional scope>): <subject>

<optional body>

Signed-off-by: Your Name <you@example.com>
```

Valid types: `feat`, `fix`, `perf`, `refactor`, `docs`, `chore`, `ci`,
`test`, `build`, `style`, `deps`, `license`, `security`.

PR titles must follow the same format — `validate` job in CI rejects
`v13: …` style titles. Use `feat(release): v13 — …`.

`Signed-off-by` is required (DCO substitute). `git commit -s` adds it.

## CLA + bots

Every human contributor signs the CLA once. Comment on your PR exactly:

> I have read the CLA Document and I hereby sign the CLA

The bot records your signature in
`DiegoNogueiraDev/mcp-graph-cla-signatures` so future PRs from you skip
the prompt.

**Co-authoring with bots / AI assistants** (Claude, Copilot, etc.) needs
the bot's GitHub login on the allowlist in `.github/workflows/cla.yml`.
Currently allowed:

- `dependabot[bot]`, `renovate[bot]`, `*[bot]` (wildcard for bots)
- `DiegoNogueiraDev` (project owner)
- `claude` (Claude Code AI)

If you co-author with a bot account that isn't on the list, edit the
allowlist in `.github/workflows/cla.yml` and the change ships with your
PR — but the change must merge to `master` before the CLA check on your
PR re-evaluates (because `pull_request_target` reads the workflow from
the base branch). For an active PR, the project owner can cherry-pick the
allowlist update directly to `master` to unblock without rewriting your
branch's history.

If the CLA check stays red after an allowlist update or signature comment,
post `recheck` on the PR — the bot re-runs.

## Pull request workflow

1. Push your branch with preflight green.
2. `gh pr create --base master --head <your-branch> --fill` (or via the
   web UI).
3. Wait for CI. If a check fails, the most likely culprits are listed
   below.

### Common CI failures and fixes

| CI check | Fix |
|----------|-----|
| `check-spdx` | `npm run spdx:apply && git commit -s -am "chore: spdx"` |
| `commitlint` | Amend the offending commit message with valid type + sign-off, then force-push |
| `cla` | Sign the CLA in a PR comment, or add your login to `.github/workflows/cla.yml` allowlist (admin merges to master) |
| `validate` (PR title) | `gh pr edit <num> --title "feat(scope): subject"` |
| `test (N)` shell-handler stderr | Should not happen — fix lives in `src/core/hooks/shell-handler.ts` (b52562f). If recurring, file an issue. |
| `test (N)` ECONNRESET | Network flake on the runner. The setup action retries 3 times automatically; if all 3 fail, `gh run rerun <id> --failed` after the workflow completes. |

If the CI failure is genuinely a flake (transient, no real signal), the
project owner can rerun the failed job; if it persists across reruns,
treat it as a real bug and fix on your branch.

## Where to read more

- `CLAUDE.md` — project overview, stack conventions, commands
- `.claude/rules/` — per-area rules (cli, core, schemas, tests, web, …)
- `docs/ARCHITECTURE.md` — local architecture map (AISE / SDD / CDE)
- `CLA.md` — full CLA text
