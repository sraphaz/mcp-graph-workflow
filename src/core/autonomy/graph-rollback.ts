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
 * Graph Rollback — Transactional State Recovery (Graph Transaction Manager)
 *
 * Provides checkpoint creation and rollback for graph state,
 * enabling "undo" for failed agent task execution.
 *
 * Based on:
 * - Transactional File Systems (TFS) for Agents
 * - Compensating Actions (Sagas pattern)
 * - MTTR-A measurement (Mean Time to Recovery — Agent)
 */

import type { SqliteStore } from "../store/sqlite-store.js";
import { createLogger } from "../utils/logger.js";
import { McpGraphError } from "../utils/errors.js";

const log = createLogger({ layer: "core", source: "graph-rollback.ts" });

// ── Types ───────────────────────────────────────────────

export interface GraphCheckpoint {
  nodeId: string;
  snapshotId: number;
  nodeCount: number;
  edgeCount: number;
  createdAt: string;
}

export interface RollbackResult {
  success: boolean;
  nodesRestored: number;
  error?: string;
  /** Mean Time to Recovery — Agent (milliseconds) */
  mttrMs: number;
}

// ── Public API ──────────────────────────────────────────

/**
 * Create a checkpoint of the current graph state before task execution.
 * Uses SQLite snapshot for atomic state capture.
 */
export function createCheckpoint(store: SqliteStore, nodeId: string): GraphCheckpoint {
  if (!store) throw new McpGraphError("Store is required for checkpoint creation");
  if (!nodeId) throw new McpGraphError("Node ID is required for checkpoint creation");
  const doc = store.toGraphDocument();
  const snapshotId = store.createSnapshot();

  const checkpoint: GraphCheckpoint = {
    nodeId,
    snapshotId,
    nodeCount: doc?.nodes?.length ?? 0,
    edgeCount: doc?.edges?.length ?? 0,
    createdAt: new Date().toISOString(),
  };

  log.info("graph-rollback:checkpoint-created", {
    nodeId,
    snapshotId,
    nodeCount: checkpoint.nodeCount,
    edgeCount: checkpoint.edgeCount,
  });

  return checkpoint;
}

/**
 * Rollback graph state to a previously created checkpoint.
 * Restores all nodes, edges, and graph structure to the checkpoint state.
 * Measures MTTR-A (Mean Time to Recovery — Agent).
 */
export function rollbackToCheckpoint(
  store: SqliteStore,
  checkpoint: GraphCheckpoint,
): RollbackResult {
  if (!store) return { success: false, nodesRestored: 0, error: "Store is required", mttrMs: 0 };
  if (!checkpoint) return { success: false, nodesRestored: 0, error: "Checkpoint is required", mttrMs: 0 };
  if (!checkpoint?.snapshotId) return { success: false, nodesRestored: 0, error: "Snapshot ID is required", mttrMs: 0 };
  const start = performance.now();

  try {
    const resultValue = store.restoreSnapshot(checkpoint?.snapshotId);
    const mttrMs = Math.round(performance.now() - start);

    log.info("graph-rollback:restored", {
      nodeId: checkpoint?.nodeId ?? "",
      snapshotId: checkpoint?.snapshotId ?? 0,
      nodesRestored: resultValue?.nodesValid ?? 0,
      edgesRestored: resultValue?.edgesRestored ?? 0,
      mttrMs,
    });

    return {
      success: true,
      nodesRestored: resultValue?.nodesValid ?? 0,
      mttrMs,
    };
  } catch (err) {
    const mttrMs = Math.round(performance.now() - start);

    log.error("graph-rollback:failed", {
      nodeId: checkpoint?.nodeId ?? "",
      snapshotId: checkpoint?.snapshotId ?? 0,
      error: String(err),
      mttrMs,
    });

    return {
      success: false,
      nodesRestored: 0,
      error: String(err),
      mttrMs,
    };
  }
}
