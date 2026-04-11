---
name: graph-audio-segmenter
description: Audio segmentation by topic, speaker turn, or semantic boundary for structured processing
triggers:
  - graph-audio-segmenter
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-audio-segmenter

Segments audio recordings into meaningful sections based on topic changes, speaker turns, silence boundaries, or semantic content shifts. Each segment is tagged and can be individually linked to graph nodes, enabling granular tracking of discussions, decisions, and action items.

## When to Use

- When long audio recordings need to be split into topic-based sections for targeted processing
- When meeting recordings should be segmented by agenda items for per-topic analysis
- When audio needs to be divided before parallel transcription or sentiment analysis
- When creating chapter markers for navigable audio content
- When specific portions of a recording need to be linked to individual graph task nodes
- When building a structured audio knowledge base with segment-level granularity

## Mandatory Flow

```
analyze(audio_overview) → detect_boundaries → classify_segments → node(add segment nodes) → write_memory(segmentation map) → analyze(implement_done)
```

## Workflow

### Step 1: Audio Overview Analysis

Examine the full audio recording to understand its structure, duration, and high-level characteristics before segmentation.

**Tool:** `mcp__mcp-graph__analyze`
- Mode: `progress`
- Determine total duration and expected number of segments
- Identify whether the recording has a structured format (meeting with agenda) or freeform
- Check for existing segmentation data to avoid reprocessing
- Assess audio quality to determine which boundary detection methods are viable

### Step 2: Boundary Detection

Apply multiple boundary detection algorithms and fuse their results:

- **Silence-based detection**: identify gaps longer than a configurable threshold (default: 2 seconds) as potential segment boundaries
- **Speaker turn detection**: use speaker change points as segment boundaries when topic follows speaker structure
- **Acoustic change detection**: detect shifts in acoustic features (energy, spectral centroid, MFCC) that indicate topic transitions
- **Semantic boundary detection**: if a transcript is available, use text-based topic modeling (LDA, BERTopic) to find topic shifts
- **Energy envelope analysis**: detect dramatic changes in volume or speaking pattern
- Merge boundaries from all detectors using a consensus threshold

### Step 3: Segment Classification

Classify each detected segment with metadata:

- Assign a topic label based on content analysis (from transcript or acoustic features)
- Determine segment type: discussion, presentation, Q&A, sidebar, silence, transition
- Calculate confidence score for each boundary
- Estimate speaker distribution within each segment
- Compute segment-level audio quality metrics
- Tag segments with keywords extracted from available context

### Step 4: Create Segment Nodes in Graph

For significant segments that correspond to actionable content, create child nodes in the execution graph.

**Tool:** `mcp__mcp-graph__node`
- Action: `add`
- Type: `task` or `note` depending on segment content
- Title: `Segment: {topic_label} ({start_time} - {end_time})`
- Description: segment summary, speakers, key terms
- Link to parent recording node via dependency edge

### Step 5: Validate Segmentation Quality

Review the segmentation results for correctness and completeness:

- Verify no audio content is lost between segments (gaps check)
- Ensure no segment exceeds a maximum duration threshold (default: 15 minutes)
- Confirm segment boundaries do not split mid-sentence (if transcript available)
- Check that the total duration of all segments matches the original recording
- Validate that speaker-based segments correctly identify turn changes

### Step 6: Persist Segmentation Map

Save the complete segmentation map to the knowledge store for downstream consumers.

**Tool:** `mcp__mcp-graph__write_memory`
- Category: `audio_segmentation`
- Content: full segment list with timestamps, labels, speakers, and confidence scores
- Tags: recording ID, segmentation method, segment count, total duration

### Step 7: Finalize

Mark the segmentation task as complete and verify all outputs are properly linked.

**Tool:** `mcp__mcp-graph__analyze`
- Mode: `implement_done`
- Verify: all segments cataloged, nodes created for actionable segments, no audio gaps

## Output Format

```json
{
  "segmentation": {
    "file": "sprint-planning-2026-04-10.wav",
    "duration_seconds": 5400,
    "method": "hybrid_silence_speaker_semantic",
    "segments": [
      {
        "id": "seg-001",
        "start": 0,
        "end": 420,
        "topic": "Sprint Goals Review",
        "type": "presentation",
        "speakers": ["Speaker_1"],
        "confidence": 0.92,
        "keywords": ["goals", "velocity", "capacity"]
      },
      {
        "id": "seg-002",
        "start": 420,
        "end": 1200,
        "topic": "Backlog Prioritization",
        "type": "discussion",
        "speakers": ["Speaker_1", "Speaker_2", "Speaker_3"],
        "confidence": 0.87,
        "keywords": ["priority", "dependencies", "estimation"]
      },
      {
        "id": "seg-003",
        "start": 1200,
        "end": 1800,
        "topic": "Risk Assessment",
        "type": "discussion",
        "speakers": ["Speaker_2", "Speaker_4"],
        "confidence": 0.85,
        "keywords": ["risk", "blocker", "mitigation"]
      }
    ],
    "total_segments": 8,
    "avg_segment_duration": 675,
    "boundary_method_weights": {
      "silence": 0.3,
      "speaker_turn": 0.35,
      "semantic": 0.35
    }
  },
  "graph_nodes_created": ["node-seg-001", "node-seg-002", "node-seg-003"],
  "knowledge_entry_id": "ke-seg-789"
}
```

## Anti-Patterns

- Do NOT segment audio into fixed-duration chunks without considering content boundaries
- Do NOT create graph nodes for every segment; only actionable or discussion segments warrant nodes
- Do NOT rely solely on silence detection for topic segmentation; topics can change without pauses
- Do NOT split segments mid-word or mid-sentence when transcript alignment is available
- Do NOT discard short segments (under 10 seconds) without inspection; they may contain key decisions
- Do NOT process audio longer than 4 hours without chunking into preliminary blocks first
- Do NOT ignore overlapping speech regions during boundary detection; they often indicate topic shifts
