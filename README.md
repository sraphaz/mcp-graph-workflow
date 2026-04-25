<p align="center">
  <img src="docs/images/graph-logo.jpg" alt="mcp-graph" width="700">
</p>

<h1 align="center">mcp-graph</h1>

<p align="center">
  <strong>Structured execution for AI-driven development workflows.</strong><br/>
  Transforms requirement documents into persistent, agent-navigable task graphs.
</p>

<p align="center">
  <a href="https://github.com/DiegoNogueiraDev/mcp-graph-workflow/actions/workflows/ci.yml"><img src="https://github.com/DiegoNogueiraDev/mcp-graph-workflow/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@mcp-graph-workflow/mcp-graph"><img src="https://img.shields.io/npm/v/%40mcp-graph-workflow%2Fmcp-graph" alt="npm version"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/%40mcp-graph-workflow%2Fmcp-graph" alt="Node.js"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL_v3-blue.svg" alt="License: AGPL v3"></a>
  <a href="COMMERCIAL.md"><img src="https://img.shields.io/badge/Commercial-available-informational" alt="Commercial license available"></a>
</p>

## What It Does

`mcp-graph` is a local-first tool that converts natural-language requirement documents (PRDs) into persistent, executable task graphs. An AI coding assistant navigates this graph instead of reasoning from scratch each session — reducing hallucination, preserving context, and enforcing discipline across the full development cycle.

Operates entirely offline. No external AI/LLM dependency at runtime. All decisions deterministic and reproducible.

## Key Capabilities

- **PRD → Task Graph** — `.md`/`.txt`/`.pdf`/`.html` requirement docs parsed into structured task trees with dependencies
- **Agent-navigable workflow** — 9-phase lifecycle (Analyze → Design → Plan → Implement → Validate → Review → Handoff → Deploy → Listening) with gate checks
- **Context continuity** — agents request task context from the graph; token-efficient compression included
- **Knowledge base** — project knowledge indexed and retrievable by semantic similarity
- **Sprint planning & metrics** — velocity-based planning, progress tracking, delivery metrics
- **Visual dashboard** — browser-based task board with graph, kanban, and analytics
- **Multi-agent support** — concurrent agent terminals with conflict prevention

## Installation

```bash
npm install -g @mcp-graph-workflow/mcp-graph
```

**Requirements:** Node.js ≥ 18. No Docker, no external infrastructure.

## Quick Start

Add to `.mcp.json` (Claude Code, Cursor, IntelliJ) or `.vscode/mcp.json` (Copilot):

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

Then in your agent: `init` → `import_prd <file>` → `plan_sprint` → `start_task` / `finish_task`.

## Documentation

- **[User Guide](docs/guides/USER-GUIDE.md)** — full reference: install, concepts, workflow, CLI, dashboard
- **[Quickstart](docs/getting-started/QUICKSTART.md)** — 5-minute setup
- **[Cheatsheet](docs/getting-started/CHEATSHEET.md)** — common commands
- **[Troubleshooting](docs/getting-started/TROUBLESHOOTING.md)** — fix common issues
- **[Glossary](docs/getting-started/GLOSSARY.md)** — terminology

## Research & Citation

This project is an active Master's research experiment (UNOPAR). For academic context, citation (BibTeX/ABNT), and the research hypothesis: see [`docs/_internal/RESEARCH.md`](docs/_internal/RESEARCH.md).

## License

- **Open Source:** [AGPL v3](LICENSE) — free for open-source and research use
- **Commercial:** [Commercial license available](COMMERCIAL.md) for proprietary use
- **Attribution:** [NOTICE.md](NOTICE.md) — original methodologies and required credits
