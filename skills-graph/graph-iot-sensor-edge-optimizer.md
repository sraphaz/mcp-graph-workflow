---
name: graph-iot-sensor-edge-optimizer
description: Edge processing optimization for IoT sensor workloads targeting latency, energy, and bandwidth efficiency
triggers:
  - graph-iot-sensor-edge-optimizer
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-iot-sensor-edge-optimizer

Orchestrates edge computing optimization for IoT sensor workloads, balancing processing latency, energy consumption, and bandwidth usage across edge devices. Determines which computations run on-device, at the edge gateway, or in the cloud, and continuously optimizes the placement based on measured performance and constraints.

## When to Use

- When sensor data processing latency must be minimized by running computation closer to the source
- When edge device energy consumption needs optimization for battery-powered or solar-powered deployments
- When network bandwidth between edge and cloud is limited or expensive and data must be pre-processed locally
- When deciding the optimal split of processing between device, edge gateway, and cloud tiers
- When profiling edge workloads to identify bottlenecks and optimization opportunities
- When forecasting edge resource needs for capacity planning

## Mandatory Flow

```
search(edge optimization nodes) → node(add edge optimization task) → metrics(current edge performance) → analyze(design_ready) → implement optimizations with TDD → forecast(resource needs) → write_memory(optimization strategy) → analyze(implement_done) → update_status(done)
```

## Workflow

### Step 1: Profile Current Edge Deployment

Measure baseline performance of the current edge processing topology to identify optimization targets.

**Tool:** `mcp__mcp-graph__metrics`
- Track: per-device CPU utilization, memory usage, energy consumption, processing latency, bandwidth usage
- Identify: bottleneck devices, underutilized resources, bandwidth-constrained links

### Step 2: Create Edge Optimization Task Nodes

Add task nodes for each optimization area: computation placement, data compression, model quantization, energy scheduling, and bandwidth management.

**Tool:** `mcp__mcp-graph__node`
- Action: `add`
- Type: `task`
- Acceptance criteria: latency reduction targets, energy savings targets, bandwidth reduction targets

### Step 3: Implement Computation Placement Optimizer

Build the placement engine that decides where each processing task runs:

| Tier | Capabilities | Best For |
|------|-------------|----------|
| On-device | Microcontroller, limited RAM | Filtering, thresholding, simple aggregation |
| Edge gateway | ARM/x86, moderate RAM/storage | Window aggregation, anomaly detection, protocol conversion |
| Cloud | Unlimited compute and storage | Model training, historical analytics, cross-site correlation |

Placement factors:
- **Latency requirement:** Tasks requiring < 10ms response must run on-device or edge
- **Data volume:** High-frequency raw data should be pre-aggregated before cloud transmission
- **Model complexity:** Lightweight models (decision trees, simple NN) run at edge; large models stay in cloud
- **Privacy:** Sensitive data processed locally; only aggregates or anonymized data leave the edge

### Step 4: Implement Model Quantization and Pruning

Optimize ML models for edge deployment:

- **Quantization:** Convert FP32 models to INT8 for 4x size reduction and faster inference on edge CPUs
- **Pruning:** Remove low-importance weights to reduce model size by 50-80% with minimal accuracy loss
- **Knowledge distillation:** Train smaller student models from larger teacher models for edge deployment
- **Runtime selection:** Choose appropriate inference runtime (TFLite, ONNX Runtime, TVM) based on edge hardware

Track accuracy vs model size trade-offs to find the optimal operating point.

### Step 5: Implement Adaptive Data Compression

Build bandwidth-aware compression that adapts to network conditions:

- **Delta encoding:** Transmit only changes from previous reading (typical 85-95% bandwidth reduction)
- **Lossy compression:** Configurable precision reduction for non-critical sensors (e.g., round temperature to 0.1C)
- **Batch compression:** Accumulate readings and compress batches with LZ4 or Zstd before transmission
- **Adaptive quality:** Increase compression ratio when bandwidth is constrained; reduce when bandwidth is available

### Step 6: Implement Energy-Aware Scheduling

Build an energy optimizer for battery-powered and solar-powered edge devices:

