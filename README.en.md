<p align="center">
  <img src="docs/images/graph-logo.jpg" alt="mcp-graph" width="700">
</p>

<h1 align="center">mcp-graph</h1>

<p align="center">
  <a href="README.md">Português</a> |
  <a href="README.en.md">English</a>
</p>

<p align="center">
  <strong>AI-driven software engineering. Local-first. Anti-vibe-coding by default.</strong><br/>
  Claude Code stops forgetting what you agreed on.<br/>
  PRD → graph → TDD → production. All local, all tracked.
</p>

<p align="center">
  <a href="https://github.com/DiegoNogueiraDev/mcp-graph-workflow/actions/workflows/ci.yml"><img src="https://github.com/DiegoNogueiraDev/mcp-graph-workflow/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@mcp-graph-workflow/mcp-graph"><img src="https://img.shields.io/npm/v/%40mcp-graph-workflow%2Fmcp-graph" alt="npm version"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/%40mcp-graph-workflow%2Fmcp-graph" alt="Node.js"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL_v3-blue.svg" alt="License: AGPL v3"></a>
  <a href="COMMERCIAL.md"><img src="https://img.shields.io/badge/Commercial-available-informational" alt="Commercial license available"></a>
</p>

## On a single page

**Category:** mcp-graph is a layer of **AI-driven software engineering (AISE — AI-Driven Software Engineering)**. It means shipping software with AI agents under the same rigor as a senior team: spec before code, mandatory TDD, traceable decisions, memory across sessions. No vibe-coding.

