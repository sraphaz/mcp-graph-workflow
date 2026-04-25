/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Sprint 7.4 #7.4.7 — emit a starter CLAUDE.md template at the project
 * root pointing at the `mg <cmd>` workflow + the auto-fired hooks.
 *
 * Idempotent: skipped when CLAUDE.md already exists (we never overwrite
 * the user's project memory). Triggered from sync-configs when the
 * project doesn't yet have one.
 */

import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ScaffoldChange } from "./scaffold.js";

const CLAUDE_MD_TEMPLATE = `# CLAUDE.md

This project uses **mcp-graph** for structured execution. The CLI
binary is \`mg\` (long form: \`mcp-graph\`). Slash commands inside
Claude Code mirror the same surface — see \`/help\` for the full list.

## Daily loop

1. \`mg next\` — pick the next unblocked task.
2. \`mg start <id>\` — claim it.
3. Implement with TDD (red → green → refactor).
4. \`mg finish <id>\` — DoD checks + AC validation + epic promotion.

## Where to look

- Tasks live in \`workflow-graph/graph.db\` (local SQLite). Use
  \`mg list\` to browse, \`mg status\` for the 1-screen overview.
- Logs at \`~/.mcp-graph/logs/{cli,hooks,events}.jsonl\` —
  query with \`mg log [--task <id>] [--hook <name>] [--since 1h]\`.
- Configs are emitted by \`mg init\`; refresh with \`mg config sync\`,
  audit drift with \`mg config check\`.

## Auto-fired hooks

\`mg hooks install\` wires Claude Code hooks (PreToolUse, SessionStart,
PostToolUse, …) into \`.claude/settings.local.json\`. Each event runs
\`mg hook <name>\` which dispatches to the per-event handler:

- **SessionStart** — config-drift check + 1-line health summary.
- **PreToolUse** — lifecycle / code-intel / prereq gate (replaces the
  v10 unified-gate wrapper when MCP_GRAPH_GATES_IN_HOOKS=on).
- **PostToolUse** / **Stop** — telemetry + snapshot (Sprint 7.6).

Status: \`mg hooks status\` (shows last-fire / last-error per hook).
Uninstall idempotent: \`mg hooks uninstall\`.

## Provenance

Every CLI invocation emits a structured entry to cli.jsonl with
source / actor / action / duration_ms / outcome / trace_id. The
redaction patterns are self-tested: run \`mg log --redact-test\` to
prove no secrets leak.

## Conventions

- Branch: feature branches off master; release-please manages
  versioning + CHANGELOG.
- Commits: conventional-commits (\`feat(scope):\`, \`fix(scope):\`, …)
  with a Signed-off-by trailer.
- Tests: vitest, TDD-first; tests live in \`src/tests/\` or alongside
  the module they cover (\`*.test.ts\`).

## Need more?

- \`mg help\` — full command catalogue with fuzzy match.
- \`mg help <topic>\` — focused help.
- \`docs/getting-started/QUICKSTART.md\` — 60-second tour.
- \`AGENTS.md\` — skill catalogue + \`/skill-name\` invocation.
- \`docs/_internal/migration/v10-to-v11-cli.md\` — v10 → v11 cmd map.

> Customize this file. The default template lives in
> \`@mcp-graph-workflow/cli\`. Anything you add stays.
`;

export function emitClaudeMd(cwd: string): ScaffoldChange {
  const path = join(cwd, "CLAUDE.md");
  if (existsSync(path)) {
    return { path, action: "skipped-existing", bytes: 0 };
  }
  writeFileSync(path, CLAUDE_MD_TEMPLATE, "utf8");
  return { path, action: "created", bytes: Buffer.byteLength(CLAUDE_MD_TEMPLATE) };
}
