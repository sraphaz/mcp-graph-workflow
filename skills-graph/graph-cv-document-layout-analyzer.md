---
name: graph-cv-document-layout-analyzer
description: Analyze document and PRD layout structure including sections, tables, figures, and headings to enrich the execution graph with structured content
triggers:
  - graph-cv-document-layout-analyzer
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-cv-document-layout-analyzer

Autonomous document layout analyzer that examines the visual structure of PRDs, specifications, and technical documents — detecting sections, tables, figures, headers, lists, and page layouts. The skill maps document structure to graph nodes, enabling precise section-level references in task descriptions and acceptance criteria, and enriches the RAG knowledge store with layout-aware content chunks.

## When to Use

- When importing a PRD or specification document that has complex layout (multi-column, tables, figures)
- When standard text parsing misses structural information like table relationships or figure references
- When document sections need to be mapped 1:1 to epic or task nodes in the execution graph
- When the knowledge store needs layout-aware chunking for better RAG retrieval precision
- When the user says "analyze document layout", "parse PRD structure", "extract tables", or "map document sections"
- Before `import_prd` when the PRD contains visual elements that text-only parsing would miss

## Mandatory Flow

```
receive_document → detect_page_layout → extract_sections → extract_tables → extract_figures → build_hierarchy → map_to_graph → index_to_knowledge → write_memory
```

## Workflow

### Step 1: Receive Document and Determine Format

Identify the document format and select the appropriate layout analysis strategy.

```
Tool: mcp__mcp-graph__analyze
Params:
  mode: "progress"
```

| Document Format | Strategy | Notes |
|---|---|---|
| PDF (text-based) | Text extraction + visual layout analysis | Combine text layer with visual positioning |
| PDF (scanned) | Full CV layout detection + OCR | No text layer, purely visual |
| Image (PNG/JPG) | Visual layout detection + OCR | Single page, no metadata |
| HTML (rendered) | DOM structure + visual rendering | Rich structural information available |
| Markdown | Parse headings + render for visual analysis | Heading hierarchy is explicit |
| DOCX | XML structure + rendered layout | Paragraph styles encode structure |

Search for previous analyses of this document:

```
Tool: mcp__mcp-graph__search
Params:
  query: "document layout analysis <document name>"
  scope: "knowledge"
```

### Step 2: Detect Page-Level Layout Regions

Segment each page into semantic regions using visual layout analysis:

| Region Type | Detection Method | Visual Cues |
|---|---|---|
| Header | Top-of-page text, larger font, bold | Position, font size, weight |
| Footer | Bottom-of-page text, page numbers | Position, repeated pattern |
| Body text | Main content area, standard font | Column detection, line spacing |
| Sidebar | Narrow column, distinct background | Width ratio, color difference |
| Figure | Image region with caption | Aspect ratio, surrounded whitespace |
| Table | Grid lines, aligned columns | Horizontal/vertical line detection |
| List | Indented items with bullets/numbers | Left margin offset, bullet detection |
| Code block | Monospace font, colored background | Font family, background color |
| Callout/Note | Bordered box, icon, different background | Border detection, icon presence |

For multi-page documents, track region continuity across page breaks (tables that span pages, sections that continue).

### Step 3: Extract Section Hierarchy

Build a hierarchical outline of the document from detected headings:

```
Tool: mcp__mcp-graph__rag_context
Params:
  query: "document section hierarchy structure"
  sources: ["knowledge"]
```

Heading detection rules:
1. **Font size** — Larger font relative to body text indicates heading level
2. **Font weight** — Bold text at beginning of content block
3. **Numbering** — "1.", "1.1", "1.1.1" patterns indicate hierarchical levels
4. **Vertical spacing** — More whitespace above than below indicates section start
5. **Case** — ALL CAPS or Title Case in isolation suggests heading

Build the hierarchy tree:
```
Document
  1. Section (H1) — "Introduction"
    1.1 Subsection (H2) — "Background"
    1.2 Subsection (H2) — "Objectives"
  2. Section (H1) — "Requirements"
    2.1 Subsection (H2) — "Functional Requirements"
      2.1.1 Sub-subsection (H3) — "User Authentication"
```

### Step 4: Extract and Reconstruct Tables

Detect tables and reconstruct their structure into machine-readable format:

| Detection Phase | Method | Output |
|---|---|---|
| Table detection | Grid line analysis, column alignment | Bounding box of table region |
| Row detection | Horizontal dividers, row spacing | List of row bounding boxes |
| Column detection | Vertical dividers, column alignment | List of column boundaries |
| Cell extraction | Row x column intersection | Cell bounding boxes |
| Header detection | First row styling (bold, background) | Boolean per column |
| Content extraction | OCR per cell | Text content per cell |
| Span detection | Merged cells (wider/taller than grid) | Colspan/rowspan values |

