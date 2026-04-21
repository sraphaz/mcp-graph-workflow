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
  <a href="https://www.npmjs.com/package/@mcp-graph-workflow/mcp-graph"><img src="https://img.shields.io/npm/dm/%40mcp-graph-workflow%2Fmcp-graph" alt="npm downloads"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-academic%20experiment-orange" alt="Academic Experiment">
  <img src="https://img.shields.io/badge/research-Master's%20Degree-blueviolet" alt="Master's Research">
  <img src="https://img.shields.io/badge/defense-pending-yellow" alt="Not yet defended">
</p>

---

> ⚠️ **Academic Experiment — Not yet defended.**
> This project is an active research experiment developed as part of a Master's program in Computer Engineering at **UNOPAR — Universidade Norte do Paraná**, by **Diego Lima Nogueira de Paula** ([ORCID 0009-0002-1117-9571](https://orcid.org/0009-0002-1117-9571)).
> The research is ongoing and under discussion. Findings, methodologies, and interfaces are subject to change.
> Academic citation is required when this system is referenced or reimplemented — see [How to Cite](#how-to-cite) below.

---

## What It Does

**mcp-graph** is a local-first tool that structures AI-assisted software development by converting natural language requirement documents (PRDs) into persistent, executable task graphs.

Rather than relying on AI to improvise a development path, mcp-graph imposes structure: requirements are parsed into a directed graph of tasks with dependencies, acceptance criteria, and lifecycle states. An AI coding assistant (Claude Code, GitHub Copilot, Cursor, etc.) navigates this graph instead of reasoning from scratch each session — reducing hallucination, improving context continuity, and enforcing discipline across the full development cycle.

The system operates entirely offline, with no external AI/LLM dependency at runtime. All decisions are deterministic and reproducible.

## Key Capabilities

- **PRD → Task Graph** — import `.md`, `.txt`, `.pdf`, or `.html` requirement documents; parsed automatically into structured task trees with dependencies
- **Agent-navigable workflow** — a 9-phase development lifecycle (Analyze → Design → Plan → Implement → Validate → Review → Handoff → Deploy → Listening) with gate checks between phases
- **Context continuity** — agents request task context from the graph rather than reconstructing it each session; token-efficient compression included
- **Knowledge base** — project knowledge is indexed and retrievable by semantic similarity; supports multi-project cross-referencing
- **Sprint planning & metrics** — velocity-based sprint planning, progress tracking, and delivery metrics
- **Visual dashboard** — browser-based task board with graph visualization, kanban view, and analytics panels
- **Multi-agent support** — multiple AI agent terminals can work on the same graph concurrently with conflict prevention

## Installation

```bash
npm install -g @mcp-graph-workflow/mcp-graph
```

**Requirements:** Node.js ≥ 18. No Docker, no external infrastructure.

## Quick Start

### With GitHub Copilot (VS Code)

Create `.vscode/mcp.json` in your project:

```json
{
  "servers": {
    "mcp-graph": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@mcp-graph-workflow/mcp-graph"]
    }
  }
}
```

Enable **Agent Mode** in Copilot Chat, then ask the agent to `init` your project.

### With Claude Code / Cursor / IntelliJ

Add to `.mcp.json`:

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

### With any MCP-compatible client

```
npx -y @mcp-graph-workflow/mcp-graph
```

### From Source

```bash
git clone https://github.com/DiegoNogueiraDev/mcp-graph-workflow.git
cd mcp-graph-workflow
npm install && npm run build
npm run dev        # starts server + dashboard at localhost:3000
```

## Typical Workflow

```
1. init               — initialize graph database for your project
2. import_prd         — parse your requirements document into tasks
3. plan_sprint        — allocate tasks to a sprint based on capacity
4. start_task → [implement with TDD] → finish_task   — work cycle
5. kanban / metrics   — monitor progress and delivery health
```

The graph tracks every task state, decision, and context piece so your AI agent always knows what was done, what is next, and why.

## Documentation

→ **[User Guide](docs/guides/USER-GUIDE.md)** — complete reference for installation, concepts, workflow, CLI commands, and dashboard.

## Research Context

This project investigates a central hypothesis: that **imposing deterministic graph structure over AI-assisted development workflows** reduces error rates, improves context continuity between sessions, and increases delivery predictability compared to unstructured prompt-based development.

The research is being conducted in the context of real software projects, with empirical measurements of productivity metrics (DORA), code quality indicators, and agent behavior patterns. It is **not yet defended** and does not represent a final scientific contribution.

Methodology documents are available in [`docs/preprint/`](docs/preprint/).

## How to Cite

If you reference or build upon this work in academic or derivative contexts:

**BibTeX:**
```bibtex
@software{nogueira2025mcpgraph,
  author    = {de Paula, Diego Lima Nogueira},
  title     = {mcp-graph: Structured Execution for AI-Driven Development},
  year      = {2025},
  url       = {https://github.com/DiegoNogueiraDev/mcp-graph-workflow},
  note      = {Master's research experiment. Not yet defended. UNOPAR.},
  orcid     = {0009-0002-1117-9571}
}
```

**ABNT:**
> DE PAULA, Diego Lima Nogueira. **mcp-graph: Structured Execution for AI-Driven Development**. 2025. Experimento de pesquisa de mestrado — UNOPAR. Disponível em: https://github.com/DiegoNogueiraDev/mcp-graph-workflow. Acesso em: [data].

## License

- **Open Source:** [AGPL v3](LICENSE) — free for open-source and research use
- **Commercial:** [Commercial license available](COMMERCIAL.md) for proprietary use
- **Attribution:** [NOTICE.md](NOTICE.md) — original methodologies and required credits
