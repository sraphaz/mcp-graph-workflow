---
name: graph-cv-diagram-parser
description: Parse UML, flowcharts, and architecture diagrams into executable graph nodes and edges with automatic relationship detection
triggers:
  - graph-cv-diagram-parser
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-cv-diagram-parser

Autonomous diagram parser that converts visual UML diagrams, flowcharts, sequence diagrams, and architecture schematics into structured graph nodes and edges. This skill detects shapes, connectors, labels, and spatial relationships, then maps them to the execution graph — transforming static visual documentation into actionable, tracked work items.

## When to Use

- When a UML class diagram, sequence diagram, or activity diagram is provided as an image and needs to be reflected in the execution graph
- When flowchart screenshots from tools like Miro, Lucidchart, or draw.io need to be imported as graph structure
- When architecture diagrams need to be decomposed into implementable task nodes with dependency edges
- When legacy documentation contains diagrams that must be reverse-engineered into the current graph
- When whiteboard session photos contain box-and-arrow structures that represent task flows

## Mandatory Flow

```
detect_diagram_type → extract_shapes → extract_connectors → extract_labels → map_to_graph_schema → validate_structure → create_nodes → create_edges → write_memory
```

## Workflow

### Step 1: Detect Diagram Type and Visual Grammar

Classify the diagram to apply the correct parsing rules for shape semantics.

```
Tool: mcp__mcp-graph__analyze
Params:
  mode: "progress"
```

| Diagram Type | Shape Semantics | Connector Semantics |
|---|---|---|
| UML Class | Rectangle = class, compartments = attributes/methods | Arrow = inheritance, diamond = composition |
| UML Sequence | Rectangle = actor/component, vertical line = lifeline | Arrow = message/call, dashed = return |
| Flowchart | Rectangle = process, diamond = decision, oval = terminal | Arrow = flow direction |
| Architecture | Box = service/component, cylinder = database | Arrow = data flow, dependency |
| ER Diagram | Rectangle = entity, oval = attribute | Line = relationship, crow's foot = cardinality |
| Mind Map | Central node = topic, branches = subtopics | Lines = hierarchy |

Search for prior diagram parses to detect updates vs new diagrams:

```
Tool: mcp__mcp-graph__search
Params:
  query: "diagram parse <source filename>"
  scope: "knowledge"
```

### Step 2: Extract Shapes and Bounding Regions

Detect all discrete shapes in the diagram using contour detection and shape classification:

1. **Edge detection** — Apply Canny edge detection to isolate shape boundaries
2. **Contour extraction** — Find closed contours representing individual shapes
3. **Shape classification** — Classify each contour as rectangle, diamond, oval, circle, cylinder, or irregular
4. **Hierarchy detection** — Identify nested shapes (e.g., compartments within a class box)
5. **Color segmentation** — Detect color-coded groups or swimlanes

For each shape, record:
- Bounding box coordinates (x, y, width, height)
- Shape type classification
- Fill color and border color
- Nesting level (parent shape if contained within another)

### Step 3: Extract Connectors and Directional Relationships

Detect lines, arrows, and connectors between shapes:

1. **Line detection** — Hough line transform to find straight connectors
2. **Curve detection** — Bezier curve fitting for curved connectors
3. **Arrowhead detection** — Classify connector endpoints (arrow, diamond, circle, none)
4. **Source/target mapping** — Associate each connector with its source and target shapes
5. **Label extraction** — Detect text on or near connectors as relationship labels

| Arrowhead Type | Relationship Meaning |
|---|---|
| Solid arrow | Directed dependency or flow |
| Open arrow | Inheritance or generalization |
| Diamond (filled) | Composition |
| Diamond (open) | Aggregation |
| No arrowhead | Association or bidirectional |
| Dashed line | Optional or async relationship |

### Step 4: Extract Labels and Text Content

Apply OCR specifically to text within and near detected shapes and connectors:

```
Tool: mcp__mcp-graph__rag_context
Params:
  query: "diagram label text extraction"
  sources: ["knowledge"]
```

