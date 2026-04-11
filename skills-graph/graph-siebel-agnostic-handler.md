---
name: graph-siebel-agnostic-handler
description: Version-agnostic Siebel CRM handler that detects Siebel version (7.x to IP202x) and abstracts Business Components/Objects/Workflows into a unified API using Strangler Fig modernization
triggers:
  - graph-siebel-agnostic-handler
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-siebel-agnostic-handler

Version-agnostic Siebel CRM handler that detects the target Siebel version (7.x through IP202x), abstracts Business Components, Business Objects, and Workflows into a unified API layer, and applies the Strangler Fig pattern for incremental modernization. Leverages the 8 existing Siebel MCP tools for analysis, composition, environment detection, SIF generation/import, doc import, search, and validation.

## When to Use

- When integrating with a Siebel CRM environment of unknown or mixed versions
- When modernizing Siebel customizations using the Strangler Fig pattern
- When generating or importing SIF (Siebel Interface Format) files across version boundaries
- When analyzing Siebel Business Components, Objects, or Workflows for migration readiness
- When composing new Siebel configurations that must remain backward-compatible
- When validating Siebel artifacts against version-specific constraints

## Mandatory Flow

```
siebel_env(detect version) --> siebel_analyze(scan artifacts) --> siebel_search(find dependencies) --> siebel_composer(build abstraction) --> siebel_validate(check compatibility) --> siebel_generate_sif(export) --> analyze(impact) --> write_memory
```

## Workflow

### Step 1: Detect Siebel Environment and Version

Identify the target Siebel version and environment characteristics. This determines which API surface, schema version, and configuration patterns are available.

```
Tool: mcp__mcp-graph__siebel_env
Params:
  action: "detect"
```

Version classification matrix:

| Version Range | Era | Key Characteristics |
|---------------|-----|---------------------|
| 7.x - 7.8 | Legacy | COM Data Server, thin client, VB scripting |
| 8.0 - 8.2 | Classic | Open UI migration, eScript, Task UI |
| IP2013 - IP2017 | Innovation Pack | REST API, workspace, incremental repo |
| IP2018 - IP202x | Modern | Kubernetes support, containerized, CI/CD ready |

Record detected version, database platform (Oracle, MSSQL, DB2), and deployment topology (on-prem, hybrid, cloud).

### Step 2: Analyze Siebel Artifacts

Scan all Business Components (BC), Business Objects (BO), Workflows/Task Flows, and Applets. Classify each artifact by customization level and migration complexity.

```
Tool: mcp__mcp-graph__siebel_analyze
Params:
  scope: "full"
```

Classify artifacts into categories:

- **Vanilla** -- unmodified out-of-box configuration, safe to upgrade in-place
- **Light customization** -- field-level changes, calculated fields, user properties
- **Heavy customization** -- scripted BCs, custom workflows, integration objects
- **Legacy coupling** -- COM/ActiveX dependencies, VB scripts, version-locked APIs

Create a node in the execution graph for the analysis results:

```
Tool: mcp__mcp-graph__node (action: "add", type: "task", title: "Siebel Artifact Analysis — <environment>")
```

### Step 3: Search for Cross-Artifact Dependencies

Map dependencies between Business Components, Business Objects, Workflows, Integration Objects, and scripted extensions. Identify coupling hotspots.

```
Tool: mcp__mcp-graph__siebel_search
Params:
  query: "<artifact name or pattern>"
  scope: "dependencies"
```

Build a dependency map:
- BC-to-BO relationships (parent/child, MVG, pick maps)
- Workflow-to-BC invocations (step inputs/outputs)
- Integration Object-to-BC field mappings
- Script-to-API calls (eScript or VB referencing server methods)

Flag circular dependencies and tightly coupled artifact clusters.

### Step 4: Import Documentation and SIF Artifacts

Import existing Siebel documentation and SIF files to build a knowledge base for migration planning.

