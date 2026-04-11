---
name: graph-cv-ocr-engine
description: OCR extraction from images, screenshots, PDFs, and diagrams with automatic knowledge store ingestion and structured text indexing
triggers:
  - graph-cv-ocr-engine
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-cv-ocr-engine

Autonomous OCR engine that extracts text from images, screenshots, PDFs, and diagrams, then feeds the extracted content into the knowledge store for RAG retrieval. This skill handles preprocessing (deskew, contrast enhancement, noise reduction), multi-language text recognition, layout-aware extraction, and structured output mapping to graph nodes.

## When to Use

- When a PRD or specification is provided as a scanned image or screenshot rather than raw text
- When diagram screenshots contain embedded text labels that need to be extracted and indexed
- When PDF documents with mixed text/image content need full-text extraction beyond standard PDF parsing
- When UI screenshots contain text that must be validated against expected copy or translations
- When whiteboard photos or handwritten notes need to be digitized into actionable graph tasks
- After any image asset is added to the project that may contain extractable textual information

## Mandatory Flow

```
detect_image_input → preprocess_image → run_ocr_extraction → structure_text_output → validate_extraction_quality → index_to_knowledge_store → create_graph_nodes → write_memory
```

## Workflow

### Step 1: Detect Image Input and Classify Source Type

Identify the input type and determine the optimal OCR strategy for the content.

```
Tool: mcp__mcp-graph__analyze
Params:
  mode: "progress"
```

| Source Type | Strategy | Preprocessing |
|---|---|---|
| Screenshot (PNG/JPG) | Direct OCR with layout detection | Contrast normalization, DPI upscale |
| Scanned PDF | Page-by-page extraction with zone detection | Deskew, binarization, noise removal |
| Diagram/Flowchart | Label-aware OCR with bounding box grouping | Edge detection, text region isolation |
| Whiteboard photo | Adaptive threshold with handwriting model | Perspective correction, color inversion |
| Mobile capture | Auto-rotate with EXIF correction | Sharpening, barrel distortion fix |

Search for existing OCR results to avoid duplicate processing:

```
Tool: mcp__mcp-graph__search
Params:
  query: "ocr extraction <filename>"
  scope: "knowledge"
```

### Step 2: Preprocess Image for Optimal Extraction

Apply preprocessing transformations based on the classified source type:

1. **Resolution normalization** — Upscale images below 300 DPI to improve character recognition accuracy
2. **Deskew correction** — Detect rotation angle via Hough transform and auto-correct alignment
3. **Binarization** — Apply Otsu or Sauvola thresholding to separate text from background
4. **Noise reduction** — Median filter for salt-and-pepper noise, Gaussian for scanner artifacts
5. **Zone detection** — Identify text regions, table regions, and image regions separately

Log preprocessing decisions for traceability:

```
Tool: mcp__mcp-graph__analyze
Params:
  mode: "implement_done"
  nodeId: "<preprocessing-node-id>"
```

### Step 3: Run OCR Extraction Engine

Execute text recognition with confidence scoring per character, word, and line:

```
Tool: mcp__mcp-graph__rag_context
Params:
  query: "ocr extraction text recognition patterns"
  sources: ["knowledge", "memories"]
```

For each detected text region, extract:

| Field | Description | Confidence Threshold |
|---|---|---|
| Text content | Raw extracted string | >= 85% character confidence |
| Bounding box | x, y, width, height coordinates | N/A |
| Language | Detected language code | >= 90% |
| Font attributes | Size, weight, style (if detectable) | Best effort |
| Reading order | Logical sequence for multi-column layouts | Layout-model dependent |
| Line grouping | Paragraph and section boundaries | Spacing heuristics |

### Step 4: Structure Extracted Text into Semantic Blocks

Group raw OCR output into semantic units suitable for knowledge store ingestion:

- **Headers** — Large font, bold, or underlined text identified as section titles
- **Body text** — Continuous paragraphs grouped by proximity and alignment
- **Table data** — Grid-aligned text structured into rows and columns
- **Labels** — Short text segments associated with diagram elements
- **Code blocks** — Monospace text regions preserved with formatting

Create a structured representation:

```
Tool: mcp__mcp-graph__node
Params:
  action: "add"
  name: "OCR-EXTRACT: <source filename>"
  type: "task"
  priority: "medium"
  description: "Extracted text from <source>. Regions: N headers, M paragraphs, K tables, L labels. Average confidence: X%."
  acceptanceCriteria: "1. All text regions extracted with >= 85% confidence\n2. Structured output indexed in knowledge store\n3. No duplicate entries for same source"
```

### Step 5: Validate Extraction Quality

Perform quality checks on the extracted content:

1. **Confidence audit** — Flag any word below 70% confidence for manual review
2. **Dictionary check** — Verify extracted words against language dictionary to catch garbled text
3. **Layout consistency** — Ensure reading order makes semantic sense
4. **Completeness check** — Compare extracted text volume against expected content density
5. **Duplicate detection** — Check if this content was already extracted from another source

```
Tool: mcp__mcp-graph__analyze
Params:
  mode: "done_integrity"
```

### Step 6: Index Extracted Content to Knowledge Store

Ingest validated text into the knowledge store for RAG retrieval:

```
Tool: mcp__mcp-graph__rag_context
Params:
  query: "index extracted ocr content <source>"
  sources: ["knowledge"]
```

Each semantic block becomes a knowledge entry with:
- Source file reference and page/region coordinates
- Extraction confidence score as metadata
- Semantic type tag (header, body, table, label, code)
- Timestamp of extraction for staleness tracking

### Step 7: Create Graph Nodes for Actionable Items

If the extracted text contains actionable items (requirements, tasks, decisions), create corresponding graph nodes:

```
Tool: mcp__mcp-graph__node
Params:
  action: "add"
  name: "FROM-OCR: <actionable item title>"
  type: "task"
  description: "Extracted from <source> via OCR. Original text: <quoted excerpt>. Confidence: X%."
```

### Step 8: Persist Extraction Results to Memory

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "OCR Extraction — <source filename> — <date>"
  content: "<total regions extracted, confidence stats, knowledge entries created, graph nodes generated, language detected, processing time>"
  tags: ["ocr", "computer-vision", "text-extraction", "knowledge-store"]
```

## Output Format

```
Phase: OCR EXTRACTION
Source: <filename> (<source type>)
Resolution: <width>x<height> @ <DPI> DPI

Preprocessing Applied:
  Deskew: <angle corrected>
  Binarization: <method>
  Noise Reduction: <filter applied>

Extraction Results:
  Text Regions: N
  Headers: N
  Paragraphs: N
  Tables: N
  Labels: N
  Code Blocks: N

Quality Metrics:
  Average Confidence: X.X%
  Words Below 70%: N (flagged for review)
  Dictionary Match Rate: X.X%

Knowledge Store:
  Entries Created: N
  Entries Updated: N
  Duplicates Skipped: N

Graph Nodes Created: N
  Actionable Items: N

Saved to memory: "OCR Extraction — <source> — <date>"
```

## Anti-Patterns

- Do NOT skip preprocessing — raw images without deskew and binarization produce significantly lower accuracy
- Do NOT index low-confidence text without flagging it — garbage OCR output pollutes the knowledge store and degrades RAG quality
- Do NOT ignore layout structure — treating a multi-column document as single-column scrambles reading order
- Do NOT extract from thumbnails or low-resolution previews — always use the highest available resolution source
- Do NOT create graph nodes for every extracted line — only actionable items warrant node creation
- Do NOT re-extract from the same source without checking for existing results — duplicate knowledge entries waste storage and confuse retrieval
- Do NOT assume English — always detect language before applying dictionary validation
