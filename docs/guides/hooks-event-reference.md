# Hook event reference — what fires when, and what each `mcp-graph hook <name>` handler does

This page documents every hook entry the `balanced` and `aggressive` profiles install. For installation see [E1 `mcp-graph hooks` CLI](./hooks.md).

## Lifecycle map

| Claude Code event | Matcher | Profiles | `mcp-graph hook <name>` | Handler does |
|---|---|---|---|---|
| `SessionStart` | — | minimal, balanced, aggressive | `session-start` | Detects `.claude/settings.local.json` drift, emits 1-line summary + drift detail. Auto-suggests `mcp-graph hooks install` re-sync if drift detected. |
| `PreToolUse` | `mcp__mcp-graph__.*` | balanced, aggressive | `pre-tool-use` | Evaluates unified gates (`checkGates` parity with MCP server). Behind `MCP_GRAPH_GATES_IN_HOOKS=1` flag; off by default. |
| `PreToolUse` | `*` (any) | aggressive only | `pre-tool-use` | Same handler, broader scope — emits a tool-call audit row regardless of matcher. |
| `PostToolUse` | `Edit\|Write\|MultiEdit` | balanced, aggressive | `post-edit` | Refreshes graph artifacts touched by the edit; advisory harness scan diff. |
| `PostToolUse` | `mcp__mcp-graph__finish_task` | balanced, aggressive | `post-finish-task` | Validates DoD chain post-completion; emits success summary. |
| `Stop` | — | balanced, aggressive | `session-stop` | Flushes structured logs, persists session-end row. |

Each handler is **non-blocking and fail-silent**: a failure in any handler emits a structured `error` event to `~/.mcp-graph/logs/hooks.jsonl` but never blocks the parent tool call. Hook execution is capped at ~5ms tick before stdin parsing falls back to best-effort.

## Disabling globally

`MCP_GRAPH_HOOKS_OFF=1` short-circuits every handler to `exitCode: 0` immediately — useful for debugging without uninstalling.

## Disabling specific events

Edit the profile in `tools/cli/src/core/hooks/install.ts` and `mcp-graph hooks install` again. Or remove the specific entry by hand and accept the drift on next `SessionStart`.

## Hook stdin contract

Claude Code passes hook context as JSON on stdin. Handlers parse with `parsePreToolUseStdin` (and analogues) but never wait — if stdin is unreadable or malformed, the handler emits a `warn` event and continues. Handlers must NOT print user-visible output unless they're reporting a non-trivial outcome (e.g. SessionStart drift detected); routine "ok" runs are silent.

## Structured event format

Every handler invocation produces one line in `~/.mcp-graph/logs/hooks.jsonl`:

```jsonc
{
  "ts": "2026-04-25T18:43:11Z",
  "hook": "post-edit",
  "outcome": "ok",
  "duration_ms": 4,
  "detail": { "files_touched": 2, "harness_delta": null }
}
```

Use `mcp-graph log --hook post-edit` to query. `outcome` is `ok | warn | error`; tools/cli/src/commands/hook-dispatch.ts is the source of truth.

## Sprint history

Hook lifecycle was assembled in stages:

| Sprint | Item | Commit |
|---|---|---|
| 7.5 | Skeleton handlers + structured emission | `60f40c85` |
| 7.6 | SessionStart drift detection + re-sync hint | `153fe1b9` |
| 7.6 | SessionStart 1-line summary | `5f4039f6` |
| 7.6 | `mcp-graph hooks status` last-fire / last-error per hook | `ff6ef964` |
| 7.5 | PreToolUse handler + lazy gate deps | `37144187` |
| 7.6 | `MCP_GRAPH_GATES_IN_HOOKS` parity flag | `a4472791` |

## See also

- E1: [`mcp-graph hooks` CLI](./hooks.md) — install/uninstall/status surface
- E2: [`mcp-graph set-phase`](./set-phase.md) — companion CLI, also exposed via SessionStart drift
- E4: [Migration MCP `set_phase` → CLI `mcp-graph set-phase`](./set-phase-migration.md)
- ADR-0053 — v11 CLI surface
- ADR-0054 — capability gate (hooks themselves are unaffected; only `assembleSiblingContext` call sites are gated)
