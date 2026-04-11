---
name: graph-deterministic-layers-theorems
description: Implements 5-layer deterministic architecture grounded in CS theorems with per-layer coverage tracking
triggers:
  - graph-deterministic-layers-theorems
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-deterministic-layers-theorems

Autonomous skill that implements and enforces a 5-layer deterministic architecture where every layer is grounded in a formal computer science theorem. Each task in the execution graph is mapped to the lowest possible layer (most deterministic), and AI inference is only permitted when all 5 layers have been exhausted. Tracks deterministic coverage per layer, identifies gaps, and progressively hardens the system through theorem-guided rule extraction.

## When to Use

- When designing a new module and need to classify its operations by determinism level
- When auditing an existing module for AI over-reliance that could be replaced by formal methods
- When a new task type is introduced and needs to be mapped to the correct deterministic layer
- When deterministic coverage per layer drops below threshold and needs remediation
- When onboarding team members to the deterministic-first architecture and its theoretical foundations
- When validating that the 5-layer architecture is correctly implemented and no layer is being bypassed

## Mandatory Flow

```
analyze(layer_coverage) → [map tasks to layers] → [verify theorem compliance] → metrics(per_layer_coverage) → [identify gaps] → [extract rules for gaps] → write_memory
```

## Workflow

### Step 1: Understand the 5-Layer Architecture

The deterministic architecture consists of 5 layers, ordered from most deterministic (Layer 0) to most adaptive (Layer 4). Each layer is grounded in a specific CS theorem that guarantees its properties.

| Layer | Name | CS Theorem / Foundation | Guarantee | Computational Class |
|-------|------|------------------------|-----------|-------------------|
| 0 | Decidability / Automata Theory | Church-Turing Thesis + Rice's Theorem (inverse) | For decidable properties, a Turing machine always halts with correct answer | Recursive (decidable) |
| 1 | Memoization / Dynamic Programming | Bellman's Principle of Optimality | Optimal substructure: solution to subproblems can be cached and reused without loss | Polynomial (with caching) |
| 2 | DFA / Finite State Machines | Myhill-Nerode Theorem | Any regular language is recognizable by a minimal DFA; state transitions are deterministic and complete | Regular (O(n) recognition) |
| 3 | Property-Based Testing / QuickCheck | Curry-Howard Correspondence (proofs as programs) | If a property holds for all generated inputs, it holds with high probability for the domain | Probabilistic verification |
| 4 | Rule Induction / Learning | Gold's Theorem (identification in the limit) | Given enough examples, a consistent rule can be induced that converges to the correct concept | Limit-computable |

### Step 2: Map Tasks to Layers

For every task or operation in the graph, determine the lowest applicable layer. Lower layers are always preferred because they provide stronger determinism guarantees.

- `Tool: mcp__mcp-graph__analyze` — mode: `progress`, retrieve all tasks and their current classification
- `Tool: mcp__mcp-graph__rag_context` — search knowledge store for existing layer mappings

**Layer 0 -- Decidability / Automata Theory:**
- Tasks where the answer is fully computable from structured data
- Examples: counting nodes by status, checking if a dependency exists, validating a status transition
- Theorem application: these are decidable problems (the algorithm always halts with the correct answer)
- Implementation: SQL queries, pure functions with known input domains, lookup tables

**Layer 1 -- Memoization / Dynamic Programming:**
- Tasks where the result of a subcomputation can be reused across multiple queries
- Examples: shortest dependency path between two nodes, optimal task ordering, context token estimation
- Theorem application: Bellman's principle -- if optimal solution contains optimal sub-solutions, cache them
- Implementation: LRU cache, memoized functions, precomputed tables with TTL-based invalidation

**Layer 2 -- DFA / Finite State Machines:**
- Tasks that follow a known state machine with deterministic transitions
- Examples: node lifecycle (ready -> in_progress -> done), phase gates, validation state machines
- Theorem application: Myhill-Nerode -- the state machine is minimal and complete for the language it recognizes
- Implementation: explicit state transition tables, FSM libraries, guard conditions on transitions

