<!--
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
-->

<p align="center">
  <img src="docs/images/graph-logo.jpg" alt="mcp-graph" width="600">
</p>

<h1 align="center">mcp-graph</h1>

<p align="center">
  <a href="README.md">Português</a> |
  <a href="README.en.md">English</a>
</p>

<p align="center">
  <a href="https://github.com/DiegoNogueiraDev/mcp-graph-workflow/actions/workflows/ci.yml"><img src="https://github.com/DiegoNogueiraDev/mcp-graph-workflow/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@mcp-graph-workflow/mcp-graph"><img src="https://img.shields.io/npm/v/%40mcp-graph-workflow%2Fmcp-graph" alt="npm"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL_v3-blue.svg" alt="AGPL v3"></a>
  <a href="COMMERCIAL.md"><img src="https://img.shields.io/badge/Commercial-available-informational" alt="Commercial license"></a>
</p>

---

**mcp-graph** turns your PRD into a persistent task graph that your AI agent navigates instead of improvising.

PRD → graph (SQLite) → TDD → production. 100% local, zero cloud.

---

## The problem

Every AI coding session has the same three problems:

- **The agent forgets** — each new chat starts from zero, the plan gets reinvented
- **PRDs become walls of text** — nobody re-reads them, the agent improvises
- **No traceability** — you can't tell what was done, what's blocked, or why

## How it solves them

1. `import_prd` — reads the PRD and creates tasks with acceptance criteria in the graph
2. `start_task` — agent picks the next task with compressed context in hand
3. `finish_task` — validates DoD (12 checks), status → done, suggests the next

Everything lives in `workflow-graph/graph.db` — local SQLite, gitignored, never in the cloud.

## Installation

```bash
npm install -g @mcp-graph-workflow/mcp-graph
```

Add to your project's `.mcp.json` (Claude Code, Cursor, Copilot):

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

Initialize in your project:

```bash
mcp-graph init
```

**Prerequisites:** Node.js ≥ 18. No Docker. No LLM API key required.

## Getting started

```bash
# 1. Import a PRD (or create tasks manually)
mcp-graph import my-prd.md

# 2. See the graph
mcp-graph status

# 3. Get next task
mcp-graph next

# 4. Start → implement with TDD → finish
mcp-graph start <id>
# ... write test, implement ...
mcp-graph finish <id>
```

The AI agent does this automatically via MCP tools (`start_task`, `finish_task`, `next`).

## What's inside

| Layer | What it does |
|---|---|
| 54 MCP tools | Graph, tasks, memory, RAG, sprint, deploy |
| 130+ REST endpoints | Web dashboard, IDE integration |
| Local RAG (FTS5 + BM25) | Compressed context without external LLM |
| React dashboard | Kanban, visual graph, logs, insights |
| 9-phase lifecycle | ANALYZE → DESIGN → PLAN → IMPLEMENT → VALIDATE → REVIEW → HANDOFF → DEPLOY → LISTENING |

## Privacy

Zero telemetry. Zero phone-home. Runs offline after installation.

LLM, embeddings, and external integrations are **opt-in** — nothing active by default.

## Documentation

- [Quickstart](docs/getting-started/QUICKSTART.md) — 60 seconds
- [Full guide](docs/getting-started/GUIDE.md)
- [Cheatsheet](docs/getting-started/CHEATSHEET.md) — all commands
- [Architecture](docs/ARCHITECTURE.md)
- [Sample PRD](docs/examples/sample-prd.md)

## License

[AGPL-3.0-or-later](LICENSE) — open source with strong copyleft.
Proprietary commercial use: [commercial license available](COMMERCIAL.md).
