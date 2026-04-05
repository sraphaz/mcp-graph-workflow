<p align="center">
  <img src="docs/images/mcp-graph-v6.png" alt="mcp-graph v6.0 — Autopilot for AI-driven development" width="700">
</p>

<h1 align="center">mcp-graph</h1>

<p align="center">
  <strong>Autopilot for AI-driven development.</strong><br/>
  Local-first CLI that converts PRDs into execution graphs with pipeline tools, agent state machine, and predictive analytics.
</p>

<p align="center">
  <a href="https://github.com/DiegoNogueiraDev/mcp-graph-workflow/actions/workflows/ci.yml"><img src="https://github.com/DiegoNogueiraDev/mcp-graph-workflow/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@mcp-graph-workflow/mcp-graph"><img src="https://img.shields.io/npm/v/%40mcp-graph-workflow%2Fmcp-graph" alt="npm version"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/%40mcp-graph-workflow%2Fmcp-graph" alt="Node.js"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome"></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@mcp-graph-workflow/mcp-graph"><img src="https://img.shields.io/npm/dm/%40mcp-graph-workflow%2Fmcp-graph" alt="npm downloads"></a>
  <a href="https://github.com/DiegoNogueiraDev/mcp-graph-workflow/stargazers"><img src="https://img.shields.io/github/stars/DiegoNogueiraDev/mcp-graph-workflow" alt="GitHub stars"></a>
  <a href="https://github.com/DiegoNogueiraDev/mcp-graph-workflow/network"><img src="https://img.shields.io/github/forks/DiegoNogueiraDev/mcp-graph-workflow" alt="GitHub forks"></a>
  <img src="https://img.shields.io/badge/tests-5111%2B-brightgreen" alt="5111+ tests">
  <img src="https://img.shields.io/badge/MCP%20tools-52%2B-blue" alt="52+ MCP tools">
</p>

<p align="center">
  <img src="docs/images/tab-graph.png" alt="mcp-graph dashboard — execution graph" width="800">
</p>

---

## What is mcp-graph?

A **local-first MCP server** that transforms product requirement documents (PRD) into persistent execution graphs (SQLite), with an integrated knowledge store, RAG pipeline, and multi-agent orchestration mesh.

**v6.0** introduces **pipeline tools** that reduce the mandatory workflow from 6 tool calls to 2, an **agent state machine** that tells the agent what to do next, **DORA metrics** for delivery health, and **cross-project learning**.

## Quick Start

### GitHub Copilot (VS Code)

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

Enable **Agent Mode** in Copilot Chat, then: `init` your project and use `start_task` to begin.

### Claude Code / Cursor / IntelliJ

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

### Windsurf / Zed / Other MCP Clients

```
npx -y @mcp-graph-workflow/mcp-graph
```

### From Source

```bash
git clone <repo-url> && cd mcp-graph-workflow
npm install && npm run build
npm run dev        # HTTP + dashboard at localhost:3000
```

> For detailed setup, see [Getting Started](docs/guides/GETTING-STARTED.md).

---

## 30 Engineering Skills

mcp-graph includes 30 ready-to-use skills covering the entire software development lifecycle:

| Category | Count | Examples |
|----------|-------|---------|
| **Lifecycle** | 9 | `/graph-implement`, `/graph-deploy`, `/graph-validate` |
| **Quality** | 6 | `/graph-security`, `/graph-tests`, `/graph-observability` |
| **Engineering** | 4 | `/graph-performance`, `/graph-refactor`, `/graph-api-design` |
| **Operations** | 4 | `/graph-incident`, `/graph-cicd`, `/graph-accessibility` |
| **Governance** | 6 | `/graph-architecture`, `/graph-release`, `/graph-docs` |
| **PRD** | 1 | `/graph-prd` (7 methodologies: 5W2H, JTBD, Pareto, MoSCoW, INVEST) |

### Install Skills

```bash
node skills-graph/install.mjs
```

Supports Claude Code, GitHub Copilot, and Codex CLI. See [skills-graph/README.md](skills-graph/README.md) for the full catalog and platform setup guides.

---

## v6.0 Highlights

### Pipeline Tools: 6 calls to 2

```
# Before (v5.x) — 6 tool calls per task
next → context → rag_context → [implement] → analyze(implement_done) → update_status

# After (v6.0) — 2 tool calls per task
start_task → [implement with TDD] → finish_task
```

`start_task` composes: next + context + RAG + TDD hints + update_status(in_progress).
`finish_task` composes: DoD 9 checks + AC validation + epic promotion + next task.

### Agent State Machine (`nextAction`)

Every tool response now includes `_lifecycle.nextAction` — the graph tells the agent exactly what to do next:

```json
{
  "_lifecycle": {
    "phase": "IMPLEMENT",
    "nextAction": {
      "tool": "start_task",
      "reason": "Task done — start next task",
      "priority": "recommended"
    }
  }
}
```

