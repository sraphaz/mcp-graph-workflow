---
name: graph-nirvana-swarm-orchestrator
description: Multi-agent swarm orchestration — coordinates multiple skills in parallel with DAG-based execution, resource budgeting, and result aggregation
triggers:
  - graph-nirvana-swarm-orchestrator
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-nirvana-swarm-orchestrator

Multi-agent swarm orchestrator that coordinates multiple Nirvana and graph-* skills in parallel. Acts as the "brain" of the autonomous system — decomposes complex work into parallelizable sub-tasks, matches each to the optimal skill, builds execution DAGs, and aggregates results.

This is the **meta-skill** that enables the full Nirvana ecosystem to operate as a cohesive autonomous system rather than isolated tools.

Integrates into the MAPE-K loop: **Monitor** (scan skill registry) → **Analyze** (task decomposition) → **Plan** (build DAG) → **Execute** (parallel dispatch) → **Knowledge** (aggregate + save).

## When to Use

- When a task requires multiple skills working together (e.g., implement + test + quality + deploy)
- For full sprint execution (orchestrate the entire IMPLEMENT → VALIDATE → REVIEW pipeline)
- When running the complete Nirvana self-management cycle
- For complex operations that benefit from parallelism
- The user says "orchestrate", "swarm", "run all skills", "parallel execution", or "nirvana orchestrator"

## Mandatory Flow

```
skill_registry_scan → task_analysis → skill_matching → dependency_graph → parallel_dispatch → progress_monitoring → result_aggregation → orchestration_report → write_memory
```

## Workflow

### Step 1: Skill Registry Scan

Inventory all available skills with capabilities:

**Nirvana Skills (autonomous):**

| Skill | Domain | Can Parallelize |
|-------|--------|----------------|
| `graph-nirvana-quality-guardian` | Code quality, tests, compliance | Yes (read-only analysis) |
| `graph-nirvana-adaptive-intelligence` | Learning, knowledge evolution | Yes (read-heavy, write at end) |
| `graph-nirvana-resilience-ops` | Backup, resources, deploy | Partial (backup must precede deploy) |
| `graph-nirvana-community-engine` | Feedback, docs, monetization | Yes (independent data sources) |

**Lifecycle Skills (manual, can be orchestrated):**

| Skill | Phase | Dependencies |
|-------|-------|-------------|
| `graph-implement` | IMPLEMENT | Requires: graph-plan completed |
| `graph-validate` | VALIDATE | Requires: graph-implement completed |
| `graph-review` | REVIEW | Requires: graph-validate completed |
| `graph-deploy` | DEPLOY | Requires: graph-review completed |

**Cross-Cutting Skills (can run anytime):**

| Skill | Domain | Parallelizable |
|-------|--------|---------------|
| `graph-security` | Security audit | Yes |
| `graph-performance` | Performance audit | Yes |
| `graph-tests` | Test strategy audit | Yes |
| `graph-quality-assurance` | Code quality audit | Yes |

### Step 2: Task Analysis

Decompose incoming work into atomic sub-tasks:

```
Tool: mcp__mcp-graph__next
```

For each task from the graph:
1. Identify required capabilities (implement, test, review, deploy)
2. Determine parallelizable vs. sequential steps
3. Estimate resource budget per sub-task (time, tokens, memory)
4. Identify shared dependencies (files, modules, data)

**Decomposition rules:**
- Each sub-task must be completable by a single skill
- Sub-tasks that write to the same file must be sequential
- Sub-tasks that only read can be parallel
- Maximum fan-out: 5 parallel skills (resource budget)

### Step 3: Skill Matching

Map each sub-task to the optimal skill:

| Sub-Task Type | Primary Skill | Fallback |
|--------------|---------------|----------|
| Code implementation | `graph-implement` | Manual coding |
| Test writing | `graph-nirvana-quality-guardian` (Step 4) | `graph-tests` |
| Quality check | `graph-nirvana-quality-guardian` | `graph-quality-assurance` |
| Security audit | `graph-security` | Manual review |
| Performance check | `graph-performance` | Manual profiling |
| Documentation | `graph-nirvana-community-engine` (Step 4) | `graph-docs` |
| Backup/deploy | `graph-nirvana-resilience-ops` | `graph-deploy` |

Selection criteria:
- **Capability match** — skill covers the sub-task domain
- **Past performance** — historical success rate for similar tasks (from adaptive intelligence)
- **Resource availability** — skill fits within resource budget
- **Autonomy level** — prefer Nirvana skills (autonomous) over graph-* skills (manual)

### Step 4: Dependency Graph (DAG)

