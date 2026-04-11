---
name: graph-cv-object-detection
description: Detect and classify UI components, icons, logos, and visual elements in product images with bounding box extraction and graph indexing
triggers:
  - graph-cv-object-detection
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-cv-object-detection

Autonomous object detection engine that identifies and classifies UI components, icons, logos, and visual elements within product images. The skill produces bounding box coordinates for each detected object, classifies them into semantic categories, and indexes the results in the knowledge store — enabling automated UI inventory, design system compliance checks, and visual element tracking across the execution graph.

## When to Use

- When product screenshots need automated UI component inventory (buttons, inputs, cards, modals)
- When brand compliance requires detecting logo placement, sizing, and consistency across screens
- When design system adherence needs verification by detecting non-standard components in screenshots
- When accessibility audits need to identify interactive elements that may lack proper labels
- When the user says "detect components", "find UI elements", "logo detection", or "icon inventory"
- During VALIDATE phase to verify that implemented screens contain all specified UI elements

## Mandatory Flow

```
receive_image → preprocess_for_detection → run_object_detector → classify_detections → extract_bounding_boxes → validate_against_spec → index_detections → create_tracking_nodes → write_memory
```

## Workflow

### Step 1: Receive Image and Determine Detection Scope

Identify the target image and configure detection parameters based on context.

```
Tool: mcp__mcp-graph__analyze
Params:
  mode: "progress"
```

| Detection Scope | Target Objects | Confidence Threshold |
|---|---|---|
| Full UI audit | All interactive and visual elements | >= 70% |
| Component inventory | Buttons, inputs, selects, checkboxes, toggles | >= 80% |
| Brand compliance | Logos, brand colors, typography | >= 85% |
| Icon detection | Icons, glyphs, symbols | >= 75% |
| Layout analysis | Containers, grids, cards, sections | >= 70% |
| Accessibility | Interactive elements, labels, focus indicators | >= 80% |

Search for existing detection results for this image:

```
Tool: mcp__mcp-graph__search
Params:
  query: "object detection <image filename>"
  scope: "knowledge"
```

### Step 2: Preprocess Image for Detection

Prepare the image for optimal object detection performance:

1. **Resolution standardization** — Scale to detection model's expected input size while preserving aspect ratio
2. **Color normalization** — Normalize color channels to standard distribution for consistent detection
3. **Padding** — Add uniform padding to handle objects at image edges
4. **Tiling** — For high-resolution images, create overlapping tiles to maintain detection accuracy
5. **Contrast enhancement** — Boost contrast for low-visibility UI elements (e.g., ghost buttons, disabled states)

### Step 3: Run Multi-Class Object Detection

Execute the detection pipeline across all configured object classes:

| Object Class | Visual Features | Example Elements |
|---|---|---|
| Button | Rectangular, colored fill or border, text label | Primary CTA, secondary, icon button, fab |
| Input | Rectangular, border, placeholder text, label above | Text field, textarea, search bar |
| Select | Rectangular with dropdown indicator (chevron) | Dropdown, combobox, multi-select |
| Checkbox | Small square, check mark presence | Checkbox, toggle switch |
| Icon | Small, symbolic, often monochrome | Navigation icons, status icons, action icons |
| Logo | Brand-specific shape, often in header/footer | Company logo, partner logos |
| Card | Rectangular container, shadow/border, mixed content | Product card, info card, stat card |
| Modal | Centered overlay, backdrop, close button | Dialog, alert, confirmation |
| Navigation | Horizontal/vertical list, links, active indicator | Navbar, sidebar, tabs, breadcrumb |
| Table | Grid of cells, header row, alternating rows | Data table, list view |
| Image | Photo or illustration within UI | Avatar, thumbnail, hero image, banner |

### Step 4: Extract Bounding Boxes and Confidence Scores

For each detection, extract precise spatial information:

```
Tool: mcp__mcp-graph__analyze
Params:
  mode: "implement_done"
```

Per-detection output:

