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
  <a href="https://www.npmjs.com/package/@mcp-graph-workflow/cli"><img src="https://img.shields.io/npm/v/%40mcp-graph-workflow%2Fcli/beta?label=cli%20%40beta&color=orange" alt="cli @beta"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/%40mcp-graph-workflow%2Fmcp-graph" alt="Node.js"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL_v3-blue.svg" alt="License: AGPL v3"></a>
  <a href="COMMERCIAL.md"><img src="https://img.shields.io/badge/Commercial-available-informational" alt="Commercial license available"></a>
</p>

## What It Does

Three problems every AI coding session has:

1. **Your agent forgets** — every new chat starts blank, the agent re-invents the plan from scratch.
2. **PRDs become walls of text** — nobody re-reads them, the agent improvises features.
3. **No paper trail** — you can't tell what got done, what blocked, or why a decision was made.

`mcp-graph` fixes that. It turns your PRD into a persistent task graph the agent **navigates** instead of **improvises** — backed by local SQLite. No cloud, no LLM API key.

### How it fits with your AI CLI

```
You (human)
 └─ AI CLI (Claude Code · Copilot CLI · Cursor)        ← agent runs here, has no memory
    ├─ mcp-graph (MCP server, v10.x)                   ← structured memory: PRDs, graph, lifecycle
    └─ mg CLI (v11 beta)                               ← human entry point, auto-hooks, skill files
                                                       ↓
                                  workflow-graph/graph.db (the project's "memory")
```

| Without mcp-graph | With mcp-graph |
|---|---|
| "Build me a SaaS" → chaos | PRD → atomic tasks with acceptance criteria |
| Agent forgets between sessions | Persistent SQLite, compressed context handoff |
| TDD optional, depends on the agent's mood | Hooks block commits without a test first |
| Two parallel agents collide | `unified-gate` keeps them coordinated |
| "Is it ready?" → guessing | `mg status` answers in 200ms |

### A complete loop in 4 commands

```bash
mg init                           # bootstrap graph + IDE configs
mg add task --title "fix login"   # or: import a full PRD with import_prd <file>
mg start <id>                     # status → in_progress, render TDD checklist
mg finish                         # status → done, suggest next
```

Fully offline. Deterministic. Reproducible.

## Installation

Two paths — pick one. v11 CLI is **opt-in** and **fully backward-compatible**: existing v10 setups keep working unchanged.

### Path 1 — MCP server only (stable, v10.x)

```bash
npm install -g @mcp-graph-workflow/mcp-graph
```

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

In your agent: `init` → `import_prd <file>` → `plan_sprint` → `start_task` / `finish_task`.

### Path 2 — MCP server + v11 CLI (recommended for new projects)

```bash
npm install -g @mcp-graph-workflow/mcp-graph
npm install -g @mcp-graph-workflow/cli@beta
```

Then in your project:

```bash
cd your-project
mg init                                # graph + IDE configs + .claude/skills
mg hooks install --profile balanced    # Claude Code automation (optional, recommended)
mg                                     # interactive REPL — type /help to discover
```

**Requirements:** Node.js ≥ 18. No Docker, no external infra, no LLM API key.

## Documentation

Start here:

- **[Quickstart](docs/getting-started/QUICKSTART.md)** — 60-second tour with `mg`
- **[Guide](docs/getting-started/GUIDE.md)** — full walkthrough (Portuguese)
- **[Cheatsheet](docs/getting-started/CHEATSHEET.md)** — every command on one page

Deep dives:

- **[v10 → v11 Surface Map](docs/guides/v11-cli-surface-map.md)** — three modes side-by-side: Claude tool, `mg` shell, REPL slash
- **[Troubleshooting](docs/getting-started/TROUBLESHOOTING.md)** — fix common issues
- **[Glossary](docs/getting-started/GLOSSARY.md)** — terminology

## Research & Citation

This project is an active Master's research experiment (UNOPAR). For academic context, citation (BibTeX/ABNT), and the research hypothesis: see [`docs/_internal/RESEARCH.md`](docs/_internal/RESEARCH.md).

## License

- **Open Source:** [AGPL v3](LICENSE) — free for open-source and research use
- **Commercial:** [Commercial license available](COMMERCIAL.md) for proprietary use
- **Attribution:** [NOTICE.md](NOTICE.md) — original methodologies and required credits
