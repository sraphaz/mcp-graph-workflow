---
name: graph-iot-sensor-protocol-handler
description: IoT protocol management and abstraction for MQTT, Zigbee, LoRa, and BLE communication layers
triggers:
  - graph-iot-sensor-protocol-handler
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-iot-sensor-protocol-handler

Orchestrates the management and abstraction of IoT communication protocols, providing a unified interface over MQTT, Zigbee, LoRaWAN, and Bluetooth Low Energy (BLE). Handles protocol-specific connection lifecycle, message framing, device discovery, and network topology management while exposing a consistent API to upstream consumers.

## When to Use

- When integrating sensors that communicate over different IoT protocols into a unified system
- When building a protocol abstraction layer that shields application logic from transport details
- When managing Zigbee mesh networks, LoRaWAN gateways, or BLE peripheral fleets
- When implementing protocol-specific reliability features (QoS, retries, acknowledgments)
- When troubleshooting connectivity issues across heterogeneous IoT networks
- When evaluating protocol trade-offs for new sensor deployments (range, power, bandwidth, latency)

## Mandatory Flow

```
search(existing protocol handlers) → node(add protocol handler task) → analyze(design_ready) → implement handlers with TDD → write_memory(protocol decisions) → analyze(implement_done) → update_status(done)
```

## Workflow

### Step 1: Audit Current Protocol Landscape

Search the graph for existing protocol handler implementations, device registries, and network configurations.

**Tool:** `mcp__mcp-graph__search`
- Query: `mqtt zigbee lora ble protocol handler`
- Identify existing implementations and gaps in protocol coverage

### Step 2: Create Protocol Handler Task Nodes

Add task nodes for each protocol handler and the shared abstraction layer.

**Tool:** `mcp__mcp-graph__node`
- Action: `add`
- Type: `task`
- One node per protocol (MQTT, Zigbee, LoRa, BLE) plus one for the abstraction interface

### Step 3: Design Unified Protocol Interface

Define the common interface that all protocol handlers must implement:

```typescript
interface ProtocolHandler {
  connect(config: ProtocolConfig): Promise<Connection>
  disconnect(connectionId: string): Promise<void>
  subscribe(topic: string, callback: MessageCallback): Promise<Subscription>
  publish(topic: string, payload: Buffer, options: PublishOptions): Promise<void>
  discover(): AsyncIterable<DeviceInfo>
  getHealth(): ProtocolHealth
}
```

Each handler adapts its protocol-specific semantics to this unified interface.

### Step 4: Implement MQTT Handler

Build the MQTT protocol handler with full broker lifecycle management:

- **Connection:** TLS/mTLS support, clean/persistent sessions, auto-reconnect with exponential backoff
- **Topics:** Wildcard subscriptions, topic aliasing, shared subscriptions for load distribution
- **QoS:** Per-message QoS (0, 1, 2) with configurable defaults per topic
- **Features:** Last Will and Testament, retained messages, message expiry intervals
- **Versions:** Support MQTT v3.1.1 and v5.0 with feature negotiation

### Step 5: Implement Zigbee Handler

Build the Zigbee protocol handler for mesh network management:

- **Coordinator:** Interface with Zigbee coordinator (e.g., CC2652, EZSP-based) via serial or TCP
- **Device management:** Join/leave handling, device interview, endpoint/cluster enumeration
- **Binding:** Establish direct bindings between devices for local automation
- **Groups:** Manage Zigbee groups for multicast messaging
- **OTA updates:** Coordinate firmware updates across the mesh
- **Resilience:** Handle mesh rerouting, coordinator failover, and device re-interview

### Step 6: Implement LoRaWAN Handler

Build the LoRaWAN protocol handler for long-range, low-power sensor networks:

- **Network server:** Interface with LoRaWAN Network Server (e.g., ChirpStack, TTN)
- **Device provisioning:** OTAA and ABP activation, device profile management
- **Downlink scheduling:** Queue downlink messages with configurable class (A, B, C)
- **Adaptive data rate:** Monitor and configure ADR for optimal range/throughput balance
- **Multicast:** Group messaging for bulk configuration or firmware updates
- **Geolocation:** TDOA-based device location from gateway timestamps

### Step 7: Implement BLE Handler

Build the Bluetooth Low Energy protocol handler for proximity and wearable sensors:

- **Scanning:** Active and passive scanning with configurable intervals and filters
- **Connection:** Managed connection pool with automatic reconnection and MTU negotiation
- **GATT:** Service/characteristic discovery, read/write/notify operations, descriptor handling
- **Advertising:** Parse and process BLE advertisements (iBeacon, Eddystone, custom)
- **Security:** Pairing, bonding, and encryption management
- **Throughput:** Connection parameter optimization for data-intensive BLE sensors

### Step 8: Implement Protocol Selection Engine

Build a decision engine that recommends the optimal protocol for new sensor deployments:

| Factor | MQTT | Zigbee | LoRaWAN | BLE |
|--------|------|--------|---------|-----|
| Range | WAN (via IP) | 10-100m mesh | 2-15km | 10-100m |
| Power | Medium | Low | Ultra-low | Low |
| Bandwidth | High | Low-Medium | Very low | Medium |
| Latency | Low | Medium | High | Low |
| Topology | Star | Mesh | Star-of-stars | Star/mesh |
| Best for | IP-connected | Indoor mesh | Remote/outdoor | Proximity |

### Step 9: Validate Protocol Handlers

Run integration tests for each protocol handler with real or emulated devices.

**Tool:** `mcp__mcp-graph__analyze`
- Mode: `implement_done`
- Verify: connection lifecycle, message delivery, reconnection, device discovery, QoS compliance

### Step 10: Record Protocol Decisions

Persist protocol selection rationale, configuration parameters, and network topology decisions.

**Tool:** `mcp__mcp-graph__write_memory`
- Category: `architecture`
- Content: protocol selection criteria, handler configurations, network topology, security settings

## Output Format

```yaml
protocol_handler_report:
  handlers:
    mqtt:
      status: active
      broker: "mqtt.local:8883"
      tls: true
      sessions: 48
      qos_default: 1
      version: "5.0"
    zigbee:
      status: active
      coordinator: "CC2652RB"
      devices_joined: 36
      mesh_routes: 52
      firmware: "20260301"
    lorawan:
      status: active
      network_server: "chirpstack"
      devices_activated: 12
      activation_mode: "OTAA"
      adr_enabled: true
    ble:
      status: active
      adapters: 2
      connected_peripherals: 8
      scanning: true
      scan_interval_ms: 100
  abstraction_layer:
    handlers_registered: 4
    total_devices: 104
    total_subscriptions: 87
    messages_routed_24h: 2400000
  health:
    mqtt_uptime: "99.97%"
    zigbee_mesh_quality: "94%"
    lora_packet_delivery_rate: "98.2%"
    ble_connection_stability: "99.1%"
```

## Anti-Patterns

- Do NOT expose protocol-specific details to application logic; use the abstraction layer consistently
- Do NOT use a single QoS level for all messages; match QoS to the criticality of each data type
- Do NOT ignore Zigbee mesh topology health; degraded mesh routes cause silent message loss
- Do NOT poll BLE characteristics when notifications are available; polling wastes battery and bandwidth
- Do NOT hardcode LoRaWAN data rates; use adaptive data rate to optimize for changing conditions
- Do NOT skip TLS/mTLS for MQTT in production; unencrypted broker connections are a security vulnerability
- Do NOT implement protocol handlers as monoliths; each handler must be independently deployable and testable
