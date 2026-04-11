---
name: graph-legacy-agnostic-evolver
description: Safe legacy system evolution using Strangler Fig Pattern, characterization tests, feature toggles, and canary releases for any legacy tech stack
triggers:
  - graph-legacy-agnostic-evolver
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-legacy-agnostic-evolver

Safe legacy system evolution that works with any legacy technology (COBOL, VB6, Delphi, Oracle Forms, mainframe, FoxPro, PowerBuilder, classic ASP). Applies the Strangler Fig Pattern for incremental modernization, characterization tests to capture existing behavior before changes, feature toggles for safe rollout, and canary releases for production validation. Technology-agnostic by design.

## When to Use

- When modernizing a legacy system that cannot be rewritten from scratch
- When the legacy codebase has no tests and behavior must be captured before changes
- When deploying modernized components alongside legacy requires feature toggles
- When validating new implementations against legacy behavior via shadow testing
- When planning a phased migration roadmap from any legacy stack to modern architecture
- When managing risk during incremental legacy replacement

## Mandatory Flow

```
analyze(legacy landscape) --> characterization tests --> node(migration tasks) --> edge(dependencies) --> strangler fig facade --> feature toggles --> canary release --> code_intelligence(impact) --> search(verify) --> write_memory
```

## Workflow

### Step 1: Legacy Landscape Analysis

Analyze the legacy system to understand its boundaries, integration points, data flows, and technology constraints. This is technology-agnostic -- the same process applies whether the system is COBOL on z/OS or VB6 on Windows Server.

```
Tool: mcp__mcp-graph__analyze (mode: "design_ready")
```

```
Tool: mcp__mcp-graph__code_intelligence (action: "index")
```

Produce a landscape inventory:

| Dimension | What to Capture |
|-----------|-----------------|
| Runtime | Language, framework, OS, middleware, database |
| Integration points | APIs, file transfers, message queues, batch jobs, shared databases |
| Data stores | Schema, data volume, referential integrity, replication topology |
| Business rules | Embedded logic in code, stored procedures, triggers, batch scripts |
| Users/consumers | Internal teams, external partners, downstream systems |
| Deployment | Release frequency, deployment method, rollback capability |

Create the evolution epic in the execution graph:

```
Tool: mcp__mcp-graph__node (action: "add", type: "epic", title: "Legacy Evolution — <system name>")
```

### Step 2: Characterization Tests

Before touching any legacy code, capture its current behavior with characterization tests. These tests document what the system actually does (not what it should do), creating a safety net for changes.

```
Tool: mcp__mcp-graph__node (action: "add", type: "task", title: "Characterization Tests — <module>", parentId: "<epic_id>")
```

Characterization test strategy per technology:

- **COBOL/Mainframe** -- capture JCL inputs/outputs, VSAM file snapshots, CICS transaction recordings
- **VB6/Delphi** -- record UI interaction sequences, COM interface call traces, database state changes
- **Oracle Forms** -- capture form triggers, PL/SQL procedure I/O, database state transitions
- **Stored procedures** -- snapshot input parameters and result sets for all known call patterns
- **Batch jobs** -- record input files, output files, database state before/after, timing constraints

Golden rule: every characterization test asserts on actual observed behavior, not on specification. If the legacy system has a bug that users rely on, the test captures the bug as expected behavior.

```
Tool: mcp__mcp-graph__edge (from: "<chartest_node>", to: "<migration_node>", type: "depends_on")
```

### Step 3: Define Migration Task Graph

Decompose the legacy system into independently replaceable components. Each component becomes a task node with explicit dependencies.

```
Tool: mcp__mcp-graph__node (action: "add", type: "task", title: "Migrate <component>", parentId: "<epic_id>")
```

```
Tool: mcp__mcp-graph__edge (from: "<component_a>", to: "<component_b>", type: "depends_on")
```

Decomposition principles:
- **Seam identification** -- find natural boundaries where the legacy system can be split (API boundaries, file interfaces, message queues)
- **Dependency ordering** -- migrate leaf components first (fewest dependents), work inward
- **Data migration first** -- if the data store changes, migrate data before migrating logic
- **Shared nothing** -- each migrated component must own its data, no shared database coupling

### Step 4: Strangler Fig Facade

Build a facade layer that routes traffic between the legacy system and the new implementation. Initially, 100% of traffic goes to legacy. As components are migrated, the facade gradually routes traffic to the new system.

```
Tool: mcp__mcp-graph__node (action: "add", type: "task", title: "Strangler Fig Facade — <system>")
```

Facade implementation patterns:

