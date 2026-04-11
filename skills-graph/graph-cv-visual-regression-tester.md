---
name: graph-cv-visual-regression-tester
description: Pixel-level UI regression testing via screenshot comparison with automatic diff highlighting and failure node generation
triggers:
  - graph-cv-visual-regression-tester
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-cv-visual-regression-tester

Autonomous visual regression testing engine that captures UI screenshots, compares them pixel-by-pixel against approved baselines, detects meaningful visual differences, and automatically generates failure nodes in the execution graph. This skill distinguishes true regressions from acceptable variations (anti-aliasing, subpixel rendering) and integrates with the validation lifecycle phase.

## When to Use

- After any IMPLEMENT task that modifies UI components, CSS, or layout templates
- Before REVIEW phase transitions as a visual quality gate
- When a UI-related task is marked as done and needs visual acceptance criteria validation
- After dependency upgrades that may affect rendered component appearance
- When the user says "visual regression", "screenshot test", "pixel diff", or "UI comparison"
- During VALIDATE phase for comprehensive visual coverage across responsive breakpoints

## Mandatory Flow

```
capture_baseline_check → capture_current_screenshots → pixel_diff_analysis → threshold_evaluation → highlight_regressions → create_failure_nodes → validate_fixes → write_memory
```

## Workflow

### Step 1: Determine Test Scope and Baseline Status

Identify which pages and components need visual regression testing based on recent changes.

```
Tool: mcp__mcp-graph__analyze
Params:
  mode: "validate_ready"
```

Check for existing baselines in the knowledge store:

```
Tool: mcp__mcp-graph__search
Params:
  query: "visual baseline screenshot"
  scope: "knowledge"
```

| Scenario | Action |
|---|---|
| No baseline exists | Capture current state as baseline, skip comparison |
| Baseline exists, no changes | Skip (no regression possible) |
| Baseline exists, UI changes detected | Full comparison pipeline |
| Baseline exists, intentional redesign | Update baseline after human approval |

Define the viewport matrix for responsive testing:

| Breakpoint | Width | Height | Device |
|---|---|---|---|
| Mobile | 375px | 812px | iPhone 13 |
| Tablet | 768px | 1024px | iPad |
| Desktop | 1440px | 900px | Standard laptop |
| Wide | 1920px | 1080px | Full HD monitor |

### Step 2: Capture Current Screenshots

Capture screenshots of all pages/components in scope across all viewport breakpoints:

```
Tool: mcp__mcp-graph__node
Params:
  action: "add"
  name: "VRT-CAPTURE: <page/component name>"
  type: "task"
  priority: "high"
  description: "Visual regression test capture for <target>. Viewports: mobile, tablet, desktop, wide. Baseline date: <last capture date>."
  acceptanceCriteria: "1. Screenshots captured at all 4 breakpoints\n2. Page fully loaded (no spinners/placeholders)\n3. Animations settled to final state"
```

For each page/component:
1. Navigate to the target URL or render the component in isolation
2. Wait for all network requests to complete (no loading spinners)
3. Wait for animations to settle (CSS transitions, JS animations)
4. Hide dynamic content (timestamps, randomized IDs, live data)
5. Capture full-page and viewport-only screenshots

### Step 3: Pixel-Level Diff Analysis

Compare each captured screenshot against its baseline using structural similarity:

| Metric | Description | Threshold |
|---|---|---|
| Pixel diff percentage | Raw count of changed pixels / total pixels | < 0.1% = pass |
| Structural similarity (SSIM) | Perceptual similarity score | > 0.98 = pass |
| Color delta (CIE76) | Average color difference across changed regions | < 2.0 = pass |
| Anti-aliasing tolerance | Ignored pixels at edges and curves | 2px buffer zone |
| Layout shift score | Bounding box position delta for key elements | < 3px = pass |

For each comparison, generate:
- A diff image highlighting changed pixels in magenta
- A side-by-side comparison (baseline | current | diff)
- A heat map showing change intensity across the viewport

### Step 4: Threshold Evaluation and Classification

Classify each diff result into actionable categories:

```
Tool: mcp__mcp-graph__analyze
Params:
  mode: "done_integrity"
```

| Classification | Criteria | Action |
|---|---|---|
| Pass | All metrics within threshold | No action needed |
| Anti-aliasing noise | Diff < 0.05%, only at edges | Auto-approve, log |
| Minor regression | 0.1% < diff < 1.0% | Create warning node |
| Major regression | diff > 1.0% or SSIM < 0.95 | Create failure node, block review |
| Layout break | Element position shift > 10px | Create critical failure node |
| Content change | Text content differs | Flag for content review |

### Step 5: Highlight Regressions with Annotated Diffs

For each regression detected, create an annotated diff image:

1. Draw bounding boxes around each changed region
2. Label each region with the change type (color, position, size, visibility)
3. Calculate the affected component or CSS selector
4. Annotate with severity level and pixel count
5. Generate a filmstrip view for responsive breakpoints showing the regression across devices

### Step 6: Create Failure Nodes in Execution Graph

For each major regression or layout break, create a tracked failure node:

```
Tool: mcp__mcp-graph__node
Params:
  action: "add"
  name: "VRT-FAIL: <page> @ <breakpoint> — <regression type>"
  type: "task"
  priority: "high"
  description: "Visual regression detected on <page> at <breakpoint>. Diff: X.X%. SSIM: 0.XX. Changed region: <bounding box>. Likely cause: <CSS selector or component>."
  acceptanceCriteria: "1. Diff percentage returns to < 0.1%\n2. SSIM score > 0.98\n3. Baseline updated after fix verification"
```

Record the validation result:

```
Tool: mcp__mcp-graph__validate
Params:
  action: "ac"
  nodeId: "<ui-task-node-id>"
  result: "fail"
  details: "Visual regression detected: <summary>"
```

### Step 7: Self-Healing Verification Loop

After regression fixes are applied, automatically re-run the visual comparison:

```
Tool: mcp__mcp-graph__analyze
Params:
  mode: "status_flow"
```

If the re-run passes:
1. Update the failure node status to `done`
2. Update the baseline to the new approved screenshot
3. Log the fix details for future reference

If the re-run still fails:
1. Keep the failure node open
2. Escalate severity if the diff has worsened
3. Add diagnostic notes about what was attempted

### Step 8: Persist Test Results to Memory

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Visual Regression Test — <date>"
  content: "<total pages tested, breakpoints covered, pass/fail/warning counts, failure nodes created, baseline updates, SSIM averages>"
  tags: ["visual-regression", "computer-vision", "ui-testing", "screenshot", "pixel-diff"]
```

## Output Format

```
Phase: VISUAL REGRESSION TESTING
Scope: <N pages> x <M breakpoints> = <total screenshots>

Capture Status:
  Successful: N
  Failed to Load: N
  Dynamic Content Masked: N regions

Comparison Results:
  Pass: N (X%)
  Anti-aliasing Noise: N (auto-approved)
  Minor Regression: N (warning)
  Major Regression: N (failure)
  Layout Break: N (critical)
  Content Change: N (flagged)

Metrics Summary:
  Average SSIM: 0.XX
  Max Pixel Diff: X.X%
  Layout Shifts Detected: N

Failure Nodes Created: N
  Critical: N
  High: N
  Warning: N

Baselines Updated: N
Baselines Created (new): N

Saved to memory: "Visual Regression Test — <date>"
```

## Anti-Patterns

- Do NOT compare screenshots without waiting for full page load — loading spinners and placeholder content cause false positives
- Do NOT use raw pixel diff without anti-aliasing tolerance — subpixel rendering differences across environments create noise
- Do NOT skip responsive breakpoints — a regression at mobile width may not appear at desktop and vice versa
- Do NOT auto-approve major regressions based on previous approval — each significant visual change requires fresh human verification
- Do NOT store baseline screenshots in the git repository — use the knowledge store or external artifact storage to avoid repo bloat
- Do NOT run visual tests against live data — dynamic content (dates, user names, random IDs) must be masked or mocked
- Do NOT ignore layout shift metrics — elements can maintain visual appearance while shifting position, breaking scroll and interaction patterns
