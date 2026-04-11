---
name: graph-video-multimodal-integrator
description: Full multimodal fusion of video, audio, text, and computer vision for enriched RAG indexing
triggers:
  - graph-video-multimodal-integrator
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-video-multimodal-integrator

Performs full multimodal fusion across video, audio, text, and computer vision channels to produce enriched, unified representations for RAG indexing. Combines transcript text, visual features, audio analysis, and OCR output into a single knowledge structure that enables cross-modal search and retrieval from the graph knowledge store.

## When to Use

- When video content contains critical information across multiple modalities (speech, slides, demos, annotations)
- When building a comprehensive knowledge base that must be searchable across text, visual, and audio dimensions
- When a single-modality approach (transcript-only or frame-only) misses important context
- When preparing enriched RAG entries that need to answer questions requiring cross-modal understanding
- When indexing tutorial or training videos where visual demonstrations complement verbal explanations
- When maximizing knowledge extraction from high-value video recordings

## Mandatory Flow

```
rag_context → [multimodal fusion pipeline] → knowledge_stats → analyze → write_memory
```

## Workflow

### Step 1: Load Existing Knowledge Context

Retrieve current knowledge store state and related content to avoid redundant processing and inform fusion decisions.

**Tool:** `mcp__mcp-graph__rag_context`

```
rag_context({ nodeId: "<task-node-id>", includeKnowledge: true, includeHistory: true })
```

### Step 2: Check Knowledge Store Capacity

Assess current knowledge store statistics to plan indexing strategy.

**Tool:** `mcp__mcp-graph__knowledge_stats`

```
knowledge_stats({})
```

Determine available capacity, existing video-derived entries, and optimal chunking strategy for the new content.

### Step 3: Extract Text Modality

Generate or load the text representation of the video:

- **Speech transcript**: Full timestamped transcript with speaker labels
- **OCR text**: Text extracted from visual frames (slides, UI text, annotations, code)
- **Chat/caption text**: Any embedded text overlays, closed captions, or chat messages
- **Metadata text**: Title, description, tags, and other metadata fields

Produce a unified text stream with timestamp alignment and source attribution.

### Step 4: Extract Visual Modality

Generate the visual representation:

- **Key frames**: Intelligent frame extraction at scene boundaries and content peaks
- **Object detection**: Identify UI components, diagrams, people, and artifacts in frames
- **Layout analysis**: Detect screen regions (code editor, terminal, browser, slides)
- **Visual embeddings**: Generate dense vector representations for visual similarity search
- **Color and style features**: Extract dominant colors, layout patterns, and visual themes

### Step 5: Extract Audio Modality

Generate the audio representation beyond speech:

- **Speech prosody**: Emphasis, pacing, and intonation patterns indicating importance
- **Non-speech audio**: Music, sound effects, notification sounds, silence patterns
- **Emotional tone**: Voice emotion classification (confident, uncertain, excited, frustrated)
- **Audio quality metrics**: Signal-to-noise ratio, clipping, background noise levels

### Step 6: Cross-Modal Alignment and Fusion

Align and fuse all modalities into unified multimodal segments:

- **Temporal alignment**: Synchronize text, visual, and audio streams by timestamp
- **Semantic alignment**: Link transcript mentions to visual elements showing the same concept
- **Complementary fusion**: Combine information from modalities that provide unique content
- **Redundancy reduction**: Deduplicate information present in multiple modalities
- **Confidence boosting**: Increase confidence when multiple modalities agree on the same content

Produce fused segments where each segment contains:
- Combined text (speech + OCR)
- Representative visual frame
- Audio features
- Cross-modal confidence score

### Step 7: Generate Enriched RAG Entries

Convert fused multimodal segments into RAG-indexable knowledge entries:

- **Chunk text**: Create searchable text chunks combining all textual content per segment
- **Metadata enrichment**: Attach visual descriptions, audio features, and cross-modal scores
- **Query anchors**: Generate likely query patterns that this segment could answer
- **Citation mapping**: Map each piece of information to its source modality and timestamp

### Step 8: Validate Fusion Quality

Run analysis to verify the multimodal fusion produced coherent, high-quality entries.

**Tool:** `mcp__mcp-graph__analyze`

```
analyze({ mode: "implement_done", nodeId: "<task-node-id>" })
```

Verify:
- All modalities are represented in the fused output
- Cross-modal alignment timestamps are consistent
- No significant content was lost during fusion
- RAG entry quality scores meet minimum thresholds

### Step 9: Persist Multimodal Knowledge

Store the fused multimodal knowledge entries for RAG retrieval.

**Tool:** `mcp__mcp-graph__write_memory`

```
write_memory({
  type: "insight",
  category: "multimodal-video-knowledge",
  content: "<structured JSON with fused segments, modality sources, confidence scores, RAG entries>"
})
```

## Output Format

```json
{
  "fusion_id": "mm-<timestamp>",
  "source": {
    "video": "<video-filename>",
    "duration_seconds": 2400,
    "nodeId": "<task-node-id>"
  },
  "modalities_processed": {
    "text": { "transcript_segments": 156, "ocr_frames": 42 },
    "visual": { "key_frames": 38, "objects_detected": 215 },
    "audio": { "speech_segments": 156, "non_speech_events": 12 }
  },
  "fused_segments": [
    {
      "id": "fused-001",
      "start": "00:00:00.000",
      "end": "00:00:45.200",
      "text_combined": "Welcome to the architecture review. As you can see on the diagram, the event bus connects all three services.",
      "visual_description": "Architecture diagram showing EventBus with arrows to ServiceA, ServiceB, ServiceC",
      "audio_features": { "tone": "confident", "emphasis_words": ["event bus", "three services"] },
      "cross_modal_confidence": 0.94,
      "modality_sources": ["transcript", "ocr", "visual", "audio"]
    }
  ],
  "rag_entries_created": 52,
  "knowledge_store_delta": {
    "entries_before": 1240,
    "entries_after": 1292,
    "storage_increase_kb": 384
  },
  "persisted": true
}
```

## Anti-Patterns

- Do NOT index video content using a single modality -- transcript-only misses visual content, frames-only miss speech context
- Do NOT skip cross-modal alignment -- unaligned modalities produce incoherent RAG entries
- Do NOT ignore audio prosody -- emphasis and tone carry semantic weight not present in flat text
- Do NOT create RAG entries without checking `knowledge_stats` first -- oversized indexes degrade search performance
- Do NOT fuse modalities without redundancy reduction -- duplicated information inflates the index without adding value
- Do NOT persist multimodal entries without running `analyze` -- validation ensures fusion coherence
- Do NOT treat all video segments as equally important for indexing -- prioritize segments with high cross-modal confidence
