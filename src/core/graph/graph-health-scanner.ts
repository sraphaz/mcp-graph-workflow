/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

/**
 * Unified Graph Health Scanner — combines existing analyzers into a single diagnostic.
 * Reuses: detectCycles, analyzeScope, analyzeBacklogHealth, checkDoneIntegrity, checkStatusFlow.
 */

import type { GraphDocument } from "./graph-types.js";
import { detectCycles } from "../planner/dependency-chain.js";
import { analyzeScope } from "../analyzer/scope-analyzer.js";
import { analyzeBacklogHealth } from "../listener/backlog-health.js";
import { checkDoneIntegrity } from "../validator/done-integrity-checker.js";
import { checkStatusFlow } from "../validator/status-flow-checker.js";
import { GraphIntegrityError, getErrorMessage } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export interface HealthIssue {
  severity: "critical" | "warning" | "info";
  category: "cycle" | "orphan" | "stuck" | "oversized" | "broken_dep" | "status_violation" | "done_violation";
  nodeId?: string;
  message: string;
}

export interface HealthReport {
  scannedAt: string;
  nodeCount: number;
  edgeCount: number;
  issues: HealthIssue[];
  summary: { critical: number; warning: number; info: number; total: number };
  scanDurationMs: number;
}

/**
 * Run a comprehensive health scan on the graph, combining multiple analyzers.
 */
export function scanGraphHealth(doc: GraphDocument): HealthReport {
  if (!doc || !doc.nodes) {
    throw new GraphIntegrityError("Invalid graph document: missing nodes");
  }
  const start = performance.now();
  const issues: HealthIssue[] = [];

  // 1. Cycle detection
  try {
    const cycles = detectCycles(doc);
    for (const cycle of cycles) {
      issues.push({
        severity: "critical",
        category: "cycle",
        nodeId: cycle[0],
        message: `Dependency cycle detected: ${cycle.join(" → ")}`,
      });
    }
  } catch (err) {
    logger.debug("graph-health: cycle detection skipped", { error: getErrorMessage(err) });
  }

  // 2. Orphan detection via scope analysis
  try {
    const scope = analyzeScope(doc);
    for (const orphan of scope.orphans) {
      issues.push({
        severity: "warning",
        category: "orphan",
        nodeId: orphan.id,
        message: `Orphan ${orphan.type}: "${orphan.title}" — no parent or edges`,
      });
    }
  } catch (err) {
    logger.debug("graph-health: scope analysis skipped", { error: getErrorMessage(err) });
  }

  // 3. Backlog health — stuck and stale tasks
  try {
    const health = analyzeBacklogHealth(doc);
    for (const stale of health.staleTasks) {
      issues.push({
        severity: "warning",
        category: "stuck",
        nodeId: stale.nodeId,
        message: `Stale task: "${stale.title}" — ${stale.daysInBacklog} days in backlog`,
      });
    }
  } catch (err) {
    logger.debug("graph-health: backlog health skipped", { error: getErrorMessage(err) });
  }

  // 4. Done integrity — done tasks with unresolved deps or blocked status
  try {
    const integrity = checkDoneIntegrity(doc);
    for (const issue of integrity.issues) {
      issues.push({
        severity: "critical",
        category: "done_violation",
        nodeId: issue.nodeId,
        message: `Done integrity: "${issue.title}" — ${issue.details}`,
      });
    }
  } catch (err) {
    logger.debug("graph-health: done integrity skipped", { error: getErrorMessage(err) });
  }

  // 5. Status flow — tasks done without proper transitions
  try {
    const flow = checkStatusFlow(doc);
    for (const violation of flow.violations) {
      issues.push({
        severity: "warning",
        category: "status_violation",
        nodeId: violation.nodeId,
        message: `Status flow: "${violation.title}" — ${violation.currentStatus} without proper transitions`,
      });
    }
  } catch (err) {
    logger.debug("graph-health: status flow skipped", { error: getErrorMessage(err) });
  }

  // 6. Oversized tasks — tasks with too many children and no decomposition
  try {
    for (const node of doc.nodes) {
      if (node.type === "task" || node.type === "epic") {
        const children = doc.nodes.filter(n => n.parentId === node.id);
        if (children.length > 15) {
          issues.push({
            severity: "info",
            category: "oversized",
            nodeId: node.id,
            message: `Oversized: "${node.title}" has ${children.length} children — consider decomposition`,
          });
        }
      }
    }
  } catch (err) {
    logger.debug("graph-health: oversized check skipped", { error: getErrorMessage(err) });
  }

  const elapsed = performance.now() - start;
  const summary = {
    critical: issues.filter(i => i.severity === "critical").length,
    warning: issues.filter(i => i.severity === "warning").length,
    info: issues.filter(i => i.severity === "info").length,
    total: issues.length,
  };

  logger.info("graph-health:scan", { nodeCount: doc.nodes.length, edgeCount: doc.edges.length, ...summary, ms: elapsed.toFixed(1) });

  return {
    scannedAt: new Date().toISOString(),
    nodeCount: doc.nodes.length,
    edgeCount: doc.edges.length,
    issues,
    summary,
    scanDurationMs: Math.round(elapsed * 10) / 10,
  };
}