Map extracted text to its visual context:
- **Shape labels** — Text inside shapes becomes the node name
- **Compartment text** — Text in subdivided regions becomes node description/metadata
- **Connector labels** — Text on arrows becomes edge labels or relationship types
- **Annotations** — Free-floating text becomes notes attached to nearest nodes

### Step 5: Map to Graph Schema

Transform the visual elements into graph-compatible structures:

```
Tool: mcp__mcp-graph__analyze
Params:
  mode: "implement_done"
```

| Visual Element | Graph Element | Mapping Rule |
|---|---|---|
| Shape with label | Node | name = label, type = inferred from shape |
| Connector with arrowhead | Edge | from = source shape, to = target shape |
| Nested shape | Parent-child edge | type = "contains" |
| Swimlane | Group metadata | tag = swimlane label |
| Color group | Category | metadata.category = color meaning |
| Decision diamond | Branching node | type = "decision", multiple outgoing edges |

### Step 6: Validate Parsed Structure

Before creating graph elements, validate structural integrity:

1. **Orphan check** — Every shape must have at least one connector (or be flagged)
2. **Cycle detection** — Flowcharts should be DAGs; cycles must be intentional
3. **Label completeness** — Shapes without labels are flagged for manual annotation
4. **Connector integrity** — Every connector must have both a source and target shape
5. **Duplicate detection** — Check existing graph for nodes that match parsed labels

```
Tool: mcp__mcp-graph__search
Params:
  query: "<primary diagram label>"
  scope: "nodes"
```

### Step 7: Create Graph Nodes from Parsed Shapes

For each validated shape, create a corresponding graph node:

```
Tool: mcp__mcp-graph__node
Params:
  action: "add"
  name: "DIAGRAM: <shape label>"
  type: "<inferred from diagram type>"
  priority: "medium"
  description: "Parsed from <diagram type> diagram (<source file>). Shape: <shape type>. Position: (<x>, <y>). Compartment text: <if any>."
  acceptanceCriteria: "1. Implementation matches diagram specification\n2. All relationships from diagram are satisfied\n3. Validated against original diagram"
```

### Step 8: Create Graph Edges from Parsed Connectors

For each validated connector, create a corresponding graph edge:

```
Tool: mcp__mcp-graph__edge
Params:
  action: "add"
  from: "<source-node-id>"
  to: "<target-node-id>"
  type: "<inferred from arrowhead>"
```

### Step 9: Persist Parse Results to Memory

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Diagram Parse — <source filename> — <date>"
  content: "<diagram type, shapes detected, connectors detected, nodes created, edges created, orphan count, validation issues>"
  tags: ["diagram", "computer-vision", "graph-import", "uml", "flowchart"]
```

## Output Format

```
Phase: DIAGRAM PARSING
Source: <filename> (<diagram type>)
Dimensions: <width>x<height>

Shape Detection:
  Total Shapes: N
  Rectangles: N
  Diamonds: N
  Ovals: N
  Cylinders: N
  Nested Groups: N

Connector Detection:
  Total Connectors: N
  Directed (arrow): N
  Bidirectional: N
  Dashed: N

Label Extraction:
  Shape Labels: N/N (X% coverage)
  Connector Labels: N
  Annotations: N

Validation:
  Orphan Shapes: N
  Unlabeled Shapes: N
  Broken Connectors: N
  Cycles Detected: N

Graph Elements Created:
  Nodes: N
  Edges: N
  Skipped (duplicates): N

Saved to memory: "Diagram Parse — <source> — <date>"
```

## Anti-Patterns

- Do NOT create nodes without labels — unlabeled shapes must be flagged for human review, never auto-created with placeholder names
- Do NOT ignore connector direction — the difference between A->B and B->A fundamentally changes dependency semantics
- Do NOT flatten nested structures — compartments and swimlanes carry hierarchical meaning that must be preserved in the graph
- Do NOT parse low-resolution or heavily compressed diagrams — JPEG artifacts destroy edge detection accuracy
- Do NOT skip the duplicate check — importing a diagram twice creates phantom duplicate nodes that corrupt the graph
- Do NOT assume all diagrams are DAGs — sequence diagrams and state machines have valid cycles that must be handled correctly
- Do NOT discard spatial layout information — relative positioning of shapes encodes implicit grouping and priority that aids understanding