**Technically:** it implements the two canonical AISE methodologies — **Specification-Driven Development (SDD)**, where a PRD becomes an executable spec graph with AC, and **Context-Driven Engineering (CDE)**, where graph + RAG + memory provide persistent context across sessions. It is the "platform capability" that the [DORA Report 2025](https://www.infoq.com/news/2026/03/ai-dora-report/) calls a prerequisite for AI to convert productivity into delivery.

**What it ships:**

1. **Structure before code** — PRD becomes a graph persisted in SQLite. Zero untracked work.
2. **Non-negotiable TDD** — every task has a test before implementation. The agent refuses to skip.
3. **Memory that survives reload** — compressed context, local RAG, 50+ MCP tools.

**How it differs:**

| Comparison | What mcp-graph brings |
|---|---|
| vs raw Cursor / Copilot | Persistence + governance across sessions |
| vs Linear / Jira | Graph executable by the agent, not just visual |
| vs LangGraph and similar | Local-first, zero infra, single CLI |

## What it does

Three problems every AI coding session has:

1. **Your agent forgets** — every new chat starts from zero, it reinvents the plan each time.
2. **PRDs become walls of text** — nobody re-reads them, the agent improvises features.
3. **Zero traceability** — you can't tell what was done, what got stuck, or why a decision was made.

`mcp-graph` solves this. It takes your PRD, turns it into a persistent task graph that the agent **navigates** instead of **improvising** — all stored in local SQLite. No cloud, no LLM API key required.

> 💡 **MCP** = Model Context Protocol. It is the standard that lets your AI agent (Claude Code, Cursor, Copilot) see external tools like mcp-graph. You don't need to understand the protocol — just know that `.mcp.json` is the file where the agent discovers which tools are available.

### How it fits with your AI CLI

```
You (human)
 └─ AI CLI (Claude Code · Copilot CLI · Cursor)           ← agent runs here, no memory
    └─ mcp-graph (unified MCP server + CLI, v12)          ← memory + human gate + hooks + skills
                                                          ↓
                                  workflow-graph/graph.db (the persistent "memory")
```

| Without mcp-graph | With mcp-graph |
|---|---|
| "Build a SaaS for me" → chaos | PRD → atomic tasks with acceptance criteria |
| Agent forgets across sessions | Persistent SQLite, compressed context across sessions |
| TDD optional, depends on the agent's mood | Hook blocks commit without test first |
| Two parallel agents fight each other | `unified-gate` keeps both in sync |
| "Is it ready?" → guesswork | `mcp-graph status` answers in 200ms |

### A full cycle in 4 commands

```bash
mcp-graph init                           # creates graph + IDE configs
mcp-graph add task --title "fix login"   # or: import a full PRD with 'mcp-graph import <file>'
mcp-graph start <id>                     # status → in_progress, shows TDD checklist
mcp-graph finish                         # status → done, suggests the next one
```

> No PRD yet? Use [this example](docs/examples/sample-prd.md) (basic login, ~3 tasks) to test `import_prd` before writing your own.

100% offline. Deterministic. Reproducible.

## Installation

A single command — the unified v12 package ships the MCP server + complete CLI:

```bash
npm install -g @mcp-graph-workflow/mcp-graph
```

To use it as an MCP tool inside the agent, add it to `.mcp.json` (Claude Code, Cursor, IntelliJ) or `.vscode/mcp.json` (Copilot):

```json
{
  "mcpServers": {
    "mcp-graph": {
      "command": "npx",
      "args": ["-y", "@mcp-graph-workflow/mcp-graph"]
    }
  }
}
```

To use it in the terminal:

```bash
cd your-project
mcp-graph init                                # graph + IDE configs + .claude/skills
mcp-graph hooks install --profile balanced    # Claude Code automation (optional, recommended)
mcp-graph repl                                # interactive REPL — type /help to discover
```

**Prerequisites:** Node.js ≥ 18. No Docker, no external infra, no LLM API key.

## Documentation

> Most documentation is currently written in Portuguese (PT-BR). Translation is incremental — open an issue if a specific page should be prioritized.

Start here:

- **[Quickstart (PT)](docs/getting-started/QUICKSTART.md)** — 60 seconds with `mcp-graph`
- **[Guide (PT)](docs/getting-started/GUIDE.md)** — full step-by-step
- **[Cheatsheet (PT)](docs/getting-started/CHEATSHEET.md)** — every command on one page

Go deeper:

- **[Surface map (PT)](docs/guides/cli-surface-map.md)** — three modes side by side: Claude tool, `mcp-graph` shell, REPL slash
- **[Local architecture (PT)](docs/ARCHITECTURE.md)** — boundaries of AISE, SDD, CDE, stack and project layers
- **[Troubleshooting (PT)](docs/getting-started/TROUBLESHOOTING.md)** — solve common issues
- **[Glossary (PT)](docs/getting-started/GLOSSARY.md)** — vocabulary in plain language
- **[Sample PRD (PT)](docs/examples/sample-prd.md)** — to test `import_prd` without writing a PRD from scratch

## Network & Privacy

**mcp-graph is 100% local-first.** Zero mandatory SaaS, zero telemetry, zero automatic phone-home. Runs fully air-gapped after install.

Five integrations are opt-in and stay off by default:

| Integration | How to enable | How to disable |
|---|---|---|
| npm update check | Non-blocking banner in interactive CLI | `MCP_GRAPH_NO_UPDATE_CHECK=1` (or run with `CI=true`, or in MCP stdio mode) |
| LLM (Anthropic / GitHub Copilot) | Create `workflow-graph/bh-auth.json` or set `ANTHROPIC_API_KEY` / `GITHUB_COPILOT_TOKEN` | Delete the file / unset the env vars |
| Neural embeddings (Hugging Face) | `mcp-graph install-neural` | Don't run the command — automatic hash fallback |
| Context7 MCP (library docs) | Add to `.mcp.json` | Remove from `.mcp.json` |
| browser-use / Playwright MCP | Add to `.mcp.json` + Copilot Bridge | Remove from `.mcp.json` |

Full details, fallback contracts and rationale: [`docs/_internal/adr/0057-local-first-zero-saas.md`](docs/_internal/adr/0057-local-first-zero-saas.md).

## Research & Citation

This project is an active Master's research experiment (UNOPAR). For academic context, citation (BibTeX/ABNT) and the research hypothesis: see [`docs/_internal/RESEARCH.md`](docs/_internal/RESEARCH.md).

## License

**[GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later)](LICENSE)** — strong copyleft by default.

- **Open source / research / internal use:** free under AGPL. Distributing a modified version (including over SaaS/network — AGPL §13) requires releasing source code under the same license.
- **Proprietary commercial use:** if AGPL copyleft doesn't fit your model (e.g., closed product, SaaS without releasing derivations), a [commercial license is available](COMMERCIAL.md).
- **Mandatory attribution:** [NOTICE.md](NOTICE.md) — authorship, original methodology and credits.

Why AGPL and not a permissive license: it ensures derivative improvements come back to the community. mcp-graph is open-source Master's research — copyleft preserves that contract.
