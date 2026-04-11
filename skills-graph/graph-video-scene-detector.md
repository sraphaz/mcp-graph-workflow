---
name: graph-video-scene-detector
description: Scene cut and change detection in video with structured boundary mapping
triggers:
  - graph-video-scene-detector
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-video-scene-detector

Detects scene cuts, transitions, and visual change boundaries in video recordings. Produces a structured scene map with timestamps, transition types, and visual similarity scores, persisted to the graph for downstream analysis, chapter generation, and content navigation.

## When to Use

- When you need to segment a long video into distinct visual scenes for analysis
- When identifying transition points (hard cuts, fades, dissolves) in screen recordings
- When building chapter markers based on visual content changes rather than audio
- When detecting slide transitions in presentation recordings for automatic indexing
- When pre-processing video for frame extraction by identifying scene boundaries first
- When analyzing UI demo recordings to map distinct application screens or views

## Mandatory Flow

```
node → [scene detection pipeline] → analyze → write_memory
```

## Workflow

### Step 1: Create or Locate the Task Node

Every scene detection job must have a corresponding node in the execution graph.

**Tool:** `mcp__mcp-graph__node`

```
node({ action: "add", name: "Scene detection: <video-name>", type: "task", status: "in_progress" })
```

### Step 2: Frame Sampling and Histogram Analysis

Process the video to extract frames at a configurable sampling rate:

- **Sampling rate**: Default 2 fps for general content, 5 fps for fast-paced UI recordings
- **Color histograms**: Compute RGB and HSV histograms for each sampled frame
- **Frame differencing**: Calculate pixel-level differences between consecutive frames
- **Threshold calibration**: Auto-calibrate cut detection thresholds based on video characteristics

### Step 3: Detect Scene Boundaries

Apply multi-method scene boundary detection:

- **Hard cuts**: Abrupt frame-to-frame changes exceeding the histogram difference threshold
- **Gradual transitions**: Fades, dissolves, and wipes detected via sustained low-level change patterns
- **Content-aware detection**: Identify screen changes in UI recordings (URL bar changes, modal appearances)
- **Motion-based boundaries**: Detect camera movement cessation or significant motion vector shifts

Assign each boundary a type, confidence score, and precise timestamp.

### Step 4: Scene Classification

Classify each detected scene by its visual content type:

- **Presentation slide**: Static content with text and graphics
- **Live demo**: Dynamic UI interaction with cursor movement
- **Speaker view**: Camera feed showing a person
- **Screen share**: Desktop or application window capture
- **Transition screen**: Title cards, loading screens, blank frames
- **Mixed**: Combination of multiple content types

### Step 5: Compute Visual Similarity Scores

Calculate pairwise similarity between adjacent scenes:

- **Structural similarity (SSIM)**: Measure perceptual image quality between scene representative frames
- **Color distribution**: Compare color palette consistency across scenes
- **Layout similarity**: Detect similar UI layouts or slide templates across non-adjacent scenes

### Step 6: Validate Scene Map

Run analysis to verify the scene map is consistent and complete.

**Tool:** `mcp__mcp-graph__analyze`

```
analyze({ mode: "implement_done", nodeId: "<task-node-id>" })
```

Verify that:
- No scenes are shorter than 1 second (likely false positives)
- No scenes are longer than 15 minutes without internal sub-scenes
- Transition types are consistently classified
- Confidence scores are above the minimum threshold

### Step 7: Persist Scene Map

Store the structured scene map in the knowledge store.

**Tool:** `mcp__mcp-graph__write_memory`

```
write_memory({
  type: "insight",
  category: "video-scene-map",
  content: "<structured JSON with scenes, boundaries, classifications, similarity scores>"
})
```

## Output Format

```json
{
  "scene_map_id": "sd-<timestamp>",
  "source": {
    "video": "<video-filename>",
    "duration_seconds": 1200,
    "fps": 30,
    "resolution": "1920x1080",
    "nodeId": "<task-node-id>"
  },
  "detection_config": {
    "sampling_rate_fps": 2,
    "hard_cut_threshold": 0.65,
    "gradual_transition_window": 15
  },
  "scenes": [
    {
      "id": "scene-001",
      "start": "00:00:00.000",
      "end": "00:02:14.500",
      "duration_seconds": 134.5,
      "type": "presentation_slide",
      "confidence": 0.92,
      "representative_frame": "frame-00-01-07.png",
      "transition_in": { "type": "hard_cut", "confidence": 0.98 }
    }
  ],
  "statistics": {
    "total_scenes": 18,
    "avg_scene_duration_seconds": 66.7,
    "hard_cuts": 14,
    "gradual_transitions": 4,
    "detection_confidence_avg": 0.91
  },
  "persisted": true
}
```

## Anti-Patterns

- Do NOT run scene detection without a graph node -- all processing must be tracked
- Do NOT use a single detection method -- combine histogram, motion, and content-aware approaches for accuracy
- Do NOT accept scenes shorter than 1 second without manual review -- they are likely false positives
- Do NOT skip scene classification -- unclassified scenes provide limited value for downstream workflows
- Do NOT use fixed thresholds across all video types -- auto-calibrate based on video characteristics
- Do NOT persist the scene map without running `analyze` -- validation catches detection artifacts
- Do NOT treat scene detection as a standalone step -- it feeds into summarization, frame extraction, and chapter generation