**Layer 3 -- Property-Based Testing / QuickCheck:**
- Tasks where correctness is verified by testing invariant properties across many inputs
- Examples: "no cycles in dependency graph" (property: acyclicity), "all done nodes have AC validated" (property: completeness)
- Theorem application: Curry-Howard -- a property test is a constructive proof attempt; passing tests increase confidence
- Implementation: property generators, shrinking strategies, invariant assertions

**Layer 4 -- Rule Induction / Learning:**
- Tasks where no deterministic rule exists yet, but patterns can be learned from examples
- Examples: classifying new task types, predicting task duration, recommending next actions
- Theorem application: Gold's theorem -- with enough positive and negative examples, the correct rule is identifiable in the limit
- Implementation: decision tree induction, version space learning, example-driven rule extraction from AI fallback logs

### Step 3: Verify Theorem Compliance

For each layer, verify that the implementation actually satisfies the theorem's guarantees. A layer is non-compliant if its implementation violates its foundational theorem.

| Layer | Compliance Check | Violation Signal |
|-------|-----------------|-----------------|
| 0 | Algorithm always halts; result is correct for all valid inputs | Timeout, infinite loop, wrong answer on edge case |
| 1 | Cached result is identical to recomputed result; no stale data | Cache returns different answer than fresh computation |
| 2 | All states are reachable; all transitions are defined; no dead states | Unreachable state, undefined transition, ambiguous input |
| 3 | Properties hold for at least 1000 random inputs; shrinking finds minimal counterexample | Property violation found; shrinking does not terminate |
| 4 | Induced rule agrees with training examples; generalization tested on holdout set | Rule contradicts a known example; overfitting detected |

- `Tool: mcp__mcp-graph__analyze` — mode: `done_integrity`, verify each layer's implementation integrity
- `Tool: mcp__mcp-graph__metrics` — record compliance status per layer

### Step 4: Measure Per-Layer Coverage

Calculate deterministic coverage for each layer: what percentage of tasks assigned to that layer are actually handled deterministically (no AI fallback)?

- `Tool: mcp__mcp-graph__metrics` — compute per-layer hit rates
- `Tool: mcp__mcp-graph__knowledge_stats` — check knowledge store for rule completeness per layer

| Layer | Total Tasks Assigned | Handled Deterministically | AI Fallback | Coverage % | Target |
|-------|---------------------|--------------------------|-------------|-----------|--------|
| 0 | {n} | {n} | {n} | {%} | 100% |
| 1 | {n} | {n} | {n} | {%} | 95% |
| 2 | {n} | {n} | {n} | {%} | 98% |
| 3 | {n} | {n} | {n} | {%} | 90% |
| 4 | {n} | {n} | {n} | {%} | 70% |
| **Total** | **{n}** | **{n}** | **{n}** | **{%}** | **90%** |

### Step 5: Identify Coverage Gaps

For each layer below its target coverage, identify the specific tasks or operations causing AI fallbacks.

- Query the AI fallback log for operations assigned to each layer
- Group by root cause: missing rule, stale cache, incomplete FSM, untested property, insufficient examples
- Rank gaps by impact: `frequency * tokens_per_fallback = total token waste`
- `Tool: mcp__mcp-graph__rag_context` — search for similar patterns that already have deterministic rules
- `Tool: mcp__mcp-graph__analyze` — mode: `progress`, correlate gaps with sprint priorities

### Step 6: Extract Rules to Close Gaps

For each identified gap, extract or create a deterministic rule that closes it. This is the continuous improvement engine of the architecture.

**Gap in Layer 0 (Decidability):**
- The query is decidable but no SQL/rule exists yet
- Action: write the SQL query or pure function; add to the rule registry
- Validation: run against all historical inputs; verify 100% match with AI fallback answers

**Gap in Layer 1 (Memoization):**
- The computation is cacheable but the cache key or TTL is wrong
- Action: fix cache key normalization or adjust TTL; add cache warming for cold-start scenarios
- Validation: compare cached vs. fresh results over 100 samples

**Gap in Layer 2 (DFA / FSM):**
- The state machine has an undefined transition or missing guard
- Action: add the missing transition; verify DFA minimality using Myhill-Nerode equivalence classes
- Validation: exhaustively test all state/input combinations

