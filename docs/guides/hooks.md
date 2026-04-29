# `mcp-graph hooks` — install, manage, observe Claude Code hooks

`mcp-graph hooks` is the CLI surface design for Claude Code's `.claude/settings.local.json` hook configuration. It replaces hand-editing the JSON and the implicit hook lifecycle that lived inside MCP tools.

## Quick start

```bash
mcp-graph hooks install              # install the "balanced" profile (default)
mcp-graph hooks install --profile aggressive
mcp-graph hooks install --dry-run    # preview changes, write nothing

mcp-graph hooks status               # 1-screen view of installed hooks + last-fire / last-error per hook
mcp-graph hooks uninstall            # remove only mcp-graph entries (other user hooks stay)
```

## Profiles

| Profile | What fires | Use when |
|---|---|---|
| `minimal` | SessionStart only | You only want the boot-time graph drift detection |
| `balanced` *(default)* | SessionStart, PreToolUse on `mcp__mcp-graph__*`, PostToolUse on `Edit|Write|MultiEdit` and `mcp__mcp-graph__finish_task`, Stop | Standard usage — graph stays in sync without overhead on unrelated tools |
| `aggressive` | All of `balanced` + every PreToolUse (regardless of matcher) | Compliance / audit modes where every tool call must be graph-traced |

The full hook map is canonical in `tools/cli/src/core/hooks/install.ts` (`PROFILES` constant). Run `mcp-graph hooks status` to see what is currently installed.

## What gets written

Each entry in `.claude/settings.local.json` is tagged with `__mg__: { version, profile, tag: "mcp-graph-hook" }` so `mcp-graph hooks uninstall` removes only mcp-graph's entries without disturbing user hooks. The tag also lets `mcp-graph hooks status` detect drift (settings file modified externally) and prompt for a re-sync.

Example `balanced` profile entry:

```jsonc
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "mcp__mcp-graph__.*",
      "hooks": [{ "type": "command", "command": "mcp-graph hook pre-tool-use" }],
      "__mg__": { "version": "v1", "profile": "balanced", "tag": "mcp-graph-hook" }
    }]
    // ... other events
  }
}
```

## Disabling at runtime

Set `MCP_GRAPH_HOOKS_OFF=1` to disable the dispatcher without uninstalling. Useful for debugging — the entries stay in `settings.local.json`, but `mcp-graph hook <name>` becomes a no-op (exit 0).

## See also

- `mcp-graph hook <name>` — internal dispatcher invoked by Claude Code; humans should not call this directly. See [Hook event reference](./hooks-event-reference.md) (E3) for what each handler does.
- `mcp-graph set-phase` — companion CLI for the `set_phase` MCP tool, deprecated . See [`mcp-graph set-phase` guide](./set-phase.md) (E2).
- ADR-0053 — CLI surface design (defines `hooks <action>` as one of the meta sub-trees).
- ADR-0054 — capability gate. *Note: hooks themselves are not gated; the `assembleSiblingContext` call inside graph tools is. Hook installation is unaffected by tier.*

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `mcp-graph hooks status` says "drift detected" | settings.local.json was hand-edited | `mcp-graph hooks install --profile <yours>` to overwrite, or accept drift if intentional |
| Hook doesn't fire | Profile doesn't include that event, or `MCP_GRAPH_HOOKS_OFF=1` | `mcp-graph hooks install --profile aggressive`, unset env |
| `mcp-graph hook <name>` errors logged but not user-visible | Hooks are fail-silent by design | Tail `~/.mcp-graph/logs/hooks.jsonl` |

## Files

- Code: `tools/cli/src/core/hooks/install.ts` (install/uninstall/drift)
- Dispatcher: `tools/cli/src/commands/hook-dispatch.ts` (`mcp-graph hook <name>` runtime)
- UI: `tools/cli/src/commands/hooks.tsx` (Ink-based `mcp-graph hooks status`)
- Logs: `~/.mcp-graph/logs/hooks.jsonl` (structured, fail-silent)
- Config: `.claude/settings.local.json` (project-scoped, never global)

---

## Runtime hook handlers (MCP tool `hooks`)

The CLI surface above (`mcp-graph hooks ...`) installs Claude Code hooks. Separately, the **MCP tool `hooks`** lets agents register **runtime handlers** that fire on the 12 internal lifecycle channels (`task:pre-execute`, `tool:pre-call`, `session:start`, etc. — see [hooks-event-reference.md](./hooks-event-reference.md)).

### Sandbox by default — `kind: "shell"`

Sprint 2 (Hooks Integration PRD) replaced the legacy `new Function()` path with subprocess handlers. Default registration:

```jsonc
mcp__mcp-graph__hooks({
  "action": "register",
  "channel": "tool:pre-call",
  "kind": "shell",                          // default; can be omitted
  "command": ".mcp-graph/handlers/block-rm-rf.sh",
  "commandArgs": ["--strict"],              // optional
  "timeoutMs": 5000                         // optional, default 5000
})
```

Contract for the script:

| Channel | What you get on stdin | What you return |
|---|---|---|
| any `*:pre-*` | `{ channel, timestamp, payload }` (one JSON line + EOF) | exit 0 = pass, **exit 2 = block** (stderr → contexto do model), other = warn (logged) |
| any `*:post-*` | same | exit code is logged but not enforced — post-* is fire-and-forget |

Env in the subprocess is scrubbed to `PATH`, `HOME`, and any `MCP_GRAPH_*` keys plus an explicit `env` block in the registration. Stderr is captured up to 64 KiB and truncated with an explicit marker. Hung processes are SIGKILLed at `timeoutMs`.

### Legacy `kind: "inline-unsafe"` (gated)

The pre-Sprint-2 inline JavaScript path still exists for migration but is disabled by default:

```bash
MCP_GRAPH_HOOKS_INLINE_UNSAFE=true mcp-graph serve
```

When enabled, every `register` with `kind: "inline-unsafe"` logs an explicit security warning. The flag will be removed once all built-in handlers migrate to shell.

### Files

- Subprocess runner: `src/core/hooks/shell-handler.ts`
- MCP tool: `src/mcp/tools/hooks.ts`
- Tests: `src/tests/shell-handler.test.ts`, `src/tests/shell-handler-security.test.ts`, `src/tests/mcp-tool-hooks.test.ts`
