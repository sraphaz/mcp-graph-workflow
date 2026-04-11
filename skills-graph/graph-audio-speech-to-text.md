---
name: graph-audio-speech-to-text
description: Automatic audio transcription with multi-language and multi-speaker support using Whisper ONNX local inference
triggers:
  - graph-audio-speech-to-text
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-audio-speech-to-text

Transcribes audio files into structured text using local Whisper ONNX models, supporting multiple languages and speaker identification. The resulting transcription is indexed into the knowledge store and linked to the corresponding graph node for full traceability.

## When to Use

- When you have audio recordings (meetings, interviews, voice notes) that need to be converted to text
- When multi-language transcription is required with automatic language detection
- When speaker-labeled transcripts are needed for downstream processing
- When transcription results must be persisted in the execution graph as knowledge artifacts
- When building a searchable knowledge base from audio content
- When voice-based input needs to be converted into actionable graph nodes

## Mandatory Flow

```
analyze(audio_inventory) → node(add transcription task) → transcribe_audio → segment_by_speaker → write_memory(transcription result) → rag_context(index transcript) → analyze(implement_done)
```

## Workflow

### Step 1: Audio Inventory Analysis

Analyze the available audio files, their formats, durations, and language hints. Validate that the audio is in a supported format (WAV, MP3, OGG, FLAC, M4A).

**Tool:** `mcp__mcp-graph__analyze`
- Mode: `progress`
- Verify existing transcription nodes to avoid duplicate work
- Check for previously transcribed segments in the knowledge store

### Step 2: Create Transcription Node

Create a graph node representing the transcription task. Link it to the parent epic or feature node via a dependency edge.

**Tool:** `mcp__mcp-graph__node`
- Action: `add`
- Type: `task`
- Title: `Transcribe: {audio_file_name}`
- Include metadata: file path, duration, estimated language, speaker count

### Step 3: Load Existing Context

Pull any existing transcription context, related knowledge entries, and speaker profiles from the RAG pipeline.

**Tool:** `mcp__mcp-graph__rag_context`
- Query: audio file identifier and related topic keywords
- Use results to inform language model selection and speaker identification

### Step 4: Execute Transcription

Run the Whisper ONNX local inference pipeline on the audio file. Configure parameters based on context from previous steps.

- Select model size (tiny, base, small, medium, large) based on audio quality and duration
- Enable automatic language detection or force a specific language
- Set beam search width for accuracy vs speed tradeoff
- Process in chunks for files longer than 30 minutes
- Generate word-level timestamps for precise alignment

### Step 5: Post-Process Transcription

Clean and structure the raw transcription output:

- Normalize punctuation and capitalization
- Merge fragmented sentences across chunk boundaries
- Apply speaker labels from diarization (if available)
- Generate paragraph breaks based on topic shifts and silence gaps
- Create a structured JSON output with timestamps, speaker IDs, and confidence scores

### Step 6: Persist Results to Knowledge Store

Save the transcription as a knowledge entry linked to the graph node. Index the full text for RAG retrieval.

**Tool:** `mcp__mcp-graph__write_memory`
- Category: `transcription`
- Content: structured transcription with metadata
- Tags: language, speakers, duration, source file

### Step 7: Validate and Complete

Verify transcription quality metrics (word error rate estimate, confidence scores) and mark the task as complete.

**Tool:** `mcp__mcp-graph__analyze`
- Mode: `implement_done`
- Validate: transcription coverage, speaker identification accuracy, language detection correctness

## Output Format

```json
{
  "transcription": {
    "file": "meeting-2026-04-10.wav",
    "language": "en",
    "duration_seconds": 3600,
    "model": "whisper-large-v3",
    "segments": [
      {
        "start": 0.0,
        "end": 4.5,
        "speaker": "Speaker_1",
        "text": "Welcome to the sprint planning meeting.",
        "confidence": 0.97
      },
      {
        "start": 4.8,
        "end": 9.2,
        "speaker": "Speaker_2",
        "text": "Thanks. Let's start with the backlog review.",
        "confidence": 0.95
      }
    ],
    "word_count": 8500,
    "speaker_count": 4,
    "avg_confidence": 0.94
  },
  "graph_node_id": "node-abc123",
  "knowledge_entry_id": "ke-def456"
}
```

## Anti-Patterns

- Do NOT transcribe audio without first creating a graph node to track the work
- Do NOT skip language detection and assume a default language for multi-language content
- Do NOT process files larger than 2GB without chunking into manageable segments
- Do NOT discard low-confidence segments silently; flag them for human review
- Do NOT store raw audio blobs in the knowledge store; store only transcription text and metadata
- Do NOT ignore speaker diarization when multiple speakers are present in the recording
- Do NOT run transcription without checking if a previous transcription already exists for the same file