| Field | Description |
|---|---|
| Class | Object category (button, input, icon, etc.) |
| Confidence | Detection confidence score (0.0 - 1.0) |
| Bounding box | [x_min, y_min, x_max, y_max] in pixels |
| Center point | (cx, cy) computed from bounding box |
| Area | width * height of bounding box |
| Aspect ratio | width / height |
| Relative position | Quadrant and percentage position within image |
| Overlap | List of other detections this box overlaps with |

### Step 5: Validate Detections Against Specification

If a design specification exists, validate detected elements against expected elements:

```
Tool: mcp__mcp-graph__search
Params:
  query: "design specification UI elements <page name>"
  scope: "nodes"
```

| Validation Check | Pass Criteria | Failure Action |
|---|---|---|
| Element presence | All specified elements detected | Create missing-element node |
| Element count | Detected count matches expected | Flag excess or missing elements |
| Position accuracy | Detected position within tolerance of spec | Flag misaligned elements |
| Size compliance | Element dimensions within design system rules | Flag oversized/undersized elements |
| Logo placement | Logo in expected position with correct size | Create brand compliance issue node |

### Step 6: Index Detections to Knowledge Store

Persist all detection results for RAG retrieval:

```
Tool: mcp__mcp-graph__search
Params:
  query: "ui component detection inventory"
  scope: "knowledge"
```

Each detection entry includes:
- Image source path and region coordinates
- Object class and confidence score
- Bounding box coordinates and area
- Associated page/screen name
- Detection timestamp for change tracking
- Link to design specification node if applicable

### Step 7: Create Tracking Nodes for Issues

For each validation failure, create a tracked node in the graph:

```
Tool: mcp__mcp-graph__node
Params:
  action: "add"
  name: "OBJ-DETECT: <issue type> — <element> on <page>"
  type: "task"
  priority: "<based on severity>"
  description: "Object detection found <issue>. Image: <source>. Expected: <spec>. Detected: <actual>. Bounding box: [<coords>]. Confidence: X%."
  acceptanceCriteria: "1. Element matches design specification\n2. Re-detection confirms compliance\n3. No regression in other elements"
```

### Step 8: Persist Detection Results to Memory

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Object Detection — <image source> — <date>"
  content: "<total objects detected, class distribution, confidence stats, validation results, issues found, tracking nodes created>"
  tags: ["object-detection", "computer-vision", "ui-components", "design-system", "brand-compliance"]
```

## Output Format

```
Phase: OBJECT DETECTION
Source: <filename> (<width>x<height>)
Detection Scope: <scope type>

Detection Results:
  Total Objects: N
  Buttons: N (avg confidence: X%)
  Inputs: N (avg confidence: X%)
  Icons: N (avg confidence: X%)
  Logos: N (avg confidence: X%)
  Cards: N (avg confidence: X%)
  Navigation: N (avg confidence: X%)
  Tables: N (avg confidence: X%)
  Other: N

Confidence Distribution:
  >= 90%: N detections
  80-89%: N detections
  70-79%: N detections
  < 70%: N detections (flagged)

Spatial Coverage:
  Total Detected Area: X.X% of image
  Overlapping Detections: N

Specification Validation:
  Expected Elements: N
  Detected (matching): N
  Missing: N
  Extra (unexpected): N
  Misaligned: N

Issues Created: N
  Missing Elements: N
  Size Violations: N
  Position Violations: N
  Brand Compliance: N

Saved to memory: "Object Detection — <source> — <date>"
```

## Anti-Patterns

- Do NOT run detection on heavily compressed JPEG images — compression artifacts create phantom edges that produce false positive detections
- Do NOT use a single confidence threshold for all object classes — small icons need lower thresholds than large buttons due to feature availability
- Do NOT ignore overlapping bounding boxes — overlapping detections often indicate duplicate detection of the same element that must be merged via non-maximum suppression
- Do NOT validate against spec without accounting for responsive layout — element positions shift across breakpoints and fixed-pixel comparisons will false-alarm
- Do NOT skip the preprocessing step for dark mode screenshots — inverted color schemes require separate normalization parameters
- Do NOT index low-confidence detections alongside high-confidence ones without a confidence tag — polluted knowledge entries degrade RAG retrieval quality
- Do NOT treat absence of detection as absence of element — the detector may miss elements due to unusual styling, and manual verification should be flagged
