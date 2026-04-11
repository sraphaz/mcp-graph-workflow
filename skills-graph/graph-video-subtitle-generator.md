---
name: graph-video-subtitle-generator
description: Automatic subtitle generation with multilingual support and format export
triggers:
  - graph-video-subtitle-generator
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-video-subtitle-generator

Generates accurate, timed subtitles from video content with multilingual translation support. Produces industry-standard subtitle formats (SRT, VTT, ASS) with configurable styling, line breaking, and reading speed optimization. Subtitle metadata is persisted to the knowledge store for searchability and RAG retrieval.

## When to Use

- When video content needs subtitles for accessibility compliance
- When distributing video recordings to multilingual teams or stakeholders
- When creating training or onboarding videos that require localized subtitles
- When improving searchability of video content through indexed subtitle text
- When preparing demo videos for external audiences that need professional captioning
- When existing auto-generated subtitles need quality improvement and proper timing

## Mandatory Flow

```
rag_context → [subtitle generation pipeline] → analyze → write_memory
```

## Workflow

### Step 1: Load Domain Context

Retrieve domain-specific terminology, project names, and technical vocabulary to improve transcription accuracy for subtitle generation.

**Tool:** `mcp__mcp-graph__rag_context`

```
rag_context({ nodeId: "<task-node-id>", includeKnowledge: true, includeHistory: true })
```

### Step 2: Generate or Load Base Transcript

Produce a high-quality timestamped transcript as the foundation for subtitles. If a transcript already exists from a previous `graph-video-transcriber` run, load it directly.

Key requirements for subtitle-ready transcripts:
- **Word-level timestamps**: Required for precise subtitle timing
- **Punctuation**: Proper sentence boundaries for natural line breaks
- **Speaker labels**: Needed for multi-speaker subtitle attribution

### Step 3: Segment Text into Subtitle Cues

Convert the continuous transcript into discrete subtitle cues:

- **Character limits**: Maximum 42 characters per line, 2 lines per cue
- **Reading speed**: Target 15-20 characters per second for comfortable reading
- **Minimum duration**: No cue shorter than 1 second
- **Maximum duration**: No cue longer than 7 seconds
- **Line breaking**: Break at natural linguistic boundaries (clauses, phrases)
- **Gap timing**: Minimum 200ms gap between consecutive cues

### Step 4: Apply Styling and Formatting

Configure subtitle presentation:

- **Font and size**: Configurable based on target platform
- **Position**: Bottom-center default, adjustable for content that uses lower screen area
- **Speaker identification**: Color coding or name prefixes for multi-speaker content
- **Emphasis**: Italic for off-screen speech, bold for emphasis
- **Sound descriptions**: Bracketed descriptions for non-speech audio ([applause], [music])

### Step 5: Translate to Target Languages

For multilingual subtitle generation:

- **Source language detection**: Auto-detect if not specified
- **Translation**: Translate subtitle cues while preserving timing constraints
- **Timing adjustment**: Re-time translated cues to account for language length differences
- **Cultural adaptation**: Adjust idioms and references for target locale
- **Technical terms**: Preserve project-specific terms from the domain context loaded in Step 1

Supported output languages are configured per project.

### Step 6: Quality Validation

Run analysis to verify subtitle quality meets standards.

**Tool:** `mcp__mcp-graph__analyze`

```
analyze({ mode: "implement_done", nodeId: "<task-node-id>" })
```

Validate:
- Reading speed is within the 15-20 CPS range for all cues
- No overlapping cue timestamps
- Line lengths do not exceed the 42-character maximum
- All speaker changes are properly attributed
- Translation accuracy for key technical terms

### Step 7: Export Subtitle Files

Generate subtitle files in requested formats:

- **SRT**: SubRip Text -- most widely supported
- **VTT**: WebVTT -- standard for web video players
- **ASS**: Advanced SubStation Alpha -- supports advanced styling

### Step 8: Persist Subtitle Metadata

Store subtitle metadata and text content for knowledge store indexing.

**Tool:** `mcp__mcp-graph__write_memory`

```
write_memory({
  type: "insight",
  category: "video-subtitles",
  content: "<structured JSON with subtitle metadata, cue count, languages, quality scores>"
})
```

## Output Format

```json
{
  "subtitle_id": "sub-<timestamp>",
  "source": {
    "video": "<video-filename>",
    "duration_seconds": 1800,
    "nodeId": "<task-node-id>"
  },
  "primary_language": "en",
  "translations": ["es", "pt-BR", "fr"],
  "format_exports": ["srt", "vtt"],
  "cue_statistics": {
    "total_cues": 245,
    "avg_duration_seconds": 3.2,
    "avg_chars_per_second": 17.4,
    "max_chars_per_line": 42,
    "speaker_count": 3,
    "reading_speed_violations": 0
  },
  "cues_sample": [
    {
      "index": 1,
      "start": "00:00:01.200",
      "end": "00:00:04.800",
      "text": "Welcome to the sprint 14\nreview session.",
      "speaker": "Speaker_1",
      "chars_per_second": 16.1
    }
  ],
  "quality": {
    "timing_accuracy": 0.97,
    "overlap_count": 0,
    "line_length_violations": 0,
    "reading_speed_compliance": 1.0
  },
  "persisted": true
}
```

## Anti-Patterns

- Do NOT generate subtitles without loading domain context via `rag_context` -- technical terms need project-specific vocabulary
- Do NOT exceed 42 characters per line -- long lines are unreadable on most displays
- Do NOT set cue durations below 1 second -- viewers cannot read flash subtitles
- Do NOT skip reading speed validation -- subtitles faster than 20 CPS cause comprehension failure
- Do NOT translate subtitles without preserving technical terms from the domain context
- Do NOT generate subtitles without speaker attribution for multi-speaker content -- unlabeled dialogue is confusing
- Do NOT persist subtitle data without running `analyze` -- quality validation prevents publishing unreadable subtitles
