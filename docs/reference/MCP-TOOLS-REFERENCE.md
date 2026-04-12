# MCP Tools Reference

<!-- mcp-graph:tools-summary:start -->
> 54 tools organized in 5 categories — complete parameter reference.
> v7.0: 6 deprecated tools removed (add_node, delete_node, update_node, validate_ac, validate_task, list_skills). New: `graph_health`. See [Migration Guide](../MIGRATION-v7.md).

## Summary

| Category | Tools | Count |
|----------|-------|-------|
| Core | analyze, clone_node, context, context_compress, davinci_analyze, davinci_build, davinci_convert, delete_memory, edge, export, finish_task, forecast, graph_health, help, import_graph, import_prd, init, intersect_knowledge, journey, kanban, knowledge_prune, learn_from_project, list, list_memories, manage_skill, metrics, move_node, next, node, plan_sprint, rag_context, read_memory, reindex_knowledge, search, self_healing, set_phase, show, snapshot, start_task, sync_stack_docs, template, update_status, validate, write_memory | 44 |
| Translation | analyze_translation, translate_code, translation_jobs | 3 |
| Code Intelligence | code_intelligence | 1 |
| Knowledge | export_knowledge, knowledge_feedback, knowledge_stats | 3 |
| Siebel CRM | siebel_analyze, siebel_composer, siebel_env, siebel_generate_sif, siebel_import_docs, siebel_import_sif, siebel_search, siebel_validate | 8 |
<!-- mcp-graph:tools-summary:end -->

---

## Graph CRUD

### `init`

Initialize a new project graph.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `projectName` | string | No | — | Name for the project |

### `import_prd`

Import a PRD file and convert it into graph nodes and edges.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `filePath` | string | Yes | — | Path to the PRD text file (.md, .txt, .pdf, .html) |
| `force` | boolean | No | `false` | Force re-import: delete nodes from previous import before importing |

### `import_graph`

Import and merge an external graph (JSON) into the current project. Uses INSERT OR IGNORE semantics — existing local nodes/edges win on conflict.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `graph` | string | No | — | JSON string of a GraphDocument (nodes + edges) |
| `filePath` | string | No | — | Path to a JSON file containing a GraphDocument |
| `dry_run` | boolean | No | `false` | Preview merge counts without writing to the database |

> One of `graph` or `filePath` must be provided. Returns counts of inserted nodes and edges.

### `node`

Unified CRUD for graph nodes. Replaces `add_node`, `update_node`, and `delete_node` (v5.5.0).

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `action` | "add"\|"update"\|"delete" | Yes | — | Action to perform |

**action: "add"** — Create a new node:

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `type` | NodeType | Yes | — | Node type |
| `title` | string | Yes | — | Node title |
| `description` | string | No | — | Node description |
| `status` | NodeStatus | No | `backlog` | Node status |
| `priority` | 1-5 | No | `3` | Priority (1=highest) |
| `xpSize` | XpSize | No | — | Size estimate: XS, S, M, L, XL |
| `estimateMinutes` | number | No | — | Time estimate in minutes |
| `tags` | string[] | No | — | Tags for categorization |
| `parentId` | string\|null | No | — | Parent node ID (auto-creates parent_of/child_of edges) |
| `sprint` | string\|null | No | — | Sprint identifier |
| `acceptanceCriteria` | string[] | No | — | Acceptance criteria |
| `blocked` | boolean | No | — | Whether the node is blocked |
| `metadata` | object | No | — | Custom metadata |

**action: "update"** — Update fields of an existing node:

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | Yes | — | Node ID to update |
| `title` | string | No | — | New title |
| `description` | string | No | — | New description |
| `type` | NodeType | No | — | New node type |
| `priority` | 1-5 | No | — | New priority |
| `xpSize` | XpSize | No | — | New size estimate |
| `estimateMinutes` | number | No | — | New time estimate |
| `tags` | string[] | No | — | New tags array |
| `sprint` | string\|null | No | — | Sprint assignment (null to clear) |
| `parentId` | string\|null | No | — | New parent node ID (null to clear; auto-updates edges) |
| `acceptanceCriteria` | string[] | No | — | New acceptance criteria |

