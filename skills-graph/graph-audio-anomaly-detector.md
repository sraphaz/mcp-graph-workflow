---
name: graph-audio-anomaly-detector
description: Audio anomaly detection for identifying unusual patterns, noise events, and quality degradation
triggers:
  - graph-audio-anomaly-detector
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-audio-anomaly-detector

Detects anomalies in audio recordings and streams, including unexpected noise events, quality degradation, silence gaps, signal dropouts, and unusual acoustic patterns. Flags anomalies as graph nodes for investigation and tracks detection metrics over time for trend analysis.

## When to Use

- When monitoring audio recording quality across multiple sessions to detect equipment degradation
- When identifying unexpected events in long-duration recordings (alarms, interruptions, system sounds)
- When validating audio pipeline output for quality assurance before downstream processing
- When detecting silence gaps or signal dropouts that indicate recording failures
- When building an anomaly baseline for a recording environment to detect deviations
- When audio quality metrics need to be tracked and reported as part of project health dashboards

## Mandatory Flow

```
analyze(baseline profile) → extract_features → detect_anomalies → metrics(quality tracking) → node(add anomaly nodes) → write_memory(detection results) → analyze(implement_done)
```

## Workflow

### Step 1: Baseline Profile Analysis

Establish or load the acoustic baseline for the recording environment. Anomalies are defined as deviations from this baseline.

**Tool:** `mcp__mcp-graph__analyze`
- Mode: `progress`
- Load existing baseline profiles from the knowledge store if available
- If no baseline exists, analyze a reference recording to establish normal parameters
- Define thresholds for each anomaly type based on the baseline
- Check historical anomaly detection results for trend context

### Step 2: Feature Extraction

Extract a comprehensive set of acoustic features from the target audio at regular intervals:

- **Energy features**: RMS energy, peak amplitude, crest factor per frame
- **Spectral features**: spectral centroid, bandwidth, rolloff, flatness, MFCCs
- **Temporal features**: zero-crossing rate, autocorrelation, onset strength
- **Quality features**: signal-to-noise ratio, total harmonic distortion, clipping ratio
- **Silence features**: silence duration, silence frequency, voice activity ratio
- Use a frame size of 25ms with 10ms hop for fine-grained temporal resolution
- Compute statistics (mean, std, min, max, percentiles) over sliding windows of 5 seconds

### Step 3: Anomaly Detection

Apply multiple detection algorithms and fuse their outputs:

- **Statistical detection**: flag frames where features exceed 3 standard deviations from baseline mean
- **Isolation Forest**: unsupervised anomaly detection on the feature vector space
- **Change point detection**: identify abrupt shifts in feature distributions (CUSUM, PELT algorithms)
- **Pattern matching**: detect known anomaly signatures (clipping, dropout, feedback loop, codec artifacts)
- **Silence anomaly**: flag unexpected silence gaps longer than the environment baseline
- **Energy anomaly**: detect sudden volume spikes (impacts, feedback) or drops (mic muting, dropout)
- Compute an anomaly score for each detected event combining all detectors

### Step 4: Anomaly Classification

Classify each detected anomaly by type and severity:

- **Signal dropout**: complete loss of signal for more than 0.5 seconds
- **Clipping**: amplitude saturation causing distortion
- **Background noise event**: transient noise (door slam, phone ring, construction)
- **Feedback loop**: acoustic feedback detected via harmonic analysis
- **Codec artifact**: compression artifacts from poor network conditions
- **Equipment degradation**: gradual quality decline (increased noise floor, reduced frequency response)
- **Silence gap**: unexpected extended silence beyond normal conversation patterns
- Assign severity levels: critical (signal loss), warning (quality degradation), info (minor deviations)

### Step 5: Track Quality Metrics

Record detection metrics for longitudinal quality tracking.

**Tool:** `mcp__mcp-graph__metrics`
- Log anomaly counts by type and severity
- Track signal quality metrics over time (SNR trend, dropout frequency)
- Compare current session metrics against historical averages
- Calculate quality score for the overall recording

