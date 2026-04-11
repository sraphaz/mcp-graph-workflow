---
name: graph-iot-sensor-dashboard-generator
description: Auto-generate real-time dashboards from sensor data with configurable widgets and export formats
triggers:
  - graph-iot-sensor-dashboard-generator
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-iot-sensor-dashboard-generator

Orchestrates automatic dashboard generation from IoT sensor data, creating real-time visualization layouts with configurable widgets, threshold indicators, and export capabilities. Transforms raw sensor telemetry into actionable visual insights without manual dashboard design.

## When to Use

- When a new sensor deployment needs monitoring dashboards generated from its data schema
- When building real-time visualization of sensor streams with live-updating widgets
- When creating operational dashboards with threshold-based color coding and alert indicators
- When generating historical trend dashboards from stored time-series sensor data
- When exporting dashboard configurations for sharing across teams or environments

## Mandatory Flow

```
search(existing dashboards) → node(add dashboard task) → export(sensor schema) → metrics(data availability) → implement dashboard with TDD → write_memory(dashboard layout decisions) → analyze(implement_done) → update_status(done)
```

## Workflow

### Step 1: Discover Available Sensor Data Sources

Query the graph for registered sensor types, their data schemas, and available time-series data to determine what can be visualized.

**Tool:** `mcp__mcp-graph__export`
- Format: `json`
- Export sensor metadata, schema definitions, and data availability information

### Step 2: Create Dashboard Generation Task Nodes

Add task nodes for dashboard layout generation, widget configuration, data binding, and export.

**Tool:** `mcp__mcp-graph__node`
- Action: `add`
- Type: `task`
- Acceptance criteria: auto-layout correctness, widget data binding, refresh rate, export formats

### Step 3: Implement Schema-Driven Layout Engine

Build the layout engine that automatically generates dashboard layouts from sensor data schemas:

- **Sensor type mapping:** Map sensor types to appropriate widget types (gauge, line chart, heatmap, status indicator)
- **Grid layout:** Auto-arrange widgets in a responsive grid with priority-based sizing
- **Grouping:** Cluster related sensors by zone, type, or logical group
- **Responsive breakpoints:** Generate layouts for desktop (3-4 columns), tablet (2 columns), and mobile (1 column)

Widget type selection rules:

| Data Type | Widget | Size |
|-----------|--------|------|
| Temperature | Gauge + sparkline | 1x1 |
| Humidity | Gauge + sparkline | 1x1 |
| Time series | Line chart | 2x1 |
| Binary state | Status indicator | 1x0.5 |
| Location | Map pin | 2x2 |
| Multi-sensor comparison | Grouped bar chart | 2x1 |
| Anomaly score | Heatmap grid | 2x2 |

### Step 4: Implement Real-Time Data Binding

Connect each widget to its sensor data source with configurable refresh behavior:

- **WebSocket streaming:** Live push updates for real-time dashboards (sub-second refresh)
- **Polling fallback:** Configurable polling interval for environments without WebSocket support
- **Buffered rendering:** Batch DOM updates to prevent jank during high-frequency data pushes
- **Stale data indicator:** Visual indicator when data exceeds expected freshness window

### Step 5: Implement Threshold-Based Visual Indicators

Apply conditional formatting based on sensor-specific thresholds:

- **Color bands:** Green (normal), yellow (warning), red (critical) with configurable breakpoints
- **Animated alerts:** Pulsing border or icon when a reading enters critical range
- **Trend arrows:** Up/down/stable indicators based on recent rate of change
- **Sparkline overlays:** Mini time-series charts embedded in gauge widgets showing recent history

### Step 6: Build Historical Trend Dashboards

Generate historical analysis dashboards with time-range selection and aggregation controls:

- **Time range picker:** Preset ranges (1h, 6h, 24h, 7d, 30d) and custom date range
- **Aggregation selector:** Raw, 1-min, 15-min, 1-hour resolution options
- **Comparison mode:** Overlay today vs yesterday, this week vs last week
- **Annotation layer:** Display maintenance events, anomaly detections, and threshold changes on the timeline

### Step 7: Measure Dashboard Data Availability

Verify that all data sources backing the dashboard widgets are available and returning data within expected latency.

**Tool:** `mcp__mcp-graph__metrics`
- Track: data source availability, widget render time, WebSocket connection stability, data freshness
- Verify all widgets have active data bindings

### Step 8: Implement Dashboard Export

Build export capabilities for sharing and reproducing dashboards:

- **JSON config export:** Full dashboard layout and widget configuration as portable JSON
- **PNG/SVG screenshot:** Static snapshot of current dashboard state for reports
- **PDF report:** Multi-page report with dashboard screenshots and summary statistics
- **Embed code:** Iframe-ready embed snippet for including dashboards in external pages

**Tool:** `mcp__mcp-graph__export`
- Export dashboard configuration in JSON format for version control and sharing

### Step 9: Validate Dashboard Generation

Run analysis to confirm dashboard generation produces correct layouts, data bindings, and threshold indicators.

**Tool:** `mcp__mcp-graph__analyze`
- Mode: `implement_done`
- Verify: layout correctness, widget data binding, threshold coloring, export format validity

### Step 10: Record Dashboard Design Decisions

Persist layout engine rules, widget mapping configuration, and threshold defaults.

**Tool:** `mcp__mcp-graph__write_memory`
- Category: `architecture`
- Content: widget type mapping rules, layout algorithm parameters, default thresholds, export formats

## Output Format

```yaml
dashboard_generation_report:
  dashboards_generated: 3
  layouts:
    - name: "Zone A Real-Time"
      widgets: 12
      columns: 3
      refresh: "1s (websocket)"
      sensors_bound: 12
    - name: "Building Overview"
      widgets: 24
      columns: 4
      refresh: "5s (polling)"
      sensors_bound: 48
    - name: "Historical Trends"
      widgets: 8
      columns: 2
      refresh: "on-demand"
      time_range: "7d"
  widget_summary:
    gauges: 24
    line_charts: 8
    status_indicators: 16
    heatmaps: 2
    maps: 1
  thresholds_applied:
    green_normal: 42
    yellow_warning: 6
    red_critical: 3
  data_binding:
    active_sources: 48
    stale_sources: 0
    avg_render_time_ms: 18
  exports:
    json_config: true
    png_snapshot: true
    pdf_report: true
    embed_code: true
```

## Anti-Patterns

- Do NOT generate static dashboards when real-time data is available; always prefer live data binding
- Do NOT use the same widget type for all sensors; match visualization to data characteristics
- Do NOT render all widgets simultaneously on page load; use lazy loading and viewport-aware rendering
- Do NOT hardcode thresholds in dashboard templates; make them configurable per sensor and overridable per zone
- Do NOT skip mobile-responsive layouts; operational dashboards are frequently viewed on tablets and phones
- Do NOT generate dashboards without a stale-data indicator; users must know when data is not fresh
- Do NOT export dashboard configs with embedded credentials; use reference tokens for data source authentication
