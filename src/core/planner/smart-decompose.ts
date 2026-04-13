/**
 * Smart Decompose — automatically breaks large tasks into subtasks based on AC.
 * Rule: 1 AC = 1 subtask. Test type inferred from keywords. Dependencies by order.
 */

import type { SqliteStore } from "../store/sqlite-store.js";
import { generateId } from "../utils/id.js";
import { logger } from "../utils/logger.js";

export interface DecomposedSubtask {
  title: string;
  type: "subtask";
  acceptanceCriteria: string[];
  estimateMinutes: number;
  suggestedTestType: "unit" | "integration" | "e2e";
}

export interface DecomposedEdge {
  from: string;
  to: string;
  relation: "depends_on";
}

export interface DecomposeResult {
  parentId: string;
  subtasks: DecomposedSubtask[];
  edges: DecomposedEdge[];
  rationale: string;
}

const INTEGRATION_KEYWORDS = [
  "api", "endpoint", "database", "db", "persiste", "persists", "saves",
  "sync", "indexa", "indexes", "fetch", "request", "response", "query",
  "http", "rest", "graphql", "grpc", "webhook",
];

const E2E_KEYWORDS = [
  "page", "navega", "navigates", "click", "clicks", "form", "browser",
  "redirect", "ui", "dashboard", "tab", "button", "modal", "toast",
  "screen", "display", "render", "shows", "visible",
];

/**
 * Infer test type from AC text based on keywords.
 */
function inferTestType(acText: string): "unit" | "integration" | "e2e" {
  const lower = acText.toLowerCase();

  if (E2E_KEYWORDS.some((kw) => lower.includes(kw))) return "e2e";
  if (INTEGRATION_KEYWORDS.some((kw) => lower.includes(kw))) return "integration";
  return "unit";
}

/**
 * Extract a short title from AC text.
 */
function acToTitle(ac: string, index: number): string {
  // Take first 60 chars, trim at word boundary
  const truncated = ac.length > 60 ? ac.slice(0, 60).replace(/\s\S*$/, "...") : ac;
  return `Subtask ${index + 1}: ${truncated}`;
}

/**
 * Estimate minutes based on test type complexity.
 */
function estimateFromTestType(testType: "unit" | "integration" | "e2e"): number {
  switch (testType) {
    case "unit": return 30;
    case "integration": return 60;
    case "e2e": return 90;
  }
}

/**
 * Decompose a task into subtasks based on its acceptance criteria.
 * Returns null if node not found or has no AC.
 */
/** Decompose a task into subtasks based on acceptance criteria. */
export function smartDecompose(
  store: SqliteStore,
  nodeId: string,
): DecomposeResult | null {
  const node = store.getNodeById(nodeId);
  if (!node) {
    logger.warn("smart-decompose:node_not_found", { nodeId });
    return null;
  }

  // Collect AC from inline + child AC nodes
  const doc = store.toGraphDocument();
  const acChildNodes = doc.nodes.filter(
    (n) => n.type === "acceptance_criteria" && n.parentId === nodeId,
  );
  const acTexts = [
    ...(node.acceptanceCriteria ?? []),
    ...acChildNodes.map((n) => n.title),
  ];

  if (acTexts.length === 0) {
    logger.info("smart-decompose:no_ac", { nodeId });
    return null;
  }

  // 1 AC = 1 subtask
  const subtaskIds: string[] = [];
  const subtasks: DecomposedSubtask[] = acTexts.map((ac, i) => {
    subtaskIds.push(generateId("sub"));
    const testType = inferTestType(ac);
    return {
      title: acToTitle(ac, i),
      type: "subtask" as const,
      acceptanceCriteria: [ac],
      estimateMinutes: estimateFromTestType(testType),
      suggestedTestType: testType,
    };
  });

  // Dependencies: each subtask depends on the previous one (sequential order)
  const edges: DecomposedEdge[] = [];
  for (let i = 1; i < subtaskIds.length; i++) {
    edges.push({
      from: subtaskIds[i],
      to: subtaskIds[i - 1],
      relation: "depends_on",
    });
  }

  logger.info("smart-decompose:ok", {
    nodeId,
    subtasks: subtasks.length,
    edges: edges.length,
    testTypes: subtasks.map((s) => s.suggestedTestType),
  });

  return {
    parentId: nodeId,
    subtasks,
    edges,
    rationale: `Decomposed "${node.title}" into ${subtasks.length} subtasks (1 per AC). Test types: ${subtasks.map((s) => s.suggestedTestType).join(", ")}.`,
  };
}
