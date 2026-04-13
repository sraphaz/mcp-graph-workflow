/**
 * RAG Evaluation Dataset — 50 queries with ground truth for benchmark.
 *
 * Categories:
 * - narrow (15): specific function/module lookup
 * - broad (15): cross-module feature queries
 * - relational (10): dependency/impact queries
 * - temporal (10): sprint/status/timeline queries
 *
 * Ground truth uses synthetic doc IDs (doc-NNN) representing knowledge documents
 * that would be indexed from the mcp-graph execution graph.
 */

export type QueryCategory = "narrow" | "broad" | "relational" | "temporal";

export interface RagEvalQuery {
  query: string;
  category: QueryCategory;
  relevantDocIds: string[];
  grades: Map<string, number>;
  source: string;
}

function q(
  query: string,
  category: QueryCategory,
  gradeEntries: Array<[string, number]>,
  source: string,
): RagEvalQuery {
  return {
    query,
    category,
    relevantDocIds: gradeEntries.filter(([, g]) => g > 0).map(([id]) => id),
    grades: new Map(gradeEntries),
    source,
  };
}

// ── Narrow queries (15) — specific lookup ──────────

const narrow: RagEvalQuery[] = [
  q("how does FTS5 search work in the knowledge store", "narrow",
    [["doc-fts-search", 3], ["doc-knowledge-store", 2], ["doc-tokenizer", 2], ["doc-bm25", 1]],
    "search/fts-search.ts"),
  q("what is the BM25 compressor implementation", "narrow",
    [["doc-bm25-compressor", 3], ["doc-context-assembler", 2], ["doc-bm25", 2], ["doc-token-estimator", 1]],
    "context/bm25-compressor.ts"),
  q("how does the session tracker track sent chunks", "narrow",
    [["doc-session-tracker", 3], ["doc-context-session", 2], ["doc-token-estimator", 2], ["doc-session-migration", 1]],
    "context/session-tracker.ts"),
  q("what is the harness scan runner scoring algorithm", "narrow",
    [["doc-harness-scan", 3], ["doc-harnessability-score", 2], ["doc-type-coverage", 2], ["doc-test-coverage", 1]],
    "harness/harness-scan-runner.ts"),
  q("how does the PPR power iteration converge", "narrow",
    [["doc-ppr-engine", 3], ["doc-graph-rag-strategy", 2], ["doc-ppr-adr", 2], ["doc-ppr-benchmark", 1]],
    "rag/personalized-pagerank.ts"),
  q("what is the semantic cache TTL and eviction policy", "narrow",
    [["doc-semantic-cache", 3], ["doc-query-cache", 2], ["doc-response-cache", 2], ["doc-rag-pipeline", 1]],
    "rag/semantic-cache.ts"),
  q("how does the lock manager acquire and release locks", "narrow",
    [["doc-lock-manager", 3], ["doc-resource-locks-migration", 2], ["doc-lock-conflict-error", 2], ["doc-agent-identity", 1]],
    "store/lock-manager.ts"),
  q("what format does the mermaid export produce", "narrow",
    [["doc-mermaid-export", 3], ["doc-graph-types", 2], ["doc-export-tool", 2], ["doc-graph-indexes", 1]],
    "graph/mermaid-export.ts"),
  q("how does the PRD parser classify sections", "narrow",
    [["doc-prd-classifier", 3], ["doc-prd-segmenter", 2], ["doc-prd-normalizer", 2], ["doc-import-prd", 1]],
    "parser/classify.ts"),
  q("what is the token estimation heuristic", "narrow",
    [["doc-token-estimator", 3], ["doc-context-assembler", 2], ["doc-bm25-compressor", 2], ["doc-tiered-context", 1]],
    "context/token-estimator.ts"),
  q("how does the sprint planner decompose tasks", "narrow",
    [["doc-plan-sprint", 3], ["doc-decompose", 2], ["doc-dependency-chain", 2], ["doc-velocity", 1]],
    "planner/decompose.ts"),
  q("what is the migration v30 schema cleanup", "narrow",
    [["doc-migrations-v30", 3], ["doc-sqlite-store", 2], ["doc-fts-rebuild", 2], ["doc-schema-cleanup", 1]],
    "store/migrations.ts"),
  q("how does the event bus dispatch typed events", "narrow",
    [["doc-event-bus", 3], ["doc-event-types", 2], ["doc-integration-orchestrator", 2], ["doc-lifecycle-wrapper", 1]],
    "events/event-bus.ts"),
  q("what is the definition of ready gate check", "narrow",
    [["doc-definition-of-ready", 3], ["doc-adr-validator", 2], ["doc-traceability", 2], ["doc-coupling", 1]],
    "designer/definition-of-ready.ts"),
  q("how does the code indexer parse TypeScript AST", "narrow",
    [["doc-ts-analyzer", 3], ["doc-code-indexer", 2], ["doc-code-store", 2], ["doc-code-search", 1]],
    "code/ts-analyzer.ts"),
];

