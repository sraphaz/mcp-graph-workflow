---
name: graph-video-anomaly-detector
description: Visual anomaly detection in video for UI errors, flow failures, and unexpected behavior
triggers:
  - graph-video-anomaly-detector
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-video-anomaly-detector

Detects visual anomalies in video recordings including UI rendering errors, broken layouts, unexpected flow failures, error dialogs, loading failures, and behavior deviations from expected patterns. Anomalies are classified by severity, linked to graph nodes, and tracked with metrics for quality monitoring.

## When to Use

- When analyzing screen recordings for UI bugs, rendering glitches, or layout breakage
- When monitoring automated test recordings for unexpected visual states or error screens
- When validating deployment health by checking screen recordings of post-deploy smoke tests
- When detecting error modals, crash screens, or infinite loading states in recorded sessions
- When building quality metrics dashboards from video-based anomaly detection data
- When scanning user session recordings for UX pain points indicated by visual anomalies

## Mandatory Flow

```
node → analyze → [anomaly detection pipeline] → metrics → write_memory
```

## Workflow

### Step 1: Create or Locate Anomaly Detection Node

Ensure a graph node exists for the anomaly detection run.

**Tool:** `mcp__mcp-graph__node`

```
node({ action: "add", name: "Anomaly detection: <video-or-session-name>", type: "task", status: "in_progress" })
```

### Step 2: Load Expected Behavior Baselines

Retrieve known good visual states and expected behavior patterns from the graph.

**Tool:** `mcp__mcp-graph__analyze`

```
analyze({ mode: "validate_ready", nodeId: "<task-node-id>" })
```

Establish baselines:
- **Golden-path recordings**: Reference videos showing correct behavior
- **Expected UI states**: Known layouts, color schemes, and component states
- **Error signatures**: Previously detected anomaly patterns for faster recognition
- **Tolerance thresholds**: Acceptable variation ranges per UI region

### Step 3: Frame-Level Anomaly Scanning

Scan each frame for visual anomalies:

- **Error dialogs**: Detect modal dialogs with error iconography or red/warning color schemes
- **Broken layouts**: Identify overlapping elements, off-screen content, or collapsed containers
- **Missing content**: Detect placeholder images, empty states, or unrendered components
- **Loading failures**: Identify infinite spinners, skeleton screens persisting beyond timeout
- **Console errors**: Detect visible browser console overlays or error toasts
- **Blank screens**: Identify completely white or black frames that indicate rendering failure

### Step 4: Temporal Anomaly Detection

Detect anomalies across frame sequences:

- **Stuck states**: UI that does not change for an unexpectedly long duration (frozen application)
- **Flicker/flash**: Rapid visual alternation indicating rendering instability
- **Progress regression**: Progress indicators that decrease or reset unexpectedly
- **Loop detection**: Repeated visual sequences suggesting infinite loops or redirect cycles
- **Sudden transitions**: Unexpected page changes without user interaction (auto-redirect errors)

### Step 5: Behavioral Pattern Analysis

Analyze higher-level behavioral patterns for anomalies:

- **Flow deviation**: Detected user flow diverges from the expected golden-path sequence
- **Excessive retries**: User repeating the same action multiple times (suggesting failure)
- **Abandonment signals**: Session ending abruptly after encountering a specific screen
- **Performance degradation**: Visible lag, slow rendering, or stuttering animations
- **Accessibility violations**: Missing focus indicators, invisible text, insufficient contrast (detected visually)

### Step 6: Classify and Score Anomalies

Assign severity and confidence to each detected anomaly:

| Severity | Criteria |
|----------|----------|
| **critical** | Application crash, blank screen, data loss indication, security warning |
| **high** | Broken layout affecting primary content, persistent error state, blocked flow |
| **medium** | Visual glitch in secondary content, intermittent loading issue, cosmetic error |
| **low** | Minor rendering inconsistency, non-blocking warning, aesthetic deviation |

Confidence scoring based on:
- Detection method reliability
- Duration of the anomaly (persistent vs. transient)
- Confirmation across multiple detection methods

### Step 7: Generate Anomaly Metrics

Produce quantitative metrics for quality tracking.

**Tool:** `mcp__mcp-graph__metrics`

```
metrics({})
```

Key metrics:
- Anomaly count by severity
- Anomaly density (anomalies per minute of video)
- Mean time to first anomaly
- Anomaly clustering (time regions with concentrated issues)
- Comparison with previous detection runs (trend analysis)

### Step 8: Persist Anomaly Results

Store detection results in the knowledge store for tracking and trend analysis.

**Tool:** `mcp__mcp-graph__write_memory`

```
write_memory({
  type: "insight",
  category: "video-anomaly-detection",
  content: "<structured JSON with anomalies, severities, metrics, trend data>"
})
```

## Output Format

```json
{
  "detection_id": "ad-<timestamp>",
  "source": {
    "video": "<video-filename>",
    "duration_seconds": 600,
    "nodeId": "<task-node-id>"
  },
  "anomalies": [
    {
      "id": "anomaly-001",
      "timestamp": "00:02:34.100",
      "duration_seconds": 3.2,
      "type": "error_dialog",
      "severity": "critical",
      "confidence": 0.97,
      "description": "Unhandled exception modal appeared after form submission",
      "frame": "frame-00-02-34.png",
      "region": { "x": 400, "y": 200, "width": 500, "height": 300 },
      "ocr_text": "Error: Cannot read properties of undefined (reading 'map')"
    },
    {
      "id": "anomaly-002",
      "timestamp": "00:05:12.800",
      "duration_seconds": 45.0,
      "type": "stuck_state",
      "severity": "high",
      "confidence": 0.89,
      "description": "Loading spinner persisted for 45 seconds without progress",
      "frame": "frame-00-05-12.png"
    }
  ],
  "metrics": {
    "total_anomalies": 7,
    "by_severity": { "critical": 1, "high": 2, "medium": 3, "low": 1 },
    "anomaly_density_per_minute": 0.7,
    "first_anomaly_timestamp": "00:02:34.100",
    "anomaly_clusters": [
      { "start": "00:02:30", "end": "00:03:15", "count": 3 }
    ]
  },
  "trend": {
    "previous_run_anomalies": 4,
    "delta": "+3",
    "direction": "degraded"
  },
  "persisted": true
}
```

## Anti-Patterns

- Do NOT run anomaly detection without establishing baselines -- without expected behavior, everything looks anomalous
- Do NOT treat all visual changes as anomalies -- dynamic content (timestamps, live data) must be masked
- Do NOT skip temporal analysis -- single-frame analysis misses stuck states and flicker patterns
- Do NOT ignore low-severity anomalies entirely -- they often cluster into high-severity patterns
- Do NOT persist anomaly data without generating metrics via `metrics` -- raw anomaly lists lack actionable context
- Do NOT run detection without a graph node -- untracked detection runs cannot be compared for trend analysis
- Do NOT rely solely on pixel comparison -- behavioral and temporal patterns catch anomalies that frame diffs miss
