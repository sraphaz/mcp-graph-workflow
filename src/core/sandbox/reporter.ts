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
 * Wave-12 Sandbox — Reporter.updateGraph
 *
 * Connects sandbox build/test outcomes to the execution graph state. The
 * Reporter is the handoff surface between the isolated build runtime and
 * the task lifecycle: when a sandbox run fails, the corresponding task
 * should become visibly blocked so agents stop pulling it; when a run
 * succeeds on a previously-blocked task, the block is released so work
 * can resume.
 *
 * Policy (deliberately conservative — `finish_task` owns DoD and is the
 * only path to `done`):
 *
 *   previous  │  report.success=false   │  report.success=true
 *   ──────────┼─────────────────────────┼──────────────────────
 *   backlog   │  blocked                │  (no change)
 *   ready     │  blocked                │  (no change)
 *   in_progress│ blocked                │  (no change — DoD gate)
 *   blocked   │  (already blocked)      │  in_progress (unblock)
 *   done      │  (frozen — never write) │  (no change)
 *
 * We never auto-promote to `done`: the DoD (9 checks) belongs to
 * `finish_task`. Auto-done from a green sandbox would side-step AC
 * verification, status-flow validation, and harness scanning.
 */

import type { SqliteStore } from "../store/sqlite-store.js";
import { NodeNotFoundError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

/** Minimal subset of a SandboxReport that the graph update needs. */
export interface ReporterOutcome {
  success: boolean;
  /** Optional — included for provenance in logs. */
  status?: "success" | "failure" | "error" | "timeout";
}

export interface GraphUpdateResult {
  nodeId: string;
  previousStatus: string;
  /** The status actually written. `null` when no write happened. */
  newStatus: "blocked" | "in_progress" | null;
  /** Present when newStatus is null, explains why. */
  skipped?: string;
}

/** updateGraphFromReport — auto-generated description placeholder. */
export function updateGraphFromReport(
  store: SqliteStore,
  nodeId: string,
  report: ReporterOutcome,
): GraphUpdateResult {
  const node = store.getNodeById(nodeId);
  if (!node) {
    throw new NodeNotFoundError(nodeId);
  }
  const previousStatus = node.status;

  // `done` is frozen — reporter never writes over it, regardless of outcome.
  if (previousStatus === "done") {
    logger.debug("sandbox:reporter:skipped-done", { nodeId });
    return {
      nodeId,
      previousStatus,
      newStatus: null,
      skipped: "task already done — reporter never overwrites done",
    };
  }

  if (!report.success) {
    if (previousStatus === "blocked") {
      return {
        nodeId,
        previousStatus,
        newStatus: null,
        skipped: "task already blocked — no churn",
      };
    }
    store.updateNodeStatus(nodeId, "blocked");
    logger.info("sandbox:reporter:blocked", { nodeId, previousStatus, status: report.status });
    return { nodeId, previousStatus, newStatus: "blocked" };
  }

  // Success path — unblock if previously blocked, otherwise leave alone.
  if (previousStatus === "blocked") {
    store.updateNodeStatus(nodeId, "in_progress");
    logger.info("sandbox:reporter:unblocked", { nodeId, status: report.status });
    return { nodeId, previousStatus, newStatus: "in_progress" };
  }

  return {
    nodeId,
    previousStatus,
    newStatus: null,
    skipped: "success — no change (finish_task owns DoD/done transition)",
  };
}
