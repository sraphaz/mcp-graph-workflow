---
name: graph-multi-agent-swarm
description: Multi-agent swarm coordination — parallel agent collaboration on complex tasks with task distribution, conflict resolution, and result aggregation
triggers:
  - graph-multi-agent-swarm
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-multi-agent-swarm

Coordinates parallel agent collaboration on complex tasks that benefit from decomposition into concurrent workstreams. Manages task distribution across specialized agents, resolves conflicts when agents produce contradictory outputs, and aggregates partial results into a coherent whole — all tracked in the execution graph.

## When to Use

- When a task or epic has 3+ independent subtasks that can be parallelized
- When different subtasks require different specializations (e.g., frontend + backend + tests)
- When sprint deadlines require faster throughput than sequential execution allows
- Proactively when `analyze(progress)` reveals the sprint is behind schedule
- When a complex refactoring touches multiple independent modules simultaneously
- Autonomously when the task dependency graph reveals a wide parallelizable frontier

## Mandatory Flow

```
analyze(task_graph) → identify_parallel_frontier → assign_agents → monitor_execution → resolve_conflicts → aggregate_results → write_memory
```

## Workflow

### Step 1: Analyze Task Graph for Parallelism

Identify tasks that can be executed concurrently:
```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Search for ready tasks with no mutual dependencies:
```
Tool: mcp__mcp-graph__search (query: "status:ready")
```

Build the parallelizable frontier — tasks where:
- Status is `ready` (all dependencies satisfied)
- No shared mutable state between tasks
- No file-level conflicts (different tasks modify different files)
- No sequential ordering constraint

### Step 2: Define Agent Specializations

Assign agent roles based on task requirements:

| Agent Role | Specialization | Task Types |
|------------|---------------|------------|
| Architect | System design, interfaces, dependencies | Design tasks, API contracts |
| Implementer | Core logic, algorithms, data structures | Implementation tasks |
| Tester | Test creation, coverage, edge cases | Test tasks, validation |
| Integrator | Cross-module wiring, API connections | Integration tasks |
| Reviewer | Quality checks, pattern compliance | Review tasks |
| Documenter | Technical docs, API docs, comments | Documentation tasks |

### Step 3: Create Swarm Coordination Nodes

For each parallel workstream, create a coordination structure in the graph:
```
Tool: mcp__mcp-graph__node (action: "add", type: "task")
Params: title: "Swarm: <workstream_name>", metadata: {swarmRole: "<role>", parentTask: "<epic_id>"}
```

Link coordination nodes to their parent:
```
Tool: mcp__mcp-graph__search (query: "swarm coordination <epic_id>")
```

### Step 4: Distribute Tasks

Assign tasks to agents following the distribution protocol:

1. **Match specialization**: Each task goes to the agent whose role best matches
2. **Balance load**: No agent gets more than 2x the average task count
3. **Minimize dependencies**: Tasks with shared dependencies go to the same agent when possible
4. **Respect WIP limits**: Each agent maintains WIP=1 per Little's Law

Distribution tracking:

| Agent | Tasks Assigned | Estimated Time | Dependencies |
|-------|---------------|----------------|--------------|
| Agent A | T1, T4 | 2h | None |
| Agent B | T2, T5 | 3h | T2 depends on T1 |
| Agent C | T3, T6 | 2.5h | None |

### Step 5: Monitor Parallel Execution

Track progress across all agents:
```
Tool: mcp__mcp-graph__metrics
```

Monitor for coordination issues:
- **Stall detection**: If an agent has not updated status in >30 min, investigate
- **Dependency violation**: If Agent B starts before Agent A completes T1, flag
- **Resource contention**: If two agents modify the same file, halt and resolve

Progress dashboard:
```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

### Step 6: Conflict Resolution

When parallel agents produce conflicting outputs, apply resolution strategies:

| Conflict Type | Resolution Strategy |
|--------------|-------------------|
| File conflict | Agent with higher-priority task wins; other agent rebases |
| API contract mismatch | Architect agent arbitrates; both agents conform |
| Test vs implementation | Test agent wins (TDD principle); implementer adjusts |
| Style/pattern conflict | Established project patterns win; consult `write_memory` history |
| Duplicate work | Keep the higher-quality version; discard the other |

For each conflict, record the resolution:
```
Tool: mcp__mcp-graph__write_memory
Params:
  category: "decision"
  content: "Swarm conflict resolved: <conflict_type> between <agent_A> and <agent_B>. Resolution: <strategy>. Rationale: <why>."
  tags: ["multi-agent", "conflict-resolution", "swarm"]
```

### Step 7: Aggregate Results

Once all parallel workstreams complete, merge results:

1. **Collect outputs**: Gather all completed task outputs from the graph
2. **Integration test**: Run the full test suite to verify combined outputs work together
3. **Consistency check**: Verify no contradictions between agent outputs
4. **Gap analysis**: Identify any requirements not covered by any agent's output

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

### Step 8: Post-Swarm Analysis

Evaluate swarm effectiveness and persist learnings:
```
Tool: mcp__mcp-graph__metrics
```

Calculate swarm metrics:
- **Parallelism factor**: Time saved vs sequential execution
- **Conflict rate**: Conflicts per parallel task pair
- **Rework rate**: Tasks that needed revision after aggregation
- **Throughput multiplier**: Tasks/hour (swarm) vs tasks/hour (sequential)

```
Tool: mcp__mcp-graph__write_memory
Params:
  category: "pattern"
  content: "Swarm execution for <epic>: <N> agents, <M> parallel tasks. Speedup: <X>x. Conflicts: <N>. Rework: <N>%. Lessons: <observations>."
  tags: ["multi-agent", "swarm-metrics", "parallel-execution"]
```

### Step 9: Self-Healing Loop

Improve swarm coordination over time:
- If conflict rate exceeds 20%, reduce parallelism and increase dependency checking
- If rework rate exceeds 15%, add mandatory integration checkpoints mid-execution
- If one agent role consistently bottlenecks, decompose that role into sub-specializations
- Track swarm effectiveness trend across sprints

## Output Format

```
Multi-Agent Swarm Report
========================
Epic: <title> (<epic_id>)
Agents Deployed: <N>
Tasks Parallelized: <N>

Execution Summary:
  Sequential Estimate: <hours>
  Actual (Parallel):   <hours>
  Speedup:             <X>x

Agent Performance:
  <agent_A>: <N> tasks, <time>, <grade>
  <agent_B>: <N> tasks, <time>, <grade>
  <agent_C>: <N> tasks, <time>, <grade>

Conflicts: <N> total
  Resolved: <N>
  Escalated: <N>

Integration:
  Tests Passed: <N>/<total>
  Rework Required: <N> tasks

Swarm Effectiveness: <score>/10
Next Swarm: recommended for epics with <N>+ parallel tasks
```

## Anti-Patterns

- Do NOT parallelize tasks that modify the same files — this guarantees merge conflicts
- Do NOT assign more than 3 tasks to a single agent in one swarm cycle — respect WIP limits
- Do NOT skip the conflict resolution protocol — unresolved conflicts compound into integration failures
- Do NOT assume all tasks in an epic are parallelizable — always check the dependency graph first
- Do NOT run a swarm without a final integration test — parallel correctness does not imply combined correctness
- Do NOT forget to track swarm metrics — without measurement, you cannot improve coordination
- Do NOT use swarm coordination for fewer than 3 parallel tasks — the overhead exceeds the benefit
