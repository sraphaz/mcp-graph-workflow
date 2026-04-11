---
name: graph-knowledge-synthesis
description: Knowledge distillation from graph history — synthesizes new insights from accumulated execution data, decision patterns, and project evolution
triggers:
  - graph-knowledge-synthesis
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-knowledge-synthesis

Distills new insights from accumulated graph data by analyzing execution patterns, decision history, error trends, and velocity evolution. Produces synthesized knowledge artifacts that are more valuable than the sum of their raw inputs — identifying hidden correlations, emerging anti-patterns, and actionable recommendations that no single data point reveals.

## When to Use

- At the end of each sprint to extract learnings before they fade from context
- When the knowledge store exceeds 100 entries and needs consolidation
- When starting a new epic that may benefit from patterns discovered in previous epics
- Proactively when `knowledge_stats` shows high volume but low query hit rates
- When onboarding a new team member or agent who needs distilled project knowledge
- Autonomously at the end of each lifecycle phase transition

## Mandatory Flow

```
knowledge_stats → rag_context(historical_data) → extract_patterns → correlate_insights → synthesize_artifacts → validate_synthesis → write_memory
```

## Workflow

### Step 1: Assess Knowledge Store State

Get a snapshot of the current knowledge inventory:
```
Tool: mcp__mcp-graph__knowledge_stats
```

Identify knowledge categories and their distribution:

| Category | Count | Last Updated | Query Hit Rate |
|----------|-------|-------------|----------------|
| decisions | N | date | % |
| errors | N | date | % |
| patterns | N | date | % |
| estimates | N | date | % |
| adrs | N | date | % |

Flag categories with low hit rates — they may contain redundant or poorly organized entries.

### Step 2: Extract Raw Patterns

Query the knowledge store for raw data across multiple dimensions:

**Execution patterns:**
```
Tool: mcp__mcp-graph__rag_context (query: "task completion patterns cycle time velocity trends")
```

**Decision patterns:**
```
Tool: mcp__mcp-graph__rag_context (query: "architectural decisions rationale tradeoffs")
```

**Error patterns:**
```
Tool: mcp__mcp-graph__rag_context (query: "error patterns failures root causes corrections")
```

**Estimation patterns:**
```
Tool: mcp__mcp-graph__search (query: "xpSize estimate actual")
```

### Step 3: Correlate Across Dimensions

Look for hidden correlations that individual data points do not reveal:

| Correlation | Signal | Insight |
|-------------|--------|---------|
| Task size vs cycle time | XL tasks take 5x longer than predicted | Break XL into M tasks |
| Error frequency vs phase | 70% of errors occur in IMPLEMENT | Strengthen PLAN phase |
| Decision reversals vs age | Decisions <1 week old reverse 30% of time | Add cooling period |
| Dependency depth vs quality | Tasks with 3+ deps have lower DoD grades | Reduce coupling |
| Sprint position vs velocity | Velocity drops 40% in last 2 days | Front-load complex tasks |

Run analysis to validate correlations:
```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

### Step 4: Identify Emerging Anti-Patterns

Detect negative patterns that are forming but not yet critical:

1. **Knowledge silos**: Certain knowledge categories never get queried — may indicate poor organization or naming
2. **Decision oscillation**: The same architectural decision is made and reversed multiple times
3. **Error recurrence**: Same error pattern appears despite previous correction entries
4. **Velocity decay**: Throughput decreasing sprint-over-sprint without corresponding complexity increase
5. **Context bloat**: Average context size growing without quality improvement

For each anti-pattern, assess severity:
```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

### Step 5: Synthesize Knowledge Artifacts

Create high-value synthesized artifacts from raw patterns:

**Type 1 — Sprint Retrospective Synthesis:**
Combine all task outcomes, errors, and decisions from a sprint into a single coherent retrospective that captures what worked, what did not, and why.

**Type 2 — Architecture Decision Record (ADR) Consolidation:**
Merge related decisions into comprehensive ADRs that capture the full decision evolution, not just point-in-time snapshots.