**action: "delete"** — Delete a node with cascade:

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | Yes | — | Node ID to delete (cascades to children and edges) |

### `edge`

Manage edges (relationships) between nodes: add, delete, or list.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `action` | "add"\|"delete"\|"list" | Yes | — | Action to perform |
| `from` | string | No | — | Source node ID (required for add) |
| `to` | string | No | — | Target node ID (required for add) |
| `relationType` | RelationType | No | — | Relationship type (required for add, optional filter for list) |
| `reason` | string | No | — | Why this relationship exists (add only) |
| `weight` | number | No | — | Edge weight 0-1 (add only) |
| `id` | string | No | — | Edge ID (required for delete) |
| `nodeId` | string | No | — | Filter edges by node ID (list only) |
| `direction` | "from"\|"to"\|"both" | No | `both` | Edge direction relative to nodeId (list only) |

### `move_node`

Move a node to a new parent in the hierarchy.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | Yes | — | Node ID to move |
| `newParentId` | string\|null | Yes | — | New parent ID (null to make root) |

### `clone_node`

Clone a node (optionally with all children).

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | Yes | — | Node ID to clone |
| `deep` | boolean | No | `false` | Clone children recursively |
| `newParentId` | string | No | — | Parent ID for the cloned node |

### `export`

Export the graph as JSON, Mermaid diagram, or CSV.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `action` | "json"\|"mermaid"\|"csv" | Yes | — | Export format |
| `format` | "flowchart"\|"mindmap"\|"gantt"\|"stateDiagram" | No | `flowchart` | Mermaid diagram format (mermaid only) |
| `direction` | "TD"\|"LR" | No | `TD` | Flow direction (mermaid flowchart only) |
| `filterStatus` | NodeStatus[] | No | — | Only include nodes with these statuses (mermaid/csv) |
| `filterType` | NodeType[] | No | — | Only include nodes with these types (mermaid/csv) |

**Examples:**
```
export({ action: "mermaid", format: "gantt" })
→ Gantt chart of tasks with sprint timelines

export({ action: "csv" })
→ CSV with columns: id, type, title, status, priority, xpSize, sprint, parentId, tags

export({ action: "mermaid", format: "stateDiagram" })
→ State diagram showing status transitions across all nodes
```

---

## Querying

### `list`

List graph nodes with optional filters.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `type` | NodeType | No | — | Filter by node type |
| `status` | NodeStatus | No | — | Filter by node status |
| `sprint` | string | No | — | Filter by sprint name |

### `show`

Show detailed information about a node, including edges and children.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | Yes | — | Node ID to inspect |

### `search`

Full-text search across graph nodes using BM25 ranking.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query` | string | Yes | — | Search query text |
| `limit` | number | No | `20` | Maximum results (1-100) |
| `rerank` | boolean | No | `false` | Apply TF-IDF reranking |

### `rag_context`

Build RAG context from a natural language query with token budgeting.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query` | string | Yes | — | Natural language query |
| `tokenBudget` | number | No | `4000` | Max token budget (500-32000) |
| `detail` | "summary"\|"standard"\|"deep" | No | `standard` | Context detail level |

---

## Planning & Execution

### `next`

Suggest the next best task to work on based on priority, dependencies, and size. No parameters.

### `update_status`

Update the status of a node.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string \| string[] | Yes | — | Node ID or array of IDs for bulk update |
| `status` | NodeStatus | Yes | — | New status |

### `decompose`

Detect large tasks that should be decomposed into subtasks.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `nodeId` | string | No | — | Filter to a specific node |

### `velocity`

Calculate sprint velocity metrics.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `sprint` | string | No | — | Filter to a specific sprint |

