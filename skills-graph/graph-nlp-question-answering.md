---
name: graph-nlp-question-answering
description: Q&A engine over the execution graph, PRDs, knowledge store, and execution history with citation-backed answers
triggers:
  - graph-nlp-question-answering
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-nlp-question-answering

Provides a question-answering engine over the execution graph, PRDs, knowledge store, and execution history. Accepts natural language questions, retrieves relevant evidence from multiple sources, synthesizes citation-backed answers, and persists Q&A pairs for future retrieval. Designed to reduce context-switching and information hunting during development.

## When to Use

- When a developer asks "why was this decision made?" and needs an answer from project history
- When sprint planning raises questions about requirements, constraints, or past implementation choices
- When onboarding and need answers about project architecture, conventions, or design rationale
- When debugging and need to understand the history and context of a specific module or feature
- When reviewing and need quick answers about task dependencies, acceptance criteria, or blocker status
- When preparing handoff documentation and need to answer anticipated questions proactively

## Mandatory Flow

```
rag_context → search → context → [answer synthesis] → analyze → write_memory
```

## Workflow

### Step 1: Query Understanding

Parse and classify the incoming question:

**Question Types:**
- **Factual**: "What status is task X?" -- requires direct graph lookup
- **Explanatory**: "Why was SQLite chosen over PostgreSQL?" -- requires knowledge store search
- **Procedural**: "How do I run the RAG pipeline?" -- requires documentation retrieval
- **Comparative**: "What is the difference between context and rag_context?" -- requires multi-source synthesis
- **Temporal**: "What changed in sprint 3?" -- requires historical analysis
- **Hypothetical**: "What would break if we removed the event bus?" -- requires impact analysis

Classify the question type to guide the retrieval strategy.

### Step 2: Multi-Source Evidence Retrieval

Retrieve evidence from multiple sources based on question type.

**Tool:** `mcp__mcp-graph__rag_context`

```
rag_context({ query: "<reformulated question>", includeKnowledge: true, includeHistory: true })
```

**Tool:** `mcp__mcp-graph__search`

```
search({ query: "<key terms from question>", limit: 20 })
```

**Tool:** `mcp__mcp-graph__context`

```
context({ nodeId: "<most-relevant-node-id>" })
```

For factual questions, prioritize graph state. For explanatory questions, prioritize knowledge store. For procedural questions, prioritize documentation.

### Step 3: Evidence Ranking and Filtering

Rank retrieved evidence by relevance to the question:

- **Semantic similarity**: how closely the evidence matches the question intent
- **Recency**: prefer newer evidence over older for temporal questions
- **Authority**: prefer knowledge store entries (explicit decisions) over task descriptions (implicit context)
- **Specificity**: prefer evidence that directly addresses the question over tangentially related content

Filter out evidence below a relevance threshold (0.3) to avoid noise in the answer.

### Step 4: Answer Synthesis

Compose the answer from the ranked evidence:

**Answer Structure:**
1. **Direct answer**: a concise 1-2 sentence response to the question
2. **Supporting evidence**: 2-4 key pieces of evidence with citations
3. **Confidence level**: high (multiple corroborating sources), medium (single strong source), low (inferred from indirect evidence)
4. **Caveats**: any limitations, assumptions, or areas of uncertainty

**Citation Format:**
Each claim in the answer must reference its source: `[node:<node-id>]`, `[knowledge:<entry-id>]`, or `[doc:<file-path>]`.

### Step 5: Validate Answer Consistency

Cross-check the synthesized answer against the graph state.

**Tool:** `mcp__mcp-graph__analyze`

```
analyze({ mode: "progress" })
```

Verify:
- Referenced nodes exist and have the stated statuses
- Dependency claims match actual edges in the graph
- Timeline claims align with node timestamps
- Technical claims are consistent with code intelligence data

### Step 6: Handle Unanswerable Questions

When the evidence is insufficient:

- State explicitly that the question cannot be fully answered with available data
- Identify what information is missing and where it might be found
- Suggest related questions that can be answered
- Recommend creating a knowledge entry to fill the gap

### Step 7: Persist Q&A Pair

Store the question-answer pair for future retrieval and FAQ building.

**Tool:** `mcp__mcp-graph__write_memory`

```
write_memory({
  type: "qa-pair",
  category: "nlp-question-answering",
  content: "<structured Q&A pair with citations>"
})
```

## Output Format

```json
{
  "qa_id": "nlp-qa-<timestamp>",
  "question": {
    "text": "Why does the project use FTS5 instead of a vector database?",
    "type": "explanatory",
    "keyTerms": ["FTS5", "vector database", "search"]
  },
  "answer": {
    "direct": "The project uses FTS5 to maintain the local-first, zero-external-infrastructure constraint. FTS5 with BM25 provides sufficient search quality for the project's scale without requiring a separate vector database service.",
    "evidence": [
      {
        "text": "Search: FTS5 + BM25 + TF-IDF (100% local)",
        "source": "knowledge:arch-decision-001",
        "relevance": 0.95
      },
      {
        "text": "No Docker, no external infra",
        "source": "node:prd-constraints",
        "relevance": 0.88
      }
    ],
    "confidence": "high",
    "caveats": ["This decision may need revisiting if the knowledge store exceeds 100K entries"]
  },
  "relatedQuestions": [
    "How does the BM25 scoring work?",
    "What is the performance ceiling of FTS5?"
  ],
  "persisted": true
}
```

## Anti-Patterns

- Do NOT answer questions without retrieving evidence first -- unsupported answers erode trust
- Do NOT provide answers without citations -- every claim must trace back to a source
- Do NOT guess when evidence is insufficient -- explicitly state the question is unanswerable and why
- Do NOT skip the validation step -- answers referencing stale or incorrect graph state are harmful
- Do NOT treat all questions the same -- question type determines the optimal retrieval strategy
- Do NOT discard Q&A pairs -- persisted pairs build a FAQ that accelerates future queries
- Do NOT answer hypothetical questions with the same confidence as factual ones -- clearly label inference vs. fact
