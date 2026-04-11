---
name: graph-video-action-recognizer
description: Action and activity recognition in video including clicks, navigation, and user flow detection
triggers:
  - graph-video-action-recognizer
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-video-action-recognizer

Recognizes and classifies user actions and activities in video recordings, including mouse clicks, keyboard input, navigation flows, and UI interactions. Maps detected actions to structured user flow sequences that can be persisted as graph nodes and linked to task requirements.

## When to Use

- When analyzing screen recordings to extract user interaction patterns and flows
- When documenting actual user behavior from usability testing videos
- When validating that recorded UI flows match expected task acceptance criteria
- When building step-by-step interaction sequences from demo or tutorial recordings
- When detecting navigation patterns and click hotspots in recorded sessions
- When reverse-engineering user workflows from screen capture for test case generation

## Mandatory Flow

```
search → analyze → [action recognition pipeline] → node → write_memory
```

## Workflow

### Step 1: Search for Related Context

Locate existing graph nodes related to the feature or flow being analyzed to establish expected behavior baselines.

**Tool:** `mcp__mcp-graph__search`

```
search({ query: "<feature or flow being recorded>", limit: 10 })
```

### Step 2: Pre-Analysis of Video Content

Assess video characteristics to configure the recognition pipeline appropriately.

**Tool:** `mcp__mcp-graph__analyze`

```
analyze({ mode: "progress", sprintId: "<current-sprint>" })
```

Determine:
- **Recording type**: Screen capture, webcam, mobile screen, or mixed
- **Resolution and frame rate**: Affects detection granularity
- **Cursor visibility**: Whether system cursor or custom cursor is present
- **UI framework**: Detect if the application uses known component patterns

### Step 3: Detect Mouse and Pointer Actions

Identify pointer-based interactions throughout the recording:

- **Single clicks**: Left-click events with target element identification
- **Double clicks**: Rapid successive clicks on the same target
- **Right clicks**: Context menu invocations
- **Drag operations**: Click-hold-move-release sequences with start/end positions
- **Hover events**: Sustained pointer presence over interactive elements
- **Scroll actions**: Page or container scrolling with direction and magnitude

Track cursor position at each frame to build a continuous movement trail.

### Step 4: Detect Keyboard and Input Actions

Identify text input and keyboard shortcut usage:

- **Text entry**: Detect active input fields and typed content via OCR on changing text
- **Keyboard shortcuts**: Recognize common shortcuts (Ctrl+S, Ctrl+Z, Tab navigation)
- **Form submissions**: Enter key presses following form field interactions
- **Navigation keys**: Arrow keys, Page Up/Down, Home/End usage patterns

### Step 5: Detect Navigation and Flow Actions

Identify higher-level navigation patterns:

- **Page transitions**: URL changes, route navigation, tab switches
- **Modal interactions**: Dialog open/close, confirmation flows
- **Menu navigation**: Dropdown menus, sidebar navigation, breadcrumb usage
- **Back/forward**: Browser or in-app navigation history usage
- **Search flows**: Search input, result scanning, result selection

### Step 6: Build Action Sequence Graph

Assemble detected actions into a structured flow sequence:

- **Temporal ordering**: Actions sorted by timestamp
- **Causal linking**: Connect actions that form logical sequences (click search > type query > click result)
- **Flow segmentation**: Group actions into distinct user tasks or goals
- **Anomaly marking**: Flag unexpected patterns (rage clicks, repeated failures, dead-end navigation)

### Step 7: Create Graph Nodes for Detected Flows

Persist detected user flows as graph nodes for traceability and validation.

**Tool:** `mcp__mcp-graph__node`

```
node({ action: "add", name: "User flow: <flow-description>", type: "task", metadata: { actions: [...], source_video: "<video-name>" } })
```

### Step 8: Persist Action Recognition Results

Store the full action recognition output in the knowledge store.

**Tool:** `mcp__mcp-graph__write_memory`

```
write_memory({
  type: "insight",
  category: "video-action-recognition",
  content: "<structured JSON with actions, flows, anomalies>"
})
```

## Output Format

```json
{
  "recognition_id": "ar-<timestamp>",
  "source": {
    "video": "<video-filename>",
    "duration_seconds": 420,
    "resolution": "1920x1080",
    "recording_type": "screen_capture"
  },
  "actions": [
    {
      "id": "act-001",
      "timestamp": "00:00:05.200",
      "type": "click",
      "subtype": "single_left",
      "target": { "element": "button", "text": "New Project", "position": { "x": 845, "y": 120 } },
      "confidence": 0.96
    },
    {
      "id": "act-002",
      "timestamp": "00:00:06.800",
      "type": "text_input",
      "target": { "element": "input", "placeholder": "Project name" },
      "value": "mcp-graph-v2",
      "confidence": 0.88
    }
  ],
  "flows": [
    {
      "id": "flow-001",
      "name": "Create new project",
      "actions": ["act-001", "act-002", "act-003", "act-004"],
      "start": "00:00:05.200",
      "end": "00:00:18.900",
      "outcome": "success"
    }
  ],
  "anomalies": [
    {
      "type": "rage_click",
      "timestamp": "00:03:42.100",
      "target": "submit_button",
      "click_count": 5,
      "duration_ms": 1200
    }
  ],
  "statistics": {
    "total_actions": 87,
    "total_flows": 6,
    "anomalies_detected": 2,
    "avg_confidence": 0.91
  },
  "persisted": true
}
```

## Anti-Patterns

- Do NOT run action recognition without searching for related graph nodes first -- context improves classification
- Do NOT treat all clicks equally -- distinguish single, double, right-click, and drag for accurate flow mapping
- Do NOT ignore failed or repeated actions -- they reveal usability issues and are high-value findings
- Do NOT build flows without temporal and causal ordering -- unordered action lists are not actionable
- Do NOT skip anomaly detection -- rage clicks and dead-end navigation are the most valuable outputs
- Do NOT persist actions without linking them to graph nodes via `node` -- unlinked data is invisible to the graph
- Do NOT assume cursor position equals interaction target -- use OCR and element detection for accurate targeting
