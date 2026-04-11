---
name: graph-audio-text-to-speech
description: Text-to-audio generation for reports, feedback, documentation, and notification delivery
triggers:
  - graph-audio-text-to-speech
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-audio-text-to-speech

Generates natural-sounding audio from text content such as reports, feedback summaries, documentation, and status updates. Supports multiple voices, languages, and output formats, with full traceability through the execution graph.

## When to Use

- When project reports or sprint summaries need to be delivered as audio for async consumption
- When documentation needs an audio companion for accessibility compliance
- When voice notifications or feedback need to be generated from graph data
- When handoff summaries should be available in audio format for stakeholders
- When generating audio previews of content before final publication

## Mandatory Flow

```
analyze(content_inventory) → export(text content) → synthesize_audio → validate_output → write_memory(audio artifact) → analyze(implement_done)
```

## Workflow

### Step 1: Content Analysis and Preparation

Analyze the source text content to determine optimal synthesis parameters: language, tone, pacing, and voice selection.

**Tool:** `mcp__mcp-graph__analyze`
- Mode: `progress`
- Identify the content type (report, documentation, feedback, notification)
- Determine target audience and appropriate voice characteristics
- Check for special content (code blocks, URLs, abbreviations) that need preprocessing

### Step 2: Export Source Content

Extract the text content from the graph that needs to be converted to audio. This may include sprint reports, node descriptions, handoff summaries, or documentation.

**Tool:** `mcp__mcp-graph__export`
- Format: `markdown` or `text`
- Filter by node type, status, or date range as appropriate
- Collect all text segments in reading order

### Step 3: Text Preprocessing

Prepare the raw text for optimal speech synthesis:

- Expand abbreviations and acronyms (e.g., "PR" to "pull request")
- Convert code references to natural language descriptions
- Add SSML markup for emphasis, pauses, and pronunciation hints
- Split long documents into logical chapters or sections
- Normalize numbers, dates, and technical terms for natural reading

### Step 4: Voice Selection and Configuration

Configure the TTS engine parameters:

- Select voice profile (gender, accent, style) matching the content type
- Set speech rate (words per minute) appropriate for the audience
- Configure pitch and emphasis patterns
- Enable prosody adjustments for natural-sounding delivery
- Set output format (MP3, WAV, OGG) and quality (bitrate, sample rate)

### Step 5: Audio Synthesis

Execute the text-to-speech synthesis pipeline:

- Process each section sequentially with configured voice parameters
- Insert natural pauses between sections and paragraphs
- Generate chapter markers for long-form content
- Apply post-processing (normalization, compression, limiting)
- Concatenate sections into the final audio file

### Step 6: Quality Validation

Verify the generated audio meets quality standards:

- Check audio duration matches expected range for the text length
- Validate no silence gaps exceed 3 seconds (indicating synthesis failures)
- Verify file format and encoding match specifications
- Spot-check pronunciation of technical terms and proper nouns
- Ensure volume levels are consistent across sections

### Step 7: Persist Audio Metadata

Save the audio generation record to the knowledge store with full metadata for retrieval and traceability.

**Tool:** `mcp__mcp-graph__write_memory`
- Category: `audio_artifact`
- Content: file path, duration, voice profile, source node IDs
- Tags: content type, language, generation timestamp

### Step 8: Finalize and Report

Mark the synthesis task as complete and update the graph with the audio artifact reference.

**Tool:** `mcp__mcp-graph__analyze`
- Mode: `implement_done`
- Verify: audio file exists, metadata persisted, source content linked

## Output Format

```json
{
  "synthesis": {
    "source_type": "sprint_report",
    "source_nodes": ["node-abc123", "node-def456"],
    "voice": {
      "name": "en-US-Neural-F",
      "language": "en-US",
      "rate": 1.0,
      "pitch": "medium"
    },
    "output": {
      "file": "sprint-report-2026-04-10.mp3",
      "format": "mp3",
      "bitrate": "128kbps",
      "duration_seconds": 420,
      "size_bytes": 6720000
    },
    "chapters": [
      { "title": "Sprint Overview", "start": 0, "end": 60 },
      { "title": "Completed Tasks", "start": 60, "end": 240 },
      { "title": "Blockers and Risks", "start": 240, "end": 360 },
      { "title": "Next Sprint Preview", "start": 360, "end": 420 }
    ],
    "word_count": 3200,
    "processing_time_ms": 15000
  },
  "graph_node_id": "node-synth-789",
  "knowledge_entry_id": "ke-audio-012"
}
```

## Anti-Patterns

- Do NOT synthesize audio from raw markdown without preprocessing special syntax
- Do NOT use a single voice for all content types; match voice to audience and purpose
- Do NOT generate audio longer than 60 minutes without chapter markers
- Do NOT skip SSML preprocessing for content containing technical terms or acronyms
- Do NOT store generated audio without linking it back to the source graph nodes
- Do NOT re-synthesize unchanged content; cache audio artifacts and invalidate only on source changes
- Do NOT ignore accessibility requirements such as consistent volume and clear pronunciation
