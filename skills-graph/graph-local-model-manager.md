---
name: graph-local-model-manager
description: Local model management — quantization, LoRA adapters, inference acceleration, caching, and model lifecycle optimization
triggers:
  - graph-local-model-manager
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-local-model-manager

Manages the full lifecycle of local AI models including quantization selection, LoRA adapter training and merging, inference acceleration configuration, KV-cache optimization, and model versioning. Ensures the local inference stack runs at peak performance with minimal resource footprint.

## When to Use

- When setting up a new local model for the first time in the project
- When inference latency exceeds acceptable thresholds (>5s per request)
- When GPU/CPU memory usage is critically high during model inference
- Proactively after adding new task types that may benefit from fine-tuned adapters
- When a new model release is available and needs evaluation against current models
- Autonomously when resource utilization metrics cross warning thresholds

## Mandatory Flow

```
analyze(model_inventory) → assess_hardware → select_quantization → configure_acceleration → optimize_cache → benchmark → write_memory
```

## Workflow

### Step 1: Inventory Current Models

Assess the current model deployment state:
```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

Gather knowledge about existing model configurations:
```
Tool: mcp__mcp-graph__knowledge_stats
```

Build the model inventory:

| Model | Size | Quantization | Use Case | Avg Latency | Memory |
|-------|------|-------------|----------|-------------|--------|
| Model A | 7B | Q4_K_M | Code generation | 2.1s | 4.2GB |
| Model B | 13B | Q5_K_S | Complex reasoning | 4.8s | 8.1GB |
| Model C | 3B | Q8_0 | Fast classification | 0.3s | 3.0GB |

### Step 2: Assess Hardware Constraints

Profile the available hardware to determine optimization boundaries:

| Resource | Available | Reserved | Usable |
|----------|-----------|----------|--------|
| GPU VRAM | GB | GB (OS/other) | GB |
| System RAM | GB | GB (OS/other) | GB |
| CPU cores | N | N (OS/other) | N |
| Storage (models) | GB | GB (data/other) | GB |

Determine the maximum model size that fits comfortably (target <80% of usable resources).

### Step 3: Select Quantization Strategy

Choose the optimal quantization level per model based on the quality-size tradeoff:

| Quantization | Size Reduction | Quality Loss | Best For |
|-------------|---------------|-------------|----------|
| Q8_0 | ~50% | Minimal (<1%) | Critical reasoning tasks |
| Q6_K | ~58% | Very low (<2%) | High-quality general use |
| Q5_K_M | ~63% | Low (<3%) | Balanced quality/speed |
| Q4_K_M | ~70% | Moderate (<5%) | Standard tasks, constrained RAM |
| Q3_K_M | ~75% | Notable (<8%) | Fast classification, low RAM |
| Q2_K | ~82% | Significant (>10%) | Only for non-critical routing |

Decision rule: Start with Q5_K_M. If memory allows, upgrade to Q6_K. If memory is tight, downgrade to Q4_K_M. Never go below Q3_K_M for tasks affecting code quality.

### Step 4: Configure LoRA Adapters

For task-specific fine-tuning with minimal resource overhead:

1. **Identify candidates**: Tasks with >20 completed examples of Grade A quality
2. **Prepare training data**: Extract high-quality input-output pairs from graph history
   ```
   Tool: mcp__mcp-graph__search (query: "status:done grade:A")
   ```
3. **Configure LoRA parameters**:
   - Rank (r): 8-32 (higher = more capacity, more memory)
   - Alpha: 2x rank (standard scaling)
   - Target modules: attention layers (q_proj, v_proj minimum)
   - Dropout: 0.05-0.1

4. **Merge strategy**: Keep adapters separate for hot-swapping, merge only for production deployment

### Step 5: Configure Inference Acceleration

Optimize the inference pipeline for maximum throughput:

| Technique | Impact | Tradeoff |
|-----------|--------|----------|
| Continuous batching | +40-60% throughput | Slight latency increase for individual requests |
| KV-cache quantization | -30% memory | Negligible quality impact |
| Flash Attention | -40% memory, +20% speed | Requires compatible hardware |
| Speculative decoding | +2-3x speed | Requires draft model |
| Prefix caching | +50% speed for repeated prefixes | Memory for cache storage |
| Tensor parallelism | Splits across GPUs | Requires multi-GPU setup |

### Step 6: Optimize KV-Cache

Fine-tune the key-value cache for the project's query patterns:
```
Tool: mcp__mcp-graph__metrics
```

Cache optimization parameters:
- **Max cache size**: Set based on available memory (target 20% of model memory)
- **Eviction policy**: LRU with frequency boost for common query prefixes
- **Prefix sharing**: Enable for repetitive prompt templates (saves 30-50% cache space)
- **Compression**: Apply FP8 quantization to cached KV pairs (50% reduction, <1% quality loss)

### Step 7: Benchmark and Validate

Run comprehensive benchmarks comparing before and after optimization:
```
Tool: mcp__mcp-graph__metrics
```

Benchmark dimensions:

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Tokens/second | | | >30 t/s |
| Time to first token | | | <200ms |
| Peak memory usage | | | <80% available |
| Quality (Grade distribution) | | | No degradation |
| Cache hit rate | | | >40% |

### Step 8: Persist Configuration

Save the optimized configuration and benchmark results:
```
Tool: mcp__mcp-graph__write_memory
Params:
  category: "pattern"
  content: "Local model config v<N>: Model=<name>, Quant=<level>, LoRA=<config>, Accel=<techniques>. Benchmark: <latency>ms, <throughput> t/s, <memory>GB."
  tags: ["local-model", "quantization", "inference-optimization", "benchmark"]
```

### Step 9: Self-Healing Monitoring

Set up continuous monitoring triggers:

- If inference latency exceeds 2x baseline, trigger cache analysis
- If memory usage exceeds 90%, trigger quantization downgrade evaluation
- If quality grades degrade after model change, rollback to previous configuration
- Weekly model inventory refresh to detect new versions or deprecated models

```
Tool: mcp__mcp-graph__write_memory
Params:
  category: "pattern"
  content: "Model monitoring thresholds: latency_warn=<ms>, memory_warn=<GB>, quality_floor=Grade<X>."
  tags: ["local-model", "monitoring", "thresholds"]
```

## Output Format

```
Local Model Manager Report
==========================
Models Managed: <N>
Hardware Profile: <GPU_model> (<VRAM>GB), <RAM>GB RAM, <CPU> cores

Model Configuration:
  <model_1>: <quant_level>, <size>GB, <latency>ms, <use_case>
  <model_2>: <quant_level>, <size>GB, <latency>ms, <use_case>

LoRA Adapters: <N> active
  <adapter_1>: rank=<r>, target=<modules>, task_type=<type>

Acceleration:
  Techniques Active: <list>
  Cache Hit Rate: <N>%
  Throughput: <N> tokens/sec

Memory Usage: <used>/<total>GB (<percent>%)
Quality Impact: <none/minimal/notable>
Next Review: <date>
```

## Anti-Patterns

- Do NOT quantize below Q3_K_M for any task that affects code quality or architectural decisions
- Do NOT train LoRA adapters with fewer than 20 high-quality examples — underfitting produces garbage
- Do NOT enable all acceleration techniques simultaneously — profile each one's impact individually
- Do NOT ignore quality metrics after changing model configuration — always benchmark before and after
- Do NOT set KV-cache size larger than 30% of available memory — it starves the model itself
- Do NOT skip hardware profiling — optimization strategies differ drastically between GPU and CPU-only
- Do NOT forget to version model configurations via `write_memory` — rollback requires history
