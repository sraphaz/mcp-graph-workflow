---
name: graph-deterministic-first-ai-optimizer
description: Reduces AI/LLM usage by prioritizing deterministic solutions with meta-rule learning from AI fallbacks
triggers:
  - graph-deterministic-first-ai-optimizer
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-deterministic-first-ai-optimizer

Autonomous skill that reduces AI/LLM usage by systematically prioritizing deterministic solutions -- rules, SQL queries, heuristics, caches, and graph traversals -- over AI inference. AI is used only as a fallback when all deterministic layers fail. After each AI fallback, the skill extracts a new deterministic rule (meta-rule learning), progressively expanding deterministic coverage and shrinking AI dependency. Tracks an AI Usage Reduction Score to measure progress toward deterministic-first operation.

## When to Use

- When AI/LLM token costs are growing and deterministic alternatives exist for recurring queries
- When the same type of AI request is made repeatedly with predictable patterns
- When building new features and need to decide whether AI inference is truly required
- When optimizing an existing AI-dependent workflow for cost and latency reduction
- When the AI Usage Reduction Score drops below the target threshold (default: 70%)
- When onboarding a new module and need to classify its tasks across deterministic layers

## Mandatory Flow

```
analyze(deterministic_coverage) → [classify task to layer] → [attempt layers 0-3] → [AI fallback if needed] → [extract meta-rule] → metrics(ai_usage_reduction) → write_memory
```

## Workflow

### Step 1: Assess Current Deterministic Coverage

Measure how much of the current workload is handled deterministically versus by AI fallback.

- `Tool: mcp__mcp-graph__analyze` — mode: `progress`, assess current task distribution
- `Tool: mcp__mcp-graph__metrics` — retrieve AI usage stats: total requests, deterministic hits, AI fallbacks
- `Tool: mcp__mcp-graph__knowledge_stats` — check knowledge store coverage for cached deterministic answers
- Calculate baseline AI Usage Reduction Score: `(deterministic_hits / total_requests) * 100`

### Step 2: Classify Task to Deterministic Layer

Every task or query must be mapped to one of the 5 deterministic layers. Start at Layer 0 and escalate only if the current layer cannot handle the task.

| Layer | Name | Theoretical Basis | When to Use | Example |
|-------|------|-------------------|-------------|---------|
| 0 | Pure Rules / SQL | Decidability Theory, Relational Algebra | Answer is fully computable from structured data with known schema | "How many tasks are done?" -> `SELECT COUNT(*) WHERE status='done'` |
| 1 | Cache / Memoization | Dynamic Programming, Optimal Substructure | Same query was answered before; result is still valid within TTL | "What is the next task?" -> cached result from last `next` call (TTL: 60s) |
| 2 | Heuristics / FSM | Finite Automata, Greedy Algorithms | Answer follows a known decision tree or state machine | "Should this task be blocked?" -> FSM: check deps, check status, apply rules |
| 3 | Property-Based / Snapshot | QuickCheck, Metamorphic Testing | Verify correctness of a deterministic answer by testing invariants | "Is this dependency chain valid?" -> property: no cycles, all nodes exist |
| 4 | Meta-Rule Learning | Rule Induction, Version Spaces | AI was used as fallback; extract the pattern as a new deterministic rule | AI classified a task as "blocked" -> extract rule: "if all deps not done, status=blocked" |

- For each incoming task or query, attempt classification starting at Layer 0
- If Layer 0 can answer it: execute and return. Do not escalate.
- If Layer 0 cannot: try Layer 1, then Layer 2, then Layer 3
- Only if Layers 0-3 all fail: escalate to AI fallback (implicit Layer 5)

### Step 3: Execute Deterministic Layers (0-3)

Attempt to resolve the task using each applicable deterministic layer in order.

**Layer 0 -- Pure Rules / SQL:**
- Check if the query maps to a known SQL pattern or business rule
- `Tool: mcp__mcp-graph__rag_context` — search for existing rules in knowledge store
- If a rule exists: execute it, return result, log as `deterministic_hit`

**Layer 1 -- Cache / Memoization:**
- Check if an identical or equivalent query was resolved recently
- Apply cache key normalization (lowercase, sort params, strip whitespace)
- If cache hit within TTL: return cached result, log as `cache_hit`
- `Tool: mcp__mcp-graph__knowledge_stats` — check cache hit rates

**Layer 2 -- Heuristics / FSM:**
- Check if the query maps to a known decision tree or finite state machine
- Execute the heuristic: evaluate conditions in order, return first matching outcome
- Log the decision path for auditability