### `dependencies`

Analyze dependency chains: blockers, cycles, or critical path.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `mode` | "blockers"\|"cycles"\|"critical_path" | Yes | — | Analysis mode |
| `nodeId` | string | No | — | Node ID (required for blockers mode) |

### `plan_sprint`

Generate a sprint planning report with task order, missing docs, risk assessment, and velocity estimates.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `mode` | "report"\|"next" | No | `report` | Full report or enhanced next task |

### `template`

Manage task templates: create reusable task structures, list available templates, apply templates to generate nodes with variable substitution.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `action` | "create"\|"list"\|"apply" | Yes | — | Action to perform |

**action: "create"** — Create a reusable template:

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | — | Template name |
| `description` | string | No | — | Template description |
| `definition` | object | Yes | — | Template definition (see below) |

Template definition structure:
```json
{
  "nodeDefinitions": [
    {
      "type": "task",
      "titleTemplate": "Implement {{feature}} backend",
      "description": "Backend implementation for {{feature}}",
      "xpSize": "M",
      "acceptanceCriteria": ["Unit tests pass", "API responds 200"],
      "tags": ["backend"]
    },
    {
      "type": "task",
      "titleTemplate": "Implement {{feature}} frontend",
      "xpSize": "M",
      "tags": ["frontend"]
    }
  ],
  "edgeDefinitions": [
    { "fromIndex": 1, "toIndex": 0, "relationType": "depends_on" }
  ]
}
```

**action: "list"** — List all available templates. No additional parameters.

**action: "apply"** — Instantiate a template:

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `templateId` | string | Yes | — | Template node ID to apply |
| `variables` | Record<string, string> | No | — | Variable substitutions for `{{var}}` placeholders |
| `parentId` | string | No | — | Parent node ID for created nodes |

**Example workflow:**
```
// 1. Create template
template({
  action: "create",
  name: "Feature Implementation",
  definition: {
    nodeDefinitions: [
      { type: "task", titleTemplate: "Implement {{feature}} backend", xpSize: "M" },
      { type: "task", titleTemplate: "Implement {{feature}} frontend", xpSize: "M" },
      { type: "task", titleTemplate: "Write E2E tests for {{feature}}", xpSize: "S" }
    ],
    edgeDefinitions: [
      { fromIndex: 1, toIndex: 0, relationType: "depends_on" },
      { fromIndex: 2, toIndex: 1, relationType: "depends_on" }
    ]
  }
})
→ { ok: true, templateId: "tmpl_abc123" }

// 2. Apply with variables
template({
  action: "apply",
  templateId: "tmpl_abc123",
  variables: { "feature": "Authentication" },
  parentId: "epic_auth"
})
→ { ok: true, nodesCreated: 3, edgesCreated: 2 }
// Creates: "Implement Authentication backend", "Implement Authentication frontend", "Write E2E tests for Authentication"
```

### `kanban`

Kanban board visualization and orchestration.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `action` | "board"\|"move"\|"suggestions" | Yes | — | Action to perform |
| `nodeId` | string | No | — | Node ID (required for `move`) |
| `newStatus` | NodeStatus | No | — | New status (required for `move`) |
| `swimlane` | "none"\|"epic"\|"sprint" | No | — | Swimlane grouping mode (for `board`) |

---

## Knowledge & RAG

### `context`

Get a compact, AI-optimized context payload for a task (parent, children, blockers, dependencies, acceptance criteria, source references, token metrics).

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | Yes | — | Node ID to build context for |

### `reindex_knowledge`

Reindex all knowledge sources into the unified store and rebuild embeddings.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `basePath` | string | No | cwd | Project base path for finding memories |
| `sources` | ("memory"\|"serena"\|"docs"\|"skills"\|"embeddings")[] | No | all | Which sources to reindex. "serena" is an alias for "memory". |

### `write_memory`

