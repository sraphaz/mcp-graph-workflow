---
name: graph-audio-noise-reducer
description: Automatic noise, echo, and interference cleanup for audio recordings before downstream processing
triggers:
  - graph-audio-noise-reducer
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-audio-noise-reducer

Cleans audio recordings by removing background noise, echo, reverb, and other interference artifacts. Produces high-quality audio suitable for transcription, sentiment analysis, and archival. All processing steps are tracked in the execution graph for reproducibility and audit trails.

## When to Use

- When audio recordings have background noise that degrades transcription accuracy
- When echo or reverb from conference rooms needs to be removed before analysis
- When multiple audio sources need consistent quality normalization
- When preparing audio for speaker diarization where clean signals improve accuracy
- When archiving recordings that require a minimum signal-to-noise ratio standard

## Mandatory Flow

```
analyze(audio_quality_assessment) → profile_noise → apply_reduction → validate_quality → write_memory(processing log) → analyze(implement_done)
```

## Workflow

### Step 1: Audio Quality Assessment

Analyze the input audio to characterize the types and severity of noise present. This informs the selection of appropriate reduction algorithms.

**Tool:** `mcp__mcp-graph__analyze`
- Mode: `progress`
- Measure signal-to-noise ratio (SNR) of the original file
- Identify noise types: stationary (fan, hum), non-stationary (typing, coughing), echo, clipping
- Determine frequency profile of the noise floor
- Check for channel imbalances in stereo recordings
- Log the assessment results for before/after comparison

### Step 2: Noise Profile Generation

Build a noise profile from identified noise segments:

- Detect silence or noise-only segments (no speech activity detected)
- Extract spectral characteristics of the noise floor from these segments
- Build a statistical noise model (mean, variance per frequency band)
- For echo reduction, estimate room impulse response from known speech patterns
- Store the noise profile for reproducible processing

### Step 3: Algorithm Selection and Configuration

Choose the appropriate noise reduction pipeline based on the assessment:

- **Spectral subtraction**: for stationary broadband noise (HVAC, electrical hum)
- **Wiener filtering**: for non-stationary noise with moderate SNR
- **Deep learning denoiser**: for complex noise environments with overlapping spectra
- **Echo cancellation**: adaptive filtering for room echo and reverb
- **De-clipping**: for recordings with amplitude saturation
- Configure aggressiveness levels to balance noise removal vs speech preservation

### Step 4: Apply Noise Reduction Pipeline

Execute the selected algorithms in the correct order:

- Apply high-pass filter to remove sub-60Hz rumble
- Run primary noise reduction (spectral subtraction or neural denoiser)
- Apply echo cancellation if room reverb was detected
- Normalize audio levels to target loudness (LUFS standard)
- Apply de-clipping if saturation was detected
- Resample to target sample rate if needed (16kHz for transcription, 44.1kHz for archival)

### Step 5: Quality Validation

Compare the processed audio against the original to ensure noise reduction improved quality without degrading speech.

- Measure SNR improvement (target: minimum 10dB improvement)
- Run speech activity detection to verify no speech segments were removed
- Check for artifacts introduced by processing (musical noise, hollow sound)
- Compare spectrograms of original vs processed audio
- If quality degraded in any segment, reprocess with less aggressive settings

### Step 6: Generate Processing Report

Document the entire processing pipeline for reproducibility and audit purposes.

**Tool:** `mcp__mcp-graph__write_memory`
- Category: `audio_processing`
- Content: processing parameters, SNR before/after, algorithms used, quality metrics
- Tags: source file, processing date, noise types, quality score
- Include spectral comparison data for visual review

### Step 7: Finalize and Link Outputs

Mark the noise reduction task as complete and link the cleaned audio to downstream tasks.

**Tool:** `mcp__mcp-graph__analyze`
- Mode: `implement_done`
- Verify: output file exists, SNR meets threshold, no speech degradation detected
- Link cleaned audio file reference to dependent transcription or analysis nodes

## Output Format

```json
{
  "noise_reduction": {
    "input": {
      "file": "meeting-raw-2026-04-10.wav",
      "duration_seconds": 3600,
      "snr_db": 12.5,
      "noise_types": ["hvac", "keyboard", "room_echo"],
      "sample_rate": 44100
    },
    "output": {
      "file": "meeting-clean-2026-04-10.wav",
      "snr_db": 28.3,
      "sample_rate": 44100,
      "size_bytes": 63504000
    },
    "pipeline": [
      { "step": "highpass_filter", "cutoff_hz": 60 },
      { "step": "spectral_subtraction", "aggressiveness": 0.7 },
      { "step": "echo_cancellation", "tail_ms": 200 },
      { "step": "loudness_normalization", "target_lufs": -16 }
    ],
    "quality_metrics": {
      "snr_improvement_db": 15.8,
      "speech_preserved_pct": 99.7,
      "artifacts_detected": false,
      "processing_time_ms": 45000
    }
  },
  "graph_node_id": "node-denoise-789",
  "knowledge_entry_id": "ke-denoise-012"
}
```

## Anti-Patterns

- Do NOT apply maximum aggressiveness noise reduction by default; it destroys speech quality
- Do NOT skip the quality validation step, even for short recordings
- Do NOT process audio without first profiling the noise; blind reduction introduces artifacts
- Do NOT overwrite original audio files; always write to a new output path for rollback capability
- Do NOT apply echo cancellation to recordings without detected echo; it degrades clean audio
- Do NOT ignore clipping artifacts in the source; de-clip before applying other processing
- Do NOT assume a single algorithm works for all noise types; use the assessment to select the pipeline
