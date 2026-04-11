---
name: graph-iot-sensor-multimodal-integrator
description: Multimodal fusion of sensor data with video, audio, and text sources for comprehensive situational awareness
triggers:
  - graph-iot-sensor-multimodal-integrator
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-iot-sensor-multimodal-integrator

Orchestrates the fusion of traditional IoT sensor data with video, audio, and text modalities to build comprehensive situational awareness. Combines structured telemetry with unstructured perceptual data through temporal alignment, cross-modal correlation, and unified knowledge indexing for richer context than any single modality provides.

## When to Use

- When sensor telemetry alone is insufficient and video or audio context would improve understanding
- When correlating camera feeds with environmental sensors for smart building or industrial monitoring
- When fusing audio analysis (machine sounds, speech) with vibration and operational sensors
- When integrating maintenance logs, incident reports, or operator notes with sensor readings
- When building a unified knowledge base that spans all modalities for RAG-powered querying

## Mandatory Flow

```
search(multimodal nodes) → node(add multimodal fusion task) → rag_context(existing cross-modal patterns) → analyze(design_ready) → implement fusion with TDD → knowledge_stats(multimodal index coverage) → write_memory(fusion architecture) → analyze(implement_done) → update_status(done)
```

## Workflow

### Step 1: Inventory Multimodal Sources

Query the knowledge store for all available data sources across modalities to understand what can be fused.

**Tool:** `mcp__mcp-graph__rag_context`
- Query: `sensor video audio text modalities data sources`
- Identify available modalities, their formats, and temporal coverage

### Step 2: Create Multimodal Integration Task Nodes

Add task nodes for each integration layer: per-modality preprocessing, temporal alignment, cross-modal correlation, and unified indexing.

**Tool:** `mcp__mcp-graph__node`
- Action: `add`
- Type: `task`
- Acceptance criteria: alignment accuracy, cross-modal correlation quality, query latency, index completeness

### Step 3: Implement Video Stream Integration

Build the video processing pipeline that extracts structured information from camera feeds:

- **Object detection:** Identify people, vehicles, equipment, and anomalies in each frame
- **Activity recognition:** Classify actions (walking, operating machinery, maintenance activity)
- **Occupancy counting:** Track zone-level occupancy from camera feeds for cross-validation with PIR sensors
- **Change detection:** Identify visual changes (spills, equipment displacement, door state) between frames
- **Metadata extraction:** Frame timestamp, camera ID, resolution, confidence scores

Output: structured event records aligned to a common timeline with sensor data.

### Step 4: Implement Audio Stream Integration

Build the audio processing pipeline that extracts information from microphone arrays and machine audio:

- **Sound classification:** Categorize audio segments (machinery normal, machinery anomalous, speech, alarm, silence)
- **Acoustic anomaly detection:** Identify unusual sounds that may indicate equipment malfunction
- **Speech-to-text:** Transcribe operator speech for correlation with sensor events
- **Noise level monitoring:** Continuous dB measurement for environmental compliance
- **Audio fingerprinting:** Match known machine sound signatures against real-time audio

Output: time-stamped audio events and transcriptions aligned with sensor and video data.

### Step 5: Implement Text Source Integration

Ingest and structure text-based data sources for cross-modal correlation:

- **Maintenance logs:** Parse structured and free-text maintenance records with entity extraction
- **Incident reports:** Extract incident type, affected equipment, root cause, and resolution
- **Operator notes:** Index shift handover notes and ad-hoc observations
- **Work orders:** Track scheduled and completed maintenance activities
- **Equipment manuals:** Index relevant sections for RAG-powered troubleshooting

### Step 6: Implement Cross-Modal Temporal Alignment

Synchronize all modalities to a common timeline for correlation:

- **Timestamp normalization:** Convert all sources to UTC with millisecond precision
- **Latency compensation:** Account for processing delays in video and audio pipelines
- **Event alignment:** Match events across modalities within configurable temporal windows
- **Gap detection:** Identify periods where one or more modalities have missing data

### Step 7: Build Cross-Modal Correlation Engine

Compute correlations between events across modalities to surface insights:

- **Sensor + video:** Correlate temperature spikes with visual anomalies (e.g., steam, fire)
- **Sensor + audio:** Correlate vibration anomalies with acoustic changes (bearing noise)
- **Video + audio:** Correlate visual activity with speech or sound events
- **All modalities:** Build composite situational awareness by combining all correlated events

Correlation is scored by temporal proximity, spatial co-location, and semantic similarity.

### Step 8: Index Multimodal Data in Knowledge Store

Index all modality outputs into the unified knowledge store for RAG-powered querying.

**Tool:** `mcp__mcp-graph__knowledge_stats`
- Verify: index coverage across modalities, embedding quality, query response times
- Ensure all modalities are searchable through a single RAG query interface

### Step 9: Validate Multimodal Integration

Run analysis to confirm cross-modal alignment, correlation quality, and knowledge index completeness.

**Tool:** `mcp__mcp-graph__analyze`
- Mode: `implement_done`
- Verify: temporal alignment accuracy, cross-modal correlation precision, RAG query coverage

### Step 10: Record Multimodal Architecture Decisions

Persist fusion architecture, processing pipeline configurations, and cross-modal correlation parameters.

**Tool:** `mcp__mcp-graph__write_memory`
- Category: `architecture`
- Content: modality processing pipelines, alignment strategy, correlation engine parameters, indexing schema

## Output Format

```yaml
multimodal_integration_report:
  modalities:
    sensors:
      types: [temperature, humidity, vibration, co2, pir]
      devices: 48
      data_rate: "50 readings/sec"
    video:
      cameras: 8
      resolution: "1080p"
      fps: 15
      processing: [object_detection, occupancy, change_detection]
    audio:
      microphones: 4
      sample_rate: "16kHz"
      processing: [classification, anomaly_detection, speech_to_text]
    text:
      sources: [maintenance_logs, incident_reports, operator_notes]
      documents_indexed: 1247
  temporal_alignment:
    common_timeline: "UTC ms"
    max_offset_compensated_ms: 120
    alignment_accuracy: "99.7%"
  cross_modal_correlations:
    sensor_video: 34
    sensor_audio: 18
    video_audio: 12
    all_modalities: 7
    avg_correlation_score: 0.82
  knowledge_index:
    total_entries: 48000
    sensor_entries: 36000
    video_entries: 6400
    audio_entries: 3200
    text_entries: 2400
    avg_query_latency_ms: 28
  situational_awareness:
    active_correlations: 71
    composite_events_24h: 23
    accuracy_improvement_vs_sensor_only: "+41%"
```

## Anti-Patterns

- Do NOT process video or audio on the same thread as sensor ingestion; use dedicated processing pipelines
- Do NOT correlate modalities without temporal alignment; unsynchronized cross-modal joins produce false correlations
- Do NOT index raw video or audio frames; extract structured events and metadata first
- Do NOT assume all modalities are always available; implement graceful degradation when a modality goes offline
- Do NOT use a single embedding model for all modalities; use modality-specific encoders before fusion
- Do NOT skip privacy considerations; video and audio may contain PII requiring anonymization before indexing
- Do NOT build cross-modal correlations without ground truth validation; measure precision against manually labeled events
