---
name: graph-cv-graph-visual-analyzer
description: Visual analysis of task graph layout to detect bottleneck clusters, density issues, and structural anomalies in rendered graph diagrams
triggers:
  - graph-cv-graph-visual-analyzer
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-cv-graph-visual-analyzer

Autonomous visual analyzer for rendered execution graph layouts (Mermaid, React Flow, exported PNGs). This skill examines the visual topology of the task graph to detect bottleneck clusters, overcrowded regions, orphaned subgraphs, critical path bottlenecks, and layout density anomalies — providing spatial intelligence that pure graph algorithms miss because they ignore visual rendering context.

## When to Use

- After exporting the execution graph as Mermaid or screenshot and wanting to assess structural health visually
- When sprint planning reveals that tasks feel "tangled" but topological analysis shows no issues
- When the dashboard graph view appears cluttered and needs layout optimization recommendations
- During REVIEW phase to validate that the graph structure is comprehensible and well-organized
- When metrics show unexpected cycle times that may be caused by hidden structural bottlenecks
- When the user says "analyze graph layout", "graph density", "bottleneck visual", or "graph health check"

## Mandatory Flow

```
export_graph_visual → detect_clusters → measure_density → identify_bottlenecks → detect_orphans → assess_critical_path → generate_recommendations → write_memory
```

## Workflow

### Step 1: Export Graph as Visual Representation

Generate a visual rendering of the current execution graph for analysis.

```
Tool: mcp__mcp-graph__export
Params:
  format: "mermaid"
```

Capture the rendered output as an analyzable image. If the graph is large (>50 nodes), segment into subgraphs by epic or phase for tractable analysis.

Retrieve current graph metrics for correlation with visual findings:

```
Tool: mcp__mcp-graph__metrics
Params:
  type: "graph"
```

### Step 2: Detect Node Clusters and Groupings

Analyze the visual layout to identify spatial clusters — groups of nodes that are visually proximate and likely represent related work:

| Cluster Type | Visual Pattern | Significance |
|---|---|---|
| Dense hub | Many nodes converging on a single node | Bottleneck risk — single point of failure |
| Fan-out | One node with many outgoing edges | Decomposition point — potential parallelism |
| Fan-in | Many nodes converging before a gate | Integration point — synchronization risk |
| Island | Disconnected subgraph | Orphaned work — missing dependencies |
| Chain | Long linear sequence | Sequential bottleneck — no parallelism |
| Mesh | Highly interconnected subgroup | Over-coupling — may need decomposition |

For each detected cluster, record: center coordinates, radius, node count, edge density, and the dominant relationship type.

### Step 3: Measure Layout Density Metrics

Calculate spatial density metrics across the graph rendering:

```
Tool: mcp__mcp-graph__analyze
Params:
  mode: "progress"
```

| Metric | Formula | Healthy Range |
|---|---|---|
| Node density | nodes / rendering_area | 0.01 - 0.05 nodes/px^2 |
| Edge crossing ratio | crossings / total_edges | < 0.15 (15%) |
| Overlap score | overlapping_bounding_boxes / total_nodes | 0 (no overlaps) |
| Whitespace ratio | empty_area / total_area | 0.40 - 0.70 |
| Aspect ratio | width / height | 0.5 - 2.0 (avoids extreme shapes) |
| Layer balance | stdev(nodes_per_layer) / mean(nodes_per_layer) | < 0.5 |

Flag any metric outside its healthy range as a layout issue.

### Step 4: Identify Bottleneck Nodes Visually

Detect nodes that visually appear as bottlenecks based on their connectivity and position:

```
Tool: mcp__mcp-graph__analyze
Params:
  mode: "validate_ready"
```

A node is a visual bottleneck if:
1. **High in-degree** — More than 3 incoming edges (many tasks depend on it completing)
2. **High out-degree** — More than 5 outgoing edges (many tasks are blocked by it)
3. **Bridge node** — Removing it would disconnect the graph into separate components
4. **Critical path member** — Lies on the longest path from start to end
5. **Status blocked** — Currently blocked and holding up downstream work

For each bottleneck, calculate the blast radius (how many nodes are transitively blocked).

### Step 5: Detect Orphaned Subgraphs and Disconnections

Identify nodes or subgraphs that are visually isolated from the main workflow:

```
Tool: mcp__mcp-graph__analyze
Params:
  mode: "done_integrity"
```

| Issue | Description | Severity |
|---|---|---|
| True orphan | Node with zero edges | High — work is untracked |
| Isolated pair | Two connected nodes disconnected from rest | Medium — missing context |
| Floating subtree | Subgraph with no path to root or leaf | Medium — unclear priority |
| Dead branch | All nodes in subtree are status=done but parent is not | Low — cleanup needed |

### Step 6: Assess Critical Path Visualization

Overlay the critical path on the visual graph to verify it matches expectations:

```
Tool: mcp__mcp-graph__metrics
Params:
  type: "velocity"
```

Highlight the critical path visually and check:
1. Is the critical path the longest chain in the graph (visually)?
2. Are there parallel paths that could shorten the critical path if resources were reallocated?
3. Are bottleneck nodes on the critical path (compounding risk)?
4. Does the critical path pass through any blocked nodes?

### Step 7: Generate Layout and Structural Recommendations

Based on all findings, generate actionable recommendations:

```
Tool: mcp__mcp-graph__node
Params:
  action: "add"
  name: "GRAPH-HEALTH: Layout optimization recommendations"
  type: "task"
  priority: "low"
  description: "Visual graph analysis identified N issues: <summary of clusters, density problems, bottlenecks, orphans>. Recommendations: <specific actions>."
  acceptanceCriteria: "1. All orphaned nodes connected or archived\n2. Bottleneck nodes decomposed or parallelized\n3. Edge crossing ratio reduced below 15%"
```

Recommendation categories:
- **Decompose** — Break up dense hubs into smaller, parallel subtasks
- **Relink** — Add missing edges to connect orphaned subgraphs
- **Reorder** — Suggest dependency changes to reduce critical path length
- **Archive** — Mark dead branches for cleanup
- **Rebalance** — Suggest layer rebalancing for better visual clarity

### Step 8: Persist Analysis Results to Memory

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Graph Visual Analysis — <date>"
  content: "<total nodes analyzed, clusters detected, density metrics, bottleneck nodes, orphans found, critical path length, recommendations generated>"
  tags: ["graph-analysis", "computer-vision", "bottleneck", "layout", "density"]
```

## Output Format

```
Phase: GRAPH VISUAL ANALYSIS
Graph Size: N nodes, M edges
Rendering: <format> (<width>x<height>)

Cluster Analysis:
  Dense Hubs: N (nodes: <list>)
  Fan-Out Points: N
  Fan-In Gates: N
  Islands: N
  Long Chains: N (max length: K)
  Mesh Regions: N

Density Metrics:
  Node Density: X.XX nodes/area (healthy: 0.01-0.05)
  Edge Crossing Ratio: X.X% (target: <15%)
  Overlap Score: X (target: 0)
  Whitespace Ratio: X.X% (target: 40-70%)
  Layer Balance: X.XX (target: <0.5)

Bottleneck Nodes: N
  Critical: <node names with blast radius>
  On Critical Path: N/N

Orphaned Elements:
  True Orphans: N
  Isolated Pairs: N
  Floating Subtrees: N
  Dead Branches: N

Critical Path:
  Length: N nodes
  Blocked Nodes on Path: N
  Parallelization Opportunities: N

Recommendations Generated: N
  Decompose: N
  Relink: N
  Reorder: N
  Archive: N

Saved to memory: "Graph Visual Analysis — <date>"
```

## Anti-Patterns

- Do NOT analyze only the topological structure — visual layout reveals clustering and density issues that adjacency matrices miss
- Do NOT ignore edge crossings — high crossing ratios indicate poorly organized dependency structures, not just rendering artifacts
- Do NOT treat orphaned nodes as harmless — every disconnected node represents untracked or mismanaged work
- Do NOT skip the critical path overlay — bottleneck analysis without critical path context leads to optimizing non-constraining paths
- Do NOT run visual analysis on graphs with more than 200 nodes without segmentation — large graphs produce unreadable renderings
- Do NOT generate recommendations without current metrics — velocity and cycle time data are essential for prioritizing which layout issues matter most
- Do NOT conflate visual clutter with structural problems — sometimes the graph is healthy but the rendering engine needs better layout parameters
