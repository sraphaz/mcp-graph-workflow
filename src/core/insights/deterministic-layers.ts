/**
 * Deterministic Layer Classification — maps every MCP tool to a deterministic layer.
 * Layer 0 (SQL): pure data retrieval
 * Layer 1 (Cache): session/semantic caching
 * Layer 2 (Heuristic): FSM/decision trees
 * Layer 3 (Property-Based): invariant checks (DoD, DoR, validation)
 * Layer 4 (Meta-Rule): learning from AI decisions
 */

export type DeterministicLayer = "L0_SQL" | "L1_Cache" | "L2_Heuristic" | "L3_PropertyBased" | "L4_MetaRule";

export interface ToolClassification {
  toolName: string;
  layer: DeterministicLayer;
  rationale: string;
}

const CLASSIFICATIONS: ToolClassification[] = [
  // L0 — Pure SQL / direct data retrieval
  { toolName: "list", layer: "L0_SQL", rationale: "Direct SQL SELECT with filters" },
  { toolName: "show", layer: "L0_SQL", rationale: "Direct node lookup by ID" },
  { toolName: "search", layer: "L0_SQL", rationale: "FTS5 BM25 search over nodes" },
  { toolName: "metrics", layer: "L0_SQL", rationale: "Aggregate SQL queries (COUNT, AVG)" },
  { toolName: "export", layer: "L0_SQL", rationale: "Serialize graph document to JSON/Mermaid" },
  { toolName: "snapshot", layer: "L0_SQL", rationale: "Direct snapshot read/write" },
  { toolName: "knowledge_stats", layer: "L0_SQL", rationale: "Aggregate knowledge document stats" },
  { toolName: "knowledge_feedback", layer: "L0_SQL", rationale: "Record feedback signal in DB" },
  { toolName: "export_knowledge", layer: "L0_SQL", rationale: "Serialize knowledge to JSON" },
  { toolName: "list_memories", layer: "L0_SQL", rationale: "Read memory file listing" },
  { toolName: "read_memory", layer: "L0_SQL", rationale: "Read memory file content" },
  { toolName: "edge", layer: "L0_SQL", rationale: "CRUD on edge table" },
  { toolName: "node", layer: "L0_SQL", rationale: "CRUD on node table" },
  { toolName: "init", layer: "L0_SQL", rationale: "Create project in DB" },
  { toolName: "import_graph", layer: "L0_SQL", rationale: "Merge JSON into DB" },
  { toolName: "import_prd", layer: "L0_SQL", rationale: "Parse file and insert nodes" },
  { toolName: "move_node", layer: "L0_SQL", rationale: "Update parentId + edges" },
  { toolName: "clone_node", layer: "L0_SQL", rationale: "Copy node + edges" },
  { toolName: "update_status", layer: "L0_SQL", rationale: "Update status field in DB" },
  { toolName: "template", layer: "L0_SQL", rationale: "CRUD on task templates" },
  { toolName: "journey", layer: "L0_SQL", rationale: "CRUD on journey store" },
  { toolName: "delete_memory", layer: "L0_SQL", rationale: "Delete memory file" },
  { toolName: "reindex_knowledge", layer: "L0_SQL", rationale: "Rebuild FTS indexes" },
  { toolName: "sync_stack_docs", layer: "L0_SQL", rationale: "Fetch and cache library docs" },

  // L1 — Cache / Memoization
  { toolName: "context", layer: "L1_Cache", rationale: "Session delta tracking + context assembly with cache" },
  { toolName: "rag_context", layer: "L1_Cache", rationale: "Semantic cache + multi-strategy retrieval" },
  { toolName: "context_compress", layer: "L1_Cache", rationale: "Rule-based compression with cached patterns" },

  // L2 — Heuristics / FSM / Decision Trees
  { toolName: "next", layer: "L2_Heuristic", rationale: "Priority + dependency FSM for task selection" },
  { toolName: "analyze", layer: "L2_Heuristic", rationale: "44 deterministic analyze modes" },
  { toolName: "plan_sprint", layer: "L2_Heuristic", rationale: "Velocity-based sprint planning heuristic" },
  { toolName: "set_phase", layer: "L2_Heuristic", rationale: "Lifecycle state machine transition" },
  { toolName: "forecast", layer: "L2_Heuristic", rationale: "DORA metrics calculation from historical data" },
  { toolName: "self_healing", layer: "L2_Heuristic", rationale: "MAPE-K error categorization FSM" },
  { toolName: "kanban", layer: "L2_Heuristic", rationale: "WIP limits and flow state machine" },
  { toolName: "graph_health", layer: "L2_Heuristic", rationale: "Multi-analyzer scan composition" },
  { toolName: "intersect_knowledge", layer: "L2_Heuristic", rationale: "Cross-domain knowledge intersection heuristic" },
  { toolName: "help", layer: "L2_Heuristic", rationale: "Topic-based help routing" },
  { toolName: "manage_skill", layer: "L2_Heuristic", rationale: "Skill CRUD + phase-based recommendation" },
  { toolName: "knowledge_prune", layer: "L2_Heuristic", rationale: "Strategy-based pruning decision tree" },
  { toolName: "code_intelligence", layer: "L2_Heuristic", rationale: "AST analysis + symbol graph traversal" },

  // L3 — Property-Based / Invariant Checks
  { toolName: "validate", layer: "L3_PropertyBased", rationale: "AC quality scoring + browser validation invariants" },
  { toolName: "finish_task", layer: "L3_PropertyBased", rationale: "DoD 9 checks — property-based invariant validation" },
  { toolName: "start_task", layer: "L3_PropertyBased", rationale: "Dependency satisfaction + TDD hints" },

  // L4 — Meta-Rule Learning
  { toolName: "write_memory", layer: "L4_MetaRule", rationale: "Persist AI decisions as reusable rules" },
  { toolName: "learn_from_project", layer: "L4_MetaRule", rationale: "Cross-project knowledge transfer with dedup" },

  // Translation tools (L0 — deterministic AST transforms)
  { toolName: "translate_code", layer: "L0_SQL", rationale: "AST-based code translation" },
  { toolName: "analyze_translation", layer: "L0_SQL", rationale: "Translation analysis from DB" },
  { toolName: "translation_jobs", layer: "L0_SQL", rationale: "Job CRUD in DB" },

  // DaVinci tools (L0 — deterministic parsing/generation)
  { toolName: "davinci_analyze", layer: "L0_SQL", rationale: "JS AST analysis" },
  { toolName: "davinci_convert", layer: "L0_SQL", rationale: "Deterministic code conversion" },
  { toolName: "davinci_build", layer: "L0_SQL", rationale: "Deterministic build output" },

  // Siebel CRM tools (L0 — SIF parsing/generation)
  { toolName: "siebel_import_sif", layer: "L0_SQL", rationale: "SIF XML parsing to DB" },
  { toolName: "siebel_analyze", layer: "L0_SQL", rationale: "SIF complexity analysis" },
  { toolName: "siebel_composer", layer: "L0_SQL", rationale: "SIF composition from components" },
  { toolName: "siebel_env", layer: "L0_SQL", rationale: "Environment config CRUD" },
  { toolName: "siebel_validate", layer: "L0_SQL", rationale: "SIF validation rules" },
  { toolName: "siebel_search", layer: "L0_SQL", rationale: "FTS search over SIF objects" },
  { toolName: "siebel_generate_sif", layer: "L0_SQL", rationale: "Deterministic SIF generation" },
  { toolName: "siebel_import_docs", layer: "L0_SQL", rationale: "Siebel doc import to DB" },
];

/**
 * Get the deterministic layer classification for all MCP tools.
 */
export function classifyTools(): ToolClassification[] {
  return [...CLASSIFICATIONS];
}

/**
 * Get distribution of tools across deterministic layers.
 */
export function getLayerDistribution(): Record<DeterministicLayer, number> {
  const dist: Record<DeterministicLayer, number> = {
    L0_SQL: 0,
    L1_Cache: 0,
    L2_Heuristic: 0,
    L3_PropertyBased: 0,
    L4_MetaRule: 0,
  };
  for (const c of CLASSIFICATIONS) {
    dist[c.layer]++;
  }
  return dist;
}

/**
 * Get classification for a specific tool.
 */
export function getToolLayer(toolName: string): ToolClassification | undefined {
  return CLASSIFICATIONS.find(c => c.toolName === toolName);
}