Write a project memory to `workflow-graph/memories/{name}.md`. Auto-indexes into the knowledge store for RAG search.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | — | Memory name (supports nested paths like "architecture/overview") |
| `content` | string | Yes | — | Memory content (markdown) |

### `read_memory`

Read a project memory from `workflow-graph/memories/{name}.md`.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | — | Memory name (without .md extension) |

### `list_memories`

List all project memories available in `workflow-graph/memories/`.

No parameters.

### `delete_memory`

Delete a project memory from `workflow-graph/memories/{name}.md` and remove from knowledge store.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | — | Memory name to delete (without .md extension) |

### `sync_stack_docs`

Auto-detect project stack and sync documentation via Context7.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `basePath` | string | No | cwd | Project base path |
| `libraries` | string[] | No | — | Specific libraries (overrides auto-detection) |

---

## Validation

### `validate`

Unified validation tool. Replaces `validate_task` and `validate_ac` (v5.5.0).

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `action` | "task"\|"ac" | Yes | — | Action to perform |

**action: "task"** — Browser-based validation with optional A/B comparison:

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `url` | string (URL) | Yes | — | URL to validate |
| `compareUrl` | string (URL) | No | — | Second URL for A/B comparison |
| `selector` | string | No | — | CSS selector to scope extraction |
| `nodeId` | string | No | — | Associate validation with a graph node |

**action: "ac"** — Validate acceptance criteria quality:

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `nodeId` | string | No | — | Specific node to validate (if omitted, validates all nodes with AC) |
| `all` | boolean | No | `true` | Validate all nodes with AC (only when nodeId is omitted) |

### `graph_health`

Unified graph health scan. Combines cycle detection, orphan detection, stuck task analysis, done integrity, and status flow validation into a single diagnostic report.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `action` | "scan" | No | `"scan"` | Action: scan (full diagnostic) |

### `self_healing`

Self-healing MAPE-K engine: scan the graph for stuck tasks, broken dependencies, cycles, orphans, and other issues.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `action` | "scan"\|"diagnose"\|"heal"\|"report" | Yes | — | scan = detect; diagnose = detect + analyze; heal = full MAPE-K loop; report = last metrics |
| `dryRun` | boolean | No | `true` | When true, heal actions are simulated but not applied |
| `staleHours` | number | No | `48` | Hours after which an in_progress task is considered stuck |

---

## Snapshots & Stats

### `stats`

Show aggregate statistics for the project graph, including context compression metrics. No parameters.

### `snapshot`

Manage graph snapshots: create, list, or restore.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `action` | "create"\|"list"\|"restore" | Yes | — | Action to perform |
| `snapshotId` | number | No | — | Snapshot ID (required for restore) |

---

## Analysis (via `analyze` tool)

The `analyze` tool is a gateway for all project analysis modes. Each mode provides a different lens on the graph.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `mode` | string | Yes | — | Analysis mode (see below) |
| `nodeId` | string | No | — | Node ID or sprint filter depending on mode |

### IMPLEMENT modes

| Mode | Phase | Description |
|------|-------|-------------|
| `implement_done` | IMPLEMENT | Definition of Done checklist (8 checks: 4 required + 4 recommended). Requires `nodeId`. |
| `tdd_check` | IMPLEMENT | TDD adherence report with testability score and suggested test specs from AC. Optional `nodeId` filter. |
| `progress` | IMPLEMENT | Sprint burndown + velocity trend + blockers + critical path + ETA. Optional `nodeId` as sprint filter. |

### ANALYZE modes

| Mode | Description |
|------|-------------|
| `prd_quality` | PRD quality assessment (score + grade + section analysis) |
| `scope` | Scope analysis: orphans, cycles, coverage matrix, conflicts |
| `ready` | Definition of Ready check |
| `risk` | Risk matrix assessment |

### DESIGN modes

