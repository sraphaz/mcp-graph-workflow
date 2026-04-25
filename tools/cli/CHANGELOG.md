# Changelog — @mcp-graph-workflow/cli

All notable changes to the v11 CLI. Format: [Keep a Changelog](https://keepachangelog.com/) · Versioning: SemVer.

## [11.2.0-beta.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/cli-v11.1.3-beta.0...cli-v11.2.0-beta.0) (2026-04-25)


### Features

* **capability-gate:** per-task-type granularity (H12-tests v4 confirmed) ([#245](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/245)) ([e963a06](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/e963a06f4cd131e5236c4efaea555dd275858f4a))
* **skills:** v11 surface migration banner — Phase 2 (13 more skills) ([#246](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/246)) ([2d7cd97](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/2d7cd9749dc5995ad2d1e00672f738e13950b5c5))

## [11.1.3-beta.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/cli-v11.1.2-beta.0...cli-v11.1.3-beta.0) (2026-04-25)


### Bug Fixes

* **cli:** correct repository URL casing for npm provenance attestation ([#241](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/241)) ([0eed1f8](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/0eed1f87aa92c64493170439b71b93d86af60ed2))

## [11.1.2-beta.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/cli-v11.1.1-beta.0...cli-v11.1.2-beta.0) (2026-04-25)


### Bug Fixes

* **cli:** update isFeatureEnabled test for ADR-0054 v2 defaults ([#239](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/239)) ([2eb5369](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/2eb5369fb1040b2607ebd58e30be4c079964568e))

## [11.1.1-beta.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/cli-v11.1.0-beta.0...cli-v11.1.1-beta.0) (2026-04-25)


### Bug Fixes

* **cli:** hide parent-package import paths from TS resolution ([#237](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/237)) ([5de1e87](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/5de1e875b9f499563f6396b2762d18beb93042df))

## [11.1.0-beta.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/cli-v11.0.0-beta.0...cli-v11.1.0-beta.0) (2026-04-25)


### Features

* **cli:** v11 beta — Ink REPL, hooks-collapse, set-phase, tools/cli [@beta](https://github.com/beta) ([#234](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/234)) ([94d215a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/94d215a7d680637b8bbe907348f7e4c5a4520912))


### Bug Fixes

* **cli:** sync VERSION constant in meta.ts with package.json (11.0.0-beta.0) ([#236](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/236)) ([0fd472e](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/0fd472e1d406eb9c97ec4fad255185b4eb7a6ad6))

## [11.0.0-beta.0] — 2026-04-25

Beta promotion. Same surface as `11.0.0-alpha.1` — cut as `beta` so a wider N can install via `npm i -g @mcp-graph-workflow/cli@beta` and feedback flows back before the GA cut.

### Why beta now (not GA)

Beta is for production-trial usage with explicit caveats, not "feature complete". The release pipeline is:

- alpha (closed loop, internal) → **beta (you are here, public N≥1)** → rc (post-H12-main results) → GA (v11.0.0)

### Caveats — read before installing

1. **Haiku 4.5 path is advisory, not blocking.** ADR-0054 v2 made the Haiku-on-orchestrator path emit an advisory warning instead of silently disabling. If you set `--model haiku`, you'll see a structured `_advisory` notice on first invocation; tool calls still execute. Implementation fix is in the priority queue (tracked in graph as a separate epic).
2. **H12-main N≥10 evaluation is still pending pre-GA.** Beta is the right surface to gather that N — every `mg` invocation emits a structured event under `~/.mcp-graph/logs/cli.jsonl` (opt-out via `MCP_GRAPH_TELEMETRY=off`). The evaluation gate to GA needs N≥10 production sessions clean.
3. **Plan-payload contracts (`graph_validate_ui`, `graph_explore_web`, etc.) are externally-routed.** They emit MCP plan-payloads that you (the agent client) execute via Playwright/Browser-Use MCP. If those servers aren't installed, the tool returns a structured `install_hint` rather than crashing.
4. **Auto-discovery of the parent `@mcp-graph-workflow/mcp-graph`** still relies on the env override → monorepo-sibling → node_modules order. If you install CLI globally without the parent, you'll get the friendly "where is mcp-graph?" error from `parent-bridge.ts`. This is intentional — the v11 CLI is a sister package, not a replacement.
5. **Implementation fix priority documented**: see `docs/migration/v11-maestro-surface.md` for the prioritized list of known gaps the beta cycle is collecting feedback on.

### Changed since alpha.1

- npm dist-tag: `alpha` → `beta`. To install: `npm i -g @mcp-graph-workflow/cli@beta`.
- Release pipeline now wires `tools/cli` through release-please (per-path outputs, `publish-cli` job in `.github/workflows/release.yml`). Auto-publishes on every conventional-commit merge that bumps `tools/cli`.

### Not changed since alpha.1

- All 15+ commands, hook surface, REPL, slash parity, Ink theming, structured logs.
- Bundle size (60–72 KB), bin paths, parent-bridge resolver, lazy store.

## [11.0.0-alpha.1] — 2026-04-25

First alpha of the v11 User-First DX overhaul. Sister package to `@mcp-graph-workflow/mcp-graph` v10.x — both work in parallel during a 6-month dual-ship; v12.0 sunsets the v10 CLI.

### Added

#### Foundation
- New package `@mcp-graph-workflow/cli`. Bin entries: `mg` (daily) + `mcp-graph` (long form, ADR-0052).
- Single source of truth for commands at `src/commands/registry.ts`. Every command has REPL slash + shell + Claude-skill parity (ADR-0053).
- Ink-based REPL host (`src/repl/host.tsx`) with `/slash` command parsing, fuzzy autocomplete, and TTY fallback hint.
- esbuild ESM bundle to `dist/cli.mjs` (60–72 KB depending on commit; deps externalized).
- Lazy `getStore()` factory at `src/core/lazy-store.ts` — parent SqliteStore loads only on first call, cached per `basePath`.
- Parent-bridge resolver at `src/core/parent-bridge.ts` — locates `@mcp-graph-workflow/mcp-graph/dist/` via env override → monorepo sibling → node_modules → friendly error.
- Bridge-CLI locator + spawn harness at `src/core/bridge/{locate,spawn}.ts` — discovers `mcp-graph-bridge` and runs subcommands as a child process with passthrough stdio.

#### Commands (15 registered)
- `mg help [query]` — searchable command palette, typo-tolerant fuzzy match.
- `mg version` — print version (cached, bypass-Ink fast path).
- `mg exit` — leave the REPL.
- `mg init [--force]` — project fingerprint (Node/Python/Go/Rust/...) + IDE detection (VS Code/Cursor/JetBrains/Zed/Claude Code) + idempotent scaffold (`workflow-graph/`, `PRD.md`, `.gitignore`) + auto-emit IDE configs (`.mcp.json`, `.vscode/mcp.json`, `.cursor/mcp.json`, `.claude/settings.local.json`, `.claude/skills/`) + parent project bootstrap.
- `mg demo [--cleanup]` — ephemeral sandbox under `~/.mcp-graph/demos/<stamp>/` with sample PRD imported.
- `mg add <type> --title "..." [flags]` — create graph node (task/epic/decision/risk/...) with provenance metadata stamped (`{source:"cli", actor, cmd, trace_id, ts}`).
- `mg list [--status --type --search --blocked --all --limit]` — searchable task browser. Hides done/cancelled by default.
- `mg next [--id]` — animated Ink card of next unblocked task; calls parent's `findNextTask` against live `GraphDocument`.
- `mg start <id>` — status → `in_progress`, render TDD checklist + AC + context preview.
- `mg finish [<id>]` — status → `done`. Auto-detects single in-progress task. Renders DoD card + auto-suggests next task via parent planner.
- `mg login [--fresh|--logout|--status]` — wraps `mcp-graph-bridge` (Copilot device-flow auth, no VS Code dep).
- `mg ui [--port N]` — spawns parent's `serve` command, inherits stdio, Ctrl-C clean-up.
- `mg status [--oneline]` — 1-screen project health: status counts, in-progress list, blockers, bridge auth state with login hint.
- `mg config <sync|check> [--force]` — emit/refresh/diff IDE+agent configs idempotently.
- `mg hooks <install|uninstall|status> [--profile minimal|balanced|aggressive]` — Claude Code hook installer; preserves user-owned hooks via tag marker; fail-silent dispatcher.
- `mg log [--task --hook --trace --since --level --action --sink --limit]` — query structured logs. JSONL passthrough with `--json`.
- `mg harness <list|start|stop|sessions|call|cdp|add>` — first-class CLI for parent's `browser-harness` module. CDP `wsEndpoint` UUIDs auto-masked in human output (per `.claude/rules/browser-pilot.md`).

#### Observability
- Structured JSONL logger at `src/core/log/structured-logger.ts` writing to `~/.mcp-graph/logs/{cli,hooks,events}.jsonl`.
- Redaction patterns (8 default): `ghu_*`, `ghs_*`, `gho_*`, `ghp_*`, `sk-ant-*`, `sk-*`, `Bearer *`, `tid=*`. Applied at the writer boundary.
- Auto-instrumentation: `withCommandTrace()` wraps every registered command's handler. Every invocation emits `{ts, level, source, actor, action, duration_ms, outcome, ctx, trace_id}`.
- Trace correlation: each invocation generates a UUID `trace_id` propagated to hooks fired during it.
- Provenance metadata on every node created via `mg add`. Visible later via `mg log --task <id>`.

#### Auto-config emitters
- `src/core/init/emit-mcp-config.ts` — `.mcp.json` (root), `.vscode/mcp.json`, `.cursor/mcp.json`. Merges into existing files; preserves user-customized entries unless `--force`.
- `src/core/init/emit-claude-config.ts` — `.claude/settings.local.json` with permissions allow-list + scaffolded hook entries.
- `src/core/init/emit-skills.ts` — `.claude/skills/browser-harness.md` template with safety rules + action map + when-not-to-use guidance.
- `src/core/init/sync-configs.ts` — coordinator with `dryRun` support backing `mg config check`.

#### Smart hooks
- `src/core/hooks/install.ts` — installs hook entries into `.claude/settings.local.json` with `__mg__` tag marker for clean uninstall.
- 3 profiles: `minimal` (SessionStart only) / `balanced` (default — SessionStart + post-edit + post-finish-task + Stop) / `aggressive` (adds UserPromptSubmit + post-bash).
- `src/commands/hook-dispatch.ts` — dispatcher invoked by Claude Code via `mg hook <name>`. Non-blocking, fail-silent, logs to `hooks.jsonl`. `MCP_GRAPH_HOOKS_OFF=1` env disables firing without uninstall.

#### Documentation
- ADR-0050 — Ink as TUI framework.
- ADR-0051 — distribution strategy (npm primary, curl one-liner, optional Bun binary).
- ADR-0052 — `mg` daily alias + `mcp-graph` long form.
- ADR-0053 — v11 command surface (12 core + meta sub-trees).
- DX baselines — `docs/_internal/dx/v10-baseline.md` with cold-start, bundle, pack metrics.
- v10→v11 migration guide — `docs/_internal/migration/v10-to-v11-cli.md`.
- 60-second QUICKSTART — `docs/getting-started/QUICKSTART.md`.

#### Performance
- Cold start: 91 ms median over 10 runs (`mg --version`); target ≤ 500 ms — **5× under**.
- Bundle: 71 KB ESM; `npm pack` tarball: 19.8 KB; unpacked: 64 KB.
- Lazy `await import()` for every command handler so cold-start cost is dominated by Node startup, not user code.

#### Tests
- 97 tests across 13 files (vitest). Coverage:
  - Slash parser + registry (12 + 5)
  - Lazy store factory (5)
  - Init detect + scaffold (idempotency, gitignore, force, fingerprint) (10)
  - Demo sandbox (3)
  - Bridge locator (5)
  - Sync configs (8) + redaction patterns (6)
  - Log query (8)
  - Hook installer (8)
  - Help renderer + builtins lazy-load
  - `runNext` / `runList` / `runAdd` with mocked parent runtime

### Changed (vs v10 CLI in `src/cli/`)

- Daily binary is `mg`, not `mcp-graph` (long form preserved as alias).
- `mcp-graph stats` → `mg status` (same `--json` shape, additive provenance fields).
- `mcp-graph serve` → `mg ui` (same Express :3000; `--port` flag instead of `dashboard:dev` subcommand).
- `mcp-graph import <file>` → planned for `mg add prd <file>` (7.3.1).
- IDE config emission moves from manual JSON editing to `mg init` / `mg config sync` (idempotent).
- Conversational `analyze(harness_scan)` / `set_phase(...)` / `validate(ac)` ceremony replaced by Claude Code hooks (`mg hooks install`).

### Breaking changes (v11.0.0 GA cutover)

The list below is the full set of breaking changes that ship at v11.0.0 GA — call out for downstream consumers:

| Break | v10 (legacy) | v11 (new) | Sunset |
|---|---|---|---|
| User-facing CLI package | `npm i -g @mcp-graph-workflow/mcp-graph` | `npm i -g @mcp-graph-workflow/cli` | bin entries `mcp-graph` / `mcp-graph-stdio` removed from main pkg in v12.0 |
| Daily binary | `mcp-graph <cmd>` | `mg <cmd>` (long form `mcp-graph` kept as alias of the new pkg) | v12.0 — `mcp-graph` from main pkg becomes unrecognized |
| `mcp-graph stats` | `--json` returns flat counts | `mg status` `--json` adds provenance fields (additive; old keys intact) | non-breaking; documented for parity |
| `mcp-graph serve` | `serve [--port N]` | `mg ui [--port N]` | v12.0 — `serve` removed |
| Hook config | hand-edited `.claude/settings.local.json` | `mg hooks install --profile <p>` (idempotent, tagged) | v11 enforces, v10 still tolerates the old hand-edit |
| Bin shipped in main pkg | `mcp-graph` + `mcp-graph-stdio` + `mcp-graph-server` + `mcp-graph-daemon` + `mcp-graph-proxy` | only `-server` / `-daemon` / `-proxy` (T1.0 — gated on cli pkg publish) | bin removal lands at v11.1 once cli pkg is on the npm registry |

### Sunset timeline (v10 CLI surface)

The 6-month v10→v11 dual-ship is concrete:

| Milestone | Date (relative to v11.0.0 GA) | What happens |
|---|---|---|
| v11.0.0 GA | T0 (target 2026-05-09 per Fase B trigger) | `@mcp-graph-workflow/cli` published; deprecation banner appears on every legacy `mcp-graph <cmd>` invocation (silenceable with `MCP_GRAPH_NO_BANNER=1`); v10 keeps working byte-for-byte. |
| v11.1.0 | T0 + 1 month | Main pkg drops the `mcp-graph` and `mcp-graph-stdio` bin entries (T1.0). The user-facing CLI lives only at `@mcp-graph-workflow/cli` from this point. Server-side bins (`-server`, `-daemon`, `-proxy`) keep shipping from main pkg. |
| v11.x dual-ship window | T0 → T0 + 6 months | Breaking parity holds: any v10 `--json` contract preserved on the renamed v11 command. Migration doc at `docs/_internal/migration/v10-to-v11-cli.md` walks every legacy invocation. |
| v12.0 sunset | T0 + 6 months | All legacy aliases removed. `mcp-graph stats` / `serve` / hand-edited hook configs no longer accepted. Breaking-changes section of v12.0 CHANGELOG enumerates every removal. |

Suggested user actions during the dual-ship:
1. `npm i -g @mcp-graph-workflow/cli` once it lands on the registry.
2. Switch shell aliases / scripts / `.mcp.json` invocations to `mg <cmd>` (or the renamed long-form).
3. Run `mg hooks install` once per project to convert hand-edited hooks into the tagged set.
4. Set `MCP_GRAPH_NO_BANNER=1` in CI environments where the deprecation banner would noise up the log.

### Compatibility

- `mcp-graph` v10.x keeps working unchanged for 6 months (deprecation banner added in v11.0.x; sunset in v12.0).
- All v10 `--json` contracts preserved byte-for-byte where the renamed v11 command exists.
- `workflow-graph/graph.db` schema unchanged. v10 and v11 read/write the same DB.

### Known issues

- The parent's `dist/core/browser-harness/cdp-client.js` imports `CdpConnectionError`/`CdpProtocolError` from `errors.js` but those symbols are missing in both src and dist. Affects `mg harness` runtime only — the CLI surface itself is correct and tested. `mg harness` surfaces a friendly fallback error pointing the user at `npm --prefix ../.. run build`. Tracked for the parent's next build cycle.

### Out of scope (deferred)

- Windows install script (`install.ps1`).
- OS keychain integration for token storage (still chmod 0600 JSON in v11).
- Web UI redesign (dashboard kept as-is; only `mg ui` opens it differently).
- LSP-driven smart completions inside the CLI.
- Multi-language i18n.

## Pre-history

For changes prior to the v11 CLI split, see `../../CHANGELOG.md` (parent project covering v0.1 → v10.x).