### Step 6: Create Anomaly Nodes

For critical and warning-level anomalies, create graph nodes for investigation and resolution.

**Tool:** `mcp__mcp-graph__node`
- Action: `add`
- Type: `task` (for critical anomalies requiring action) or `note` (for informational anomalies)
- Title: `Audio Anomaly: {anomaly_type} at {timestamp}`
- Description: anomaly details, severity, affected duration, recommended action
- Tags: anomaly type, severity, recording ID, detection method

### Step 7: Persist Detection Results

Save the complete anomaly detection report to the knowledge store.

**Tool:** `mcp__mcp-graph__write_memory`
- Category: `audio_anomaly_detection`
- Content: full anomaly list with timestamps, classifications, severity, and quality metrics
- Tags: recording ID, detection date, anomaly count, overall quality score
- Include baseline comparison data for trend analysis

### Step 8: Validate and Complete

Finalize the anomaly detection run and verify all critical findings are tracked.

**Tool:** `mcp__mcp-graph__analyze`
- Mode: `implement_done`
- Verify: all critical anomalies have graph nodes, metrics recorded, baseline updated if needed
- Check: no false positives from known benign patterns (e.g., intentional muting)
- Report: overall audio quality assessment and recommendations

## Output Format

```json
{
  "anomaly_detection": {
    "file": "daily-standup-2026-04-10.wav",
    "duration_seconds": 900,
    "baseline_profile": "conference-room-a",
    "overall_quality_score": 0.82,
    "anomalies": [
      {
        "id": "anom-001",
        "type": "signal_dropout",
        "severity": "critical",
        "start": 245.3,
        "end": 247.8,
        "duration_seconds": 2.5,
        "anomaly_score": 0.96,
        "description": "Complete signal loss for 2.5 seconds",
        "recommended_action": "Check microphone connection stability",
        "created_node": "node-anom-101"
      },
      {
        "id": "anom-002",
        "type": "background_noise_event",
        "severity": "warning",
        "start": 512.0,
        "end": 515.2,
        "duration_seconds": 3.2,
        "anomaly_score": 0.78,
        "description": "Transient high-energy noise event (door slam)",
        "recommended_action": "No action required — transient event",
        "created_node": null
      },
      {
        "id": "anom-003",
        "type": "clipping",
        "severity": "warning",
        "start": 680.1,
        "end": 680.4,
        "duration_seconds": 0.3,
        "anomaly_score": 0.72,
        "description": "Amplitude clipping detected during loud speech",
        "recommended_action": "Reduce microphone gain by 3dB",
        "created_node": "node-anom-102"
      }
    ],
    "quality_metrics": {
      "avg_snr_db": 22.5,
      "dropout_count": 1,
      "clipping_ratio": 0.003,
      "silence_ratio": 0.12,
      "voice_activity_ratio": 0.85
    },
    "baseline_comparison": {
      "snr_delta_db": -2.1,
      "anomaly_count_delta": 1,
      "quality_trend": "slightly_degraded"
    },
    "total_anomalies": 5,
    "critical_count": 1,
    "warning_count": 3,
    "info_count": 1
  },
  "graph_nodes_created": ["node-anom-101", "node-anom-102"],
  "knowledge_entry_id": "ke-anom-567"
}
```

## Anti-Patterns

- Do NOT run anomaly detection without a baseline profile; all metrics are relative to expected norms
- Do NOT create graph nodes for every minor anomaly; only critical and actionable findings warrant nodes
- Do NOT ignore equipment degradation trends in favor of only detecting acute events
- Do NOT set detection thresholds too aggressively; high false positive rates erode trust in the system
- Do NOT skip classification after detection; raw anomaly scores without type labels are not actionable
- Do NOT discard anomaly history; longitudinal data is essential for trend analysis and root cause identification
- Do NOT assume all silence is anomalous; some recordings have natural pauses that should not be flagged