**Layer 3 -- Property-Based / Snapshot:**
- If a deterministic answer was produced by Layers 0-2, validate it using property-based checks
- Test invariants: no cycles in dependency chains, all referenced nodes exist, status transitions are valid
- If validation fails: discard the deterministic answer and escalate to AI fallback

### Step 4: AI Fallback (When Determinism Fails)

If all deterministic layers fail, use AI as the fallback. This is the only acceptable path to AI inference.

- Log the fallback event with full context: query, layers attempted, failure reasons
- Execute the AI inference request
- Record: input tokens, output tokens, latency, cost estimate
- `Tool: mcp__mcp-graph__metrics` — record AI fallback event with token count and latency
- Tag the result with `ai_fallback` for meta-rule extraction

### Step 5: Meta-Rule Learning (Layer 4)

After every AI fallback, analyze the AI response to extract a new deterministic rule that can handle similar queries in the future.

- Compare the AI input/output pair against existing rules in the knowledge store
- Identify the pattern: what input features determined the AI output?
- Formulate a candidate rule: `IF {conditions} THEN {deterministic_answer}`
- Validate the candidate rule against historical data (at least 5 matching examples)
- If validation passes: add the rule to Layer 0 or Layer 2 (depending on complexity)
- `Tool: mcp__mcp-graph__write_memory` — persist the new rule with provenance (AI fallback ID, validation stats)
- `Tool: mcp__mcp-graph__rag_context` — index the new rule for future retrieval

### Step 6: Update AI Usage Reduction Score

Calculate and report the updated AI Usage Reduction Score after applying meta-rules.

- `Tool: mcp__mcp-graph__metrics` — compute updated score
- AI Usage Reduction Score = `(deterministic_hits / total_requests) * 100`
- Track trend: is the score increasing over time? (it should be, as meta-rules accumulate)
- `Tool: mcp__mcp-graph__analyze` — mode: `progress`, check overall optimization trajectory

| Score Range | Rating | Action |
|-------------|--------|--------|
| 90-100% | Excellent | Maintain; review for over-caching |
| 70-89% | Good | Continue meta-rule extraction |
| 50-69% | Needs Work | Audit high-frequency AI fallbacks; prioritize rule extraction |
| 0-49% | Critical | Halt new features; focus entirely on deterministic coverage |

### Step 7: Persist Optimization State

Save the current optimization state and extracted rules for continuity across sessions.

- `Tool: mcp__mcp-graph__write_memory` — save: layer distribution stats, new meta-rules, AI fallback log, reduction score trend
- Tag with `deterministic-ai`, `token-economy`, `meta-rule-learning`
- Include recommendations for the next optimization cycle

## Output Format

```
## Deterministic-First AI Optimization Report

### AI Usage Reduction Score: {score}% ({rating})
- Trend: {increasing/stable/decreasing} over last {N} cycles

### Layer Distribution
| Layer | Name | Hits | % of Total | Avg Latency |
|-------|------|------|-----------|-------------|
| 0 | Pure Rules / SQL | {n} | {%} | {ms} |
| 1 | Cache / Memoization | {n} | {%} | {ms} |
| 2 | Heuristics / FSM | {n} | {%} | {ms} |
| 3 | Property-Based / Snapshot | {n} | {%} | {ms} |
| 4 | Meta-Rule Learning | {n} rules extracted | — | — |
| AI | Fallback | {n} | {%} | {ms} |

### Meta-Rules Extracted This Cycle
| Rule ID | Pattern | Source (AI Fallback) | Validation (examples) | Target Layer |
|---------|---------|---------------------|----------------------|-------------|
| {id}    | {if/then description} | {fallback_id} | {N}/5 passed | {0 or 2} |

### Token Economy
- Tokens saved by deterministic layers: {N}
- Tokens used by AI fallbacks: {N}
- Estimated cost savings: ${amount}

### Knowledge Persisted
- Memory ID: {id}
- New rules indexed: {N}
```

## Anti-Patterns

- Do NOT use AI as the first resort; always attempt deterministic layers 0-3 first
- Do NOT skip meta-rule extraction after an AI fallback; every fallback is a learning opportunity
- Do NOT cache AI responses without TTL; stale cached AI answers are worse than fresh deterministic ones
- Do NOT treat Layer 4 (meta-rule learning) as optional; it is the mechanism that makes the system self-improving
- Do NOT set cache TTLs too aggressively; invalidation bugs are harder to debug than cache misses
- Do NOT classify a task as "requires AI" without evidence that Layers 0-3 genuinely cannot handle it
- Do NOT ignore the AI Usage Reduction Score trend; a declining score indicates rule rot or new unhandled patterns
