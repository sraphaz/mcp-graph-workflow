---
name: graph-cv-screenshot-processor
description: Screenshot processing pipeline for crop, annotate, extract, and transform operations with graph-tracked provenance
triggers:
  - graph-cv-screenshot-processor
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-cv-screenshot-processor

Autonomous screenshot processing pipeline that handles cropping, annotation, region extraction, and transformation of captured screenshots. This skill maintains full provenance tracking — every processed screenshot is linked to its source, processing steps, and downstream consumers in the execution graph, ensuring reproducibility and auditability of visual documentation workflows.

## When to Use

- When raw screenshots need to be cropped to specific UI regions for documentation or bug reports
- When screenshots need annotations (arrows, highlights, callouts) to communicate issues or requirements
- When specific UI elements need to be extracted from full-page screenshots for component-level analysis
- When screenshots captured during validation need standardized formatting before inclusion in reports
- When the user says "crop screenshot", "annotate image", "extract region", or "process screenshot"
- After Playwright captures to post-process raw browser screenshots into usable documentation assets

## Mandatory Flow

```
receive_screenshot → classify_intent → apply_processing → validate_output → track_provenance → index_result → write_memory
```

## Workflow

### Step 1: Receive Screenshot and Classify Processing Intent

Determine what processing operations are needed based on the source and context.

```
Tool: mcp__mcp-graph__analyze
Params:
  mode: "progress"
```

| Source | Default Processing | Output Use |
|---|---|---|
| Playwright capture | Crop to viewport, remove browser chrome | Validation evidence |
| Bug report | Annotate problem area, add callout | Issue documentation |
| Design review | Side-by-side crop, overlay grid | Design comparison |
| Documentation | Crop to region, add border, standardize size | User guide assets |
| Regression test | Diff overlay, highlight changes | Test reporting |

Identify the screenshot source and any associated graph node:

```
Tool: mcp__mcp-graph__search
Params:
  query: "screenshot capture <source context>"
  scope: "nodes"
```

### Step 2: Define Processing Pipeline

Build the processing pipeline based on classified intent. Each operation is applied sequentially:

| Operation | Parameters | Description |
|---|---|---|
| **Crop** | x, y, width, height or CSS selector | Extract a rectangular region |
| **Resize** | target width/height, maintain aspect ratio | Scale to standard dimensions |
| **Annotate: Arrow** | start (x,y), end (x,y), color, weight | Draw directional arrow |
| **Annotate: Rectangle** | x, y, width, height, color, style | Highlight a region |
| **Annotate: Callout** | position, text, background color | Add text callout bubble |
| **Annotate: Blur** | region, intensity | Redact sensitive information |
| **Border** | width, color, radius | Add border frame |
| **Watermark** | text, position, opacity | Add processing metadata |
| **Format** | target format, quality | Convert PNG/JPG/WebP |
| **Composite** | images[], layout (side-by-side, grid, overlay) | Combine multiple screenshots |

### Step 3: Apply Processing Operations

Execute the defined pipeline on the input screenshot:

Create a processing task node for traceability:

```
Tool: mcp__mcp-graph__node
Params:
  action: "add"
  name: "SCREENSHOT-PROC: <operation> on <source>"
  type: "task"
  priority: "medium"
  description: "Processing pipeline for <source screenshot>. Operations: <list of operations>. Target use: <documentation/validation/report>."
  acceptanceCriteria: "1. All operations applied without quality loss\n2. Output dimensions match specification\n3. Annotations are readable and accurately positioned\n4. Sensitive areas properly redacted"
```

Processing guidelines:
1. **Non-destructive** — Always preserve the original screenshot; processing creates a new file
2. **Quality preservation** — Use lossless intermediate formats; apply lossy compression only on final output
3. **Coordinate accuracy** — All crop/annotation coordinates must be validated against image dimensions
4. **Consistent styling** — Use project-standard annotation colors and font sizes across all processed screenshots

### Step 4: Validate Processing Output

Verify that the processed screenshot meets quality standards:

| Check | Criteria | Action on Fail |
|---|---|---|
| Dimensions | Match target spec within 1px | Re-crop with adjusted coordinates |
| Readability | Annotations text >= 12px at target display size | Increase font size |
| Contrast | Annotation colors distinct from background | Auto-select contrasting color |
| Completeness | All specified operations applied | Re-run missing operations |
| File size | Within budget (documentation < 500KB, web < 200KB) | Adjust compression quality |
| Sensitive data | No PII or credentials visible in uncovered regions | Apply blur to detected sensitive areas |

```
Tool: mcp__mcp-graph__analyze
Params:
  mode: "done_integrity"
```

### Step 5: Track Provenance Chain

Record the full processing provenance for reproducibility:

| Field | Value |
|---|---|
| Source file | Original screenshot path and hash |
| Operations applied | Ordered list with parameters |
| Output file | Processed screenshot path and hash |
| Processing timestamp | ISO 8601 |
| Associated node | Graph node ID that triggered processing |
| Target consumer | Documentation page, report, or validation task |

Link the processed output back to the source node:

```
Tool: mcp__mcp-graph__node
Params:
  action: "update"
  nodeId: "<source-task-node-id>"
  metadata: "processedScreenshot: <output path>"
```

### Step 6: Index Processed Result

Add the processed screenshot to the knowledge store for future retrieval:

```
Tool: mcp__mcp-graph__analyze
Params:
  mode: "implement_done"
```

Index entry includes:
- Processed screenshot file path
- Description of what the screenshot shows (post-processing)
- All annotation text as searchable content
- Source-to-output relationship for provenance queries
- Tags based on content type and processing operations

### Step 7: Persist Processing Record to Memory

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Screenshot Processing — <source filename> — <date>"
  content: "<operations applied, source dimensions, output dimensions, file size reduction, annotations added, provenance chain, associated graph node>"
  tags: ["screenshot", "computer-vision", "image-processing", "annotation", "documentation"]
```

## Output Format

```
Phase: SCREENSHOT PROCESSING
Source: <filename> (<width>x<height>, <size>)

Pipeline Executed:
  1. <operation name> — <parameters> — <status>
  2. <operation name> — <parameters> — <status>
  ...

Output:
  File: <output path>
  Dimensions: <width>x<height>
  Format: <format>
  Size: <size> (X% of original)
  Quality: <quality score>

Annotations Applied:
  Arrows: N
  Rectangles: N
  Callouts: N
  Blur Regions: N

Provenance:
  Source Hash: <sha256>
  Output Hash: <sha256>
  Associated Node: <node-id>
  Target Use: <documentation/validation/report>

Validation:
  Dimensions Check: PASS/FAIL
  Readability Check: PASS/FAIL
  Contrast Check: PASS/FAIL
  Sensitive Data Check: PASS/FAIL

Saved to memory: "Screenshot Processing — <source> — <date>"
```

## Anti-Patterns

- Do NOT modify the original screenshot file — always create a processed copy to preserve the source for provenance
- Do NOT apply lossy compression in intermediate pipeline steps — quality degrades with each re-compression cycle
- Do NOT hardcode annotation coordinates without validating against image dimensions — off-by-one errors create misplaced annotations
- Do NOT skip the sensitive data check — screenshots often inadvertently capture credentials, API keys, or PII
- Do NOT process screenshots without linking to a graph node — untracked visual assets become orphaned documentation
- Do NOT use inconsistent annotation styles — standardize colors, fonts, and arrow styles across all processed screenshots for professional output
- Do NOT batch-process large screenshot sets without provenance tracking — individual traceability is lost and errors become undiagnosable