- **HTTP proxy** -- reverse proxy that routes by URL path or header to legacy or modern backend
- **Message router** -- message queue consumer that routes messages based on content or header
- **Database view** -- views that abstract whether data comes from legacy tables or new schema
- **File adapter** -- translates between legacy file formats (fixed-width, EBCDIC) and modern formats (JSON, CSV)

The facade must be transparent to callers -- existing consumers should not need to change.

### Step 5: Feature Toggles

Implement feature toggles to control which traffic routes through the new implementation vs legacy. Toggles enable instant rollback without deployment.

```
Tool: mcp__mcp-graph__search (query: "feature toggle configuration")
```

Toggle hierarchy:

| Level | Scope | Use Case |
|-------|-------|----------|
| Kill switch | Global | Emergency rollback to 100% legacy |
| Percentage rollout | Global | Canary: 1% -> 5% -> 25% -> 50% -> 100% |
| User segment | Per-user | Beta users on new, others on legacy |
| Component toggle | Per-feature | Individual components toggled independently |

Toggle state must be persisted and auditable. Every toggle change must be logged with timestamp, actor, and reason.

### Step 6: Shadow Testing

Run the new implementation in parallel with legacy, comparing outputs without affecting users. Shadow testing catches behavioral differences before any traffic is switched.

```
Tool: mcp__mcp-graph__node (action: "add", type: "task", title: "Shadow Testing — <component>")
```

Shadow test execution:
1. Clone incoming requests to both legacy and new implementation
2. Legacy response is returned to the caller (source of truth)
3. New implementation response is captured and compared
4. Divergences are logged with full request/response details
5. Divergence rate below threshold (e.g., <0.1%) qualifies for canary

### Step 7: Canary Release and Validation

Gradually shift production traffic from legacy to the new implementation using the feature toggles. Monitor error rates, latency, and business metrics at each increment.

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Canary progression:
1. **1% traffic** -- smoke test, monitor for crashes and errors (30 minutes)
2. **5% traffic** -- validate latency P95/P99 within 10% of legacy (2 hours)
3. **25% traffic** -- validate business metrics (conversion, data accuracy) match legacy (24 hours)
4. **50% traffic** -- extended validation under load (48 hours)
5. **100% traffic** -- full cutover, legacy on standby for rollback (7 days)
6. **Decommission** -- remove legacy component after 30-day bake period

At any stage, if metrics degrade, roll back instantly via feature toggle.

### Step 8: Impact Analysis and Verification

Run code intelligence to assess the blast radius of all changes and verify no unintended side effects.

```
Tool: mcp__mcp-graph__code_intelligence (action: "impact", scope: "<changed modules>")
```

```
Tool: mcp__mcp-graph__search (query: "<migrated component> integration")
```

Verify:
- All characterization tests still pass against the new implementation
- No orphaned legacy code left running without monitoring
- All integration points updated to route through the facade
- Data consistency between legacy and new data stores (if dual-write period)

### Step 9: Record Evolution Decisions

Save all migration decisions, patterns, and lessons learned.

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Legacy Evolution Report — <system> <date>"
  content: "<landscape analysis, characterization test coverage, migration roadmap, facade design, toggle strategy, canary results, decommission timeline>"
  tags: ["legacy", "strangler-fig", "migration", "characterization-tests"]
```

## Output Format

```
Phase: LEGACY EVOLUTION
System: <name> (<technology stack>)
Pattern: Strangler Fig + Characterization Tests + Feature Toggles

Landscape:
  Technology: <language/framework>
  Integration points: <N>
  Data stores: <N>
  Business rules captured: <N>

Characterization Tests:
  Modules covered: <N>/<M>
  Behavior assertions: <N>
  Coverage: <N>%

Migration Graph:
  Total components: <N>
  Migrated: <N> (<N>%)
  In progress: <N>
  Remaining: <N>

Canary Status:
  Current traffic split: <N>% new / <N>% legacy
  Error rate delta: <N>%
  Latency delta: <N>ms (P95)
  Business metric delta: <N>%

Decommission readiness: <ready/not ready>
Saved to memory: "Legacy Evolution Report — <system> <date>"
```

## Anti-Patterns

- Do NOT rewrite the entire legacy system at once -- the Strangler Fig pattern exists to prevent big-bang failures
- Do NOT skip characterization tests -- changing legacy code without capturing current behavior guarantees regressions
- Do NOT share databases between legacy and modern systems long-term -- dual-write is a transitional pattern only
- Do NOT deploy without feature toggles -- instant rollback capability is non-negotiable for legacy migration
- Do NOT ignore shadow test divergences -- even small differences indicate behavioral mismatches that will affect users
- Do NOT decommission legacy components without a bake period -- hidden consumers and batch jobs may surface days later
- Do NOT assume legacy behavior is correct -- characterization tests capture what the system does, not what it should do; track known bugs separately