| Mode | Description |
|------|-------------|
| `adr` | ADR (Architecture Decision Record) validation quality |
| `traceability` | Requirement→decision traceability matrix |
| `coupling` | Fan-in/out coupling analysis |
| `interfaces` | Interface-first quality check |
| `tech_risk` | Technical risk scoring |
| `design_ready` | DESIGN→PLAN gate readiness |
| `contract_coverage` | Interface/contract completeness check |
| `data_integrity` | Data model consistency validation |

### PLAN modes

| Mode | Description |
|------|-------------|
| `decompose` | Detect large tasks needing decomposition |
| `auto_ready` | Auto-promote eligible tasks from backlog to ready |
| `sprint_health` | Sprint health scoring and diagnostics |

### IMPLEMENT modes

| Mode | Description |
|------|-------------|
| `implement_done` | Definition of Done checklist (9 checks: 4 required + 5 recommended). Requires `nodeId`. |
| `tdd_check` | TDD adherence report with testability score and suggested test specs from AC. Optional `nodeId`. |
| `progress` | Sprint burndown + velocity trend + blockers + critical path + ETA. Optional `nodeId` as sprint filter. |

### VALIDATE modes

| Mode | Description |
|------|-------------|
| `validate_ready` | IMPLEMENT→VALIDATE gate readiness |
| `done_integrity` | Verify all done nodes meet quality standards |
| `status_flow` | Valid status transition check |
| `scenario_coverage` | User scenario coverage assessment |

### REVIEW modes

| Mode | Description |
|------|-------------|
| `review_ready` | VALIDATE→REVIEW gate readiness |
| `doc_completeness` | Documentation completeness check |

### HANDOFF modes

| Mode | Description |
|------|-------------|
| `handoff_ready` | REVIEW→HANDOFF gate readiness |

### DEPLOY modes

| Mode | Description |
|------|-------------|
| `deploy_ready` | HANDOFF→DEPLOY gate readiness (7 checks: 5 required + 2 recommended) |
| `release_check` | Release validation: semantic versioning, changelog, CI status |

### LISTENING modes

| Mode | Description |
|------|-------------|
| `listening_ready` | DEPLOY→LISTENING gate readiness |
| `backlog_health` | Track health and age of feedback/issue nodes |

### Game/Advanced modes

| Mode | Description |
|------|-------------|
| `formula_consistency` | Validate game formula balance and consistency |
| `state_completeness` | State machine completeness verification |
| `performance_budget` | Performance constraints validation (FPS, latency, memory) |
| `economy_simulation` | Game economy balance check (gold inflow/outflow, inflation risk). Params: `playerCount`, `avgSessionHours`, `avgLevel` |
| `concurrency_risk` | Parallel execution safety analysis |
| `scenario_coverage` | User scenario coverage assessment |
| `asset_blockers` | Asset dependency analysis |
| `config_coverage` | Configuration schema completeness |
| `metric_coverage` | Metric definition coverage |

### Universal modes (any phase)

| Mode | Description |
|------|-------------|
| `blockers` | Transitive blockers for a node (requires `nodeId`) |
| `cycles` | Dependency cycle detection |
| `critical_path` | Critical path through dependency DAG |

---

## User Journeys

### `journey`

Manage and query website journey maps — screen flows, form fields, CTAs, A/B variants. Indexes journey data into the knowledge store for RAG queries.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `action` | `"list"` \| `"get"` \| `"search"` \| `"index"` | Yes | — | Action to perform |
| `mapId` | string | For `get` | — | Journey map ID |
| `query` | string | For `search` | — | Search query for screens |

**Actions:**

- **`list`** — Returns all journey maps with id, name, url, description.
- **`get`** — Returns a compact AI-optimized representation of a specific map: screens with fields, CTAs, navigation edges (navigatesTo), variants, and summary stats.
- **`search`** — Full-text search across all screens by title, description, fields, CTAs, and URL.
- **`index`** — Indexes all journey maps into the knowledge store. Each screen becomes a searchable document with form fields, CTAs, navigation context, and metadata. Makes journey data discoverable via `rag_context`.