// ── Broad queries (15) — cross-module ──────────────

const broad: RagEvalQuery[] = [
  q("how does the RAG pipeline work end to end", "broad",
    [["doc-rag-pipeline", 3], ["doc-multi-strategy", 3], ["doc-post-retrieval", 2], ["doc-query-understanding", 2], ["doc-fts-search", 1]],
    "rag-pipeline"),
  q("what happens when a new PRD is imported", "broad",
    [["doc-import-prd", 3], ["doc-prd-classifier", 3], ["doc-prd-segmenter", 2], ["doc-prd-to-graph", 2], ["doc-graph-types", 1]],
    "import-flow"),
  q("how does the lifecycle enforcement work across tools", "broad",
    [["doc-lifecycle-phase", 3], ["doc-lifecycle-wrapper", 3], ["doc-unified-gate", 2], ["doc-prerequisite-gate", 2], ["doc-set-phase", 1]],
    "lifecycle-system"),
  q("what is the context compression and tiering system", "broad",
    [["doc-context-assembler", 3], ["doc-tiered-context", 3], ["doc-bm25-compressor", 2], ["doc-compress-text", 2], ["doc-token-estimator", 1]],
    "context-system"),
  q("how does the knowledge store index and retrieve documents", "broad",
    [["doc-knowledge-store", 3], ["doc-memory-indexer", 3], ["doc-docs-indexer", 2], ["doc-embedding-store", 2], ["doc-fts-search", 1]],
    "knowledge-pipeline"),
  q("what is the multi-agent integration mesh architecture", "broad",
    [["doc-integration-orchestrator", 3], ["doc-mcp-servers-config", 3], ["doc-context7-fetcher", 2], ["doc-agent-identity", 2], ["doc-event-bus", 1]],
    "integration-mesh"),
  q("how does the dashboard display graph data", "broad",
    [["doc-dashboard-app", 3], ["doc-graph-tab", 3], ["doc-api-routes", 2], ["doc-react-flow", 2], ["doc-code-graph-tab", 1]],
    "dashboard-system"),
  q("what is the harness engineering scoring and remediation system", "broad",
    [["doc-harnessability-score", 3], ["doc-remediation-engine", 3], ["doc-harness-scan", 2], ["doc-violation-detail", 2], ["doc-fitness-functions", 1]],
    "harness-system"),
  q("how does the planner determine task priority and next action", "broad",
    [["doc-next-task", 3], ["doc-enhanced-next", 3], ["doc-dependency-chain", 2], ["doc-velocity", 2], ["doc-bottleneck-detector", 1]],
    "planner-system"),
  q("what is the full test infrastructure and coverage approach", "broad",
    [["doc-vitest-config", 3], ["doc-test-coverage-scanner", 3], ["doc-playwright-e2e", 2], ["doc-test-patterns", 2], ["doc-benchmark-indexer", 1]],
    "test-infrastructure"),
  q("how does code intelligence analyze symbols and impact", "broad",
    [["doc-ts-analyzer", 3], ["doc-graph-traversal", 3], ["doc-code-search", 2], ["doc-process-detector", 2], ["doc-code-intelligence-wrapper", 1]],
    "code-intelligence"),
  q("what is the CLI command structure and routing", "broad",
    [["doc-cli-index", 3], ["doc-commander-setup", 3], ["doc-cli-serve", 2], ["doc-cli-doctor", 2], ["doc-cli-import", 1]],
    "cli-system"),
  q("how does the REST API expose graph operations", "broad",
    [["doc-api-router", 3], ["doc-api-nodes", 3], ["doc-api-edges", 2], ["doc-api-search", 2], ["doc-api-context", 1]],
    "rest-api"),
  q("what is the memory system and how are memories indexed", "broad",
    [["doc-memory-store", 3], ["doc-memory-indexer", 3], ["doc-memory-rag-query", 2], ["doc-write-memory", 2], ["doc-knowledge-store", 1]],
    "memory-system"),
  q("how does the Siebel integration import and validate SIF files", "broad",
    [["doc-siebel-import", 3], ["doc-siebel-validate", 3], ["doc-siebel-composer", 2], ["doc-siebel-search", 2], ["doc-sif-parser", 1]],
    "siebel-integration"),
];

// ── Relational queries (10) — dependency/impact ────

