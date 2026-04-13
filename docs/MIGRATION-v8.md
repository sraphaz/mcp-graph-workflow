# Migration Guide: v7.x to v8.0

## Breaking Changes

v8.0 consolidates 21 individual tools into 5 unified action-based tools. The old tool names are **removed**. Use the unified tools with `action` parameters instead.

## Tool Migration Table

### Context Tools (3 -> 1)

| Old Tool | New Tool | Action |
|----------|----------|--------|
| `rag_context` | `context` | `action: "rag"` |
| `context_compress` | `context` | `action: "compress"` |
| *(context was kept)* | `context` | `action: "compact"` (default) |

Additional action: `action: "batch_compress"` — new in v8.0.

### Knowledge Tools (5 -> 1)

| Old Tool | New Tool | Action |
|----------|----------|--------|
| `knowledge_stats` | `knowledge` | `action: "stats"` |
| `export_knowledge` | `knowledge` | `action: "export"` |
| `knowledge_feedback` | `knowledge` | `action: "feedback"` |
| `knowledge_prune` | `knowledge` | `action: "prune"` |
| `reindex_knowledge` | `knowledge` | `action: "reindex"` |

### DaVinci Tools (3 -> 1)

| Old Tool | New Tool | Action |
|----------|----------|--------|
| `davinci_analyze` | `davinci` | `action: "analyze"` |
| `davinci_build` | `davinci` | `action: "build"` |
| `davinci_convert` | `davinci` | `action: "convert"` |

### Siebel Tools (8 -> 1)

| Old Tool | New Tool | Action |
|----------|----------|--------|
| `siebel_analyze` | `siebel` | `action: "analyze"` |
| `siebel_composer` | `siebel` | `action: "compose"` |
| `siebel_env` | `siebel` | `action: "env"` |
| `siebel_generate_sif` | `siebel` | `action: "generate"` |
| `siebel_import_docs` | `siebel` | `action: "import_docs"` |
| `siebel_import_sif` | `siebel` | `action: "import_sif"` |
| `siebel_search` | `siebel` | `action: "search"` |
| `siebel_validate` | `siebel` | `action: "validate"` |

### Translation Tools (3 -> 1)

| Old Tool | New Tool | Action |
|----------|----------|--------|
| `translate_code` | `translate` | `action: "convert"` |
| `analyze_translation` | `translate` | `action: "analyze"` |
| `translation_jobs` | `translate` | `action: "jobs"` |

## New Tools in v8.0

6 new tools for the **Spec-Driven Development Platform**:

| Tool | Purpose |
|------|---------|
| `constitution` | Project governing principles with RAG indexing |
| `plugin` | Dynamic extension system with 8 hook points |
| `preset` | Workflow customization (4 built-in: default, strict-tdd, agile-light, enterprise) |
| `spec` | Structured spec templates per lifecycle phase |
| `spec_sync` | Living specs with versioning and bidirectional graph sync |
| `agent_format` | Multi-agent instruction generator (markdown, TOML, skill.md, JSON) |

## Behavioral Changes

- **Auto-promote epics** — when all children of an epic are `done`, the epic is automatically promoted to `done` (up to 10 levels of nesting)
- **Cascade status propagation** — marking a task as `done` auto-marks its `acceptance_criteria` and `subtask` children as `done`
- **NLP engine quality** — unified tokenizer with built-in Porter/RSLP stemming (EN/PT), Levenshtein fuzzy search fallback, batch recency score lookups
- **GraphRAG community summaries** — community detection table with FTS5 for knowledge consolidation

## Database Migrations

v8.0 includes the following automatic migrations:

| Migration | What it does |
|-----------|-------------|
| v31 | Adds `community_summaries` table for GraphRAG |
| v32 | Adds `plugins` table for the plugin system |
| v34 | Adds `spec_documents`, `spec_versions`, `node_links` tables for living specs |

**No manual action required.** Migrations run automatically on first start. Existing data is preserved.

## No Action Required For

- **Existing graph data** — fully backward compatible
- **Pipeline tools** — `start_task` and `finish_task` work unchanged
- **Analyze modes** — all 48 modes work unchanged
- **Dashboard** — auto-updated with new tabs
- **Skills** — all 155 skills work unchanged