**Type 3 — Error Prevention Playbook:**
Transform error patterns into a prevention checklist, organized by error type and trigger conditions.

**Type 4 — Estimation Calibration Guide:**
Synthesize estimation accuracy data into calibration factors per task type and complexity.

**Type 5 — Pattern Library Update:**
Extract reusable code patterns and architectural templates from successful implementations.

### Step 6: Validate Synthesis Quality

Before persisting, validate that synthesized artifacts meet quality criteria:

| Criterion | Check |
|-----------|-------|
| Grounded | Every claim traceable to source data |
| Actionable | Contains specific recommendations, not just observations |
| Non-redundant | Does not duplicate existing knowledge entries |
| Structured | Follows consistent format for queryability |
| Timestamped | Includes date range of source data |

### Step 7: Persist Synthesized Knowledge

Store each artifact with appropriate categorization:
```
Tool: mcp__mcp-graph__write_memory
Params:
  category: "pattern"
  content: "Knowledge synthesis [date_range]: [artifact_type]. Key findings: [findings]. Recommendations: [recommendations]. Source data: [N] entries across [categories]."
  tags: ["knowledge-synthesis", "<artifact_type>", "<sprint_id>"]
```

For high-priority findings that should influence immediate behavior:
```
Tool: mcp__mcp-graph__write_memory
Params:
  category: "decision"
  content: "Synthesis-driven decision: [decision]. Evidence: [correlation_data]. Expected impact: [prediction]."
  tags: ["knowledge-synthesis", "decision", "data-driven"]
```

### Step 8: Knowledge Compaction

When the store exceeds optimal size, compact redundant entries:

1. Identify entries with >80% content overlap
2. Merge overlapping entries into a single consolidated entry
3. Archive obsolete entries (>6 months old with zero query hits)
4. Update tags and categories for improved queryability

```
Tool: mcp__mcp-graph__knowledge_stats
```

### Step 9: Self-Healing Loop

Track synthesis effectiveness over time:
- If synthesized artifacts have higher query hit rates than raw entries, synthesis is working
- If hit rates are low, adjust synthesis focus areas and granularity
- If the same patterns keep appearing in new syntheses, the corrective actions are not working — escalate
- Run meta-synthesis every 3 sprints to synthesize the syntheses themselves

```
Tool: mcp__mcp-graph__write_memory
Params:
  category: "pattern"
  content: "Synthesis meta-analysis: Artifacts produced=<N>, Avg hit rate=<N>%, Top insight=<description>. Improvement areas: <list>."
  tags: ["knowledge-synthesis", "meta-analysis"]
```

## Output Format

```
Knowledge Synthesis Report
==========================
Period: <date_range>
Source Data: <N> entries across <M> categories

Patterns Discovered: <N>
  - <pattern_1>: <description> (confidence: <high/medium/low>)
  - <pattern_2>: <description> (confidence: <high/medium/low>)

Correlations Found: <N>
  - <dimension_A> vs <dimension_B>: <finding>

Anti-Patterns Detected: <N>
  - <anti_pattern>: severity=<high/medium/low>, recommendation=<action>

Artifacts Produced:
  - <type_1>: <title> (<N> source entries)
  - <type_2>: <title> (<N> source entries)

Knowledge Store Health:
  Total Entries: <N> (compacted from <M>)
  Avg Query Hit Rate: <N>%
  Categories: <list>

Next Synthesis: end of sprint <N>
```

## Anti-Patterns

- Do NOT synthesize from fewer than 10 source entries — insufficient data produces unreliable patterns
- Do NOT create synthesis artifacts that are longer than the source data — synthesis means distillation, not expansion
- Do NOT persist ungrounded insights — every claim must trace to specific source entries
- Do NOT skip the validation step — low-quality synthesis pollutes the knowledge store
- Do NOT ignore low-hit-rate artifacts — they indicate either poor quality or poor organization
- Do NOT synthesize too frequently — once per sprint is optimal; more often creates noise
- Do NOT delete raw source data after synthesis — the raw data is needed for future re-synthesis with new perspectives
