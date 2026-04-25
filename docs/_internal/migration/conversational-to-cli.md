# Migration: Conversational prompt → `mg` CLI → `/skill` invocation

When you stop talking to the agent in plain English and start driving it through the CLI or slash skills, the same intent maps three ways. This table is the cheat sheet.

## Lifecycle (the daily loop)

| Conversational pattern | `mg <cmd>` | `/<skill>` |
|---|---|---|
| "What should I do next?" / "give me the next task" | `mg next` | `/graph-implement` (loads ANALYZE→IMPLEMENT rubric, then calls `next`) |
| "Start working on this task" / "I'll take task X" | `mg start <id>` | `/graph-implement` |
| "I'm done with this task" / "mark it complete" | `mg finish <id>` | `/graph-implement` (the rubric ends with `finish_task`) |
| "Add a task: <title>" | `mg add task --title "<title>"` | `/graph-prd` (when adding from a doc) or direct CLI |
| "Show me the backlog" / "list everything ready" | `mg list --status ready` | `/graph-plan` (sprint-aware listing) |
| "Initialize this project for mcp-graph" | `mg init` | (no skill — single-shot setup) |
| "What's the project state?" / "where are we?" | `mg status` | `/graph-listening` (cross-cycle health view) |

## Phase-specific work

| Conversational pattern | `mg <cmd>` | `/<skill>` |
|---|---|---|
| "Read this PRD and turn it into a graph" | `mg import <file>` | `/graph-prd` |
| "Plan a sprint from the backlog" | (parent `plan_sprint` MCP) | `/graph-plan` |
| "Decompose this epic into tasks" | (parent `analyze` MCP, mode=`decompose`) | `/graph-plan` |
| "Run the architecture review" | — | `/graph-architecture` |
| "Audit this for security issues" | — | `/graph-security` |
| "Check accessibility on the dashboard" | — | `/graph-accessibility` |
| "Refactor this module" | — | `/graph-refactor` |
| "Hunt down this regression" | — | `/graph-bug-hunter` |
| "Optimize this hot path" | — | `/graph-performance` |
| "Generate the docs for this feature" | — | `/graph-docs` |
| "Drive a browser flow" / "test this UI" | `mg harness call <helper>` | `/harness-engineering` |

## Validation, review, deploy

| Conversational pattern | `mg <cmd>` | `/<skill>` |
|---|---|---|
| "Validate the acceptance criteria" | (parent `validate` MCP, action=`ac`) | `/graph-validate` |
| "Run the e2e checks on this URL" | (parent `validate` MCP, action=`task`) or `mg harness …` | `/graph-validate` |
| "Code-review this PR" | — | `/graph-review` |
| "Hand off to the reviewer" / "open the PR" | (use the host's git/PR commands) | `/graph-handoff` |
| "Deploy" / "ship it" | (CI-driven; release-please handles npm publish) | `/graph-deploy` |
| "Watch what users are saying" / "review feedback" | — | `/graph-listening` |

## Operational

| Conversational pattern | `mg <cmd>` | `/<skill>` |
|---|---|---|
| "Open the dashboard" | `mg ui` | — |
| "Show me recent activity" | `mg log` | — |
| "Check the config" | `mg config` | — |
| "Install the Claude Code hooks" | `mg hooks install` | — |
| "Show installed hooks + activity" | `mg hooks status` | — |
| "Login to Copilot Bridge" | `mg login` | — |

## Why three surfaces

- **Conversational** — fastest for one-off ideas, but the agent has to choose a tool each time and may pick wrong.
- **`mg <cmd>`** — deterministic, scriptable, no LLM round-trip; right when you know the action.
- **`/<skill>`** — loads a phase-specific rubric so the agent stays in-mode for a multi-step session; right when the work spans many MCP tool calls (e.g. running an entire IMPLEMENT cycle).

The three surfaces share state via the graph itself (`workflow-graph/graph.db`). Anything you do from one shows up everywhere — `mg start <id>` flips the same node `start_task` flips, which is what `/graph-implement` calls under the hood.

## When to bias which way

- New to the project? Stay conversational. The agent will steer you to the right skills.
- Repeating the same loop? Switch to `mg <cmd>` aliases — `mg next && mg start && mg finish` collapses the daily TDD cycle into 3 keystrokes.
- Cross-cutting work (refactor, security, perf)? Slash a phase skill so the agent loads the right rubric for the whole session instead of stitching individual MCP calls.

See also: `AGENTS.md` (skill catalogue), `docs/getting-started/QUICKSTART.md` (60-sec install→first-value), `docs/_internal/adr/0053-cli-surface.md` (CLI command surface decision).
