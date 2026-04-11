---
name: graph-cv-image-analyzer
description: General image classification, description, and metadata extraction for project assets with automatic knowledge store indexing
triggers:
  - graph-cv-image-analyzer
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-cv-image-analyzer

Autonomous image analysis engine that classifies, describes, and extracts metadata from project image assets — including logos, icons, product screenshots, marketing materials, and design mockups. The skill generates structured descriptions, detects content categories, and indexes all findings into the knowledge store for RAG-powered retrieval and cross-referencing with graph tasks.

## When to Use

- When new image assets are added to the project and need cataloging and classification
- When design mockups or wireframes need to be analyzed for feature extraction and task mapping
- When product screenshots need structured descriptions for documentation or accessibility
- When the knowledge store needs visual asset metadata for comprehensive RAG context
- When the user says "analyze image", "describe screenshot", "classify asset", or "catalog images"
- During REVIEW phase to verify that implemented UI matches design mockup assets

## Mandatory Flow

```
detect_image_assets → extract_metadata → classify_content → generate_descriptions → detect_features → index_to_knowledge → link_to_graph_nodes → write_memory
```

## Workflow

### Step 1: Detect Image Assets and Inventory

Scan the project for image assets that need analysis, filtering by modification date to process only new or changed files.

```
Tool: mcp__mcp-graph__analyze
Params:
  mode: "progress"
```

Supported image formats:

| Format | Use Case | Priority |
|---|---|---|
| PNG | Screenshots, diagrams, UI exports | High |
| JPG/JPEG | Photos, marketing materials | High |
| SVG | Icons, logos, vector graphics | Medium |
| WebP | Optimized web assets | Medium |
| GIF | Animated demos, interactions | Low |
| ICO | Favicons, app icons | Low |

Search for previously analyzed assets to avoid reprocessing:

```
Tool: mcp__mcp-graph__search
Params:
  query: "image analysis asset catalog"
  scope: "knowledge"
```

### Step 2: Extract Technical Metadata

For each image asset, extract comprehensive technical metadata:

| Metadata Field | Description | Source |
|---|---|---|
| Dimensions | Width x height in pixels | Image header |
| Color space | sRGB, Adobe RGB, P3 | ICC profile |
| Bit depth | 8-bit, 16-bit, 24-bit | Image header |
| File size | Bytes / human-readable | File system |
| DPI | Dots per inch (print resolution) | EXIF data |
| Transparency | Alpha channel present | Image format |
| Animation | Frame count, duration | GIF/APNG metadata |
| EXIF data | Camera, GPS, date, software | Embedded metadata |
| Compression | Lossless/lossy, quality estimate | Format analysis |

### Step 3: Classify Content Category

Apply multi-label classification to categorize each image:

```
Tool: mcp__mcp-graph__analyze
Params:
  mode: "implement_done"
```

| Category | Detection Criteria | Confidence Threshold |
|---|---|---|
| UI Screenshot | Window chrome, UI widgets, text fields | >= 80% |
| Design Mockup | Artboard markers, grid overlays, annotations | >= 75% |
| Diagram/Chart | Shapes, connectors, axes, legends | >= 80% |
| Icon/Logo | Small dimensions, simple shapes, transparency | >= 85% |
| Photo | Natural scene, camera EXIF, noise patterns | >= 80% |
| Marketing | Brand colors, typography, call-to-action | >= 70% |
| Code Screenshot | Syntax highlighting, monospace font, line numbers | >= 85% |
| Wireframe | Low fidelity, gray boxes, placeholder text | >= 75% |

### Step 4: Generate Structured Descriptions

Produce human-readable and machine-parseable descriptions for each asset:

```
Tool: mcp__mcp-graph__rag_context
Params:
  query: "image asset description template"
  sources: ["knowledge", "memories"]
```

Each description includes:
1. **Summary** — One sentence describing what the image shows
2. **Visible elements** — List of identifiable objects, components, or UI elements
3. **Text content** — Any readable text detected within the image
4. **Color palette** — Dominant colors extracted (hex values)
5. **Composition** — Layout structure (grid, centered, asymmetric, etc.)
6. **Context** — How this image relates to the project based on filename, directory, and content

### Step 5: Detect Features and Actionable Elements

Identify specific features within images that map to project requirements:

- **UI components** — Buttons, forms, navigation, cards, modals detected in screenshots
- **Brand elements** — Logo usage, color compliance, typography consistency
- **Data visualizations** — Chart types, axis labels, data ranges in dashboard screenshots
- **Error states** — Error messages, empty states, loading indicators
- **Accessibility issues** — Low contrast text, missing labels (estimated from visual inspection)

```
Tool: mcp__mcp-graph__search
Params:
  query: "feature requirement <detected element>"
  scope: "nodes"
```

### Step 6: Index to Knowledge Store

Ingest all analysis results into the knowledge store:

```
Tool: mcp__mcp-graph__rag_context
Params:
  query: "image asset metadata index"
  sources: ["knowledge"]
```

Each entry includes:
- File path and filename as the primary key
- All technical metadata as structured fields
- Content classification labels with confidence scores
- Generated description as searchable text
- Detected features as tagged entities
- Relationships to other assets (same page, same component, same style)

### Step 7: Link to Graph Nodes

Associate analyzed images with relevant graph nodes:

```
Tool: mcp__mcp-graph__search
Params:
  query: "<image content keywords>"
  scope: "nodes"
```

For each match, annotate the graph node with the asset reference so that task context includes visual references.

### Step 8: Persist Analysis Results to Memory

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Image Analysis Catalog — <date>"
  content: "<total assets analyzed, categories breakdown, new entries indexed, linked to N graph nodes, color palettes detected, accessibility issues found>"
  tags: ["image-analysis", "computer-vision", "asset-catalog", "knowledge-store"]
```

## Output Format

```
Phase: IMAGE ANALYSIS
Assets Scanned: N
Assets Analyzed: N (N new, N updated, N skipped)

Classification Distribution:
  UI Screenshots: N
  Design Mockups: N
  Diagrams/Charts: N
  Icons/Logos: N
  Photos: N
  Marketing: N
  Code Screenshots: N
  Wireframes: N

Technical Summary:
  Total Size: X.X MB
  Average Resolution: WxH
  Formats: PNG (N), JPG (N), SVG (N), Other (N)
  With Transparency: N

Features Detected:
  UI Components: N unique types
  Brand Elements: N
  Data Visualizations: N
  Error States: N
  Accessibility Issues: N

Knowledge Store:
  Entries Created: N
  Entries Updated: N
  Graph Nodes Linked: N

Saved to memory: "Image Analysis Catalog — <date>"
```

## Anti-Patterns

- Do NOT analyze every image on every run — use modification date filtering to process only new and changed assets
- Do NOT classify images with a single label — most project images fit multiple categories and all relevant labels must be applied
- Do NOT skip metadata extraction for SVG files — SVGs contain viewBox, class names, and inline text that are highly searchable
- Do NOT generate descriptions without checking existing entries — duplicate descriptions waste knowledge store space and confuse RAG
- Do NOT ignore color palette extraction — brand consistency issues are often caught by comparing extracted palettes across assets
- Do NOT index animated GIFs without frame analysis — the first frame alone may not represent the asset's purpose
- Do NOT assume image filenames are descriptive — many assets use auto-generated names that provide zero semantic value
