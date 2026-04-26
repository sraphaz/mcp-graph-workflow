---
name: mcp-graph-release-monitor
description: |
  Monitor an mcp-graph PR (or master push) until @mcp-graph-workflow/mcp-graph
  reaches a target version on npm. Auto-fixes the five known pipeline failure
  modes (R1 dashboard dual-react install, R2 release-please root-output gate,
  R3 manifest desync, R4 taxonomy gap on new tool, R5 missing scan check on
  non-deps PRs). TRIGGER when user asks to release, publish, or monitor a PR
  until npm publishes (e.g. "publish 12.0.x", "monitor PR 262 until v12 lands
  on npm", "fix until npm 12.x is published"). Skip for unrelated repos —
  this skill assumes the mcp-graph-workflow layout.
---

# mcp-graph-release-monitor

Drives the release pipeline for `@mcp-graph-workflow/mcp-graph` from a target
PR through npm publish, auto-fixing the documented failure modes.

## When to use

Trigger phrases (any language):
- "release / publish / shipar 12.x"
- "monitor PR <N> until npm publishes"
- "loop até a release v<X> sair no npm"
- "watch the release pipeline and fix until v<X> goes out"

Do **not** use for:
- Repos other than `DiegoNogueiraDev/mcp-graph-workflow`.
- Pre-release PRs that are not yet ready to ship.

## Pre-flight probe (1 message)

Run these in parallel and report the snapshot:

```bash
gh pr view <PR> --json state,mergeStateStatus,mergedAt,headRefName
gh pr checks <PR>
gh pr list --state open --json number,title          # release-please PRs
gh run list --branch master --workflow release.yml --limit 3 \
  --json databaseId,status,conclusion,createdAt
npm view @mcp-graph-workflow/mcp-graph version
```

If the user hasn't named a target version, infer it from the PR's commits
(`feat!:` ⇒ major bump, `feat:` ⇒ minor, `fix:`/others ⇒ patch). Confirm with
the user before arming the monitor only when the PR includes a `feat!:` (a
breaking-change bump is destructive enough to verify intent).

## Arm Monitor

```bash
prev=""
while true; do
  pr=$(gh pr view <PR> --json state,mergeStateStatus,mergedAt 2>/dev/null \
    | jq -r '"pr=\(.state)/\(.mergeStateStatus)/merged=\(.mergedAt)"' \
    || echo "pr=ERR")
  failing=$(gh pr checks <PR> 2>/dev/null \
    | awk -F'\t' '$2=="fail"{print $1}' | tr '\n' ',' || true)
  rp=$(gh pr list --search "release-please in:title" --state open \
        --json number,title --limit 5 2>/dev/null \
        | jq -r '.[] | "rp=#\(.number)"' | tr '\n' '|' || echo "rp=ERR")
  npm_latest=$(npm view @mcp-graph-workflow/mcp-graph version 2>/dev/null \
                || echo "none")
  cur="$pr | failing=$failing | $rp | npm_latest=$npm_latest"
  if [ "$cur" != "$prev" ]; then
    echo "[$(date -u +%H:%M:%SZ)] $cur"
    prev="$cur"
  fi
  case "$npm_latest" in
    <CURRENT>|none) ;;
    <TARGET_MAJOR>.*) echo "[$(date -u +%H:%M:%SZ)] PUBLISHED $npm_latest"; break;;
  esac
  sleep 60
done
```

Substitute `<CURRENT>` (the version currently published) and `<TARGET_MAJOR>`
(e.g., `12`) before arming. Use the **Monitor** tool with `persistent: true`
and `timeout_ms: 3600000`.

Each stdout line wakes this skill via `<task-notification>`. Idle wakeups
should set a `ScheduleWakeup` fallback heartbeat at 1500s (cache-aware).

## Failure recipes

Apply the matching one when its signature appears in monitor events. Each
recipe ends with: stage → commit (signed off, conventional-commit prefix) →
push → ensure auto-merge is armed.

### R1 — recharts `useContext` null in shard logs

**Signature:** `Cannot read properties of null (reading 'useContext')` at
`recharts/lib/component/ResponsiveContainer.js`, in test (1)/(2)/(3)/(4).

**Root cause:** `tools/cli` pins `react@18.3.1` (Ink dep). A separate
`src/web/dashboard/package-lock.json` plus a dedicated `cd src/web/dashboard
&& npm ci` install step in CI materialized a second physical react copy
under the dashboard, which `recharts` resolved instead of the hoisted root
`react@19`.

**Fix (canonical: commits `f5d3b77` + `c0ac857`):**
1. Audit `src/web/dashboard/package.json` — must NOT list `react` or
   `react-dom` as deps (workspace hoist covers it).
2. Audit `src/web/dashboard/package-lock.json` — must NOT exist; if present,
   `git rm` it.
3. Audit `.github/actions/setup/action.yml` — must NOT do `cd
   src/web/dashboard && npm ci`.
4. Audit `vitest.config.ts` dashboard project — `resolve.dedupe: ["react",
   "react-dom"]` belt-and-suspenders.

### R2 — publish job skipped despite tag created

**Signature:** GitHub release `mcp-graph-v<X>` exists but `gh run view <id>
--json jobs` shows `publish: skipped`. `npm view ... version` does not flip.

**Root cause:** `release.yml` gated `publish` on `steps.release.outputs['.--release_created']`,
which release-please-action v4 silently never flowed through (only
`<path>--*` outputs flow for non-root paths).

**Fix (canonical: commit `c535f37`):** in `.github/workflows/release.yml`
job `release-please.outputs`:
```yaml
root_release_created: ${{ contains(fromJSON(steps.release.outputs.paths_released || '[]'), '.') }}
```

### R3 — release-please proposes wrong major

**Signature:** PR title `chore: release master` proposes `vX+1.0.0` when
target is `vX.0.0`.

**Root cause:** somebody pre-bumped `package.json` and/or
`.release-please-manifest.json` to the target version. release-please reads
the manifest as "current released version" and adds the bump on top.

**Fix (canonical: PR #260 / commit `727559d`):** revert both
`package.json:version` and `.release-please-manifest.json[\".\"]` to the
**last published** version. Push to master; release-please will regenerate
the release PR with the correct bump.

### R4 — taxonomy contract test fails

**Signature:** `profile '<P>' registered un-allowed tool <name>: expected
false to be true` in `src/tests/profile-registration.test.ts`.

**Root cause:** a new MCP tool was registered in `src/mcp/tools/index.ts`
without a corresponding entry in `TOOL_TAXONOMY`.

**Fix (canonical: commit `a1497dd`):** add the missing entry to
`src/mcp/tools/taxonomy.ts`. Default to `"expert"` unless the tool is part
of the daily work loop.

### R5 — required `scan` check missing, all other checks pass

**Signature:** `gh pr view <N> --json mergeStateStatus` returns `BLOCKED`,
`gh pr checks <N>` shows everything green, but `gh api .../check-runs` does
not include `scan`.

**Root cause:** `.github/workflows/license-deps-scan.yml` had `on.paths`
filters; PRs that don't touch deps simply don't trigger the workflow,
and branch protection requires `scan`.

**Fix:** `license-deps-scan.yml` now always emits the `scan` check via a
`changes` filter job + conditional steps. If you encounter R5 on an old
branch from before this fix landed, ask the user before doing
`gh pr merge <N> --squash --admin --delete-branch` (admin override).

## Auto-merge

After every push, ensure auto-merge is armed:

```bash
gh pr merge <PR> --squash --auto --delete-branch
```

When release-please opens its release PR, `release.yml` has an "Auto-merge
release PR" step but it has historically raced label application. After
each release-please run completes, check `gh pr view <release_pr_number>
--json autoMergeRequest`; if null, arm manually as above.

## Termination

When monitor emits `PUBLISHED npm @mcp-graph-workflow/mcp-graph@<target>`:
1. Send `PushNotification` with the version (≤200 chars, no markdown).
2. Stop — do not arm a new wakeup.
3. Do not auto-create a follow-up scheduled job.

## Safety rails

- **Never** run `gh pr merge --admin` without explicit user authorization in
  the current turn.
- **Never** delete tags or GitHub releases without explicit user
  authorization (the v13 rollback in the canonical history needed an
  explicit "go" from the user).
- **Never** force-push to master.
- **Never** publish to npm directly with `npm publish`; release-please owns
  the publish path and any direct publish would create version drift.

## Related files

- `.github/workflows/ci.yml` — main CI; the `changes`-job pattern this skill
  recommends mirrors what `ci.yml` already does.
- `.github/workflows/release.yml` — owns release-please + publish.
- `.github/actions/setup/action.yml` — shared dep install (R1).
- `release-please-config.json` + `.release-please-manifest.json` — release
  source of truth (R3).
- `src/mcp/tools/taxonomy.ts` — taxonomy map (R4).
- `vitest.config.ts` — dashboard project resolve.dedupe (R1 belt-and-suspenders).
