---
name: graph-video-transcriber
description: Full video transcription with synchronized timestamps and graph-persisted segments
triggers:
  - graph-video-transcriber
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-video-transcriber

Performs full video transcription with synchronized timestamps, speaker diarization, and segment-level indexing. Transcription output is persisted as structured knowledge entries in the graph, enabling downstream RAG queries, search, and cross-referencing with task nodes.

## When to Use

- When a video recording (meeting, demo, walkthrough) needs a full text transcript for documentation
- When you need searchable, timestamped text segments from video content for the knowledge store
- When building a knowledge base from video assets and need structured transcript data
- When preparing context for task nodes that reference video recordings as source material
- When speaker-attributed transcripts are needed for action item extraction downstream
- When onboarding materials exist only as video and need to be indexed for RAG retrieval

## Mandatory Flow

```
node → rag_context → [transcription pipeline] → analyze → write_memory
```

## Workflow

### Step 1: Create or Locate the Task Node

Ensure a graph node exists for the transcription task. Every transcription job must be tracked in the execution graph.

**Tool:** `mcp__mcp-graph__node`

```
node({ action: "add", name: "Transcribe video: <video-name>", type: "task", status: "in_progress" })
```

If the node already exists, locate it:

**Tool:** `mcp__mcp-graph__search`

```
search({ query: "transcribe <video-name>", limit: 5 })
```

### Step 2: Load Contextual Knowledge

Retrieve any existing knowledge related to the video content, speakers, or domain to improve transcription accuracy and segment labeling.

**Tool:** `mcp__mcp-graph__rag_context`

```
rag_context({ nodeId: "<task-node-id>", includeKnowledge: true, includeHistory: true })
```

### Step 3: Extract Audio and Run Transcription

Process the video file to extract the audio track and run speech-to-text:

- **Audio extraction**: Separate audio from video container (MP4, WebM, MKV)
- **Speech-to-text**: Generate raw transcript with word-level timestamps
- **Speaker diarization**: Identify and label distinct speakers throughout the recording
- **Language detection**: Auto-detect primary language; flag multilingual segments

Produce a timestamped transcript with speaker labels and confidence scores per segment.

### Step 4: Segment and Structure the Transcript

Break the raw transcript into logical segments:

- **Time-based segments**: Fixed intervals (e.g., 30-second chunks) for indexing
- **Semantic segments**: Topic-shift detection to create meaningful boundaries
- **Speaker turns**: Segment boundaries at speaker changes
- **Silence gaps**: Mark pauses longer than 3 seconds as segment boundaries

Each segment gets a unique ID, start/end timestamps, speaker label, and text content.

### Step 5: Validate Transcript Quality

Run quality checks on the generated transcript:

- **Confidence thresholds**: Flag segments with average confidence below 0.7
- **Missing audio**: Identify gaps where no speech was detected
- **Speaker consistency**: Verify diarization labels are consistent across the recording
- **Technical terms**: Cross-reference extracted terms with the project knowledge base

**Tool:** `mcp__mcp-graph__analyze`

```
analyze({ mode: "implement_done", nodeId: "<task-node-id>" })
```

### Step 6: Persist Transcript to Knowledge Store

Store the structured transcript as knowledge entries for RAG retrieval and search.

**Tool:** `mcp__mcp-graph__write_memory`

```
write_memory({
  type: "insight",
  category: "video-transcript",
  content: "<structured JSON with segments, timestamps, speakers, confidence>"
})
```

Link the transcript knowledge entry to the originating task node for traceability.

## Output Format

```json
{
  "transcript_id": "vt-<timestamp>",
  "source": {
    "video": "<video-filename>",
    "duration_seconds": 1842,
    "format": "mp4",
    "nodeId": "<task-node-id>"
  },
  "metadata": {
    "language": "en",
    "speakers_detected": 3,
    "total_segments": 47,
    "avg_confidence": 0.89
  },
  "segments": [
    {
      "id": "seg-001",
      "start": "00:00:00.000",
      "end": "00:00:32.450",
      "speaker": "Speaker_1",
      "text": "Welcome to the sprint review. Let me share the progress on the dashboard.",
      "confidence": 0.94
    }
  ],
  "low_confidence_flags": [
    {
      "segment_id": "seg-023",
      "confidence": 0.61,
      "reason": "overlapping speakers"
    }
  ],
  "persisted": true
}
```

## Anti-Patterns

- Do NOT start transcription without creating a task node in the graph -- all work must be tracked
- Do NOT skip `rag_context` before transcription -- domain context improves technical term accuracy
- Do NOT persist raw unstructured transcript text -- always segment and structure with timestamps
- Do NOT ignore low-confidence segments -- flag them for human review rather than discarding
- Do NOT treat speaker diarization as optional -- unattributed speech loses critical context
- Do NOT run transcription on excessively long videos without chunking -- process in segments to manage memory
- Do NOT skip the `analyze` step -- validation ensures the transcript meets quality thresholds before persistence
