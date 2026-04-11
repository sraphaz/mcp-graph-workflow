---
name: graph-cv-multi-modal-integrator
description: Text and image multimodal fusion for RAG knowledge synthesis, combining visual and textual signals into unified context for graph enrichment
triggers:
  - graph-cv-multi-modal-integrator
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-cv-multi-modal-integrator

Autonomous multimodal fusion engine that combines textual and visual information sources into unified knowledge representations for RAG retrieval and graph enrichment. This skill aligns text descriptions with image content, resolves contradictions between visual and textual signals, and produces synthesized knowledge entries that capture information neither modality alone provides — enabling richer context assembly and more accurate task planning.

## When to Use

- When a task has both textual requirements (PRD text) and visual references (mockups, diagrams) that need unified context
- When RAG queries return fragmented results because text and image knowledge are stored separately
- When design mockups need to be cross-referenced with their textual specifications for completeness verification
- When the knowledge store contains visual assets and text documents that reference the same concepts but are not linked
- When the user says "merge visual and text", "multimodal context", "fuse image and text", or "unified knowledge"
- During IMPLEMENT phase when task context needs both visual and textual understanding for accurate implementation

## Mandatory Flow

```
identify_multimodal_sources → extract_text_features → extract_visual_features → align_modalities → resolve_conflicts → synthesize_knowledge → index_unified_entries → enrich_graph_context → write_memory
```

## Workflow

### Step 1: Identify Multimodal Source Pairs

Discover text and image sources that reference the same concepts or features.

```
Tool: mcp__mcp-graph__rag_context
Params:
  query: "visual references mockup diagram screenshot"
  sources: ["knowledge", "memories"]
```

Pair discovery strategies:

| Strategy | Method | Example |
|---|---|---|
| Filename matching | Same base name, different extension | `login.md` + `login.png` |
| Reference linking | Text mentions image by name or figure number | "See Figure 3" + `figure-3.png` |
| Semantic similarity | Text and image describe the same concept | "User authentication flow" + auth-flowchart.png |
| Spatial co-location | Text and image in same document region | PRD section + embedded diagram |
| Graph node association | Same node references both text and image assets | Task with description + attached mockup |

```
Tool: mcp__mcp-graph__search
Params:
  query: "design mockup specification reference"
  scope: "nodes"
```

### Step 2: Extract Textual Features

Process the textual sources to extract structured semantic features:

| Feature Type | Extraction Method | Use |
|---|---|---|
| Key entities | Named entity recognition | Align with visual labels |
| Requirements | Pattern matching (shall, must, should) | Verify against visual spec |
| Descriptions | Summarization of relevant paragraphs | Compare with image captions |
| Technical terms | Domain-specific vocabulary extraction | Match with diagram labels |
| Relationships | Dependency and flow extraction from text | Compare with visual connectors |
| Quantities | Numeric values, dimensions, counts | Validate against visual measurements |

```
Tool: mcp__mcp-graph__rag_context
Params:
  query: "<feature/concept name> specification requirements"
  sources: ["knowledge"]
```

### Step 3: Extract Visual Features

Process the image sources to extract structured visual features:

| Feature Type | Extraction Method | Use |
|---|---|---|
| Labels and text | OCR extraction from image | Align with textual entities |
| Components | Object detection for UI elements | Map to textual requirements |
| Layout structure | Spatial relationship analysis | Compare with described flow |
| Color palette | Dominant color extraction | Verify brand compliance text |
| Connectors | Arrow and line detection in diagrams | Match with textual relationships |
| Annotations | Callout and note detection | Supplement textual descriptions |

```
Tool: mcp__mcp-graph__analyze
Params:
  mode: "implement_done"
```

### Step 4: Align Modalities via Cross-Modal Mapping

Build an alignment map between textual features and visual features:

| Alignment Type | Text Feature | Visual Feature | Confidence |
|---|---|---|---|
| Entity-Label | Named entity in text | OCR label in image | Exact or fuzzy string match |
| Requirement-Component | "Login button" requirement | Button detection in mockup | Semantic + spatial |
| Flow-Connector | "User submits form" | Arrow from form to server | Sequence matching |
| Description-Scene | "Dashboard with 3 charts" | 3 chart objects detected | Count + type matching |
| Specification-Measurement | "Width: 300px" | Bounding box width | Numeric comparison |

For each aligned pair, compute a confidence score based on string similarity, semantic similarity, and spatial consistency.

### Step 5: Resolve Cross-Modal Conflicts

Detect and resolve contradictions between textual and visual information:

```
Tool: mcp__mcp-graph__analyze
Params:
  mode: "done_integrity"
```

