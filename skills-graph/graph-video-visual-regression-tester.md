---
name: graph-video-visual-regression-tester
description: Video-based UI/UX regression testing from screen recordings with automated diff detection
triggers:
  - graph-video-visual-regression-tester
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-video-visual-regression-tester

Performs visual regression testing by comparing screen recordings against baseline recordings or expected UI states. Detects layout shifts, missing elements, color changes, text differences, and interaction flow deviations. Results are linked to graph nodes and validation tasks for full traceability.

## When to Use

- When a new deployment needs visual validation against the previous version's screen recording
- When comparing UI behavior across browsers or devices using recorded sessions
- When detecting unintended visual side effects from code changes
- When validating that UI fixes actually resolved the reported visual issues
- When building a visual regression baseline library from golden-path screen recordings
- When acceptance criteria include visual fidelity requirements that need automated verification

## Mandatory Flow

```
node → analyze → [visual regression pipeline] → validate → write_memory
```

## Workflow

### Step 1: Create or Locate Regression Test Node

Ensure a graph node exists for the regression test run.

**Tool:** `mcp__mcp-graph__node`

```
node({ action: "add", name: "Visual regression: <feature-or-page>", type: "task", status: "in_progress" })
```

### Step 2: Load Baseline Context

Retrieve baseline information including previous test results, known visual states, and acceptance criteria.

**Tool:** `mcp__mcp-graph__analyze`

```
analyze({ mode: "validate_ready", nodeId: "<task-node-id>" })
```

Identify:
- **Baseline recording**: The reference video representing the expected visual state
- **Test recording**: The new video to compare against the baseline
- **Comparison scope**: Full page, specific components, or interaction flows
- **Tolerance thresholds**: Acceptable pixel difference percentages per region

### Step 3: Temporal Alignment

Synchronize the baseline and test recordings for frame-by-frame comparison:

- **Trigger-point alignment**: Identify common UI events (page load complete, animation end) as sync points
- **Action-sequence matching**: Align recordings by matching interaction sequences rather than absolute time
- **Speed normalization**: Account for performance differences between recordings
- **Trim padding**: Remove idle time at start and end of recordings

### Step 4: Frame-Level Visual Comparison

Compare aligned frames between baseline and test recordings:

- **Pixel diff**: Compute per-pixel color differences with configurable tolerance
- **Structural comparison (SSIM)**: Measure perceptual similarity accounting for minor rendering differences
- **Region-of-interest masking**: Focus comparison on specific UI regions, ignoring dynamic content areas (timestamps, avatars)
- **Anti-aliasing handling**: Compensate for subpixel rendering differences across environments
- **Layout shift detection**: Identify elements that moved position between baseline and test

### Step 5: Classify Detected Differences

Categorize each detected visual difference:

- **Layout regression**: Elements shifted, resized, or removed
- **Color regression**: Background, text, or border colors changed
- **Typography regression**: Font family, size, weight, or spacing changed
- **Content regression**: Text content differs from baseline
- **Interaction regression**: Hover states, focus indicators, or animations differ
- **False positive**: Dynamic content (timestamps, user-specific data) correctly differs

Assign severity: critical (blocks release), warning (needs review), info (cosmetic, acceptable).

### Step 6: Generate Visual Diff Report

Produce a structured diff report with visual evidence:

- **Side-by-side frames**: Baseline vs. test for each detected difference
- **Heatmap overlay**: Pixel difference intensity mapped as a heatmap on the test frame
- **Annotated screenshots**: Bounding boxes around changed regions with labels
- **Summary statistics**: Total differences, by severity, by category

### Step 7: Run Validation

Execute validation against acceptance criteria for the regression test.

**Tool:** `mcp__mcp-graph__validate`

```
validate({ action: "ac", nodeId: "<task-node-id>" })
```

Determine pass/fail based on:
- Zero critical regressions
- Warning count below the configured threshold
- All known acceptable differences are properly masked

### Step 8: Persist Results

Store the regression test results in the knowledge store for historical tracking.

**Tool:** `mcp__mcp-graph__write_memory`

```
write_memory({
  type: "insight",
  category: "visual-regression-test",
  content: "<structured JSON with diff results, severities, pass/fail status>"
})
```

## Output Format

```json
{
  "test_id": "vrt-<timestamp>",
  "source": {
    "baseline_video": "baseline-dashboard-v1.4.mp4",
    "test_video": "test-dashboard-v1.5.mp4",
    "nodeId": "<task-node-id>"
  },
  "alignment": {
    "method": "action_sequence",
    "sync_points": 8,
    "temporal_offset_ms": 120
  },
  "results": {
    "status": "fail",
    "total_frames_compared": 450,
    "frames_with_diffs": 23,
    "differences": [
      {
        "id": "diff-001",
        "frame_baseline": "00:00:15.200",
        "frame_test": "00:00:15.400",
        "category": "layout_regression",
        "severity": "critical",
        "region": { "x": 200, "y": 80, "width": 400, "height": 50 },
        "description": "Navigation bar height increased by 12px, pushing content down",
        "ssim_score": 0.82,
        "pixel_diff_pct": 8.3
      }
    ]
  },
  "summary": {
    "critical": 1,
    "warning": 3,
    "info": 19,
    "false_positives_masked": 7
  },
  "persisted": true
}
```

## Anti-Patterns

- Do NOT compare recordings without temporal alignment -- misaligned frames produce false positives everywhere
- Do NOT treat all pixel differences as regressions -- use region masking for dynamic content areas
- Do NOT skip severity classification -- treating all diffs equally buries critical regressions in noise
- Do NOT run regression tests without a tracked graph node -- unlinked test results are invisible to the workflow
- Do NOT ignore anti-aliasing differences -- they are the largest source of false positives in cross-browser testing
- Do NOT persist results without running `validate` against acceptance criteria -- raw diffs need pass/fail determination
- Do NOT use fixed pixel thresholds for all content types -- text regions need tighter thresholds than image regions
