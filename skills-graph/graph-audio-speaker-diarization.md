---
name: graph-audio-speaker-diarization
description: Multi-speaker identification and labeling to determine who speaks when in audio recordings
triggers:
  - graph-audio-speaker-diarization
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-audio-speaker-diarization

Identifies and labels individual speakers throughout an audio recording, producing a timeline of who speaks when. Supports known speaker enrollment and unknown speaker clustering, with results persisted in the knowledge store for downstream transcription, attribution, and meeting analytics.

## When to Use

- When meeting recordings need per-speaker attribution for accurate minutes and action item assignment
- When multi-speaker transcripts require speaker labels for readability and accountability
- When analyzing speaking time distribution to assess meeting participation balance
- When building speaker profiles for recurring participants across multiple recordings
- When voice-based identification is needed to correlate speakers with graph node assignees
- When preparing audio for sentiment analysis that requires per-speaker emotional tracking

## Mandatory Flow

```
search(speaker profiles) → analyze(audio_structure) → extract_embeddings → cluster_speakers → label_speakers → write_memory(diarization results) → analyze(implement_done)
```

## Workflow

### Step 1: Search for Known Speaker Profiles

Check the knowledge store for previously enrolled speaker voiceprints that can be used for identification.

**Tool:** `mcp__mcp-graph__search`
- Query: speaker profiles, voice embeddings, participant names
- Retrieve enrolled speaker models from previous diarization runs
- Identify expected participants from meeting metadata or calendar context

### Step 2: Audio Structure Analysis

Analyze the recording to understand its structure and estimate the number of speakers.

**Tool:** `mcp__mcp-graph__analyze`
- Mode: `progress`
- Estimate speaker count using clustering metrics (silhouette score, BIC)
- Detect speech and non-speech regions using voice activity detection (VAD)
- Identify overlapping speech regions where multiple speakers talk simultaneously
- Measure recording quality and determine if it supports reliable diarization

### Step 3: Speaker Embedding Extraction

Extract speaker-discriminative embeddings from speech segments:

- Apply voice activity detection to isolate speech-only regions
- Extract fixed-length speaker embeddings (d-vectors or x-vectors) from each speech segment
- Use a sliding window approach (1.5s window, 0.75s hop) for fine-grained temporal resolution
- Filter out segments with low signal quality or excessive overlap
- Normalize embeddings for clustering compatibility

### Step 4: Speaker Clustering

Group embeddings into speaker clusters:

- Apply spectral clustering or agglomerative clustering on the embedding space
- Use the estimated speaker count from Step 2 as a prior (allow flexibility of plus or minus one)
- Handle edge cases: single-speaker recordings, very short utterances, speaker changes mid-word
- Refine cluster boundaries using Viterbi re-segmentation for temporal consistency
- Calculate cluster purity metrics and merge or split clusters as needed

### Step 5: Speaker Labeling and Identification

Assign human-readable labels to each speaker cluster:

- Compare cluster centroids against enrolled speaker profiles from Step 1
- For matched speakers, assign their known name or identifier
- For unmatched speakers, assign sequential labels (Speaker_1, Speaker_2, etc.)
- Calculate match confidence scores for enrolled speaker identification
- Generate a speaker timeline with start/end timestamps for each speaking turn

### Step 6: Speaking Time Analytics

Compute per-speaker statistics for meeting analytics:

- Total speaking time per speaker (absolute and percentage)
- Number of speaking turns per speaker
- Average turn duration per speaker
- Interruption count (speaker changes within 0.5s overlap)
- Silence distribution between speakers
- Speaking rate estimates per speaker (if transcript available)

### Step 7: Persist Diarization Results

Save the complete diarization output and speaker profiles to the knowledge store.

**Tool:** `mcp__mcp-graph__write_memory`
- Category: `speaker_diarization`
- Content: speaker timeline, per-speaker statistics, cluster quality metrics
- Tags: recording ID, speaker count, enrolled matches, diarization method
- Optionally update or create speaker enrollment profiles for future use

### Step 8: Finalize and Validate

Complete the diarization task and verify output quality.

**Tool:** `mcp__mcp-graph__analyze`
- Mode: `implement_done`
- Verify: all speech regions assigned a speaker, no gaps in timeline, quality metrics above threshold
- Ensure diarization results are linked to downstream transcription or analysis nodes

## Output Format

```json
{
  "diarization": {
    "file": "standup-2026-04-10.wav",
    "duration_seconds": 900,
    "speaker_count": 4,
    "method": "spectral_clustering_xvector",
    "speakers": [
      {
        "id": "Speaker_1",
        "enrolled_name": "Alice",
        "match_confidence": 0.94,
        "speaking_time_seconds": 280,
        "speaking_time_pct": 31.1,
        "turn_count": 12,
        "avg_turn_duration": 23.3
      },
      {
        "id": "Speaker_2",
        "enrolled_name": null,
        "match_confidence": null,
        "speaking_time_seconds": 240,
        "speaking_time_pct": 26.7,
        "turn_count": 15,
        "avg_turn_duration": 16.0
      }
    ],
    "timeline": [
      { "start": 0.0, "end": 15.2, "speaker": "Speaker_1" },
      { "start": 15.5, "end": 32.8, "speaker": "Speaker_2" },
      { "start": 33.0, "end": 48.1, "speaker": "Speaker_3" },
      { "start": 48.5, "end": 65.0, "speaker": "Speaker_4" }
    ],
    "overlap_segments": 8,
    "overlap_duration_seconds": 12.5,
    "diarization_error_rate": 0.08
  },
  "graph_node_id": "node-diar-456",
  "knowledge_entry_id": "ke-diar-789"
}
```

## Anti-Patterns

- Do NOT assume a fixed number of speakers without running estimation first
- Do NOT diarize audio with SNR below 5dB without preprocessing through noise reduction
- Do NOT discard overlapping speech regions; flag them and assign to the dominant speaker
- Do NOT enroll speaker profiles without explicit consent or privacy policy compliance
- Do NOT treat diarization labels as ground truth; always report diarization error rate (DER)
- Do NOT skip re-segmentation refinement; raw clustering boundaries are often noisy at edges
- Do NOT run diarization on audio shorter than 30 seconds; insufficient data for reliable clustering
