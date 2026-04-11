---
name: graph-nlp-style-transfer
description: Text style adaptation transforming technical content to friendly prose, dense text to readable format, and vice versa
triggers:
  - graph-nlp-style-transfer
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-nlp-style-transfer

Adapts text style across different registers and audiences while preserving semantic content. Transforms technical documentation into user-friendly prose, dense specifications into readable narratives, formal reports into casual summaries, and vice versa. Ensures that graph content is accessible to all stakeholders regardless of technical background.

## When to Use

- When preparing handoff documents for non-technical stakeholders who need simplified explanations
- When converting terse task descriptions into detailed, readable documentation
- When transforming user-facing error messages from technical jargon to friendly guidance
- When adapting PRD language from business requirements to technical specifications
- When generating release notes that need different versions for developers and end users
- When onboarding materials need to bridge the gap between expert and beginner audiences

## Mandatory Flow

```
rag_context → [style analysis + transformation] → analyze → write_memory
```

## Workflow

### Step 1: Load Source Content

Retrieve the text to be transformed along with its surrounding context.

**Tool:** `mcp__mcp-graph__rag_context`

```
rag_context({ nodeId: "<source-node-id>", includeKnowledge: true })
```

Context is critical for style transfer -- understanding the domain ensures that simplification does not introduce inaccuracies.

### Step 2: Style Analysis of Source

Analyze the current style of the source text:

**Readability Metrics:**
- Sentence length distribution (average, median, max)
- Vocabulary complexity (technical term density, jargon ratio)
- Passive voice frequency
- Acronym and abbreviation density
- Code snippet and reference frequency

**Style Classification:**
- **Technical**: high jargon, precise terminology, assumes domain expertise
- **Formal**: structured, objective tone, third person, complete sentences
- **Casual**: conversational, first/second person, contractions, shorter sentences
- **Dense**: information-packed, minimal redundancy, high cognitive load
- **Readable**: moderate pace, explanations, examples, transitions
- **Minimal**: bullet points, fragments, no elaboration

### Step 3: Define Target Style

Based on the target audience and purpose, define the output style:

**Audience Profiles:**
- **Developer**: technical vocabulary OK, code references welcome, concise preferred
- **Product Manager**: business impact focus, minimal code, outcome-oriented
- **Executive**: high-level summary, metrics, decisions, no implementation details
- **End User**: friendly tone, step-by-step, no jargon, examples and analogies
- **New Team Member**: explanatory, context-heavy, links to deeper resources

**Style Parameters:**
- Target reading level (grade 8 for general, grade 12 for technical)
- Maximum sentence length (15 words for casual, 25 for formal)
- Jargon handling (keep, define-inline, replace, footnote)
- Tone (neutral, encouraging, authoritative, conversational)

### Step 4: Content-Preserving Transformation

Transform the text while preserving all semantic content:

**Simplification Strategies:**
- Replace jargon with plain language equivalents (provide glossary mapping)
- Break long sentences into shorter ones
- Convert passive voice to active voice
- Add transitional phrases for flow
- Insert brief explanations for technical concepts
- Replace acronyms with full terms on first use

**Densification Strategies (reverse):**
- Consolidate redundant statements
- Replace explanations with precise terminology
- Remove transitional filler
- Convert narrative to bullet points
- Abbreviate well-known terms

**Tone Adjustment:**
- Formal to casual: contractions, second person, shorter sentences, relatable examples
- Casual to formal: remove contractions, third person, complete sentences, precise language

### Step 5: Validate Semantic Preservation

Verify that the transformation preserved all meaningful content:

- Compare entity counts between source and target (no entities lost)
- Verify all requirements, constraints, and decisions are present in the output
- Check that no factual claims were altered or introduced during transformation
- Ensure all references (node IDs, file paths, tool names) remain accurate

**Tool:** `mcp__mcp-graph__analyze`

```
analyze({ mode: "progress" })
```

Cross-reference any graph-related claims in the transformed text against actual graph state.

### Step 6: Generate Style Report

Document the transformation for traceability:

- Source style classification and metrics
- Target style parameters applied
- Transformation strategies used
- Semantic preservation verification results
- Readability improvement metrics (before/after)

### Step 7: Persist Transformed Content

Store both the transformed text and the style report.

**Tool:** `mcp__mcp-graph__write_memory`

```
write_memory({
  type: "style-transfer",
  category: "nlp-style-transfer",
  content: "<transformed text + style report JSON>"
})
```

## Output Format

```json
{
  "transfer_id": "nlp-st-<timestamp>",
  "source": {
    "nodeId": "<source-node-id>",
    "style": "technical-dense",
    "readabilityGrade": 14.2,
    "wordCount": 850
  },
  "target": {
    "audience": "product-manager",
    "style": "formal-readable",
    "readabilityGrade": 10.1,
    "wordCount": 620
  },
  "transformedText": "...",
  "strategies": ["jargon-replacement", "sentence-splitting", "passive-to-active"],
  "semanticPreservation": {
    "entitiesPreserved": true,
    "requirementsPreserved": true,
    "factsAltered": false,
    "score": 0.97
  },
  "glossary": [
    { "technical": "FTS5", "plain": "full-text search engine built into SQLite" },
    { "technical": "RAG", "plain": "retrieval-augmented generation (finding relevant context before generating answers)" }
  ],
  "persisted": true
}
```

## Anti-Patterns

- Do NOT transform text without loading context via `rag_context` -- decontextualized simplification introduces errors
- Do NOT sacrifice accuracy for readability -- if a technical term has no safe simplification, keep it and add an inline definition
- Do NOT apply the same transformation to all text types -- style parameters must match the target audience
- Do NOT skip semantic preservation validation -- style transfer that alters meaning is worse than no transfer
- Do NOT remove code references when targeting developers -- they are high-value content for technical audiences
- Do NOT over-simplify for executives -- they need precision on metrics and decisions, just not implementation details
- Do NOT treat style transfer as a one-way operation -- always preserve the original text alongside the transformation
