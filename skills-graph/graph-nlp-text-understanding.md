---
name: graph-nlp-text-understanding
description: Deep text comprehension with entity recognition, intent detection, and sentiment analysis on PRDs, feedback, and graph content
triggers:
  - graph-nlp-text-understanding
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-nlp-text-understanding

Performs deep text comprehension across PRDs, task descriptions, user feedback, and graph content. Extracts entities, detects intent, classifies sentiment, and persists structured insights into the knowledge store for downstream consumption by planning and analysis tools.

## When to Use

- When a new PRD is imported and you need structured understanding of its content (entities, intents, requirements)
- When user feedback or issue reports need to be parsed for actionable insights
- When task descriptions are ambiguous and need intent clarification before implementation
- When you need to identify implicit requirements or risks hidden in natural language text
- When preparing context for sprint planning and need structured text analysis
- When onboarding to a project and need to understand the semantic landscape of existing nodes

## Mandatory Flow

```
search → rag_context → [NLP text analysis] → analyze → write_memory
```

## Workflow

### Step 1: Identify Target Text

Locate the text corpus to analyze. This may be a PRD, a set of task descriptions, user feedback, or any unstructured text attached to graph nodes.

**Tool:** `mcp__mcp-graph__search`

Search the graph for nodes containing the target text. Use keyword and semantic queries to locate relevant content.

```
search({ query: "<target text or topic>", limit: 20 })
```

### Step 2: Load Deep Context

Retrieve enriched context for the identified nodes, including related knowledge entries, linked documents, and historical analysis.

**Tool:** `mcp__mcp-graph__rag_context`

```
rag_context({ nodeId: "<target-node-id>", includeKnowledge: true, includeHistory: true })
```

### Step 3: Entity Recognition

Extract structured entities from the text corpus:

- **Technical entities**: file paths, function names, class names, module references
- **Domain entities**: feature names, user roles, business rules, constraints
- **Dependency entities**: library names, API endpoints, service references
- **Risk entities**: phrases indicating uncertainty, complexity, or external dependencies

Classify each entity with a type, confidence score, and source location.

### Step 4: Intent Detection

Classify the intent behind each text segment:

- **Requirement**: the text describes something the system must do
- **Constraint**: the text limits how something can be done
- **Risk**: the text describes a potential problem or uncertainty
- **Decision**: the text records an architectural or design choice
- **Question**: the text poses an open question needing resolution
- **Feedback**: the text provides evaluation of existing functionality

### Step 5: Sentiment Analysis

Evaluate the sentiment polarity and intensity of text segments:

- **Positive**: satisfaction, approval, confidence
- **Negative**: frustration, concern, dissatisfaction
- **Neutral**: factual, informational, objective
- **Mixed**: contains both positive and negative signals

Assign a sentiment score (-1.0 to +1.0) and confidence level.

### Step 6: Run Graph Analysis

Validate the extracted insights against the current graph state.

**Tool:** `mcp__mcp-graph__analyze`

```
analyze({ mode: "progress", sprintId: "<current-sprint>" })
```

Cross-reference extracted entities with existing graph nodes to identify gaps, redundancies, or misalignments.

### Step 7: Persist Insights

Store the structured analysis results in the knowledge store for future retrieval.

**Tool:** `mcp__mcp-graph__write_memory`

```
write_memory({
  type: "insight",
  category: "nlp-text-understanding",
  content: "<structured JSON with entities, intents, sentiments>"
})
```

## Output Format

```json
{
  "analysis_id": "nlp-tu-<timestamp>",
  "source": {
    "type": "prd | task | feedback | document",
    "nodeId": "<source-node-id>",
    "textLength": 2450
  },
  "entities": [
    {
      "text": "GraphEventBus",
      "type": "technical",
      "subtype": "class",
      "confidence": 0.95,
      "location": { "start": 120, "end": 133 }
    }
  ],
  "intents": [
    {
      "segment": "The system must support real-time event propagation",
      "intent": "requirement",
      "confidence": 0.92
    }
  ],
  "sentiment": {
    "overall": 0.15,
    "distribution": { "positive": 0.3, "negative": 0.1, "neutral": 0.6 },
    "highlights": []
  },
  "summary": "Text contains 12 technical entities, 5 requirements, 2 risks, overall neutral sentiment.",
  "persisted": true
}
```

## Anti-Patterns

- Do NOT run text understanding without first loading context via `rag_context` -- you need the full picture
- Do NOT extract entities from text without validating them against the graph -- phantom entities waste downstream effort
- Do NOT classify sentiment on purely technical/factual text -- sentiment analysis is for feedback and subjective content
- Do NOT persist raw unstructured text as insights -- always produce structured JSON output
- Do NOT skip the `analyze` step -- cross-referencing with graph state catches misalignments early
- Do NOT treat entity extraction as a one-time task -- re-run when source text is updated
- Do NOT ignore low-confidence extractions entirely -- flag them for human review instead of discarding
