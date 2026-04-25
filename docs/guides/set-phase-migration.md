# Migration — MCP `set_phase` tool → `mg set-phase` CLI

The MCP tool `set_phase` (called via `mcp__mcp-graph__set_phase` from inside an agent session) is **deprecated in v11** and **removed in v12.0**. Replacement: the `mg set-phase` CLI command (Sprint 7.4 #7.4.7).

This page covers the timeline, the behavior parity, the migration recipe, and the feature flag that controls hook-side enforcement.

## Timeline

| Version | MCP `set_phase` status | `mg set-phase` status | What you'd get |
|---|---|---|---|
| v10.x | Active, primary | Not yet shipped | Set phase only via MCP tool |
| **v11.0.0-beta** | **Deprecated, advisory** | **Active, primary** | Both work; non-blocking deprecation banner on MCP `set_phase` (commit `f42ef54b`) |
| v11.x.* | Deprecated, advisory | Active | Same as beta; banner stays |
| v12.0.0 | **Removed** | Active | MCP tool returns error; CLI is the only path |

The 6-month sunset timeline is documented in commit `6fb0d467` ("docs(changelog): explicit Breaking changes + 6-month sunset timeline").

## Behavior parity

`mg set-phase` and the deprecated MCP tool **share the same SQLite store**. Latest-write wins; you can mix entry points within a single project without inconsistency.

| Aspect | MCP `set_phase` | `mg set-phase` |
|---|---|---|
| Phase write | ✅ same `lifecycle_state` row | ✅ same row |
| Mode (strict/advisory) | ✅ | ✅ |
| Code-intelligence enforcement | ✅ | ✅ (via `--code-intelligence`) |
| Prerequisites enforcement | ✅ | ✅ (via `--prerequisites`) |
| TeamTask + WIP | ✅ | ✅ (via `--team-task`, `--wip-strict`, `--max-in-flight`) |
| Autopilot | ✅ | ✅ (via `--autopilot`, `--sprint-id`) |
| Visible to Claude Code agents | ✅ during the agent's own session | ✅ if the agent runs `mg set-phase` via Bash, or if SessionStart drift hook re-reads |

## Migration recipe

### In agent prompts / `.claude/skills/*`

Wherever you have:

```text
Use the mcp__mcp-graph__set_phase tool with phase=REVIEW.
```

Change to:

```text
Run: mg set-phase REVIEW
```

### In CI / shell scripts

Where you previously had a `claude` invocation just to set phase:

```bash
# old
claude --headless 'mcp__mcp-graph__set_phase --phase IMPLEMENT'

# new
mg set-phase IMPLEMENT
```

### In `.claude/settings.local.json` SessionStart

The `balanced` and `aggressive` hook profiles already call `mg hook session-start`, which detects when the recorded phase mismatches the graph state and prompts a `mg set-phase` rerun. No change needed if you ran `mg hooks install`.

## Feature flag — `MCP_GRAPH_GATES_IN_HOOKS`

A separate concern from the migration: gate enforcement parity between MCP tool and PreToolUse hook. When set to `1`, the PreToolUse hook runs the unified `checkGates` evaluator with the same logic as the MCP server. Default: off (advisory). Source: commit `a4472791` (test parity + flag).

You don't need this flag to migrate. It only affects whether the *hook* enforces gates pre-tool-call. The CLI command `mg set-phase` enforces gates regardless (driven by `--mode`).

## Why the deprecation

ADR-0053 (CLI surface) §"Out of the v11 surface" notes that `set_phase` was MCP-only — un-discoverable from a terminal. v11 brings it (and other v10 MCP-only ops) to the shell so the workflow can be driven without entering an agent chat.

The deprecation is also part of the broader **Hooks-Collapse** initiative referenced as Wave D2 in `docs/_internal/migration/v11-maestro-surface.md`: collapse the implicit hook lifecycle that lived inside MCP tools into explicit, user-facing CLI commands.

## See also

- E1: [`mg hooks` CLI](./mg-hooks.md)
- E2: [`mg set-phase`](./mg-set-phase.md)
- E3: [Hook event reference](./mg-hooks-event-reference.md)
- ADR-0053 — v11 CLI surface
- Sprint 7.4 commit log: `ae897d39` (init template), `60f40c85` (CLI v11 alpha)
- v10 MCP set_phase deprecation banner: commit `f42ef54b`