Build execution DAG with critical path:

```
Phase 1 (parallel): backup + quality scan + security audit
    ↓
Phase 2 (sequential): implement (requires Phase 1 context)
    ↓
Phase 3 (parallel): test generation + performance check + doc update
    ↓
Phase 4 (sequential): validate (requires Phase 3 results)
    ↓
Phase 5 (sequential): review → deploy
```

**Critical path identification:**
- Longest sequential chain = critical path
- Optimize: move non-critical tasks to parallel phases
- Constraint: resource budget (max 5 concurrent)

Visualize DAG:
```
Tool: mcp__mcp-graph__export
Params:
  format: mermaid
```

### Step 5: Parallel Dispatch

Launch independent skills concurrently with resource budgets:

For each phase in the DAG:
1. Identify all skills in the current phase
2. Verify no write conflicts between parallel skills
3. Assign resource budgets (token limits, time limits)
4. Dispatch skills with contextual prompts

**Resource budget per skill:**

| Resource | Budget | Rationale |
|----------|--------|-----------|
| Max tokens | 10K per skill invocation | Prevent runaway consumption |
| Max time | 5 minutes per skill | Prevent stalls |
| Max graph writes | 20 nodes per skill | Prevent backlog flooding |
| Max memory writes | 5 per skill | Prevent knowledge bloat |

**Dispatch pattern:**
```
# Phase N: dispatch all skills in parallel
for skill in phase_skills:
    dispatch(skill, context=task_context, budget=resource_budget)
```

### Step 6: Progress Monitoring

Track sub-task completion and handle issues:

| Event | Detection | Response |
|-------|-----------|----------|
| Skill completed | Status update received | Unlock dependent phases |
| Skill stalled | No progress in 5 minutes | Retry once, then flag |
| Skill failed | Error returned | Log error, try fallback skill |
| Resource exceeded | Budget limit hit | Terminate, use partial results |
| Conflict detected | Two skills write same resource | Serialize conflicting skills |

Monitor via graph state:
```
Tool: mcp__mcp-graph__metrics
```

### Step 7: Result Aggregation

Merge outputs from parallel skills:

1. **Collect** — Gather results from all completed skills
2. **Deduplicate** — Remove duplicate findings (e.g., same issue found by quality + security)
3. **Resolve conflicts** — If two skills recommend contradictory actions, use priority rules:
   - Security > Quality > Performance > Docs
   - Critical > High > Medium > Low
4. **Synthesize** — Create unified report with attribution (which skill found what)
5. **Update graph** — Ensure all skill-created nodes are properly linked

### Step 8: Orchestration Report & Memory

Generate execution trace and performance metrics:

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Nirvana Swarm Orchestrator — <date>"
  content: "<DAG executed, skills dispatched, parallelism achieved, results aggregated, conflicts resolved, performance metrics>"
  tags: ["nirvana", "swarm", "orchestrator", "parallel", "execution"]
```

## Output Format

```
Phase: NIRVANA SWARM ORCHESTRATOR (MAPE-K)
Skills Available: N Nirvana + M graph-* + K cross-cutting
Tasks Decomposed: N sub-tasks from M source tasks

Execution DAG:
  Phases: N (N parallel, M sequential)
  Critical Path: <phase sequence>
  Parallelism Factor: X.Xx (actual parallel / total skills)

Dispatch Results:
  Completed: N/M skills (X% success rate)
  Failed: N skills (fallbacks used: M)
  Stalled: N skills (retried: M)

Aggregation:
  Total Findings: N (N deduplicated from M raw)
  Conflicts Resolved: N (security: M, quality: K)
  Graph Nodes Created: N (linked to M epics)

Performance:
  Total Execution Time: Xm Ys
  Parallel Savings: Xm Ys (vs. sequential)
  Resource Usage: N tokens, M memory writes

Saved to memory: "Nirvana Swarm Orchestrator — <date>"
```

## Anti-Patterns

- Do NOT dispatch more than 5 skills in parallel — resource contention degrades all results
- Do NOT skip the DAG phase — uncoordinated parallel execution causes write conflicts
- Do NOT ignore skill failures — always use fallback or flag for manual intervention
- Do NOT let skills exceed resource budgets — runaway skills starve others
- Do NOT aggregate without deduplication — duplicate findings waste developer time
- Do NOT resolve conflicts by dropping findings — merge with priority rules, keep all evidence
- Do NOT orchestrate without monitoring — unmonitored parallel execution hides failures
- Do NOT use the orchestrator for single-skill tasks — overhead exceeds benefit for simple work