- **Duty cycling:** Configure sensor wake/sleep intervals based on event urgency and battery level
- **Harvest-aware scheduling:** Align energy-intensive tasks (model inference, bulk upload) with solar harvest periods
- **Battery prediction:** Estimate remaining battery life based on current consumption profile
- **Low-power mode:** Progressively reduce functionality as battery depletes (reduce sampling rate, disable ML, increase upload interval)

### Step 7: Forecast Edge Resource Needs

Project future resource requirements based on fleet growth and workload trends.

**Tool:** `mcp__mcp-graph__forecast`
- Input: historical edge resource utilization, fleet growth rate, workload complexity trends
- Output: projected CPU, memory, storage, and bandwidth needs for 30/60/90 day horizons
- Identify: when current edge hardware will reach capacity limits

### Step 8: Implement Edge Health Monitoring

Build continuous monitoring of edge device fleet health:

- **Heartbeat monitoring:** Detect offline devices within configurable timeout
- **Resource alerts:** Trigger when CPU, memory, or storage exceeds threshold
- **Thermal management:** Monitor device temperature and throttle workload if overheating
- **Firmware tracking:** Track firmware versions across fleet, identify devices needing updates

### Step 9: Run Optimization Analysis

Verify that optimizations achieve the targeted improvements in latency, energy, and bandwidth.

**Tool:** `mcp__mcp-graph__analyze`
- Mode: `implement_done`
- Compare: pre-optimization vs post-optimization metrics for each target
- Verify: no accuracy degradation from model quantization or lossy compression

### Step 10: Record Optimization Strategy

Persist placement decisions, compression parameters, energy scheduling policy, and capacity forecasts.

**Tool:** `mcp__mcp-graph__write_memory`
- Category: `architecture`
- Content: computation placement rules, quantization parameters, compression strategy, energy policy, capacity forecast

## Output Format

```yaml
edge_optimization_report:
  fleet:
    total_edge_devices: 48
    gateways: 4
    device_types:
      - type: "ESP32"
        count: 36
        role: "sensor + on-device filtering"
      - type: "Raspberry Pi 4"
        count: 8
        role: "edge gateway + ML inference"
      - type: "Jetson Nano"
        count: 4
        role: "edge gateway + video processing"
  computation_placement:
    on_device: ["threshold_filter", "delta_encoding", "duty_cycle"]
    edge_gateway: ["window_aggregation", "anomaly_detection", "protocol_conversion"]
    cloud: ["model_training", "historical_analytics", "cross_site_correlation"]
  optimizations:
    model_quantization:
      original_size_mb: 48
      quantized_size_mb: 12
      accuracy_delta: "-0.3%"
      inference_speedup: "3.8x"
    data_compression:
      raw_bandwidth_mbps: 4.2
      compressed_bandwidth_mbps: 0.6
      compression_ratio: "7:1"
      method: "delta + lz4"
    energy:
      avg_battery_life_before: "14 days"
      avg_battery_life_after: "31 days"
      duty_cycle: "10s on / 50s sleep"
  performance:
    avg_latency_before_ms: 240
    avg_latency_after_ms: 18
    latency_reduction: "92%"
    bandwidth_reduction: "86%"
    energy_reduction: "55%"
  capacity_forecast:
    current_utilization: "62%"
    projected_90d_utilization: "78%"
    upgrade_needed_by: "2026-08-15"
```

## Anti-Patterns

- Do NOT send all raw data to the cloud when edge processing can reduce volume by 80%+
- Do NOT deploy full-precision ML models on resource-constrained edge devices; always quantize
- Do NOT use fixed duty cycles for all sensors; adapt wake intervals based on event urgency and battery state
- Do NOT ignore thermal constraints on edge devices; sustained high CPU usage causes throttling and premature failure
- Do NOT optimize for a single metric (latency OR energy OR bandwidth); balance all three with weighted objectives
- Do NOT skip capacity forecasting; running edge devices at full utilization leads to unpredictable failures
- Do NOT assume edge devices have reliable connectivity; implement store-and-forward for intermittent connections
