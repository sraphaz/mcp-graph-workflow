/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

# Git Workflow Rules

Self-rules derived from observed gaps in the mcp-graph development loop.
Each rule has a **Why** (the gap it closes) and **How to apply** (the trigger).

---

## Rule 1 — Epic Branch Lifecycle (complete before starting next task)

Every feature branch must go through the full lifecycle before a new task is pulled:

```
implement → tests green (isolated) → push → PR created
→ wait for ALL CI checks to pass
→ merge PR (squash preferred for epics)
→ delete local branch: git branch -d <branch>
→ git checkout master && git pull
→ only then: mcp-graph next / start_task
```

**Why:** Starting a new local task while a prior branch is open creates context
drift — the graph thinks you're in LISTENING but local master is stale. If CI
fails post-push you end up fixing two things at once.

**How to apply:** After every `finish_task` on the last story of an epic,
run the full lifecycle above before calling `next`. Never `git checkout -b feat/new`
while `git branch` still shows an open epic branch with a pending PR.

---

## Rule 2 — Pre-existing CI Failures: Verify Before Fixing

Before spending time fixing a CI failure, check if the same failure exists on master:

```bash
# Quick check: does this test fail on master too?
git stash
npx vitest run <failing-test-file>
git stash pop
```

If it fails on master → pre-existing, document and move on (don't block the PR on it).
If it passes on master → regression you introduced, fix it before merging.

**Why:** This session wasted multiple push cycles trying to fix 10+ tests that
were already failing on master. Identifying pre-existing vs regression first
saves 20–40 minutes per cycle.

**How to apply:** Immediately after a CI failure notification, run the two-step
check above. Only invest in fixes for regressions you introduced.

---

## Rule 3 — Security Audit: Use Overrides, Never `npm audit fix`

When `npm audit` fails CI, update `overrides` in `package.json` — never run
`npm audit fix` directly.

```json
"overrides": {
  "vulnerable-pkg": ">=fixed-version"
}
```

Then regenerate with `npm install --package-lock-only`.

**Why:** `npm audit fix` removed 489 packages in one run and broke the build
(`rimraf` missing from `tools/cli`). Overrides are surgical — they force a
specific sub-dependency version without touching the rest of the tree.

**How to apply:** When `Security audit (production deps)` fails CI, run
`npm audit --omit=dev --json` to find the vuln → check `fixAvailable: true` →
add/update the relevant `overrides` entry → reinstall. Verify with
`npm run build` before committing.

---

## Rule 4 — Logger Migration: Exclusions for Code-Gen and Singleton Files

When a layer-compliance migration (`createLogger` adoption) touches `src/core/**`,
always exclude these files from the compliance scan in `layer-compliance.test.ts`:

- `logger.ts` — is the singleton definition itself (not a call site)
- `add-logging.ts` — is a code generator; `logger.debug(...)` appears inside a
  template literal as generated output, not as an actual call

Pattern in `collectTs()`:
```ts
entry !== "logger.ts" && entry !== "add-logging.ts"
```

**Why:** Both files were incorrectly flagged as non-compliant. `logger.ts`
caused infinite recursion when the migration modified it. `add-logging.ts`
caused a false positive because the compliance regex matched template literal
content.

**How to apply:** Before running a bulk migration script on `src/core/**`,
check: does the file produce or define logger calls rather than consume them?
If yes, add it to the exclusion list.

---

## Rule 5 — Static Source Scan Tests: Dual Pattern After Logger Migration

Any test that does a structural source scan (reads a `.ts` file and runs a regex
on its content) must use a dual pattern after a `createLogger` migration:

```ts
// Before migration:
expect(source).toMatch(/logger\.warn.*corrupted-model/);

// After migration (Story 2 pattern):
expect(source).toMatch(/(?:logger|log)\.warn.*corrupted-model/);
```

**Why:** Story 2 migrated `logger.X(...)` → `log.X(...)` across 80+ files.
Static scan tests in `onnx-download-cache-audit.test.ts` hardcoded `logger\.`
and broke silently — they passed the compliance gate but failed shard 2 in CI.

**How to apply:** After any mass migration that changes the logger call site
pattern, grep for `logger\\.` in all `*.test.ts` files and update structural
scan regexes to accept both patterns.

---

## Rule 6 — Hook Files: Check `.sh.off` Before Assuming Tests Are Broken

If `block-dangerous-git-hook.test.ts` fails, check `.claude/hooks/` first:

```bash
ls .claude/hooks/block-dangerous-git.sh*
```

If the file is `.sh.off`, the hook was disabled for a release cascade. Restore
it by renaming (no content change needed):

```bash
mv .claude/hooks/block-dangerous-git.sh.off .claude/hooks/block-dangerous-git.sh
```

**Why:** The hook gets renamed to `.sh.off` during release cascades to avoid
blocking automated pushes. The rename is intentional but temporary — it should
be restored once the cascade is complete.

**How to apply:** After any release cascade closes (PR merged to master, tags
published), check if `block-dangerous-git.sh.off` exists and restore it.
This is always safe — the hook only blocks from inside Claude Code's tool calls,
not from the terminal directly.