const relational: RagEvalQuery[] = [
  q("what modules depend on sqlite-store", "relational",
    [["doc-sqlite-store", 3], ["doc-knowledge-store", 2], ["doc-tool-call-log", 2], ["doc-lock-manager", 2], ["doc-migrations", 1]],
    "sqlite-store-deps"),
  q("what is the blast radius of changing graph-types", "relational",
    [["doc-graph-types", 3], ["doc-graph-indexes", 2], ["doc-mermaid-export", 2], ["doc-compact-context", 2], ["doc-import-prd", 1]],
    "graph-types-impact"),
  q("which tools call update_status internally", "relational",
    [["doc-update-status", 3], ["doc-finish-task", 2], ["doc-start-task", 2], ["doc-lifecycle-wrapper", 2], ["doc-unified-gate", 1]],
    "update-status-callers"),
  q("what are the upstream dependencies of the RAG pipeline", "relational",
    [["doc-rag-pipeline", 3], ["doc-fts-search", 2], ["doc-knowledge-store", 2], ["doc-embedding-store", 2], ["doc-tfidf", 1]],
    "rag-pipeline-deps"),
  q("which modules import from the harness barrel file", "relational",
    [["doc-harness-index", 3], ["doc-lifecycle-wrapper", 2], ["doc-definition-of-ready", 2], ["doc-harness-preflight", 2], ["doc-analyze-tool", 1]],
    "harness-consumers"),
  q("what edges connect the planner to the graph store", "relational",
    [["doc-next-task", 3], ["doc-sqlite-store", 2], ["doc-plan-sprint", 2], ["doc-dependency-chain", 2], ["doc-decompose", 1]],
    "planner-store-edges"),
  q("what is the call chain from CLI import to graph nodes", "relational",
    [["doc-cli-import", 3], ["doc-import-prd", 2], ["doc-prd-to-graph", 2], ["doc-sqlite-store", 2], ["doc-prd-classifier", 1]],
    "import-call-chain"),
  q("which modules emit events via the event bus", "relational",
    [["doc-event-bus", 3], ["doc-sqlite-store", 2], ["doc-integration-orchestrator", 2], ["doc-lifecycle-wrapper", 2], ["doc-code-intelligence-wrapper", 1]],
    "event-emitters"),
  q("what modules are affected if knowledge-store schema changes", "relational",
    [["doc-knowledge-store", 3], ["doc-memory-indexer", 2], ["doc-docs-indexer", 2], ["doc-capture-indexer", 2], ["doc-rag-pipeline", 1]],
    "knowledge-schema-impact"),
  q("what is the dependency graph of the context module", "relational",
    [["doc-context-assembler", 3], ["doc-compact-context", 2], ["doc-bm25-compressor", 2], ["doc-session-tracker", 2], ["doc-tiered-context", 1]],
    "context-dep-graph"),
];

// ── Temporal queries (10) — sprint/status/timeline ──

const temporal: RagEvalQuery[] = [
  q("what tasks were completed in the latest sprint", "temporal",
    [["doc-sprint-progress", 3], ["doc-velocity-report", 2], ["doc-burndown", 2], ["doc-done-tasks", 1]],
    "latest-sprint"),
  q("what is the current sprint velocity trend", "temporal",
    [["doc-velocity", 3], ["doc-sprint-progress", 2], ["doc-metrics-calculator", 2], ["doc-planning-report", 1]],
    "velocity-trend"),
  q("which tasks are currently blocked and why", "temporal",
    [["doc-blocked-tasks", 3], ["doc-blocker-analysis", 2], ["doc-dependency-chain", 2], ["doc-bottleneck-detector", 1]],
    "blocked-tasks"),
  q("what was the last architecture decision recorded", "temporal",
    [["doc-latest-adr", 3], ["doc-adr-validator", 2], ["doc-decision-nodes", 2], ["doc-design-phase", 1]],
    "latest-adr"),
  q("what is the estimated completion date for the current epic", "temporal",
    [["doc-forecast", 3], ["doc-velocity", 2], ["doc-burndown", 2], ["doc-sprint-progress", 1]],
    "epic-eta"),
  q("which tasks transitioned to done in the last 24 hours", "temporal",
    [["doc-recent-done", 3], ["doc-status-history", 2], ["doc-sprint-progress", 2], ["doc-velocity", 1]],
    "recent-completions"),
  q("what is the work in progress limit status", "temporal",
    [["doc-wip-status", 3], ["doc-in-progress-tasks", 2], ["doc-flow-metrics", 2], ["doc-bottleneck-detector", 1]],
    "wip-status"),
  q("when was the last knowledge reindex performed", "temporal",
    [["doc-reindex-log", 3], ["doc-knowledge-store", 2], ["doc-embedding-store", 2], ["doc-code-indexer", 1]],
    "last-reindex"),
  q("what phases have been completed in the current lifecycle", "temporal",
    [["doc-lifecycle-status", 3], ["doc-phase-history", 2], ["doc-set-phase-log", 2], ["doc-snapshot", 1]],
    "lifecycle-phases"),
  q("what is the trend of harness score over the last 5 sessions", "temporal",
    [["doc-harness-trends", 3], ["doc-harness-history", 2], ["doc-harness-evolution", 2], ["doc-grade-prediction", 1]],
    "harness-trend"),
];

/** Complete evaluation dataset — 50 queries across 4 categories. */
export const RAG_EVAL_DATASET: RagEvalQuery[] = [
  ...narrow,
  ...broad,
  ...relational,
  ...temporal,
];
