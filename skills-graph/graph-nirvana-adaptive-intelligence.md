---
name: graph-nirvana-adaptive-intelligence
description: Continuous adaptive learning — adjusts heuristics from task outcomes and evolves the knowledge base via deduplication, enrichment, and staleness cleanup
triggers:
  - graph-nirvana-adaptive-intelligence
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-nirvana-adaptive-intelligence

Continuous adaptive learning engine that harvests task outcomes, recognizes patterns, adjusts estimation heuristics, and evolves the knowledge base. Combines two autonomous capabilities: **adaptive learning** (agent improves from experience) and **knowledge base evolution** (auto-merge, dedup, enrich memories).

Integrates into the MAPE-K loop: **Monitor** (harvest outcomes) → **Analyze** (pattern recognition) → **Plan** (heuristic adjustments) → **Execute** (knowledge evolution) → **Knowledge** (save learning deltas).

## When to Use

- After completing a sprint or batch of tasks (LISTENING phase)
- When estimation accuracy is declining (planned vs. actual diverging)
- When knowledge base grows beyond 100 memories (dedup needed)
- When RAG relevance scores are dropping (enrichment needed)
- Periodically (weekly recommended) for continuous improvement
- The user says "adaptive learning", "evolve knowledge", "improve heuristics", or "nirvana intelligence"

## Mandatory Flow

```
harvest_outcomes → pattern_recognition → heuristic_adjustment → prompt_tuning → knowledge_dedup → knowledge_enrichment → staleness_cleanup → evolution_report → write_memory
```

## Workflow

### Step 1: Harvest Outcomes

Collect task completion data from the graph:

```
Tool: mcp__mcp-graph__metrics
```

Extract per-task:
- **Cycle time** — `done_timestamp - in_progress_timestamp`
- **Lead time** — `done_timestamp - created_at`
- **Rework rate** — status reversals (done → in_progress count)
- **AC pass rate** — acceptance criteria validation results
- **Estimation accuracy** — planned size vs. actual cycle time

```
Tool: mcp__mcp-graph__forecast (mode: "dora")
```

Collect DORA metrics for macro-level trends:
- Deployment frequency, lead time, change failure rate, MTTR

### Step 2: Pattern Recognition

Analyze outcome data for recurring patterns:

| Pattern Type | Detection Method | Example |
|-------------|-----------------|---------|
| Error recurrence | Same error hash in healing memories | "Zod v4 import error" repeats 5x |
| Estimation bias | Systematic over/underestimate by size | "L tasks take 2.3x estimated time" |
| Dependency bottleneck | Tasks blocked by same dependency | "store module blocks 40% of tasks" |
| Success strategy | Common traits of fast-completed tasks | "Tasks with AC + tests finish 60% faster" |
| Anti-patterns | Common traits of reworked tasks | "Tasks without context load have 3x rework" |

Use `mcp__mcp-graph__search(query:"healing")` to find self-healing memories.
Use `mcp__mcp-graph__rag_context` for deep pattern search across knowledge base.

### Step 3: Heuristic Adjustment

Based on patterns, propose adjustments to planning heuristics:

| Heuristic | Current | Proposed | Justification |
|-----------|---------|----------|---------------|
| Size multiplier (S/M/L/XL) | 1x/2x/4x/8x hours | Adjust based on actual ratios | "L tasks average 5.2x, not 4x" |
| Priority weights | fixed | Adjust based on blocking frequency | "Blocked tasks waste 30% lead time" |
| Decomposition threshold | >4h = decompose | Adjust based on completion rate | "Tasks >3h have 40% rework rate" |
| Context load requirement | optional | Adjust based on success correlation | "Context-loaded tasks: 80% first-pass" |

Save adjustments as recommendations (do NOT auto-apply — create review tasks).

### Step 4: Prompt Tuning

Analyze which skill instructions produce best outcomes:

1. Correlate task success with skill used (`mcp__mcp-graph__search(query:"skill")`)
2. Identify skill instructions that lead to:
   - Higher first-pass success rate
   - Lower rework rate
   - Better AC validation scores
3. Document improvement suggestions for underperforming skills
4. Create task nodes for skill instruction updates

### Step 5: Knowledge Deduplication

Scan knowledge base for redundant memories:

```
Tool: mcp__mcp-graph__rag_context
Params:
  query: "all healing memories"
  topK: 50
```

**Dedup criteria:**
- Same error hash → merge, keep most recent resolution
- Similar title (>80% token overlap) → merge, combine content
- Superseded advice (old memory contradicted by newer) → archive old
- Same topic from different tasks → consolidate into single authoritative memory

For each merge candidate:
```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "[Merged] <consolidated title>"
  content: "<merged content with citations from originals>"
  tags: ["nirvana", "merged", "adaptive", "<original-tags>"]
```

### Step 6: Knowledge Enrichment

Improve existing memories for better RAG retrieval:

| Enrichment | Method | Impact |
|-----------|--------|--------|
| Cross-linking | Add `related_to` references between memories | +20% retrieval relevance |
| Tag completion | Add missing tags based on content analysis | +15% search recall |
| Context gaps | Add "when to use" and "when NOT to use" to memories | +25% precision |
| Code references | Add file paths and line numbers to memories | +30% actionability |

Use `mcp__mcp-graph__search` to find memories missing tags or cross-references.

### Step 7: Staleness Cleanup

Identify and handle stale knowledge:

| Staleness Signal | Threshold | Action |
|-----------------|-----------|--------|
| Age without access | >60 days since last RAG hit | Flag for review |
| Contradicted by code | Memory says X, code shows Y | Update or archive |
| Outdated dependency | References removed/renamed package | Update |
| Superseded by newer | Newer memory covers same topic better | Archive old |
| Orphaned reference | Links to deleted graph nodes | Remove links |

**Verification rule:** Before archiving, grep the codebase to confirm the memory is truly stale. Code always wins over memory.

### Step 8: Evolution Report & Memory

Generate learning delta report:

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Nirvana Adaptive Intelligence — <date>"
  content: "<patterns found, heuristic adjustments proposed, memories merged/enriched/archived, DORA trends>"
  tags: ["nirvana", "adaptive", "intelligence", "learning", "evolution"]
```

## Output Format

```
Phase: NIRVANA ADAPTIVE INTELLIGENCE (MAPE-K)
Outcomes Harvested: N tasks analyzed (N sprints)
Patterns Found: N error recurrences, N estimation biases, N bottlenecks
Heuristic Adjustments: N proposed (N size, N priority, N decomposition)
Prompt Tuning: N skill improvements identified

Knowledge Evolution:
  Duplicates Merged: N memories consolidated into M
  Enriched: N memories improved (tags, links, context)
  Stale Archived: N memories archived
  Net Knowledge: N total memories (delta: +/-M)

DORA Trend: freq X/day, lead P85 Yh, failure Z%, MTTR Wh
Estimation Accuracy: X% (trend: ↑/↓/→)
First-Pass Success: X% (trend: ↑/↓/→)

Saved to memory: "Nirvana Adaptive Intelligence — <date>"
```

## Anti-Patterns

- Do NOT auto-apply heuristic changes — create review tasks, let the developer approve adjustments
- Do NOT delete memories without verifying against code — code is the source of truth, not memory
- Do NOT merge memories with different intent — similar words ≠ same knowledge
- Do NOT ignore estimation accuracy trends — systematic bias compounds sprint after sprint
- Do NOT enrich memories with speculative content — only add verifiable facts
- Do NOT run staleness cleanup without a backup — use `graph-nirvana-resilience-ops` first
- Do NOT overfit heuristics to recent data — use rolling windows (last 3 sprints minimum)
- Do NOT skip pattern recognition — jumping straight to cleanup misses the learning opportunity
