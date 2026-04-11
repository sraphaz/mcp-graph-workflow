---
name: graph-iot-sensor-data-fusion
description: Multi-sensor data fusion combining heterogeneous sources for richer contextual insights
triggers:
  - graph-iot-sensor-data-fusion
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-iot-sensor-data-fusion

Orchestrates multi-sensor data fusion workflows that combine readings from heterogeneous sensor types into unified, context-rich representations. Applies temporal alignment, spatial correlation, and confidence-weighted aggregation to produce higher-quality insights than any single sensor can provide.

## When to Use

- When combining temperature, humidity, pressure, and air quality sensors for environmental monitoring
- When fusing accelerometer, gyroscope, and magnetometer data for motion tracking or orientation estimation
- When correlating sensors across different physical locations to build spatial awareness
- When improving measurement confidence by cross-validating redundant sensor readings
- When building composite indicators that require inputs from multiple sensor modalities
- When resolving conflicting readings from overlapping sensors using confidence weighting

## Mandatory Flow

```
search(fusion nodes) → node(add fusion task) → rag_context(sensor correlation patterns) → analyze(design_ready) → implement fusion with TDD → knowledge_stats(fusion accuracy) → write_memory(fusion strategy) → analyze(implement_done) → update_status(done)
```

## Workflow

### Step 1: Inventory Available Sensor Sources

Query the knowledge store for all registered sensor types, their sampling rates, accuracy specifications, and spatial deployment topology.

**Tool:** `mcp__mcp-graph__rag_context`
- Query: `sensor types specifications accuracy sampling rates`
- Retrieve sensor metadata and deployment information

### Step 2: Create Fusion Pipeline Task Nodes

Add task nodes for each fusion stage: temporal alignment, spatial correlation, confidence weighting, and composite indicator computation.

**Tool:** `mcp__mcp-graph__node`
- Action: `add`
- Type: `task`
- Acceptance criteria: alignment tolerance, fusion accuracy improvement, latency budget

### Step 3: Implement Temporal Alignment

Synchronize sensor readings from sources with different sampling rates and clock offsets:

- **Resampling:** Interpolate or decimate streams to a common timeline using linear or spline interpolation
- **Clock correction:** Apply NTP-derived offsets to align event timestamps across devices
- **Jitter buffer:** Hold readings in a short buffer to reorder out-of-sequence arrivals
- **Gap handling:** Detect and flag temporal gaps; use last-known-value or interpolation based on gap duration

Alignment tolerance: configurable per fusion rule (default: 100ms).

### Step 4: Implement Spatial Correlation

Map sensor readings to physical locations and compute spatial correlations:

- **Co-location fusion:** Average redundant sensors at the same location with confidence weighting
- **Gradient estimation:** Compute spatial gradients from distributed sensor arrays (e.g., temperature gradient across a building)
- **Zone aggregation:** Roll up sensor readings into logical zones (room, floor, building, campus)
- **Proximity weighting:** Weight contributions by inverse distance for interpolation at unmeasured points

### Step 5: Implement Confidence-Weighted Aggregation

Combine readings from multiple sensors using dynamic confidence scores:

```
fused_value = sum(reading_i * confidence_i) / sum(confidence_i)
```

Confidence factors include:
- Sensor age and calibration recency
- Historical accuracy vs reference measurements
- Current signal quality (battery, RSSI, error rate)
- Agreement with peer sensors (consensus score)

### Step 6: Build Composite Indicators

Define and compute composite indicators that synthesize multiple sensor modalities:

| Indicator | Inputs | Computation |
|-----------|--------|-------------|
| Comfort Index | temp, humidity, airflow | PMV/PPD model |
| Air Quality Index | PM2.5, CO2, VOC, O3 | EPA AQI formula |
| Structural Health | vibration, strain, tilt | Modal analysis score |
| Occupancy Estimate | PIR, CO2, sound, light | Bayesian fusion |

### Step 7: Verify Fusion Quality

Check knowledge store statistics to validate that fusion improves measurement quality over individual sensors.

**Tool:** `mcp__mcp-graph__knowledge_stats`
- Verify: fusion accuracy improvement ratio, confidence score distribution, gap handling rate

### Step 8: Analyze Fusion Pipeline Completeness

Run analysis to confirm all fusion stages are implemented and integrated correctly.

**Tool:** `mcp__mcp-graph__analyze`
- Mode: `implement_done`
- Verify temporal alignment accuracy, spatial correlation coverage, composite indicator validity

### Step 9: Persist Fusion Strategy

Record fusion architecture decisions, confidence weighting parameters, and composite indicator formulas.

**Tool:** `mcp__mcp-graph__write_memory`
- Category: `architecture`
- Content: fusion topology, alignment tolerances, confidence model, composite indicator definitions

## Output Format

```yaml
data_fusion_report:
  sources_fused:
    - type: temperature
      sensors: 24
      sampling_rate: "1Hz"
    - type: humidity
      sensors: 24
      sampling_rate: "0.5Hz"
    - type: co2
      sensors: 12
      sampling_rate: "0.1Hz"
    - type: pir_motion
      sensors: 36
      sampling_rate: "event-driven"
  temporal_alignment:
    common_timeline: "1Hz"
    max_clock_offset_ms: 47
    interpolation_method: linear
    gaps_detected: 8
    gaps_handled: 8
  spatial_correlation:
    zones_defined: 6
    gradient_sensors: 12
    co_location_groups: 8
  confidence_weighting:
    avg_confidence: 0.87
    low_confidence_readings_pct: 3.2
  composite_indicators:
    - name: comfort_index
      inputs: [temperature, humidity, airflow]
      accuracy_improvement: "+18%"
    - name: occupancy_estimate
      inputs: [pir, co2, sound]
      accuracy_improvement: "+34%"
  overall_fusion_gain: "+22% accuracy vs single-sensor"
```

## Anti-Patterns

- Do NOT fuse sensors without temporal alignment; misaligned timestamps produce garbage composites
- Do NOT assign equal confidence to all sensors; use dynamic confidence based on calibration and signal quality
- Do NOT ignore sensor failures in the fusion pipeline; implement graceful degradation when sources drop out
- Do NOT hard-code spatial relationships; use a configurable topology map that can be updated without code changes
- Do NOT compute composites from already-aggregated data; fuse at the highest available resolution first
- Do NOT skip cross-validation of fused outputs against reference measurements during commissioning
- Do NOT assume sensor clocks are synchronized; always apply clock offset correction
