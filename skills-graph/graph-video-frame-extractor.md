---
name: graph-video-frame-extractor
description: Intelligent key-frame extraction from video for analysis, documentation, and visual evidence
triggers:
  - graph-video-frame-extractor
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-video-frame-extractor

Extracts intelligent key-frames from video recordings based on visual significance, content changes, and domain relevance. Produces annotated frame sets suitable for documentation, visual regression baselines, sprint review artifacts, and graph-linked visual evidence.

## When to Use

- When you need representative screenshots from a video for documentation or reports
- When building visual baselines for UI regression testing from screen recordings
- When extracting slide images from presentation recordings for indexing
- When creating visual step-by-step guides from tutorial or demo videos
- When capturing UI states at specific interaction points for acceptance criteria evidence
- When reducing video storage by extracting only the visually significant frames

## Mandatory Flow

```
node → [frame extraction pipeline] → analyze → write_memory
```

## Workflow

### Step 1: Create or Locate the Task Node

Ensure a graph node exists for the frame extraction task.

**Tool:** `mcp__mcp-graph__node`

```
node({ action: "add", name: "Extract frames: <video-name>", type: "task", status: "in_progress" })
```

### Step 2: Analyze Video Characteristics

Profile the video to determine optimal extraction strategy:

- **Duration**: Total length determines sampling density
- **Frame rate**: Native fps affects temporal resolution
- **Resolution**: Output frame dimensions and quality settings
- **Content type**: Presentation, UI demo, meeting, or mixed content
- **Motion profile**: Average and peak motion levels across the video

### Step 3: Apply Extraction Strategies

Use multiple extraction strategies in combination for comprehensive coverage:

- **Scene-boundary frames**: Extract the first stable frame after each detected scene cut
- **Content-peak frames**: Select frames with maximum visual information density (text, UI elements, diagrams)
- **Periodic sampling**: Extract frames at regular intervals as fallback coverage
- **Motion-minimum frames**: Select the sharpest frames during low-motion periods (avoids blur)
- **OCR-optimized frames**: Prefer frames where text content is most legible

### Step 4: Deduplicate and Rank Frames

Remove redundant frames and rank remaining candidates:

- **Perceptual hashing**: Compute perceptual hashes (pHash) and remove near-duplicates within a Hamming distance threshold
- **SSIM filtering**: Remove frames with structural similarity above 0.95 to any already-selected frame
- **Quality scoring**: Rank frames by sharpness (Laplacian variance), brightness, contrast, and text legibility
- **Relevance scoring**: Boost frames that contain UI elements, text, or visual content matching the task context

### Step 5: Annotate Extracted Frames

Add metadata annotations to each extracted frame:

- **Timestamp**: Precise video timestamp of the extracted frame
- **Scene context**: Which scene the frame belongs to
- **Content description**: Auto-generated description of visual content via image analysis
- **OCR text**: Extracted text content visible in the frame
- **Extraction reason**: Why this frame was selected (scene boundary, content peak, etc.)

### Step 6: Validate Extraction Quality

Run analysis to verify the extracted frame set meets quality and coverage requirements.

**Tool:** `mcp__mcp-graph__analyze`

```
analyze({ mode: "implement_done", nodeId: "<task-node-id>" })
```

Verify that:
- All major scenes have at least one representative frame
- No critical visual content (slides, UI states) was missed
- Frame quality scores are above the minimum threshold
- Total frame count is within the target range for the video length

### Step 7: Persist Frame Metadata

Store the frame extraction results and metadata in the knowledge store.

**Tool:** `mcp__mcp-graph__write_memory`

```
write_memory({
  type: "insight",
  category: "video-frame-extraction",
  content: "<structured JSON with frame metadata, annotations, quality scores>"
})
```

## Output Format

```json
{
  "extraction_id": "fe-<timestamp>",
  "source": {
    "video": "<video-filename>",
    "duration_seconds": 900,
    "native_fps": 30,
    "resolution": "1920x1080",
    "nodeId": "<task-node-id>"
  },
  "config": {
    "max_frames": 50,
    "min_quality_score": 0.7,
    "dedup_threshold": 0.95,
    "strategies": ["scene_boundary", "content_peak", "motion_minimum"]
  },
  "frames": [
    {
      "id": "frame-001",
      "timestamp": "00:00:12.400",
      "file": "frames/frame-001-00-00-12.png",
      "scene_id": "scene-001",
      "extraction_reason": "scene_boundary",
      "quality_score": 0.94,
      "sharpness": 0.91,
      "ocr_text": "Sprint 14 - Dashboard Performance",
      "description": "Title slide showing sprint number and theme"
    }
  ],
  "statistics": {
    "total_frames_extracted": 34,
    "total_frames_after_dedup": 28,
    "avg_quality_score": 0.88,
    "scenes_covered": 18,
    "scenes_total": 18,
    "coverage_pct": 100
  },
  "persisted": true
}
```

## Anti-Patterns

- Do NOT extract frames at fixed intervals only -- intelligent extraction based on content changes produces far better results
- Do NOT skip deduplication -- near-identical frames waste storage and pollute downstream analysis
- Do NOT extract frames without quality scoring -- blurry or dark frames degrade documentation quality
- Do NOT ignore OCR extraction on frames with text content -- searchable text is a primary value driver
- Do NOT persist frames without linking to a graph node -- untracked visual assets become orphaned
- Do NOT extract all frames from high-fps video -- this produces thousands of redundant images
- Do NOT skip the `analyze` validation step -- it catches gaps in scene coverage before persistence