**Gap in Layer 3 (Property-Based):**
- A property is failing for certain edge cases
- Action: refine the property generator or add the edge case to the property domain
- Validation: run 10,000 iterations; confirm zero failures after fix

**Gap in Layer 4 (Rule Induction):**
- Not enough examples for reliable rule extraction
- Action: collect more examples from AI fallback log; retrain rule when example count >= threshold
- Validation: holdout accuracy >= 90%

- `Tool: mcp__mcp-graph__write_memory` — persist each new rule with its theorem justification and validation results

### Step 7: Update Architecture Documentation

Record the current state of the 5-layer architecture, including layer assignments, coverage, and theorem compliance.

- `Tool: mcp__mcp-graph__write_memory` — save: layer mapping table, coverage metrics, compliance status, gap analysis, new rules extracted
- Tag with `deterministic-layers`, `cs-theorems`, `architecture`, sprint/phase identifier
- `Tool: mcp__mcp-graph__rag_context` — index the updated layer mappings for future queries
- `Tool: mcp__mcp-graph__knowledge_stats` — verify the knowledge store reflects the new rules

## Output Format

```
## Deterministic Layers Architecture Report

### 5-Layer Summary
| Layer | Name | Theorem | Tasks | Coverage | Compliance | Target |
|-------|------|---------|-------|----------|------------|--------|
| 0 | Decidability | Church-Turing | {n} | {%} | {pass/fail} | 100% |
| 1 | Memoization | Bellman | {n} | {%} | {pass/fail} | 95% |
| 2 | DFA / FSM | Myhill-Nerode | {n} | {%} | {pass/fail} | 98% |
| 3 | Property-Based | Curry-Howard | {n} | {%} | {pass/fail} | 90% |
| 4 | Rule Induction | Gold's Theorem | {n} | {%} | {pass/fail} | 70% |
| **Total** | — | — | **{n}** | **{%}** | **{N}/5** | **90%** |

### Theorem Compliance Details
| Layer | Theorem | Check Performed | Result | Details |
|-------|---------|----------------|--------|---------|
| 0 | Church-Turing | Halting + correctness on all inputs | {pass/fail} | {details} |
| 1 | Bellman | Cache consistency (cached == fresh) | {pass/fail} | {details} |
| 2 | Myhill-Nerode | DFA minimality + completeness | {pass/fail} | {details} |
| 3 | Curry-Howard | 1000 random inputs, all properties hold | {pass/fail} | {details} |
| 4 | Gold's Theorem | Holdout accuracy >= 90% | {pass/fail} | {details} |

### Coverage Gaps
| Layer | Gap Description | Root Cause | Impact (tokens/period) | Remediation |
|-------|----------------|-----------|----------------------|-------------|
| {L}   | {description}  | {cause}   | {tokens}             | {action}    |

### Rules Extracted This Cycle
| Rule ID | Layer | Pattern | Theorem Justification | Validation | Status |
|---------|-------|---------|----------------------|------------|--------|
| {id}    | {L}   | {if/then} | {theorem reference} | {N}/{N} passed | {active/pending} |

### Knowledge Persisted
- Memory ID: {id}
- Layer mappings updated: {N}
- New rules indexed: {N}
- Tags: {tags}
```

## Anti-Patterns

- Do NOT assign a task to a higher layer when a lower layer can handle it; always prefer maximum determinism
- Do NOT skip theorem compliance verification; a layer that violates its theorem provides false confidence
- Do NOT treat Layer 4 (Rule Induction) as a permanent home for a task; every Layer 4 task should eventually be promoted to Layer 0-2 as rules solidify
- Do NOT ignore coverage gaps in Layer 0; 100% coverage at Layer 0 is non-negotiable for decidable problems
- Do NOT create FSMs (Layer 2) without verifying minimality via Myhill-Nerode; redundant states cause maintenance burden and subtle bugs
- Do NOT use property-based testing (Layer 3) as a substitute for deterministic rules; properties verify, they do not replace computation
- Do NOT extract rules (Layer 4) from fewer than 5 examples; premature induction leads to overfitting and brittle rules
