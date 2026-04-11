---
name: graph-nlp-sentiment-analyzer
description: Sentiment analysis on user feedback, issues, code comments, and task descriptions to surface team morale and project health
triggers:
  - graph-nlp-sentiment-analyzer
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-nlp-sentiment-analyzer

Performs sentiment analysis across user feedback, issue reports, code comments, task descriptions, and retrospective notes. Produces sentiment scores, trend analysis, and actionable alerts when negative sentiment spikes. Enables proactive detection of frustration, confusion, or dissatisfaction before they escalate into blockers.

## When to Use

- When reviewing user feedback or issue reports to prioritize by urgency and frustration level
- When analyzing retrospective notes to quantify team morale and identify recurring pain points
- When code review comments indicate tension or disagreement that needs mediation
- When task descriptions contain language suggesting confusion, uncertainty, or scope creep
- When preparing sprint reviews and need a sentiment health check across the iteration
- When monitoring long-running projects for sentiment drift over time

## Mandatory Flow

```
search → rag_context → [sentiment analysis pipeline] → analyze → write_memory
```

## Workflow

### Step 1: Collect Text Corpus

Gather the text to be analyzed. Target sources include task descriptions, comments, feedback entries, and knowledge store entries.

**Tool:** `mcp__mcp-graph__search`

```
search({ query: "<feedback topic or sprint identifier>", limit: 50 })
```

Cast a wide net to capture all relevant text within the analysis scope.

### Step 2: Load Contextual Background

Retrieve context for the identified nodes to understand the surrounding project state.

**Tool:** `mcp__mcp-graph__rag_context`

```
rag_context({ nodeId: "<primary-node-id>", includeKnowledge: true })
```

Context is essential for disambiguating sentiment -- "this is a nightmare" about a production bug is different from "this is a nightmare" about a test fixture.

### Step 3: Sentence-Level Sentiment Classification

Process each text segment at the sentence level:

**Polarity Classification:**
- **Positive** (+0.5 to +1.0): satisfaction, enthusiasm, confidence, gratitude
- **Mildly Positive** (+0.1 to +0.5): approval, agreement, mild satisfaction
- **Neutral** (-0.1 to +0.1): factual statements, objective descriptions
- **Mildly Negative** (-0.5 to -0.1): concern, mild frustration, uncertainty
- **Negative** (-1.0 to -0.5): frustration, anger, dissatisfaction, confusion

**Emotion Detection:**
- Frustration markers: "again", "still", "broken", "why does this"
- Confusion markers: "unclear", "don't understand", "what does this mean"
- Urgency markers: "critical", "blocking", "ASAP", "urgent"
- Satisfaction markers: "works great", "clean", "elegant", "perfect"

### Step 4: Aspect-Based Sentiment

Break sentiment down by aspect to identify which areas generate positive or negative reactions:

- **Code quality**: sentiment about code structure, readability, maintainability
- **Documentation**: sentiment about docs completeness, accuracy, clarity
- **Tooling**: sentiment about build tools, CI/CD, development environment
- **Process**: sentiment about workflow, sprint planning, communication
- **Performance**: sentiment about speed, reliability, resource usage
- **UX/UI**: sentiment about user interface, developer experience

### Step 5: Trend Analysis

Compute sentiment trends over time windows:

- **Per-sprint trend**: average sentiment across all text in each sprint
- **Per-topic trend**: sentiment trajectory for specific features or modules
- **Anomaly detection**: flag sudden sentiment drops (> 0.3 decrease between windows)
- **Correlation analysis**: map sentiment drops to specific events (blockers, scope changes, outages)

### Step 6: Cross-Reference with Graph Health

Validate sentiment findings against graph metrics.

**Tool:** `mcp__mcp-graph__analyze`

```
analyze({ mode: "progress", sprintId: "<current-sprint>" })
```

Correlate:
- Negative sentiment with blocked tasks
- Frustration spikes with high cycle time nodes
- Confusion indicators with tasks lacking acceptance criteria

### Step 7: Persist Sentiment Report

Store the analysis in the knowledge store for longitudinal tracking.

**Tool:** `mcp__mcp-graph__write_memory`

```
write_memory({
  type: "sentiment-report",
  category: "nlp-sentiment-analysis",
  content: "<structured sentiment report JSON>"
})
```

## Output Format

```json
{
  "analysis_id": "nlp-sa-<timestamp>",
  "scope": {
    "type": "sprint | feedback-batch | code-review | retrospective",
    "period": { "from": "2026-04-01", "to": "2026-04-10" },
    "textSegments": 124
  },
  "overall": {
    "score": -0.12,
    "label": "mildly_negative",
    "confidence": 0.88
  },
  "byAspect": {
    "code_quality": { "score": 0.35, "sampleSize": 28 },
    "documentation": { "score": -0.42, "sampleSize": 15 },
    "tooling": { "score": 0.10, "sampleSize": 22 },
    "process": { "score": -0.18, "sampleSize": 31 }
  },
  "trends": {
    "direction": "declining",
    "anomalies": [
      { "date": "2026-04-07", "drop": -0.45, "correlatedEvent": "scope expansion" }
    ]
  },
  "alerts": [
    { "severity": "warning", "message": "Documentation sentiment dropped 40% this sprint" }
  ],
  "persisted": true
}
```

## Anti-Patterns

- Do NOT run sentiment analysis on purely technical/factual text (API docs, schema definitions) -- it produces noise
- Do NOT ignore context when scoring sentiment -- sarcasm and domain jargon require contextual understanding
- Do NOT treat sentiment scores as absolute truth -- they are signals for investigation, not verdicts
- Do NOT skip aspect-based breakdown -- overall sentiment hides important per-topic variation
- Do NOT analyze sentiment without loading context via `rag_context` -- isolated text loses meaning
- Do NOT alert on single negative sentences -- require a pattern or threshold before flagging
- Do NOT overwrite historical sentiment data -- append new reports to maintain trend visibility