---

## Lifecycle & Enforcement

### `set_phase`

Override lifecycle phase detection, switch enforcement modes, or reset to auto-detection.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `phase` | string | Yes | — | Lifecycle phase (`ANALYZE`, `DESIGN`, `PLAN`, `IMPLEMENT`, `VALIDATE`, `REVIEW`, `HANDOFF`, `DEPLOY`, `LISTENING`, `auto`) |
| `force` | boolean | No | `false` | Force phase transition even if gate conditions are not met |
| `mode` | `"strict"` \| `"advisory"` | No | — | Lifecycle enforcement mode |
| `codeIntelligence` | `"strict"` \| `"advisory"` \| `"off"` | No | — | Code Intelligence enforcement mode |
| `prerequisites` | `"strict"` \| `"advisory"` \| `"off"` | No | — | Tool Prerequisites enforcement mode |

**Enforcement modes:**

| Mode | Lifecycle | Code Intelligence | Prerequisites |
|------|-----------|-------------------|---------------|
| `strict` | Blocks tools outside phase | Blocks mutating tools if index empty | Blocks tools if mandatory prerequisites not called |
| `advisory` | Warns only | Warns only | Warns only (default) |
| `off` | — | No checks | No checks |

**Full enforcement:**
```json
set_phase({ phase: "IMPLEMENT", mode: "strict", codeIntelligence: "strict", prerequisites: "strict" })
```

### Tool Prerequisites Rules

When `prerequisites` is `"strict"` or `"advisory"`, the system tracks tool calls per node and enforces mandatory prerequisites before allowing certain actions.

| Phase | Trigger | Required Prerequisites | Scope |
|-------|---------|----------------------|-------|
| DESIGN | `set_phase(PLAN)` | `analyze(design_ready)` | project |
| PLAN | `set_phase(IMPLEMENT)` | `sync_stack_docs` + `plan_sprint` | project |
| IMPLEMENT | `update_status(in_progress)` | `next` | project |
| IMPLEMENT | `update_status(done)` | `context` + `rag_context` + `analyze(implement_done)` | node |
| VALIDATE | `update_status(done)` | `validate` + `analyze(validate_ready)` | mixed |
| REVIEW | `set_phase(HANDOFF)` | `analyze(review_ready)` + `export` | project |
| HANDOFF | `set_phase(DEPLOY)` | `analyze(handoff_ready)` + `snapshot` + `write_memory` | project |
| DEPLOY | `set_phase(LISTENING)` | `analyze(deploy_ready)` + `snapshot` | project |

**Scope:** `node` = must be called for the specific nodeId. `project` = called once for the project. `mixed` = some node-scoped, some project-scoped.

---

## DaVinci Converter

Convert DaVinci JavaScript (PingOne DaVinci flows) to PingFederate/PingAccess Java plugins.

### `davinci_analyze`

Analyze DaVinci custom code (JavaScript). Extracts variables, API calls, flow logic, detects plugin type, and resolves variable mappings to Java equivalents.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `code` | string | Yes | — | DaVinci JavaScript code to analyze |
| `codeLocation` | "custom_function"\|"code_snippet"\|"html_template" | No | auto-detect | Code location type |
| `targetSdk` | "pingfederate"\|"pingaccess" | No | `pingfederate` | Target SDK for plugin type detection |

**Example:**
```
davinci_analyze({
  code: "var firstName = properties.firstName;\nif (!firstName) { return errorConnector('missing_name'); }",
  targetSdk: "pingfederate"
})
→ {
    ok: true,
    analysis: { variables: [...], apiCalls: [...], flowLogic: { conditionals: 1 } },
    resolvedVariables: [{ name: "firstName", kind: "property", javaEquivalent: "..." }],
    detection: { pluginType: "idp-adapter", confidence: 0.85 }
  }
```

