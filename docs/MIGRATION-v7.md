# Migration Guide: v6.x to v7.0

This guide covers all breaking changes in mcp-graph v7.0.0 and how to update your workflow.

## Removed: 6 Deprecated MCP Tools

The following tools were deprecated in v5.5 and have been removed in v7.0:

| Removed Tool | Replacement | Migration |
|-------------|-------------|-----------|
| `add_node` | `node` | `node({ action: "add", type: "task", title: "..." })` |
| `update_node` | `node` | `node({ action: "update", id: "...", title: "..." })` |
| `delete_node` | `node` | `node({ action: "delete", id: "..." })` |
| `validate_task` | `validate` | `validate({ action: "task", url: "...", nodeId: "..." })` |
| `validate_ac` | `validate` | `validate({ action: "ac", nodeId: "..." })` |
| `list_skills` | `manage_skill` | `manage_skill({ action: "list" })` or `manage_skill({ action: "list", skillName: "..." })` |

**Action required:** Update any automation scripts, CLAUDE.md instructions, or skill files that reference the old tool names.

## Removed: Legacy Directory Migration

In v6.x, mcp-graph automatically migrated data from the legacy `.mcp-graph/` directory to `workflow-graph/`.

**In v7.0, this automatic migration is removed.** If you still have a `.mcp-graph/` directory:

1. Rename it manually before upgrading:
   ```bash
   mv .mcp-graph workflow-graph
   ```
2. Or simply run `mcp-graph init` to create a new `workflow-graph/` store.

## Schema Changes

### `blocked` field now defaults to `false`

The `blocked` field on graph nodes now has a default value of `false` instead of being optional. This is handled automatically by Migration v30 which backfills any NULL values.

### Migration v30 (automatic)

On first run with v7.0, Migration v30 will automatically:
- Set `status = 'backlog'` for any nodes with NULL status
- Set `priority = 3` for any nodes with NULL priority
- Set `blocked = false` for any nodes with NULL blocked
- Rebuild FTS5 search indexes for optimal performance

**Recommendation:** Back up your `workflow-graph/graph.db` before upgrading.

## Security: Path Traversal Protection

v7.0 introduces centralized path traversal protection via `assertPathInside()`. This affects:

- `write_memory` / `read_memory` / `delete_memory` — memory names with `../`, null bytes, or URL-encoded traversal sequences will now throw `PathTraversalError`
- `import_prd` — file paths outside the project root are rejected
- `import_graph` — file paths outside the project root are rejected

**If you use legitimate paths with special characters**, they should continue to work. Only malicious traversal patterns are blocked.

## Architecture: Unified Gate System

The lifecycle enforcement wrapper (`lifecycle-wrapper.ts`) and code intelligence wrapper (`code-intelligence-wrapper.ts`) have been merged into a single `unified-gate.ts`.

**Impact:** None for end users. This is an internal refactoring that:
- Eliminates deadlock bugs (#001-#007) from double-wrapping
- Reduces overhead by reading store/doc/phase once per tool call instead of twice
- Simplifies the codebase by ~400 LOC

If you imported from these files directly (unusual), they still re-export from `unified-gate.ts` for backward compatibility.

## Tool Classification: Single Source of Truth

`ALWAYS_ALLOWED_TOOLS`, `READ_ONLY_TOOLS`, and `BOOTSTRAP_TOOLS` are now all defined in `src/core/utils/constants.ts`. The file `src/mcp/tool-classification.ts` re-exports them for backward compatibility.

## Knowledge Store: Auto-Pruning

New method `KnowledgeStore.autoprune(budgetLimit, dryRun?)` automatically removes the oldest documents when the count exceeds 2x the budget limit. This helps prevent knowledge store bloat over time.

## New: 155 Skills

v7.0 includes 155 skill definitions in `skills-graph/` covering audio processing, computer vision, IoT, ML/AI ops, NLP, data pipelines, and autonomous Nirvana systems.

## Dependency Updates

| Package | v6.x | v7.0 |
|---------|------|------|
| TypeScript (peer) | >=5.0.0 | >=5.0.0 \|\| >=6.0.0 |
| @modelcontextprotocol/sdk | ^1.27.1 | ^1.29.0 |
| @playwright/test | ^1.58.2 | ^1.59.1 |
| ESLint | ^10.0.3 | ^10.2.0 |

## Quick Checklist

- [ ] Rename `.mcp-graph/` to `workflow-graph/` if still present
- [ ] Back up `workflow-graph/graph.db` before upgrading
- [ ] Replace `add_node` calls with `node({ action: "add", ... })`
- [ ] Replace `update_node` calls with `node({ action: "update", ... })`
- [ ] Replace `delete_node` calls with `node({ action: "delete", ... })`
- [ ] Replace `validate_task` calls with `validate({ action: "task", ... })`
- [ ] Replace `validate_ac` calls with `validate({ action: "ac", ... })`
- [ ] Replace `list_skills` calls with `manage_skill({ action: "list", ... })`
- [ ] Run `npm test` to verify no regressions
