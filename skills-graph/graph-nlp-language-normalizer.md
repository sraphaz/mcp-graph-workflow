---
name: graph-nlp-language-normalizer
description: Text cleanup, term standardization, and normalization across graph content for consistent vocabulary and improved searchability
triggers:
  - graph-nlp-language-normalizer
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-nlp-language-normalizer

Performs text cleanup, term standardization, and linguistic normalization across all graph content. Enforces consistent vocabulary, corrects spelling and formatting inconsistencies, standardizes naming conventions, and builds a project glossary. Improves searchability, reduces ambiguity, and ensures that the same concept is always referred to with the same term throughout the graph.

## When to Use

- When the graph contains inconsistent terminology (e.g., "SQLite store" vs "sqlite-store" vs "the database")
- When search results are poor because the same concept uses different terms across nodes
- When onboarding new contributors who need a standardized glossary of project terms
- When preparing for a graph audit and need to clean up text quality across all nodes
- When merging content from multiple PRDs or authors with different writing styles
- When the knowledge store has duplicate entries caused by terminology inconsistency

## Mandatory Flow

```
search → rag_context → [normalization pipeline] → analyze → write_memory
```

## Workflow

### Step 1: Corpus Collection

Gather all text content from the graph for normalization analysis.

**Tool:** `mcp__mcp-graph__search`

```
search({ query: "*", limit: 200 })
```

Collect node names, descriptions, acceptance criteria, and knowledge entry content.

### Step 2: Load Knowledge Context

Retrieve existing knowledge entries to understand established terminology.

**Tool:** `mcp__mcp-graph__rag_context`

```
rag_context({ query: "project terminology conventions glossary", includeKnowledge: true })
```

Existing knowledge entries may already contain term definitions that should be used as normalization targets.

### Step 3: Term Inventory

Build a comprehensive inventory of all terms used across the graph:

- Extract all unique terms and multi-word phrases
- Compute term frequency across all documents
- Identify term variants (different spellings, casing, abbreviations of the same concept)
- Group variants into equivalence classes

**Variant Detection Strategies:**
- **Case variants**: "SqliteStore" vs "sqliteStore" vs "sqlite_store" vs "SQLITE_STORE"
- **Spelling variants**: "colour" vs "color", "initialise" vs "initialize"
- **Abbreviation variants**: "PRD" vs "Product Requirements Document", "DB" vs "database"
- **Synonym variants**: "store" vs "database" vs "persistence layer" vs "data layer"
- **Hyphenation variants**: "knowledge-store" vs "knowledge store" vs "knowledgeStore"

### Step 4: Canonical Form Selection

For each equivalence class, select a canonical form:

**Selection Criteria:**
- **Project convention**: prefer the form used in `CLAUDE.md`, schema definitions, or type names
- **Code alignment**: prefer the form that matches the actual code identifier (kebab-case for files, PascalCase for types, camelCase for functions)
- **Frequency**: prefer the most commonly used form in existing content
- **Clarity**: prefer the most unambiguous and self-explanatory form
- **Consistency**: prefer forms that follow a consistent pattern across the project

**Standard Conventions (from project rules):**
- File references: kebab-case (`sqlite-store.ts`)
- Type references: PascalCase (`SqliteStore`)
- Function references: camelCase (`findNextTask`)
- Module references: kebab-case directory name (`core/store/`)

### Step 5: Text Cleanup

Apply cleanup transformations to all graph content:

**Formatting Normalization:**
- Standardize whitespace (collapse multiple spaces, normalize line endings)
- Fix inconsistent punctuation (trailing periods, comma usage, semicolons)
- Normalize quotes (smart quotes to straight quotes)
- Standardize list formatting (consistent bullet style, indentation)

**Spelling and Grammar:**
- Correct obvious typos without altering technical terms
- Fix subject-verb agreement errors
- Standardize tense usage (prefer present tense for descriptions, past tense for completed work)

**Technical Term Formatting:**
- Apply backtick formatting to code references in descriptions
- Standardize file path formatting (forward slashes, no trailing slash)
- Normalize version numbers and date formats

### Step 6: Glossary Generation

Produce a project glossary from the normalization analysis:

- **Term**: canonical form
- **Aliases**: all known variants and abbreviations
- **Definition**: concise definition derived from context
- **Category**: technical, domain, process, or tool
- **Usage example**: example sentence from the graph
- **Related terms**: semantically related terms in the glossary

### Step 7: Validate Normalization

Verify that normalization does not alter semantic content.

**Tool:** `mcp__mcp-graph__analyze`

```
analyze({ mode: "progress" })
```

Checks:
- No node names were changed in a way that breaks edge references
- No acceptance criteria were altered in meaning
- No technical terms were incorrectly "corrected" to non-technical equivalents
- All code references still match actual file/symbol names

### Step 8: Persist Normalization Results

Store the glossary, normalization rules, and cleanup report.

**Tool:** `mcp__mcp-graph__write_memory`

```
write_memory({
  type: "normalization-report",
  category: "nlp-language-normalizer",
  content: "<glossary + normalization rules + cleanup report JSON>"
})
```

## Output Format

```json
{
  "normalization_id": "nlp-ln-<timestamp>",
  "corpus": {
    "documentCount": 156,
    "totalTerms": 4820,
    "uniqueTerms": 1340,
    "variantGroups": 89
  },
  "glossary": [
    {
      "canonical": "SqliteStore",
      "aliases": ["sqlite store", "the database", "sqlite-store", "db store"],
      "definition": "Primary persistence layer implementing graph storage in SQLite",
      "category": "technical",
      "frequency": 47
    }
  ],
  "cleanupActions": [
    {
      "type": "term_standardization",
      "before": "sqlite store",
      "after": "SqliteStore",
      "occurrences": 12,
      "nodes": ["node-01", "node-05", "node-12"]
    },
    {
      "type": "formatting",
      "description": "Applied backtick formatting to code references",
      "occurrences": 34
    }
  ],
  "statistics": {
    "termsNormalized": 156,
    "typosFixed": 8,
    "formattingFixes": 34,
    "glossaryEntries": 89,
    "semanticPreservation": 1.0
  },
  "persisted": true
}
```

## Anti-Patterns

- Do NOT normalize technical terms to non-technical equivalents -- "SqliteStore" must not become "database thing"
- Do NOT change node names without verifying that all edges and references still resolve
- Do NOT autocorrect domain-specific terms that look like typos but are intentional (e.g., "kebab-case", "camelCase")
- Do NOT apply normalization without a baseline search test -- verify that search quality improves after normalization
- Do NOT discard variant information -- the aliases list is essential for search expansion and backward compatibility
- Do NOT normalize in bulk without human review on the first batch -- validate the rules before applying broadly
- Do NOT skip the semantic preservation check -- normalization that alters meaning is a regression, not an improvement