```
Tool: mcp__mcp-graph__analyze
Params:
  mode: "implement_done"
```

### Step 5: Extract Figures and Visual Elements

Detect figures, diagrams, charts, and other visual elements:

For each figure, extract:
- Bounding box coordinates within the page
- Caption text (typically below or above the figure)
- Figure number/label if present
- Referenced section (where the figure is discussed)
- Content classification (chart, diagram, screenshot, illustration, photo)

Link figures to their referencing sections for cross-reference integrity.

### Step 6: Build Document Structure Model

Assemble all extracted elements into a unified document structure model:

```
Tool: mcp__mcp-graph__analyze
Params:
  mode: "validate_ready"
```

The model captures:
- **Hierarchy** — Section nesting and ordering
- **Content types** — Text, table, figure, list, code per section
- **Cross-references** — Figure references from text, table references, section links
- **Page mapping** — Which pages contain which sections
- **Reading order** — Logical flow including multi-column layout resolution
- **Metadata** — Document title, author, date, version if present

### Step 7: Map Document Structure to Graph Nodes

Create graph nodes that mirror the document structure:

```
Tool: mcp__mcp-graph__node
Params:
  action: "add"
  name: "DOC-SECTION: <section title>"
  type: "task"
  priority: "medium"
  description: "Document section from <document name>, page <N>. Content: <summary>. Contains: <N paragraphs, M tables, K figures>. Children sections: <list>."
  acceptanceCriteria: "Derived from section content and requirements expressed within."
```

For table-derived requirements, create nodes with structured acceptance criteria extracted from table rows.

### Step 8: Index Layout-Aware Content to Knowledge Store

Chunk the document content with layout awareness for optimal RAG retrieval:

```
Tool: mcp__mcp-graph__rag_context
Params:
  query: "document layout indexed content <document name>"
  sources: ["knowledge"]
```

Layout-aware chunking rules:
- Each section becomes a separate chunk (preserving hierarchy context in metadata)
- Tables are chunked as complete units (never split mid-table)
- Figures are chunked with their captions and referencing paragraphs
- Lists are kept intact within their parent section chunk
- Code blocks are preserved as single chunks with language metadata

### Step 9: Persist Analysis Results to Memory

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Document Layout Analysis — <document name> — <date>"
  content: "<pages analyzed, sections detected, tables extracted, figures found, hierarchy depth, graph nodes created, knowledge chunks indexed>"
  tags: ["document-layout", "computer-vision", "prd-analysis", "knowledge-store", "rag"]
```

## Output Format

```
Phase: DOCUMENT LAYOUT ANALYSIS
Document: <filename> (<format>, <pages>)

Page Layout:
  Pages Analyzed: N
  Multi-Column Pages: N
  Header/Footer Detected: Yes/No

Section Hierarchy:
  Total Sections: N
  Max Depth: N levels
  H1 Sections: N
  H2 Sections: N
  H3+ Sections: N

Tables Extracted:
  Total Tables: N
  Total Rows: N
  Total Cells: N
  Spanning Cells: N

Figures Detected:
  Total Figures: N
  With Captions: N
  Cross-Referenced: N

Content Types:
  Text Blocks: N
  Lists: N
  Code Blocks: N
  Callouts/Notes: N

Graph Nodes Created: N
  Section Nodes: N
  Requirement Nodes (from tables): N

Knowledge Store:
  Chunks Indexed: N
  Average Chunk Size: N tokens

Saved to memory: "Document Layout Analysis — <document> — <date>"
```

## Anti-Patterns

- Do NOT split tables across chunks — tables are atomic semantic units and partial tables produce nonsensical RAG results
- Do NOT ignore figure captions — captions carry critical context that makes figures searchable and referenceable
- Do NOT flatten the section hierarchy — losing nesting information destroys the relationship between requirements and their parent features
- Do NOT rely solely on text extraction for PDFs with complex layouts — visual layout analysis catches multi-column, sidebar, and callout structures that text-only parsing merges incorrectly
- Do NOT create graph nodes for every paragraph — only section-level and requirement-level granularity is appropriate for the execution graph
- Do NOT skip cross-reference detection — "see Table 3" and "as shown in Figure 2" links are critical for maintaining document coherence in chunked knowledge
- Do NOT process scanned documents without OCR preprocessing — layout detection on scanned images without binarization and deskew produces garbage results
