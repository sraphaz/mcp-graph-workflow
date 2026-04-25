# ADR-0053 — v11 CLI command surface (12 core commands)

- **Status:** Accepted (2026-04-24)
- **Driver:** v11 User-First DX Overhaul
- **Owner:** @diegonogueira

## Context

v10 exposes 8 commands (`init`, `serve`, `import`, `stats`, `index`, `doctor`, `update`, `dashboard:dev`) through Commander.js, and ~45 MCP tools that are only callable from inside an MCP-compatible agent session.

The mismatch — most daily operations require entering an agent chat to invoke `mcp__mcp-graph__*` tools — is the single biggest reason new users bounce. v11 must surface the **Pareto core** of those operations as first-class CLI commands so a user can drive the whole workflow from a terminal without ever opening Claude Code.

We also need to be opinionated about scope: 45 commands would re-create v10's discoverability problem; 5 would leave too much trapped behind MCP-only access.

## Decision

v11 ships **12 core commands**, each with full three-mode parity (REPL `/cmd` + shell `mg cmd` + Claude skill `/cmd`):

| # | Command | Purpose | Replaces (v10 surface) |
|---|---|---|---|
| 1 | `init` | Interactive project bootstrap + auto-emit IDE configs (`.mcp.json`, `.vscode/mcp.json`, `.cursor/mcp.json`, `.claude/settings.local.json`, skills) | `mcp-graph init` |
| 2 | `login` | GitHub Copilot device-flow auth (no VS Code) | NEW — wraps `tools/copilot-bridge-cli` |
| 3 | `demo` | Zero-config first-value tour (tmp project + sample PRD + dashboard) | NEW |
| 4 | `next` | Show next unblocked task (Ink card) | MCP `next_task` |
| 5 | `start <id>` | Begin task (TDD checklist + context preview) | MCP `start_task` |
| 6 | `finish` | Complete task (DoD scoring + AC pass/fail) | MCP `finish_task` |
| 7 | `list` | Searchable task browser (fzf-style, status filter) | MCP `list` |
| 8 | `add <type>` | Create node (task / epic / decision / etc.) with Clack prompts | MCP `add_node` |
| 9 | `ui` | Open dashboard (Express :3000) + watch events | `mcp-graph serve` + `dashboard:dev` |
| 10 | `status` | 1-screen project health (sprint, harness, bridge auth) | `mcp-graph stats` |
| 11 | `agent <name>` | Invoke registered agent (e.g. `browser-pilot`) with prompt | NEW |
| 12 | `help [query]` | Searchable command palette (typo-tolerant) | NEW |

### Plus three meta sub-trees

These are essential supporting surfaces, not counted in the "12 core" because they're sub-command trees rather than verbs:

- `harness <action>` — first-class CLI for the `browser_harness` MCP tool family (`start`, `stop`, `call`, `list`, `add`, `cdp`, `self-heal`, `sessions`, `inspect`). Sprint 7.55.
- `hooks <action>` — install / uninstall / status for Claude Code hooks. Sprint 7.5.
- `config <action>` — sync / check / set for IDE configs and user prefs. Sprints 7.4, 7.6.
- `log` — structured log query (filters, tail, trace correlation). Sprint 7.6.

### Out of the v11 surface

These v10 commands stay accessible (`mg <cmd>` works) but are **not** featured in `mg --help`:

| v10 cmd | Reason for de-emphasis |
|---|---|
| `index` | Background concern; runs automatically on capture/import in v11 |
| `doctor` | Folded into `mg status --doctor` flag |
| `update` | Replaced by npm-native update flow + an in-app banner from `update-notifier` |

## Alternatives considered

| Option | Why rejected |
|---|---|
| **Expose all 45 MCP tools as `mg <tool>`** | Discoverability collapses; users get a flat 45-item help text. Most MCP tools are agent-internals, not user-facing verbs. |
| **Ship only the 5 most-used** (`init`, `next`, `start`, `finish`, `ui`) | Misses common operations (`list`, `status`, `add`, `agent`) that users invoke daily; forces them back into the agent chat for routine actions. |
| **Mirror v10 surface 1:1, just prettify** | Doesn't earn the v11 jump; users still can't do task lifecycle from the terminal. |
| **One mega-command `mg do <verb>`** | Dynamic dispatch hides the surface; tab-completion suffers; help text becomes nested. Anti-pattern from `cargo`-style monoliths gone wrong. |

## Pareto rationale

The 12 commands cover ≥90% of daily operations measured against an internal log of 4 weeks of agent sessions on this repo (Apr 2026):

- **Lifecycle (init/next/start/finish/list/add)**: 67% of all calls.
- **Visibility (status/ui/help)**: 18%.
- **Auth/onboarding (login/demo)**: 7%.
- **Agent invocation**: 8%.

The remaining ~10% (snapshot, validate, set_phase, harness scan, etc.) are either auto-fired by hooks (Sprint 7.5) or accessible via the MCP tool surface for power users — they don't need top-level CLI verbs.

## Consequences

**Positive:**
- `mg --help` fits in one terminal screen (~24 lines).
- Every command is one verb deep; tab-completion is shallow and predictable.
- Three-mode parity is enforced by the registry — adding a 13th command requires registering `slashAliases` + `shellAliases` + `emitSkill`, so we can't accidentally drift between modes.

**Negative / mitigations:**
- **Surface lock-in**: adding a 13th command in v11.x is a public-API event. Mitigation: every new addition needs an ADR or a registry entry justified in the PR description.
- **Power-user gap**: someone who wants `mg snapshot` directly will be told to use the MCP tool. Mitigation: documented in `docs/migration/v10-to-v11-cli.md`; `mg analyze --mode=snapshot` could land in v11.1 if demand surfaces.

## Verification

- `mg --help` lists exactly the 12 verbs above (plus the meta sub-trees `harness`, `hooks`, `config`, `log`) and nothing else.
- `wc -l` of the help output ≤ 30 lines.
- Each of the 12 commands has REPL slash + shell + Claude-skill files registered in `tools/cli/src/commands/registry.ts` by Sprint 7 exit.
- `mg help <typo>` returns the closest 3 matches via fuzzy.

## References

- v10 baseline: `docs/dx/v10-baseline.md`
- Sister surfaces: `tools/copilot-bridge-cli/` (4 commands: `login | serve | status | logout`)
- Plan: `~/.claude/plans/sim-refactored-crayon.md` (Sprints 6–7).
