# User Guide — mcp-graph

> Complete reference for installing, configuring, and using mcp-graph.
> For a quick overview, see the [README](../../README.md).

---

## Table of Contents

1. [What mcp-graph Does](#what-mcp-graph-does)
2. [Installation & Setup](#installation--setup)
3. [Core Concepts](#core-concepts)
4. [Typical Workflow](#typical-workflow)
5. [CLI Reference](#cli-reference)
6. [Dashboard](#dashboard)
7. [Multi-Agent Setup](#multi-agent-setup)
8. [FAQ](#faq)

---

## What mcp-graph Does

mcp-graph is a local-first development orchestration tool. It sits between your requirement documents and your AI coding assistant, providing structure that keeps the agent grounded, consistent, and productive across sessions.

**Without mcp-graph:** your AI agent reconstructs context from scratch every session, improvises a development path, and has no persistent memory of decisions made.

**With mcp-graph:** requirements become a navigable task graph. The agent asks the graph what to do next, retrieves exactly the context needed for the current task, and records completion evidence — producing a traceable, reproducible development process.

The system works entirely offline. No external services, no cloud dependencies, no AI at runtime — only your AI coding assistant interacting with the local graph.

---

## Installation & Setup

### Prerequisites

- Node.js ≥ 18
- An MCP-compatible AI assistant (Claude Code, GitHub Copilot Agent Mode, Cursor, Zed, IntelliJ, Windsurf, etc.)

### Global Install (recommended)

```bash
npm install -g @mcp-graph-workflow/mcp-graph
```

Verify:
```bash
mcp-graph --version
```

### Using npx (no install)

```bash
npx -y @mcp-graph-workflow/mcp-graph
```

### Configure Your AI Assistant

**Claude Code** — add to `.mcp.json` in your project root:
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

**GitHub Copilot (VS Code)** — add to `.vscode/mcp.json`:
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

**Cursor / Windsurf / Zed / IntelliJ** — use the standard MCP server configuration for your client, pointing to `npx -y @mcp-graph-workflow/mcp-graph`.

### Initialize a Project

Once configured, ask your AI assistant:

```
init
```

This creates the graph database for your project in `workflow-graph/` (gitignored automatically). You only do this once per project.

### Start the Dashboard (optional)

```bash
npm run dashboard:dev    # from source, or:
mcp-graph-server         # if installed globally
```

Dashboard runs at `http://localhost:3000`.

---

## Core Concepts

### PRD (Product Requirement Document)

A plain text document (Markdown, PDF, HTML, or TXT) that describes what you want to build. mcp-graph parses it automatically into structured tasks. You write requirements naturally — the tool handles the decomposition.

### Execution Graph

The central data structure. Tasks (nodes) and their dependencies (edges) form a directed graph stored locally. Every piece of work has a node; every dependency has an edge. The graph persists across sessions, so your AI agent always has a complete picture of the project state.

### Tasks and Epics

- **Task** — atomic unit of work with a title, acceptance criteria, and status
- **Epic** — a group of related tasks; automatically marked done when all children complete
- **Subtask** — a task that belongs to a parent task; cascades completion upward

### Status Lifecycle

```
backlog → in_progress → done
              ↕
           blocked
```

Tasks move through states as work progresses. The graph enforces that blocked tasks aren't started until dependencies are resolved.

### Lifecycle Phases

mcp-graph structures development into 9 phases:

| Phase | What happens |
|-------|-------------|
| **ANALYZE** | Import PRD, define requirements, build graph structure |
| **DESIGN** | Architecture decisions, technical planning |
| **PLAN** | Sprint allocation, dependency mapping |
| **IMPLEMENT** | Write code — test-driven, one task at a time |
| **VALIDATE** | Run tests, verify acceptance criteria |
| **REVIEW** | Code review, impact analysis |
| **HANDOFF** | Documentation, PR creation |
| **DEPLOY** | Release, post-deploy checks |
| **LISTENING** | Collect feedback, start next cycle |

Each phase has gate checks. The graph tells your agent when it's ready to transition.

### Knowledge Base

As you work, mcp-graph builds a local knowledge store — decisions, context, patterns, and references from your project. This is indexed for semantic retrieval: when a task starts, the agent gets the most relevant knowledge automatically, not a full dump.

---

## Typical Workflow

### 1. Import Your Requirements

Create a `requirements.md` (or any name) describing what you want to build. Then ask your agent:

```
import_prd requirements.md
```

The tool parses the document and creates the task graph. Review it:

```
list
```

### 2. Plan a Sprint

```
plan_sprint
```

The tool suggests which tasks to tackle based on priority, dependencies, and estimated capacity.

### 3. Work on Tasks

The work cycle for each task:

```
start_task         — loads task context + relevant knowledge + TDD hints
[write failing test, then implementation]
finish_task        — validates completion, marks done, returns next task
```

Your agent drives this cycle. You interact with the agent; the agent queries the graph.

### 4. Monitor Progress

```
kanban             — visual board with task states
metrics            — delivery health metrics
```

Or open the dashboard at `http://localhost:3000`.

### 5. Complete the Cycle

When all sprint tasks are done, move to validation:

```
validate           — check acceptance criteria
```

Then review, handoff, and deploy as appropriate for your project.

---

## CLI Reference

These are the primary commands available via your AI assistant.

### Initialization

| Command | What it does |
|---------|-------------|
| `init` | Initialize graph database for the current project |
| `set_phase` | Set the current lifecycle phase and enforcement mode |

### Task Management

| Command | What it does |
|---------|-------------|
| `import_prd <file>` | Parse a requirement document into tasks |
| `list` | List tasks (filterable by status, phase, epic) |
| `next` | Get the recommended next task to work on |
| `start_task` | Begin a task — loads context, acquires work lock |
| `finish_task` | Complete a task — validates DoD, returns next |
| `update_status` | Manually update a task's status |
| `node` | View or edit a specific task node |

### Planning

| Command | What it does |
|---------|-------------|
| `plan_sprint` | Generate a sprint plan based on capacity |
| `forecast` | Delivery forecast and velocity trends |
| `metrics` | DORA metrics and delivery health |

### Context & Knowledge

| Command | What it does |
|---------|-------------|
| `context` | Retrieve compressed context for the current task |
| `search` | Search the task graph and knowledge base |
| `knowledge` | Manage the project knowledge store |

### Graph Operations

| Command | What it does |
|---------|-------------|
| `analyze` | Run analysis on the graph (health, progress, readiness) |
| `validate` | Check acceptance criteria for tasks or epics |
| `export` | Export the graph (Mermaid, JSON, snapshot) |
| `kanban` | View tasks as a kanban board |
| `show` | Show graph summary and statistics |

---

## Dashboard

The web dashboard provides a visual interface to your task graph.

**Start it:**
```bash
# From source:
npm run dashboard:dev

# If installed globally:
mcp-graph-server
```

**Access:** `http://localhost:3000`

**Key panels:**
- **Graph View** — interactive node graph with task relationships and status colors
- **Kanban** — drag-and-drop task board by status
- **Backlog** — full task list with filtering and sorting
- **Metrics** — sprint progress, velocity, delivery forecasts
- **Insights** — bottleneck detection, dependency analysis

The dashboard is read-mostly; task state changes happen through your AI assistant.

---

## Multi-Agent Setup

Multiple AI agent terminals can work on the same project graph simultaneously.

**Enable teamTask mode:**

```
set_phase({ teamTask: true })
```

With teamTask mode active:
- `start_task` acquires an exclusive work lock for the task
- `next` excludes tasks already locked by other agents
- Events propagate across terminals automatically
- Abandoned tasks are detected and returned to the backlog

**Shared daemon (memory optimization):**

If running several agents against the same project, use the proxy to share a single server process:

```json
{
  "mcpServers": {
    "mcp-graph": {
      "command": "npx",
      "args": ["-y", "--package=@mcp-graph-workflow/mcp-graph", "mcp-graph-proxy"]
    }
  }
}
```

The first agent starts the daemon; subsequent agents reuse it.

---

## FAQ

**Q: Does mcp-graph send data anywhere?**
No. Everything runs locally. The graph database, knowledge store, and all indexes live in `workflow-graph/` inside your project. Nothing is sent to external services.

**Q: Do I need an internet connection?**
Only for the initial `npm install`. After that, all operations are offline.

**Q: Can I use mcp-graph with any AI assistant?**
Any assistant that supports MCP (Model Context Protocol). This includes Claude Code, GitHub Copilot Agent Mode, Cursor, Windsurf, Zed, and IntelliJ AI.

**Q: What format should my PRD be in?**
Markdown is recommended, but `.txt`, `.pdf`, and `.html` are also supported. The document should describe features as requirements, not implementation details. See [Writing Effective PRDs](#) for guidelines.

**Q: My agent says "no tasks in backlog" — what's wrong?**
The graph is empty. Run `import_prd <your-requirements-file>` first.

**Q: Can I edit tasks manually?**
Yes, through your AI assistant: `node <task-id>` to view and edit a specific task.

**Q: How do I reset the graph?**
Delete the `workflow-graph/` directory and run `init` again. This cannot be undone.

**Q: Where is the data stored?**
In `workflow-graph/` at your project root. This directory is gitignored by default.

**Q: Something is broken. How do I get help?**
Open an issue at [github.com/DiegoNogueiraDev/mcp-graph-workflow/issues](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues).

---

## LLM Gateway

mcp-graph routes any LLM-backed task (analysis, summarization, plan refinement)
through a single deterministic gateway — see [llm-gateway.md](./llm-gateway.md)
for the full reference, default models, budget caps, and the v66 `llm_call_ledger`
schema. Outbound calls are off by default; you opt in by setting an API key
and (optionally) overriding `cap_usd_per_cell`.

---

*This guide covers the stable public interface. Internal implementation details are intentionally omitted.*