### DORA Metrics & Forecast

```
forecast(mode: "dora") → {
  deploymentFrequency: 3.2,      // tasks/day
  leadTime: { p50: 2.1, p85: 8.4 },  // hours
  changeFailureRate: 0.03,       // 3%
  mttr: 0.5,                     // hours
  trend: "improving"
}
```

### More v6.0 Features

| Feature | What it does |
|---------|-------------|
| **Cross-Project Learning** | `learn_from_project` imports knowledge from other projects |
| **Code-Aware Graph Sync** | `analyze(code_sync)` detects drift between graph and code |
| **Smart Decompose** | `analyze(smart_decompose)` breaks tasks into subtasks by AC |
| **Cumulative Flow Diagram** | `analyze(cfd)` captures daily status snapshots for flow analysis |
| **Industrial Methodologies** | Little's Law, Six Sigma, Shift-Left Testing principles embedded |

---

## Architecture

```mermaid
graph TD
    PRD[PRD Document] -->|import_prd| GRAPH[Execution Graph<br/>SQLite]
    GRAPH -->|start_task| PIPELINE[Pipeline Engine]
    PIPELINE -->|context + RAG + TDD| AGENT[AI Agent]
    AGENT -->|finish_task| PIPELINE
    PIPELINE -->|nextAction| AGENT
    GRAPH -->|analyze| INSIGHTS[48 Analyze Modes]
    GRAPH -->|forecast| DORA[DORA Metrics]
    GRAPH -->|learn_from_project| CROSS[Cross-Project Knowledge]
    
    CODE[Code Intelligence] -->|code_sync| GRAPH
    CTX7[Context7 Docs] -->|sync_stack_docs| GRAPH
    PW[Playwright] -->|validate task| GRAPH

    style PIPELINE fill:#22c55e,stroke:#16a34a,color:#000
    style GRAPH fill:#3b82f6,stroke:#2563eb,color:#fff
    style AGENT fill:#f59e0b,stroke:#d97706,color:#000
```

## Lifecycle: 9 Phases

```mermaid
graph LR
    A[ANALYZE] --> B[DESIGN]
    B --> C[PLAN]
    C --> D[IMPLEMENT]
    D --> E[VALIDATE]
    E --> F[REVIEW]
    F --> G[HANDOFF]
    G --> H[DEPLOY]
    H --> I[LISTENING]
    I -->|feedback| A

    style D fill:#22c55e,stroke:#16a34a,color:#000
```

Each phase has **gate checks** (`analyze` modes) that must pass before transitioning. In IMPLEMENT, the pipeline flow is: `start_task` (auto-loads context + RAG + TDD hints) then `finish_task` (validates DoD + marks done + returns next).

---

## Features

| Category | Details |
|----------|---------|
| **MCP Tools** | 52 active + 6 deprecated across 8 categories |
| **Analyze Modes** | 48 modes mapped to 9 lifecycle phases |
| **Pipeline Tools** | `start_task` + `finish_task` (v6.0) |
| **Agent State Machine** | `nextAction` in every response (v6.0) |
| **PRD Import** | .md, .txt, .pdf, .html auto-parsed into task trees |
| **Context Compression** | 70-85% token reduction (summary/standard/deep) |
| **Semantic Search + RAG** | BM25 + TF-IDF, phase-aware boosting, 100% local |
| **Sprint Planning** | Velocity metrics, capacity-based, overflow detection |
| **DORA Metrics** | Deploy freq, lead time, CFR, MTTR (v6.0) |
| **Cross-Project Learning** | Knowledge transfer between projects (v6.0) |
| **Code-Aware Sync** | Graph ↔ code drift detection (v6.0) |
| **Dashboard** | 14 tabs: Graph, PRD, Code Graph, Memories, Insights, and more |
| **Local-First** | SQLite, zero external deps, cross-platform |

## Dashboard

15 tabs covering the full development lifecycle:

| Tab | Purpose |
|-----|---------|
| **Graph** | Interactive execution graph with hierarchy and filters |
| **PRD & Backlog** | Progress tracking with dependency visualization |
| **Journey** | Website journey mapping |
| **Code Graph** | Multi-language code intelligence (13 languages) |
| **Siebel** | SIF import/export and code generation |
| **LSP** | Language Server Protocol status and diagnostics |
| **Memories** | Project knowledge store |
| **Insights** | Health score, sprint progress, knowledge coverage |
| **Skills** | 45 built-in skills by lifecycle phase |
| **Context** | Token management + DreamMode |
| **Benchmark** | Compression rates, cost impact, token usage |
| **Languages** | Code translation between languages |
| **DaVinci** | DaVinci JS to Java plugin converter |
| **Docs** | Live-introspected tools, APIs, guides |
| **Logs** | Real-time structured logs |

