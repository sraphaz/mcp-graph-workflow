---
name: graph-cv-anomaly-visual-detector
description: Visual anomaly detection in UI outputs, charts, graph renders, and dashboard visualizations with automatic issue tracking in the execution graph
triggers:
  - graph-cv-anomaly-visual-detector
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-cv-anomaly-visual-detector

Autonomous visual anomaly detection engine that scans UI outputs, data charts, graph renderings, and dashboard visualizations for unexpected patterns, rendering errors, data outliers, and visual defects. The skill learns expected visual patterns from historical baselines and flags deviations that indicate bugs, data quality issues, or rendering failures — automatically creating tracked issue nodes in the execution graph.

## When to Use

- When dashboard or chart renders need to be verified for visual correctness (missing data, clipped axes, overlapping labels)
- When graph visualizations (Mermaid, React Flow) produce unexpected layouts or rendering artifacts
- When UI outputs show visual glitches (z-index issues, overflow, truncation, misalignment)
- When data visualizations need anomaly detection beyond numerical checks (visual outliers in scatter plots, broken trend lines)
- When the user says "detect visual anomalies", "check chart rendering", "find visual bugs", or "anomaly scan"
- During VALIDATE phase to catch rendering issues that functional tests do not cover

## Mandatory Flow

```
capture_visual_output → establish_baseline_pattern → detect_anomalies → classify_severity → generate_evidence → create_issue_nodes → track_resolution → write_memory
```

## Workflow

### Step 1: Capture Visual Output for Analysis

Identify and capture the visual outputs that need anomaly detection.

```
Tool: mcp__mcp-graph__analyze
Params:
  mode: "validate_ready"
```

| Visual Output Type | Capture Method | Analysis Focus |
|---|---|---|
| Dashboard page | Full-page screenshot | Widget alignment, data display, responsiveness |
| Chart/Graph | Component screenshot | Axis labels, data points, legends, gridlines |
| Mermaid render | SVG/PNG export | Node positioning, edge routing, label readability |
| React Flow graph | Canvas screenshot | Node overlap, edge crossing, zoom level |
| Table/List | Component screenshot | Column alignment, row spacing, pagination |
| Form | Component screenshot | Field alignment, label positioning, error states |

Retrieve current metrics for correlation with visual anomalies:

```
Tool: mcp__mcp-graph__metrics
Params:
  type: "graph"
```

### Step 2: Establish Baseline Visual Patterns

Define what "normal" looks like for each visual output type:

| Pattern Category | Baseline Definition | Deviation Threshold |
|---|---|---|
| Layout geometry | Expected bounding boxes, grid alignment | > 5px shift from expected position |
| Color distribution | Expected color histogram from design system | > 10% deviation in dominant color ratios |
| Text rendering | Expected font sizes, line heights, no truncation | Any clipped text or missing characters |
| Data density | Expected number of data points, bars, lines | > 20% fewer elements than expected |
| Whitespace | Expected margins, padding, gutters | > 15% deviation from design spec |
| Symmetry | Expected left-right or top-bottom balance | Asymmetry score > 0.3 where symmetry expected |

Search for previous baselines:

```
Tool: mcp__mcp-graph__search
Params:
  query: "visual baseline anomaly pattern"
  scope: "knowledge"
```

### Step 3: Run Multi-Layer Anomaly Detection

Apply layered anomaly detection across different visual aspects:

**Layer 1: Structural Anomalies**
- Overlapping elements (z-index issues)
- Clipped content (overflow hidden cutting off content)
- Missing elements (expected components not rendered)
- Broken layout (grid collapse, flex wrap failure)

**Layer 2: Data Anomalies in Visualizations**
- Empty charts with data expected
- Axes with wrong scale or missing labels
- Data points outside chart boundaries
- Trend lines that don't match visible data
- Legend items that don't match chart series

**Layer 3: Rendering Anomalies**
- Anti-aliasing failures (jagged edges where smooth expected)
- Color banding (gradient artifacts)
- Font rendering issues (wrong font loaded, missing glyphs)
- Image loading failures (broken image placeholders)
- SVG rendering differences across browsers

**Layer 4: Consistency Anomalies**
- Different styling for same component type
- Inconsistent spacing between similar elements
- Color deviations from design system tokens
- Typography inconsistencies (mixed font sizes, weights)

```
Tool: mcp__mcp-graph__analyze
Params:
  mode: "done_integrity"
```

### Step 4: Classify Anomaly Severity

Rate each detected anomaly by its impact:

| Severity | Criteria | Examples |
|---|---|---|
| Critical | Data loss or misrepresentation | Chart showing wrong values, missing data series |
| High | Functional impact on user understanding | Overlapping labels hiding text, clipped chart axes |
| Medium | Visual defect affecting professionalism | Misaligned grid, inconsistent spacing |
| Low | Minor cosmetic issue | 1px border misalignment, slight color shift |
| Info | Potential issue, may be intentional | Design deviation that could be a feature |

### Step 5: Generate Anomaly Evidence

For each detected anomaly, produce comprehensive evidence:

1. **Annotated screenshot** — Original with anomaly region highlighted in red bounding box
2. **Comparison** — Side-by-side of expected (baseline) vs actual if baseline exists
3. **Isolation** — Cropped view of the anomalous region at 2x zoom
4. **Context** — Surrounding UI context showing where the anomaly appears
5. **Reproduction data** — Viewport size, browser, data state, and graph state at time of capture

```
Tool: mcp__mcp-graph__analyze
Params:
  mode: "implement_done"
```

### Step 6: Create Issue Tracking Nodes

For each anomaly above the reporting threshold (medium or higher), create a tracked issue:

```
Tool: mcp__mcp-graph__node
Params:
  action: "add"
  name: "VISUAL-ANOMALY: <anomaly type> — <location>"
  type: "task"
  priority: "<mapped from severity>"
  description: "Visual anomaly detected in <output type> at <location>. Type: <anomaly category>. Severity: <level>. Expected: <baseline pattern>. Actual: <observed pattern>. Evidence: <screenshot reference>."
  acceptanceCriteria: "1. Anomaly no longer detected in re-scan\n2. Visual output matches baseline pattern\n3. No new anomalies introduced by the fix"
```

Correlate with existing metrics:

```
Tool: mcp__mcp-graph__metrics
Params:
  type: "velocity"
```

### Step 7: Track Resolution and Re-Scan

After anomaly fixes are applied, re-scan to verify resolution:

```
Tool: mcp__mcp-graph__analyze
Params:
  mode: "status_flow"
```

Resolution verification flow:
1. Re-capture the same visual output under identical conditions
2. Re-run anomaly detection on the new capture
3. If anomaly cleared: update node to `done`, update baseline
4. If anomaly persists: keep node open, add diagnostic notes
5. If new anomalies appeared: create new issue nodes (regression)

### Step 8: Persist Detection Results to Memory

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Visual Anomaly Detection — <scope> — <date>"
  content: "<outputs scanned, anomalies detected by layer, severity distribution, issue nodes created, baselines updated, false positive rate, resolution status>"
  tags: ["visual-anomaly", "computer-vision", "rendering", "quality", "dashboard"]
```

## Output Format

```
Phase: VISUAL ANOMALY DETECTION
Outputs Scanned: N
Baseline Comparisons: N available / N used

Detection Results by Layer:
  Structural Anomalies: N
    Overlapping Elements: N
    Clipped Content: N
    Missing Elements: N
    Broken Layout: N
  Data Anomalies: N
    Empty Charts: N
    Wrong Scale: N
    Out-of-Bounds Points: N
    Missing Labels: N
  Rendering Anomalies: N
    Anti-aliasing Failures: N
    Color Banding: N
    Font Issues: N
    Broken Images: N
  Consistency Anomalies: N
    Style Deviations: N
    Spacing Issues: N
    Color Mismatches: N
    Typography Inconsistencies: N

Severity Distribution:
  Critical: N
  High: N
  Medium: N
  Low: N
  Info: N

Issue Nodes Created: N
  Critical/High (immediate): N
  Medium (next sprint): N

Baselines Updated: N
False Positives Suppressed: N

Saved to memory: "Visual Anomaly Detection — <scope> — <date>"
```

## Anti-Patterns

- Do NOT run anomaly detection without a baseline — without knowing what "normal" looks like, every deviation is flagged and the signal-to-noise ratio becomes unusable
- Do NOT ignore data anomalies in charts — a chart rendering the wrong values is worse than a chart with misaligned labels, yet rendering bugs get more attention
- Do NOT treat all anomalies as bugs — some visual deviations are intentional design decisions (e.g., responsive layout changes) and must be confirmed before creating issue nodes
- Do NOT skip the re-scan verification step — closing anomaly nodes without re-scanning leads to false confidence that issues were fixed
- Do NOT use pixel-perfect comparison for dynamic content — timestamps, live data, and animated elements produce false positives unless masked
- Do NOT batch all anomalies into a single issue node — each distinct anomaly needs its own node for proper tracking, assignment, and resolution verification
- Do NOT ignore consistency anomalies as "just cosmetic" — inconsistent styling across the same component type indicates systematic design system drift that compounds over time