| Conflict Type | Example | Resolution Strategy |
|---|---|---|
| Missing in text | Image shows a component not mentioned in PRD | Flag as undocumented requirement |
| Missing in image | Text specifies a feature not visible in mockup | Flag as unimplemented in design |
| Count mismatch | Text says "5 items", image shows 4 | Flag for clarification, trust text as spec |
| Flow contradiction | Text describes A->B->C, diagram shows A->C->B | Flag for review, trust text as spec |
| Naming conflict | Text says "Submit", button label reads "Send" | Flag for consistency decision |
| Layout conflict | Text says "left sidebar", image shows right sidebar | Flag for review, create resolution node |

For each conflict, create a resolution entry:

```
Tool: mcp__mcp-graph__node
Params:
  action: "add"
  name: "MULTIMODAL-CONFLICT: <conflict summary>"
  type: "task"
  priority: "medium"
  description: "Cross-modal conflict detected between <text source> and <image source>. Text says: <text claim>. Image shows: <visual observation>. Recommended resolution: <strategy>."
  acceptanceCriteria: "1. Conflict reviewed by stakeholder\n2. Authoritative source determined\n3. Non-authoritative source updated to match"
```

### Step 6: Synthesize Unified Knowledge Entries

Merge aligned and resolved information into unified knowledge entries:

Each synthesized entry contains:
- **Unified description** — Combined text and visual description
- **Source attribution** — Which facts came from text vs image
- **Confidence scores** — Per-fact confidence based on cross-modal agreement
- **Visual reference** — Link to the source image and bounding box
- **Textual reference** — Link to the source document and section
- **Conflict status** — Resolved, pending, or none

```
Tool: mcp__mcp-graph__knowledge_stats
Params: {}
```

### Step 7: Index Unified Entries to Knowledge Store

Ingest synthesized knowledge entries for RAG retrieval:

```
Tool: mcp__mcp-graph__rag_context
Params:
  query: "unified multimodal knowledge <feature name>"
  sources: ["knowledge"]
```

Index entries with multimodal metadata:
- Modality tags (text-only, image-only, fused)
- Cross-modal confidence score
- Source pair identifiers for provenance
- Conflict resolution status
- Last-verified timestamp

### Step 8: Enrich Graph Node Context

Update relevant graph nodes with synthesized multimodal context:

```
Tool: mcp__mcp-graph__analyze
Params:
  mode: "validate_ready"
```

For each node that references the synthesized features, append the unified context so that `context` tool calls return richer, cross-modal information.

### Step 9: Persist Fusion Results to Memory

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Multimodal Fusion — <feature/scope> — <date>"
  content: "<source pairs processed, alignments found, conflicts detected, resolutions applied, unified entries created, graph nodes enriched, knowledge stats>"
  tags: ["multimodal", "computer-vision", "rag", "knowledge-synthesis", "text-image-fusion"]
```

## Output Format

```
Phase: MULTIMODAL FUSION
Sources: N text + M images = K pairs

Alignment Results:
  Entity-Label Matches: N (avg confidence: X%)
  Requirement-Component Matches: N
  Flow-Connector Matches: N
  Description-Scene Matches: N
  Unmatched Text Features: N
  Unmatched Visual Features: N

Conflict Detection:
  Total Conflicts: N
  Missing in Text: N
  Missing in Image: N
  Count Mismatches: N
  Flow Contradictions: N
  Naming Conflicts: N
  Layout Conflicts: N

Resolution Status:
  Auto-Resolved: N
  Pending Review: N
  Conflict Nodes Created: N

Synthesis Results:
  Unified Entries Created: N
  Text-Only Entries: N
  Image-Only Entries: N
  Fused Entries: N

Knowledge Store:
  New Entries Indexed: N
  Existing Entries Updated: N
  Graph Nodes Enriched: N

Saved to memory: "Multimodal Fusion — <scope> — <date>"
```

## Anti-Patterns

- Do NOT treat text and images as independent knowledge sources — the whole point of multimodal fusion is that combined understanding exceeds individual modalities
- Do NOT auto-resolve conflicts without logging — every conflict resolution must be traceable for later audit
- Do NOT assume text is always authoritative over images — design mockups may represent the latest stakeholder intent while text is outdated
- Do NOT skip the alignment step and directly concatenate text and image descriptions — unaligned fusion produces incoherent knowledge entries
- Do NOT index duplicate entries from separate modalities when a fused entry exists — duplicates confuse RAG retrieval with redundant results
- Do NOT perform fusion on unrelated text-image pairs — misaligned fusion introduces hallucinated cross-references that poison the knowledge store
- Do NOT ignore low-confidence alignments entirely — they should be flagged for human review rather than silently discarded