<p align="center">
  <img src="docs/images/tab-insights.png" alt="Insights — health score, sprint progress" width="800">
</p>

<p align="center">
  <img src="docs/images/tab-code-graph.png" alt="Code Graph — 221 symbols, 177 relations" width="800">
</p>

<p align="center">
  <img src="docs/images/tab-benchmark.png" alt="Benchmark — 97% compression, cost savings" width="800">
</p>

<p align="center">
  <img src="docs/images/tab-context.png" alt="Context — DreamMode + token management" width="800">
</p>

> See all 15 tabs with full screenshots in the [V6 Features Guide](docs/guides/V6-FEATURES-GUIDE.md).

```bash
npx mcp-graph serve --port 3000    # or: npm run dev
```

---

## v5.x to v6.0

**Zero breaking changes.** All existing tools continue working. v6.0 is purely additive.

| Metric | v5.x | v6.0 | Change |
|--------|------|------|--------|
| Tool calls per task | 6 | 2 | **-67%** |
| Sprint overhead (20 tasks) | 120 calls | 40 calls | **-67%** |
| Agent guidance | None | `nextAction` in every response | **NEW** |
| MCP tools | 46 + 6 deprecated | 52 + 6 deprecated | **+6** |
| Analyze modes | 24 | 48 | **+100%** |
| Test suite | 4200+ | 5111+ | **+22%** |
| Cross-project learning | No | `learn_from_project` | **NEW** |
| DORA metrics | No | `forecast(dora)` | **NEW** |
| Flow tracking (CFD) | No | `analyze(cfd)` | **NEW** |
| Code-aware sync | No | `analyze(code_sync)` | **NEW** |
| Smart decompose | No | `analyze(smart_decompose)` | **NEW** |

### New Tools in v6.0

| Tool | Description |
|------|-------------|
| `start_task` | Pipeline: next + context + RAG + TDD + status in 1 call |
| `finish_task` | Pipeline: DoD + AC + status + epic promo + next in 1 call |
| `forecast` | DORA metrics (deploy freq, lead time, CFR, MTTR) |
| `learn_from_project` | Import knowledge from another project's DB |
| `analyze(cfd)` | Cumulative Flow Diagram data |
| `analyze(code_sync)` | Validate graph vs code index |
| `analyze(smart_decompose)` | Auto-decompose tasks by AC (1 AC = 1 subtask) |

---

## Integrations

| Integration | Role |
|-------------|------|
| **Code Intelligence** | Native LSP-based analysis, 13 languages, impact analysis |
| **Context7** | Library documentation fetching and indexing |
| **Playwright** | Browser-based task validation and A/B testing |
| **DreamMode** | REM-inspired knowledge consolidation (soft-merge, quality decay) |

Native systems: **Code Intelligence** (AST + symbol graph), **Native Memories** (project knowledge store). See [INTEGRATIONS-GUIDE.md](docs/reference/INTEGRATIONS-GUIDE.md).

## Testing

**5111+ tests** across 460 Vitest files + Playwright E2E specs.

```bash
npm test            # Unit + integration
npm run test:e2e    # Browser E2E (Playwright, local only)
npm run test:coverage  # V8 coverage report
```

## Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](docs/guides/GETTING-STARTED.md) | Step-by-step setup guide |
| [v6.0 Features Guide](docs/guides/V6-FEATURES-GUIDE.md) | Pipeline tools, nextAction, DORA, and more |
| [Architecture](docs/architecture/ARCHITECTURE-GUIDE.md) | System layers, modules, data flows |
| [MCP Tools Reference](docs/reference/MCP-TOOLS-REFERENCE.md) | 52 tools + 6 deprecated, full parameters |
| [REST API Reference](docs/reference/REST-API-REFERENCE.md) | 19 routers, 59 endpoints |
| [Lifecycle](docs/reference/LIFECYCLE.md) | 9-phase dev methodology |
| [Knowledge Pipeline](docs/architecture/KNOWLEDGE-PIPELINE.md) | RAG, embeddings, context assembly |
| [Integrations](docs/reference/INTEGRATIONS-GUIDE.md) | Code Intelligence, Context7, Playwright |
| [Test Guide](docs/guides/TEST-GUIDE.md) | Test pyramid and best practices |

## Support the Project

If this tool is useful to you, consider supporting its development:

- **Star this repo** — it helps others discover the project
- **Share** — tell your team, post on X/LinkedIn, write about it
- **Contribute** — see [CONTRIBUTING.md](CONTRIBUTING.md). TDD is mandatory — write the failing test first
- **Sponsor** — [GitHub Sponsors](https://github.com/sponsors/DiegoNogueiraDev)

[![Star History Chart](https://api.star-history.com/svg?repos=DiegoNogueiraDev/mcp-graph-workflow&type=Date)](https://star-history.com/#DiegoNogueiraDev/mcp-graph-workflow&Date)

## License

[MIT](LICENSE)
