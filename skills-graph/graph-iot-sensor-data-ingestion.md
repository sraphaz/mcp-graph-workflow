---
name: graph-iot-sensor-data-ingestion
description: Sensor data ingestion pipeline supporting MQTT, CoAP, HTTP, and Bluetooth protocols
triggers:
  - graph-iot-sensor-data-ingestion
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-iot-sensor-data-ingestion

Orchestrates the ingestion of sensor data from heterogeneous IoT sources into the execution graph. Supports MQTT, CoAP, HTTP, and Bluetooth Low Energy (BLE) protocols with automatic schema detection, payload normalization, and backpressure handling.

## When to Use

- When onboarding a new fleet of IoT sensors that push data via MQTT or CoAP
- When building an HTTP-based ingestion endpoint for sensor telemetry
- When integrating BLE-based wearable or proximity sensors into the data pipeline
- When normalizing heterogeneous sensor payloads into a unified schema
- When establishing backpressure and rate-limiting policies for high-throughput sensor streams
- When auditing ingestion reliability and detecting dropped or malformed messages

## Mandatory Flow

```
search(existing ingestion nodes) → node(add ingestion task) → analyze(design_ready) → implement ingestion pipeline with TDD → write_memory(protocol decisions) → analyze(implement_done) → update_status(done)
```

## Workflow

### Step 1: Discover Existing Ingestion Infrastructure

Search the graph for any pre-existing ingestion nodes, protocol handlers, or related data pipeline tasks to avoid duplication.

**Tool:** `mcp__mcp-graph__search`
- Query: `sensor ingestion` or `mqtt coap http ble`
- Review results for overlapping functionality or reusable components

### Step 2: Create Ingestion Task Nodes

Add task nodes for each protocol-specific ingestion channel. Each node should specify the protocol, expected payload format, and throughput requirements.

**Tool:** `mcp__mcp-graph__node`
- Action: `add`
- Type: `task`
- Include acceptance criteria: message parsing, schema validation, error handling, backpressure

### Step 3: Define Protocol Adapters

Design and implement protocol-specific adapters that normalize raw sensor payloads into a canonical internal format. Each adapter handles connection lifecycle, authentication, and message deserialization.

- **MQTT:** Topic subscription, QoS levels, retained messages, last-will handling
- **CoAP:** Observe pattern, confirmable vs non-confirmable, block-wise transfer
- **HTTP:** Webhook endpoints, batch POST ingestion, API key authentication
- **BLE:** GATT service discovery, characteristic read/notify, connection pooling

### Step 4: Implement Schema Detection and Normalization

Build automatic schema detection that infers field types and units from the first N messages per sensor. Normalize all payloads into a unified envelope:

```json
{
  "sensorId": "string",
  "timestamp": "ISO-8601",
  "protocol": "mqtt | coap | http | ble",
  "payload": { "field": "value" },
  "metadata": { "rssi": -70, "firmware": "1.2.3" }
}
```

### Step 5: Implement Backpressure and Rate Limiting

Configure per-sensor and per-protocol rate limits. Implement backpressure using a bounded queue with configurable overflow policies (drop-oldest, drop-newest, block).

**Tool:** `mcp__mcp-graph__analyze`
- Mode: `progress`
- Verify throughput targets are met without message loss

### Step 6: Validate Ingestion Pipeline

Run end-to-end tests for each protocol adapter. Verify schema normalization, error handling for malformed payloads, and graceful degradation under load.

**Tool:** `mcp__mcp-graph__analyze`
- Mode: `implement_done`
- Confirm all acceptance criteria pass

### Step 7: Record Technical Decisions

Persist protocol selection rationale, schema design choices, and throughput benchmarks to the knowledge store for future reference.

**Tool:** `mcp__mcp-graph__write_memory`
- Category: `architecture`
- Content: protocol adapters design, normalization schema, rate-limiting strategy

## Output Format

```yaml
ingestion_report:
  protocols_configured:
    - protocol: mqtt
      topics: ["sensors/+/telemetry"]
      qos: 1
      status: active
    - protocol: coap
      endpoints: ["/sensor/data"]
      observe: true
      status: active
    - protocol: http
      endpoint: "/api/v1/ingest"
      auth: api_key
      status: active
    - protocol: ble
      services: ["0x180D", "0x181A"]
      status: active
  normalization:
    schema_version: "1.0"
    fields_detected: 12
    sensors_onboarded: 48
  backpressure:
    queue_size: 10000
    overflow_policy: drop_oldest
    rate_limit_per_sensor: "100 msg/s"
  health:
    messages_ingested: 1240000
    messages_dropped: 23
    avg_latency_ms: 4.2
```

## Anti-Patterns

- Do NOT hardcode protocol-specific logic in the main ingestion loop; use adapter pattern
- Do NOT skip schema validation for "trusted" sensors; all payloads must be validated
- Do NOT use unbounded queues; always configure maximum queue size and overflow policy
- Do NOT ignore BLE connection lifecycle; implement reconnection and characteristic caching
- Do NOT process messages synchronously in the MQTT callback; offload to a worker pool
- Do NOT store raw payloads without normalization; downstream consumers expect canonical format
- Do NOT deploy ingestion changes without load testing against expected peak throughput
