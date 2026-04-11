---
name: graph-nlp-summarization-auto
description: Auto-summarize PRDs, long tasks, changelogs, and graph reports into concise actionable digests
triggers:
  - graph-nlp-summarization-auto
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-nlp-summarization-auto

Automatically generates concise, actionable summaries of PRDs, long task descriptions, changelogs, sprint reports, and graph exports. Produces multi-level summaries (one-liner, paragraph, structured) optimized for different consumption contexts such as handoffs, reviews, and sprint planning.

## When to Use

- When a PRD exceeds 500 words and needs a concise executive summary for sprint planning
- When generating handoff documents and need compressed summaries of completed work
- When changelog or release notes need to be distilled from verbose commit and task histories
- When graph exports are too large for efficient context loading and need summarization
- When onboarding new team members who need quick project overviews
- When preparing review artifacts that summarize sprint progress and decisions

## Mandatory Flow

```
rag_context → [multi-level summarization] → analyze → export → write_memory
```

## Workflow

### Step 1: Load Source Content

Retrieve the full content to be summarized. This may span multiple nodes, documents, or graph exports.

**Tool:** `mcp__mcp-graph__rag_context`

```
rag_context({ nodeId: "<source-node-id>", includeKnowledge: true, depth: 2 })
```

For graph-wide summaries, use export to get the full structure.

**Tool:** `mcp__mcp-graph__export`

```
export({ format: "mermaid" })
```

### Step 2: Content Segmentation

Break the source content into logical segments for targeted summarization:

- **Requirements segments**: functional and non-functional requirements
- **Decision segments**: architectural decisions, trade-offs, rationale
- **Progress segments**: completed tasks, remaining work, blockers
- **Risk segments**: identified risks, mitigations, open concerns
- **Technical segments**: implementation details, code references, APIs

### Step 3: Multi-Level Summarization

Generate summaries at three levels of detail:

**Level 1 -- One-Liner (< 120 chars)**
A single sentence capturing the essence. Suitable for node labels, tooltips, and quick scans.

**Level 2 -- Paragraph (3-5 sentences)**
A concise paragraph covering scope, key decisions, and current state. Suitable for handoff docs and sprint reviews.

**Level 3 -- Structured Summary**
A detailed breakdown with sections for scope, decisions, progress, risks, and next steps. Suitable for full reports and onboarding.

### Step 4: Extractive Key Points

Identify and extract the most important sentences or phrases from the original text. These serve as evidence backing the generated summaries.

- Select sentences with highest information density
- Preserve exact quotes for traceability
- Tag each key point with its source location

### Step 5: Validate Against Graph State

Cross-reference the summary with current graph state to ensure accuracy.

**Tool:** `mcp__mcp-graph__analyze`

```
analyze({ mode: "progress", sprintId: "<current-sprint>" })
```

Verify that:
- Mentioned tasks exist in the graph
- Status references match actual node statuses
- Dependency claims align with edge relationships

### Step 6: Generate Changelog Summary

For release or sprint summaries, produce a structured changelog.

**Tool:** `mcp__mcp-graph__export`

```
export({ format: "json", filter: { status: "done", sprint: "<target-sprint>" } })
```

Group completed tasks by category (feature, fix, refactor, docs) and generate a human-readable changelog.

### Step 7: Persist Summaries

Store the generated summaries in the knowledge store.

**Tool:** `mcp__mcp-graph__write_memory`

```
write_memory({
  type: "summary",
  category: "nlp-auto-summary",
  content: "<structured multi-level summary>"
})
```

## Output Format

```json
{
  "summary_id": "nlp-sum-<timestamp>",
  "source": {
    "type": "prd | sprint | changelog | graph-export",
    "nodeIds": ["<node-id-1>", "<node-id-2>"],
    "wordCount": 3200
  },
  "summaries": {
    "oneLiner": "Graph-based workflow engine with 46 MCP tools, RAG pipeline, and sprint planning.",
    "paragraph": "The project implements a local-first CLI tool that converts PRDs into persistent execution graphs stored in SQLite. It features 46 MCP tools for structured agentic workflows, a RAG pipeline for knowledge retrieval, and sprint planning with velocity tracking. Current sprint has 12/18 tasks completed with 2 blockers on external integrations.",
    "structured": {
      "scope": "...",
      "decisions": ["..."],
      "progress": { "done": 12, "total": 18, "blockers": 2 },
      "risks": ["..."],
      "nextSteps": ["..."]
    }
  },
  "keyPoints": [
    { "text": "...", "source": "node-id", "importance": 0.95 }
  ],
  "changelog": {
    "features": ["..."],
    "fixes": ["..."],
    "refactors": ["..."]
  },
  "persisted": true
}
```

## Anti-Patterns

- Do NOT summarize without loading full context via `rag_context` first -- partial input produces misleading summaries
- Do NOT generate summaries that reference tasks or statuses without validating against the graph -- stale data propagates errors
- Do NOT produce only one summary level -- different consumers need different detail levels
- Do NOT discard extractive key points -- they provide traceability back to source text
- Do NOT summarize code directly -- summarize the task descriptions and decisions, not raw source code
- Do NOT skip the changelog format for sprint summaries -- structured changelogs are required for handoff
- Do NOT overwrite previous summaries without versioning -- maintain a history of summaries for trend analysis