### `davinci_convert`

Convert DaVinci JavaScript code to a PingFederate/PingAccess Java plugin. Generates Java class structure, POM.xml, and PF-INF descriptor. Validates input/output and persists job history.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `code` | string | Yes | — | DaVinci JavaScript code to convert |
| `pluginName` | string | Yes | — | Plugin name (kebab-case, e.g. `my-auth-adapter`) |
| `packageName` | string | Yes | — | Java package name (e.g. `com.example.adapter`) |
| `className` | string | Yes | — | Java class name (e.g. `MyAuthAdapter`) |
| `targetSdk` | "pingfederate"\|"pingaccess" | No | `pingfederate` | Target SDK |
| `pluginType` | string | No | auto-detect | Override plugin type (e.g. `idp-adapter`, `token-generator`, `sp-adapter`, `access-grant-manager`, `notification-publisher`, `secret-manager`, `password-credential-validator`, `custom-data-store`, `identity-store-provisioner`, `token-processor`) |

**Example:**
```
davinci_convert({
  code: "var email = properties.email; ...",
  pluginName: "email-verifier",
  packageName: "com.acme.auth",
  className: "EmailVerifierAdapter",
  targetSdk: "pingfederate"
})
→ {
    ok: true,
    jobId: "dvj_abc123",
    pluginType: "idp-adapter",
    confidence: 0.9,
    javaCode: "package com.acme.auth;\n...",
    pomXml: "<project>...</project>",
    pfInfDescriptor: { directoryName: "email-verifier", content: "...", fullPath: "..." },
    guiDescriptor: { fieldDeclarations: [...], fieldRegistrations: [...] },
    validation: { preConversion: [], postGeneration: [] },
    hint: "Use the generated POM and Java structure to build the plugin. Run davinci_build to compile."
  }
```

### `davinci_build`

Build a DaVinci-converted Java plugin using Maven. Checks environment (JDK, Maven, SDK) and runs `mvn package`.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `projectDir` | string | Yes | — | Path to the Maven project directory containing `pom.xml` |
| `checkOnly` | boolean | No | `false` | Only check environment, do not build |
| `jobId` | string | No | — | DaVinci job ID to update with build results |

**Example:**
```
// Check environment first
davinci_build({ projectDir: "/path/to/email-verifier", checkOnly: true })
→ {
    ok: true,
    action: "environment_check",
    environment: { readyToBuild: true, jdk: { found: true, version: "17.0.2" }, maven: { found: true }, sdk: { found: true } }
  }

// Build the plugin
davinci_build({ projectDir: "/path/to/email-verifier", jobId: "dvj_abc123" })
→ {
    ok: true,
    action: "build_complete",
    buildResult: { success: true, jarPath: "/path/to/target/email-verifier-1.0.jar", durationMs: 12500 }
  }
```

---

## Knowledge Tools

### `export_knowledge`

Export, import, or preview knowledge packages for team collaboration.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `action` | `"export"` \| `"import"` \| `"preview"` | Yes | — | Action to perform |
| `filePath` | string | No | `./knowledge-export.json` | Path for export output or import input |
| `sources` | string[] | No | all | Filter by source types (e.g. `["docs", "memory"]`) |
| `minQuality` | number | No | 0 | Minimum quality score filter (0-1) |
| `includeMemories` | boolean | No | true | Include project memories |
| `includeTranslationMemory` | boolean | No | true | Include translation memory entries |

**Example:**
```
export_knowledge({ action: "export", sources: ["memory", "docs"], minQuality: 0.5 })
→ { ok: true, filePath: "./knowledge-export.json", stats: { documents: 120, memories: 18, relations: 5 } }

export_knowledge({ action: "preview", filePath: "./team-knowledge.json" })
→ { ok: true, preview: { newDocuments: 45, existingDocuments: 75, newMemories: 3 } }
```

### `knowledge_feedback`

