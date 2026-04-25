# v10 → v11 CLI migration

This guide walks through the changes between `@mcp-graph-workflow/mcp-graph` v10.x and the new `@mcp-graph-workflow/cli` v11.0. **v10 keeps working for 6 months** with a deprecation banner; v12.0 removes it. There is no forced upgrade — adopt at your own pace.

## TL;DR

```bash
# old (v10):
npm install -g @mcp-graph-workflow/mcp-graph
mcp-graph init && mcp-graph stats

# new (v11):
npm install -g @mcp-graph-workflow/cli
mg init && mg status
# (`mcp-graph` long form also works in v11 — bound to the same binary)
```

Three things are new and worth noting before you migrate:

1. **`mg` is now the daily binary.** `mcp-graph` is still aliased to it for backward compat (ADR-0052).
2. **REPL** — typing just `mg` enters an interactive `/slash`-command shell with autocomplete.
3. **Auto-config** — `mg init` writes `.mcp.json`, `.vscode/mcp.json`, `.cursor/mcp.json`, and `.claude/settings.local.json` for you. No more JSON-by-hand.

## Command-by-command map

| v10 (`mcp-graph …`) | v11 equivalent | Compat note |
|---|---|---|
| `mcp-graph init` | `mg init` (interactive) · `mg init --force` | v11 auto-emits IDE configs; `--force` overrides existing |
| `mcp-graph serve` | `mg ui` | Same Express :3000; `--port N` to override |
| `mcp-graph dashboard:dev` | `mg ui --dev` | Subcommand → flag |
| `mcp-graph import <file>` | `mg add prd <file>` | (planned 7.3.1) — `mg add` covers task/epic/decision today |
| `mcp-graph stats` | `mg status` · `mg status --oneline` · `mg status --json` | `--json` shape is preserved |
| `mcp-graph index` | (auto, on capture/import) | Still triggerable manually if needed |
| `mcp-graph doctor` | `mg status --doctor` | Folded into status |
| `mcp-graph update` | npm-native (`update-notifier` banner) | No CLI subcommand |
| (none) | `mg add <type>` | NEW — create task/epic/decision/risk with provenance |
| (none) | `mg start <id>` | NEW — backlog/ready → in_progress with TDD checklist |
| (none) | `mg finish` | NEW — auto-detects in-progress task; suggests next |
| (none) | `mg next` | NEW — animated card of the next unblocked task |
| (none) | `mg list` | NEW — searchable task browser (status/type/search/limit) |
| (none) | `mg login` | NEW — Copilot device-flow auth (no VS Code) |
| (none) | `mg demo` | NEW — ephemeral sandbox for first-value tour |
| (none) | `mg config sync\|check` | NEW — manage IDE/agent configs |
| (none) | `mg hooks install\|uninstall\|status` | NEW — Claude Code hooks for zero-intervention workflow |
| (none) | `mg log` | NEW — query structured logs with filters |
| MCP tool `mcp__mcp-graph__next_task` | `mg next` | First-class CLI; MCP tool stays for conversational use |
| MCP tool `mcp__mcp-graph__start_task` | `mg start <id>` | Same |
| MCP tool `mcp__mcp-graph__finish_task` | `mg finish` | Same |
| MCP tool `mcp__mcp-graph__add_node` | `mg add <type>` | Same |
| MCP tool `mcp__mcp-graph__list` | `mg list` | Same |

## `--json` contracts

Every v10 `--json` output that exists in a renamed v11 command is preserved byte-for-byte. CI scripts using `mcp-graph stats --json | jq .total` keep working when migrated to `mg status --json | jq .total`. Where a field is added in v11 (e.g. provenance metadata), it's additive — old keys do not change.

If you find a `--json` regression, please open an issue — that's a contract break, not a deprecation.

## Migration checklist

For an existing v10 project:

```bash
# 1. install the new CLI alongside the old one
npm install -g @mcp-graph-workflow/cli   # adds `mg` and re-binds `mcp-graph`

# 2. re-run init in your project root — auto-fills missing IDE configs
cd your-project
mg init                                  # idempotent; only writes what's missing

# 3. (recommended) install hooks for zero-intervention workflow
mg hooks install                         # default: balanced profile

# 4. verify nothing broke
mcp-graph --version                      # still works during 6-month dual-ship
mg status                                # new dashboard view
```

For automation/CI:

```bash
# replace anywhere you script the CLI:
mcp-graph stats --json   →   mg status --json
mcp-graph init           →   mg init --force        # no interactive prompts
mcp-graph serve          →   mg ui --port 3000      # same port default
```

## Deprecation timeline

| Date | What changes |
|---|---|
| **2026-04** (v11.0.0) | New CLI shipped. v10 keeps working with a one-line deprecation banner pointing at `mg <cmd>`. |
| **2026-07** (v11.x) | Banner upgrades to a coloured warning. Still functional. |
| **2026-10** (v12.0.0) | `src/cli/*` removed. `mcp-graph` binary unbinds from `@mcp-graph-workflow/mcp-graph` v10; only the `mg` package provides it (still as the long-form alias). |

If you maintain a project that pins `@mcp-graph-workflow/mcp-graph@^10`, nothing breaks until you bump to v12. Plan one PR window in late 2026 to swap to `@mcp-graph-workflow/cli`.

## What did NOT change

- **Storage layout** — `workflow-graph/graph.db` (SQLite). Same migrations, same schema.
- **MCP tool surface** — all 45 tools still registered. The CLI just gives you first-class shell verbs for the most-used 12.
- **Conventions** — kebab-case files, ESM-only, Zod v4, strict TS, TDD-first. The new code follows the same `.claude/rules/*` you already use.

## Conversational ⇄ CLI parity

v11 enforces three-mode parity for every command:

| Mode | Invocation | Example |
|---|---|---|
| REPL slash | `mg` then `/<cmd>` | `mg` → `/init` → `/next` |
| Shell one-shot | `mg <cmd>` | `mg next` |
| Claude skill | `/<cmd>` inside Claude Code | `/init`, `/next` (emitted by `mg init` into `.claude/skills/`) |

All three share a single handler under `tools/cli/src/commands/`. There is exactly one source of truth.

## Reporting issues

- v10 → v11 migration friction: file under [GitHub issues](https://github.com/diegonogueira/mcp-graph-workflow/issues) with `[migration]` prefix.
- `--json` contract regressions: `[migration][regression]` prefix — these are highest-priority.

## References

- ADR-0050 — Ink as TUI framework (`docs/adr/0050-ink-cli.md`)
- ADR-0051 — distribution strategy (`docs/adr/0051-cli-distribution.md`)
- ADR-0052 — naming (`mg` + `mcp-graph` aliases) (`docs/adr/0052-cli-naming.md`)
- ADR-0053 — v11 command surface (`docs/adr/0053-cli-surface.md`)
- DX baselines — `docs/dx/v10-baseline.md`
