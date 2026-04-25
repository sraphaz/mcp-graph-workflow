# `mg hooks` — install, manage, observe Claude Code hooks

`mg hooks` is the v11 CLI surface for Claude Code's `.claude/settings.local.json` hook configuration. It replaces hand-editing the JSON and the implicit hook lifecycle that lived inside MCP tools.

## Quick start

```bash
mg hooks install              # install the "balanced" profile (default)
mg hooks install --profile aggressive
mg hooks install --dry-run    # preview changes, write nothing

mg hooks status               # 1-screen view of installed hooks + last-fire / last-error per hook
mg hooks uninstall            # remove only mcp-graph entries (other user hooks stay)
```

## Profiles

| Profile | What fires | Use when |
|---|---|---|
| `minimal` | SessionStart only | You only want the boot-time graph drift detection |
| `balanced` *(default)* | SessionStart, PreToolUse on `mcp__mcp-graph__*`, PostToolUse on `Edit|Write|MultiEdit` and `mcp__mcp-graph__finish_task`, Stop | Standard usage — graph stays in sync without overhead on unrelated tools |
| `aggressive` | All of `balanced` + every PreToolUse (regardless of matcher) | Compliance / audit modes where every tool call must be graph-traced |

The full hook map is canonical in `tools/cli/src/core/hooks/install.ts` (`PROFILES` constant). Run `mg hooks status` to see what is currently installed.

## What gets written

Each entry in `.claude/settings.local.json` is tagged with `__mg__: { version, profile, tag: "mcp-graph-hook" }` so `mg hooks uninstall` removes only mcp-graph's entries without disturbing user hooks. The tag also lets `mg hooks status` detect drift (settings file modified externally) and prompt for a re-sync.

Example `balanced` profile entry:

```jsonc
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "mcp__mcp-graph__.*",
      "hooks": [{ "type": "command", "command": "mg hook pre-tool-use" }],
      "__mg__": { "version": "v1", "profile": "balanced", "tag": "mcp-graph-hook" }
    }]
    // ... other events
  }
}
```

## Disabling at runtime

Set `MCP_GRAPH_HOOKS_OFF=1` to disable the dispatcher without uninstalling. Useful for debugging — the entries stay in `settings.local.json`, but `mg hook <name>` becomes a no-op (exit 0).

## See also

- `mg hook <name>` — internal dispatcher invoked by Claude Code; humans should not call this directly. See [Hook event reference](./mg-hooks-event-reference.md) (E3) for what each handler does.
- `mg set-phase` — companion CLI for the `set_phase` MCP tool, deprecated in v11. See [`mg set-phase` guide](./mg-set-phase.md) (E2).
- ADR-0053 — v11 CLI surface (defines `hooks <action>` as one of the meta sub-trees).
- ADR-0054 — capability gate. *Note: hooks themselves are not gated; the `assembleSiblingContext` call inside graph tools is. Hook installation is unaffected by tier.*

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `mg hooks status` says "drift detected" | settings.local.json was hand-edited | `mg hooks install --profile <yours>` to overwrite, or accept drift if intentional |
| Hook doesn't fire | Profile doesn't include that event, or `MCP_GRAPH_HOOKS_OFF=1` | `mg hooks install --profile aggressive`, unset env |
| `mg hook <name>` errors logged but not user-visible | Hooks are fail-silent by design | Tail `~/.mcp-graph/logs/hooks.jsonl` |

## Files

- Code: `tools/cli/src/core/hooks/install.ts` (install/uninstall/drift)
- Dispatcher: `tools/cli/src/commands/hook-dispatch.ts` (`mg hook <name>` runtime)
- UI: `tools/cli/src/commands/hooks.tsx` (Ink-based `mg hooks status`)
- Logs: `~/.mcp-graph/logs/hooks.jsonl` (structured, fail-silent)
- Config: `.claude/settings.local.json` (project-scoped, never global)
