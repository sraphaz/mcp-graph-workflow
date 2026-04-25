---
name: graph-self-healing
description: Auto-cures failed tasks, broken dependencies, and blocked workflows using autonomous detect-diagnose-remediate-verify healing loop
triggers:
  - graph-self-healing
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---
> 💡 **v11 CLI surface available** (`@mcp-graph-workflow/cli@beta`): lifecycle verbs (`start_task`, `finish_task`, `next`, `update_status`, `list`, `add_node`, `set_phase`) referenced below have faster slash/shell equivalents — see **[V11-SURFACE-MAP.md](./V11-SURFACE-MAP.md)**. Prefer `/start` over `mcp__mcp-graph__start_task` when possible. Other tools (analyze, validate, search, edge, node, metrics, etc.) stay MCP for now.


# graph-self-healing

Auto-cures tasks, errors, and broken dependencies in the execution graph. Autonomously detects failed or blocked tasks, diagnoses root causes, applies targeted fixes, and verifies recovery. Operates on a continuous SelfHealing pattern (detect, diagnose, remediate, verify) without human intervention.

## When to Use

- Proactively triggered when `metrics` show >0 tasks in `failed` status
- When >3 tasks have been `blocked` for more than 48 hours
- After a build or test failure that leaves graph nodes in inconsistent states
- When `analyze(mode: "status_flow")` reports status flow violations
- The user says "heal graph", "fix blocked tasks", "self-healing", or "auto-cure"
- Autonomously triggered on every phase transition to clean up residual issues

## Mandatory Flow

```
detect(scan failures + blocks) → diagnose(root cause analysis) → remediate(apply fixes) → verify(validate recovery) → write_memory
```

## Workflow

### Step 1: Detect — Scan for Unhealthy Nodes

Scan the entire graph for nodes in problematic states:

```
Tool: mcp__mcp-graph__search (query: "status:failed")
```

```
Tool: mcp__mcp-graph__search (query: "status:blocked")
```

```
Tool: mcp__mcp-graph__analyze (mode: "status_flow")
```

Classify detected issues:

| Issue Type | Detection Signal | Severity |
|------------|-----------------|----------|
| Failed tasks | `status === "failed"` | Critical |
| Stale blocked | `status === "blocked"` for >48h | High |
| Orphan in_progress | `status === "in_progress"` with no recent activity | High |
| Dependency deadlock | Circular `depends_on` chain where all nodes blocked | Critical |
| Status flow violation | Node went `ready -> done` skipping `in_progress` | Medium |
| Missing dependencies | Node references non-existent dependency | High |
| Zombie nodes | `in_progress` for >7 days with no updates | Medium |

Build a triage queue sorted by severity (critical first).

### Step 2: Diagnose — Root Cause Analysis

For each issue in the triage queue, perform root cause analysis:

```
Tool: mcp__mcp-graph__node (action: "show", nodeId: "<affected_node_id>")
```

```
Tool: mcp__mcp-graph__analyze (mode: "done_integrity")
```

Diagnosis decision tree:

1. **Failed task** — Check if dependencies are all `done`. If not, the failure is a dependency issue, not a task issue.
2. **Stale blocked** — Check the blocker: is it another task? An external dependency? A missing resource? Search for the blocking node.
3. **Orphan in_progress** — Check last update timestamp. If >48h, likely abandoned. Check if the implementer context-switched.
4. **Dependency deadlock** — Trace the full dependency chain. Identify the cycle. Find the weakest link (least dependencies itself).
5. **Status flow violation** — Check audit trail. Determine if status was manually set or if a tool skipped steps.
6. **Missing dependency** — The referenced node was deleted or never created. Check if it was merged into another node.
7. **Zombie node** — Check if work was completed but status never updated. Search for related commits or test files.

Record diagnosis per node:
```
Tool: mcp__mcp-graph__search (query: "<related terms from diagnosis>")
```

### Step 3: Remediate — Apply Targeted Fixes

Apply the appropriate fix for each diagnosed issue:

**Failed tasks with unsatisfied dependencies:**
```
Tool: mcp__mcp-graph__update_status (nodeId: "<node_id>", status: "blocked", reason: "Dependency <dep_id> not done")
```

**Stale blocked with resolved blocker:**
```
Tool: mcp__mcp-graph__update_status (nodeId: "<node_id>", status: "ready")
```

**Orphan in_progress (abandoned):**
```
Tool: mcp__mcp-graph__update_status (nodeId: "<node_id>", status: "ready", reason: "Reset: no activity for >48h")
```

**Dependency deadlock:**
```
Tool: mcp__mcp-graph__node (action: "update", nodeId: "<weakest_link>", description: "DEADLOCK BROKEN: removed circular dependency")
```
Remove the circular edge or decompose the task to break the cycle.

**Status flow violation:**
```
Tool: mcp__mcp-graph__update_status (nodeId: "<node_id>", status: "in_progress")
Tool: mcp__mcp-graph__update_status (nodeId: "<node_id>", status: "done")
```

**Missing dependency — create replacement:**
```
Tool: mcp__mcp-graph__node (action: "add", type: "task", title: "<replacement task>")
Tool: mcp__mcp-graph__edge (from: "<new_node>", to: "<dependent_node>", type: "depends_on")
```

**Zombie nodes — verify and complete or reset:**
```
Tool: mcp__mcp-graph__update_status (nodeId: "<node_id>", status: "done", reason: "Work verified complete, status was stale")
```

### Step 4: Verify — Validate Recovery

Re-run health checks to confirm all remediations were successful:

```
Tool: mcp__mcp-graph__analyze (mode: "status_flow")
```

```
Tool: mcp__mcp-graph__analyze (mode: "done_integrity")
```

Verification checklist:
- Zero `failed` tasks remaining (or documented with known external blockers)
- Zero stale `blocked` tasks (>48h) without active remediation plan
- No dependency cycles in the graph
- All status flows are valid (ready -> in_progress -> done)
- No orphan `in_progress` tasks older than 24h

If any check fails, loop back to Step 2 (diagnose) for the remaining issues. Maximum 3 healing iterations to prevent infinite loops.

### Step 5: Record Healing Actions

Save all healing actions and patterns discovered:

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Self-Healing Report — <date>"
  content: "<issues found, diagnoses, remediations applied, verification results, recurring patterns>"
  tags: ["self-healing", "auto-cure", "graph-health"]
```

Record recurring patterns for adaptive learning:
- If the same task fails >2 times, flag for human review
- If the same dependency pattern causes deadlocks, recommend architectural change
- If zombie nodes recur in the same module, flag the module for process improvement

## Output Format

```
Phase: SELF-HEALING
Loop: Detect -> Diagnose -> Remediate -> Verify

Detect:
  Issues found: <N> (critical: <N>, high: <N>, medium: <N>)
  Failed tasks: <N>
  Stale blocked: <N>
  Zombies: <N>
  Deadlocks: <N>

Diagnose:
  Root causes identified: <N>/<N>
  Top cause: <description>

Remediate:
  Fixes applied: <N>
  Tasks unblocked: <N>
  Tasks reset: <N>
  Deadlocks broken: <N>
  Dependencies created: <N>

Verify:
  Health check: <passed/failed>
  Remaining issues: <N> (details if > 0)
  Healing iterations: <N>/3

Recurring patterns: <N> flagged for human review
Saved to memory: "Self-Healing Report — <date>"
```

## Anti-Patterns

- Do NOT remediate without diagnosing first — blind fixes create new problems
- Do NOT break dependency edges without understanding why they exist — trace the full chain
- Do NOT mark failed tasks as done without verification — that hides problems
- Do NOT run more than 3 healing iterations — escalate to human if issues persist
- Do NOT skip the verify step — unverified fixes are worse than known issues
- Do NOT heal tasks that are actively being worked on — check for recent activity first
- Do NOT delete nodes as a remediation strategy — update status or restructure instead