```
Tool: mcp__mcp-graph__siebel_import_docs
Params:
  source: "<documentation path or URL>"
```

```
Tool: mcp__mcp-graph__siebel_import_sif
Params:
  filePath: "<path to .sif file>"
```

Index imported artifacts into the knowledge store for RAG-powered queries during migration.

### Step 5: Compose Version-Agnostic Abstraction Layer

Build a unified abstraction layer that normalizes version-specific APIs into a common interface. Apply the Strangler Fig pattern: new functionality goes through the abstraction, legacy calls are gradually rerouted.

```
Tool: mcp__mcp-graph__siebel_composer
Params:
  action: "compose"
  pattern: "strangler-fig"
  targetVersion: "<detected version>"
```

Abstraction layer design:
- **Unified BC access** -- normalize field names, data types, and picklists across versions
- **Workflow adapter** -- translate between Task UI (8.x+) and classic Workflow (7.x) syntax
- **REST facade** -- wrap SOAP/COM endpoints with REST-compatible interfaces for pre-IP2013 systems
- **Script migration** -- convert VB scripts to eScript (7.x to 8.x) or REST handlers (IP2018+)

### Step 6: Validate Compatibility

Validate all composed artifacts against version-specific rules and cross-version compatibility constraints.

```
Tool: mcp__mcp-graph__siebel_validate
Params:
  scope: "full"
  targetVersion: "<version>"
```

Validation checks:
- Schema field compatibility (renamed/removed fields between versions)
- Deprecated API usage (COM Data Server, ActiveX controls)
- Script engine compatibility (VB to eScript migration completeness)
- Integration Object field mapping integrity
- Workflow step compatibility (runtime engine differences)

### Step 7: Generate Export Artifacts

Generate SIF files for the modernized configuration, ready for import into the target environment.

```
Tool: mcp__mcp-graph__siebel_generate_sif
Params:
  scope: "modified"
  format: "sif"
```

### Step 8: Impact Analysis and Memory

Run impact analysis on the modernization changes and record all findings.

```
Tool: mcp__mcp-graph__analyze (mode: "implement_done", nodeId: "<siebel_task_node>")
```

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Siebel Agnostic Handler — <environment> <version>"
  content: "<version detected, artifacts analyzed, abstraction composed, validation results, migration roadmap>"
  tags: ["siebel", "legacy", "strangler-fig", "migration"]
```

## Output Format

```
Phase: SIEBEL AGNOSTIC HANDLING
Environment: <detected version> on <database> (<deployment>)

Artifacts Scanned:
  Business Components: <N> (vanilla: <N>, light: <N>, heavy: <N>, legacy: <N>)
  Business Objects: <N>
  Workflows: <N>
  Integration Objects: <N>

Dependency Map:
  Total relationships: <N>
  Circular dependencies: <N>
  Coupling hotspots: <list>

Abstraction Layer:
  Pattern: Strangler Fig
  Endpoints wrapped: <N>
  Scripts migrated: <N>
  Legacy APIs facades: <N>

Validation:
  Compatibility: <pass/fail>
  Deprecated APIs: <N> flagged
  Schema mismatches: <N>

SIF Export: <N> files generated
Saved to memory: "Siebel Agnostic Handler — <env> <version>"
```

## Anti-Patterns

- Do NOT assume a single Siebel version across the entire landscape -- always detect per environment
- Do NOT migrate VB scripts by manual rewrite -- use the composer tool for automated translation
- Do NOT bypass validation after composing abstractions -- version-specific edge cases will break in production
- Do NOT import SIF files without first analyzing dependencies -- orphaned references cause silent failures
- Do NOT ignore COM/ActiveX dependencies in 7.x environments -- these require explicit facade wrappers
- Do NOT attempt big-bang migration -- the Strangler Fig pattern exists to enable incremental, safe evolution
- Do NOT skip writing memory after analysis -- version-specific findings are essential for future migration phases
