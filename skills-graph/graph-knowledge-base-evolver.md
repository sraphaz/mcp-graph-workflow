---
name: graph-knowledge-base-evolver
description: Auto-evolves the knowledge base — detects stale knowledge, fills gaps, re-indexes, and improves retrieval quality autonomously
triggers:
  - graph-knowledge-base-evolver
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-knowledge-base-evolver

Auto-evolves the mcp-graph knowledge base to maintain high-quality, relevant, and complete knowledge. Autonomously detects stale entries, identifies knowledge gaps, consolidates duplicate information, re-indexes for optimal retrieval, and measures retrieval quality. Ensures the RAG pipeline always delivers accurate and current context.

## When to Use

- Proactively triggered when `knowledge_stats` shows staleness >25% of total entries
- When RAG retrieval returns low-relevance results (user reports "wrong context")
- After every 20 completed tasks to ensure knowledge keeps pace with implementation
- When a new epic or major feature is started (knowledge gap detection)
- The user says "evolve knowledge", "fix knowledge base", "stale knowledge", or "improve RAG"
- Autonomously triggered when `rag_context` quality scores drop below 0.6 average relevance

## Mandatory Flow

```
audit(knowledge_stats + quality) → detect(stale + gaps + duplicates) → evolve(update + fill + merge) → reindex(rebuild indexes) → verify(retrieval quality) → write_memory
```

## Workflow

### Step 1: Audit — Assess Knowledge Base Health

Collect comprehensive knowledge base metrics:

```
Tool: mcp__mcp-graph__knowledge_stats
```

Audit dimensions:

| Dimension | Metric | Healthy Threshold |
|-----------|--------|-------------------|
| Volume | Total entries | Proportional to graph size |
| Coverage | % of graph nodes with related knowledge | >70% |
| Freshness | % of entries updated within 7 days | >70% |
| Staleness | % of entries not updated in >14 days | <25% |
| Duplicates | Entries with >80% content similarity | <5% |
| Retrieval quality | Average relevance score of RAG queries | >0.6 |
| Category balance | Distribution across categories | No category >40% of total |

Test retrieval quality with representative queries:

```
Tool: mcp__mcp-graph__rag_context (query: "<representative query for active work>")
```

Score each result: is the returned context relevant, current, and useful? Record the average relevance.

### Step 2: Detect — Identify Issues

Based on the audit, classify knowledge base issues:

**Stale knowledge detection:**
```
Tool: mcp__mcp-graph__search (query: "knowledge entries older than 14 days")
```

Identify entries that reference:
- Modules that have been significantly refactored since the entry was created
- Architectural decisions that have been superseded
- Error patterns that have been resolved
- Estimation data from >3 sprints ago

**Knowledge gap detection:**
```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Compare graph structure against knowledge coverage:
- Nodes with 0 related knowledge entries
- Modules with high code complexity but no architectural knowledge
- Epics with decisions not documented in knowledge base
- Error patterns observed in self-healing but not in knowledge

**Duplicate detection:**
Search for entries with overlapping titles or content:
```
Tool: mcp__mcp-graph__rag_context (query: "<topic with suspected duplicates>")
```

Flag entries where:
- Two or more entries cover the same topic with >80% content overlap
- Multiple entries describe the same decision with conflicting information
- Redundant error pattern entries that could be consolidated

### Step 3: Evolve — Apply Knowledge Improvements

**3a. Update stale entries:**

For each stale entry, determine the correct action:

| Staleness Type | Action |
|----------------|--------|
| Outdated but topic still relevant | Update content with current state |
| Topic no longer relevant (feature removed) | Archive (tag as `archived`) |
| Superseded by newer entry | Merge into newer entry, archive old |
| Estimation data >3 sprints old | Refresh with current velocity data |

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "<updated title>"
  content: "<refreshed content reflecting current state>"
  tags: ["<original tags>", "evolved"]
```

**3b. Fill knowledge gaps:**

For each identified gap, create new knowledge entries:

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "<gap topic> — Knowledge Entry"
  content: "<synthesized knowledge from code analysis, graph context, and RAG>"
  tags: ["<relevant tags>", "gap-fill"]
```

Sources for gap filling:
- Code analysis for undocumented modules
- Graph node descriptions and acceptance criteria
- Historical task outcomes and patterns
- Existing but disconnected knowledge entries

**3c. Merge duplicates:**

For each duplicate pair:
1. Identify the most complete and recent entry
2. Merge unique information from the other entry
3. Archive the redundant entry

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "<consolidated title>"
  content: "<merged content from both entries>"
  tags: ["<all unique tags>", "consolidated"]
```

### Step 4: Reindex — Rebuild for Optimal Retrieval

After all knowledge modifications, rebuild indexes:

```
Tool: mcp__mcp-graph__reindex_knowledge
```

Reindexing ensures:
- FTS5 indexes reflect updated content
- BM25 scores are recalculated with current term frequencies
- TF-IDF weights reflect the evolved corpus
- Embedding vectors (if used) are regenerated for modified entries

### Step 5: Verify — Test Retrieval Quality

Re-run the representative queries from Step 1 and compare:

```
Tool: mcp__mcp-graph__rag_context (query: "<same representative query>")
```

```
Tool: mcp__mcp-graph__knowledge_stats
```

Verification criteria:

| Metric | Before | After | Must Be |
|--------|--------|-------|---------|
| Staleness % | Measured in Step 1 | Measured now | Lower |
| Coverage % | Measured in Step 1 | Measured now | Higher |
| Duplicate count | Measured in Step 1 | Measured now | Lower |
| Retrieval relevance | Measured in Step 1 | Measured now | Higher or equal |

If retrieval quality decreased after evolution, investigate: a merge may have lost important content, or reindexing may need different parameters.

### Step 6: Record Evolution Results

Save the evolution report:

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Knowledge Evolution Report — <date>"
  content: "<audit results, issues found, actions taken, before/after metrics, retrieval quality comparison>"
  tags: ["knowledge-evolution", "rag", "quality", "maintenance"]
```

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

## Output Format

```
Phase: KNOWLEDGE BASE EVOLUTION
Loop: Audit -> Detect -> Evolve -> Reindex -> Verify

Audit:
  Total entries: <N>
  Coverage: <N>% | Freshness: <N>% | Staleness: <N>%
  Duplicates: <N> | Retrieval relevance: <N>

Detect:
  Stale entries: <N> (outdated: <N>, irrelevant: <N>, superseded: <N>)
  Knowledge gaps: <N> (modules: <N>, decisions: <N>, patterns: <N>)
  Duplicates: <N> pairs

Evolve:
  Entries updated: <N>
  Entries archived: <N>
  Gaps filled: <N> new entries
  Duplicates merged: <N>

Reindex:
  FTS5 rebuild: <completed>
  Entries indexed: <N>

Verify:
  Staleness: <N>% -> <N>% (delta: <-N>%)
  Coverage: <N>% -> <N>% (delta: <+N>%)
  Retrieval relevance: <N> -> <N> (delta: <+/-N>)

Saved to memory: "Knowledge Evolution Report — <date>"
```

## Anti-Patterns

- Do NOT delete knowledge entries — always archive with tags; deletion loses history
- Do NOT merge entries without verifying no unique information is lost — diff before merge
- Do NOT reindex during active RAG queries — schedule for session boundaries
- Do NOT fill gaps with speculative content — only synthesize from verified sources (code, graph, memories)
- Do NOT skip the verify step — evolution without quality measurement is blind maintenance
- Do NOT evolve the knowledge base more than once per day — allow time for new entries to be created naturally
- Do NOT treat all staleness equally — estimation data stales faster than architectural decisions