Provide feedback on a knowledge document to improve RAG quality.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `docId` | string | Yes | — | Knowledge document ID |
| `action` | `"helpful"` \| `"unhelpful"` \| `"outdated"` | Yes | — | Feedback action |
| `query` | string | No | — | The query that surfaced this document |
| `context` | string | No | — | Additional context about the feedback |

**Example:**
```
knowledge_feedback({ docId: "kdoc_abc123", action: "helpful", query: "lifecycle phases" })
→ { ok: true, docId: "kdoc_abc123", action: "helpful" }
```

### `knowledge_stats`

Get statistics about the knowledge store.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `topK` | number | No | 5 | Number of top accessed docs to return (1-50) |

**Example:**
```
knowledge_stats({ topK: 3 })
→ { total: 459, bySourceType: { memory: 25, docs: 7, graph_node: 224 }, topDocs: [...] }
```

### `intersect_knowledge`

Discover cross-domain knowledge intersections and generate novel skill ideas from the knowledge store.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `action` | "discover"\|"list"\|"detail" | Yes | — | discover = run intersection analysis; list = show previous; detail = single insight |
| `concept` | string | No | — | Filter intersections by concept keyword (e.g. 'quantum', 'blockchain') |
| `minScore` | number (0-1) | No | `0.15` | Minimum combined score threshold |
| `limit` | integer (1-50) | No | `10` | Maximum results to return |
| `docId` | string | No | — | Document ID (required for `detail` action) |

### `help`

On-demand reference for mcp-graph tools, analyze modes, skills, CLI commands, and workflow.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `topic` | `"tools"` \| `"analyze_modes"` \| `"skills"` \| `"cli"` \| `"knowledge"` \| `"workflow"` \| `"all"` | Yes | — | Reference topic |
| `phase` | string | No | — | Lifecycle phase to filter by |

**Example:**
```
help({ topic: "tools", phase: "IMPLEMENT" })
→ Returns tools relevant to IMPLEMENT phase (next, context, rag_context, update_status, ...)

help({ topic: "analyze_modes", phase: "DESIGN" })
→ Returns only DESIGN modes (adr, traceability, coupling, interfaces, tech_risk, design_ready)
```

---

## Type Reference

**NodeType (21 types):**

| Type | Category | Description |
|------|----------|-------------|
| `epic` | Core | High-level feature or user story |
| `task` | Core | Implementable unit of work |
| `subtask` | Core | Child of a task |
| `requirement` | Core | Functional or non-functional requirement |
| `constraint` | Core | Technical or business constraint |
| `milestone` | Core | Checkpoint or deliverable |
| `acceptance_criteria` | Core | Testable success condition |
| `risk` | Core | Identified risk or uncertainty |
| `decision` | Core | Architecture or technical decision (ADR) |
| `interface` | Game/Advanced | Interface or API contract definition |
| `formula` | Game/Advanced | Game formula or calculation rule |
| `state_machine` | Game/Advanced | State machine or FSM definition |
| `contract` | Game/Advanced | Service or data contract |
| `scenario` | Game/Advanced | User scenario or test scenario |
| `performance_budget` | Game/Advanced | Performance constraint (FPS, latency, memory) |
| `asset` | Game/Advanced | Asset dependency (art, audio, data) |
| `data_table` | Game/Advanced | Data table or lookup definition |
| `metric` | Game/Advanced | Observable metric or KPI |
| `config_schema` | Game/Advanced | Configuration schema definition |

**NodeStatus:** `backlog`, `ready`, `in_progress`, `blocked`, `done`

**RelationType (11 types):** `parent_of`, `child_of`, `depends_on`, `blocks`, `related_to`, `priority_over`, `implements`, `derived_from`, `provides`, `consumes`, `requires_asset`

**XpSize:** `XS`, `S`, `M`, `L`, `XL`

**Priority:** `1` (highest) to `5` (lowest)
