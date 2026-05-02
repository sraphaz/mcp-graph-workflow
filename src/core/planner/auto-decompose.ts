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
 * Auto-decomposition for the PLAN → IMPLEMENT handoff.
 *
 * `smartDecompose` only *computes* a decomposition — it does not touch the
 * store. This module provides the write-side:
 *
 *   - `persistDecomposition(store, result)` inserts the subtask nodes and
 *     `depends_on` edges that `smartDecompose` returned.
 *   - `autoDecomposeLarge(store, opts?)` scans the current graph for L/XL
 *     tasks that are good candidates (no existing children, 2–N ACs, not
 *     already decomposed) and applies persistDecomposition to each.
 *
 * Guardrails (why opt-in is the default in `plan_sprint`):
 *   - Only L/XL, because M/S are already Haiku-eligible.
 *   - Skip parents that already have children — the user (or a previous
 *     decompose pass) made a choice we should not override.
 *   - Require ≥ 2 ACs — one AC = nothing to split.
 *   - Cap subtasks per parent (`maxSubtasks`, default 8) to prevent runaway
 *     fragmentation of AC-heavy epics.
 */

import type { SqliteStore } from "../store/sqlite-store.js";
import type { GraphNode, GraphEdge } from "../graph/graph-types.js";
import { XP_SIZE_ORDER } from "../utils/xp-sizing.js";
import { generateId } from "../utils/id.js";
import { smartDecompose, type DecomposeResult } from "./smart-decompose.js";
import { logger } from "../utils/logger.js";
import { now } from "../utils/time.js";

export interface PersistResult {
  createdNodeIds: string[];
  createdEdgeCount: number;
}

/**
 * Insert subtasks + `depends_on` edges into the store. The order follows
 * `result.subtasks`; edges follow `result.edges` but are remapped from the
 * planner's provisional IDs to the IDs we actually allocate on write.
 */
export function persistDecomposition(
  store: SqliteStore,
  result: DecomposeResult,
): PersistResult {
  const createdNodeIds: string[] = [];
  // Map the planner's synthetic IDs (embedded in result.edges.from/to via
  // array position) onto the real IDs generated here.
  const provisionalToReal = new Map<string, string>();

  // smart-decompose currently allocates its own IDs internally but does not
  // expose them on DecomposedSubtask — the edges it produces reference those
  // internal IDs positionally. We reconstruct by iterating in order.
  const plannerIds = Array.from(
    new Set<string>(result.edges.flatMap((e) => [e.from, e.to])),
  );

  result.subtasks.forEach((sub, index) => {
    const realId = generateId("sub");
    createdNodeIds.push(realId);
    if (plannerIds[index]) provisionalToReal.set(plannerIds[index], realId);

    const timestamp = now();
    const node: GraphNode = {
      id: realId,
      type: "subtask",
      title: sub.title,
      status: "backlog",
      priority: 3,
      parentId: result.parentId,
      acceptanceCriteria: sub.acceptanceCriteria,
      estimateMinutes: sub.estimateMinutes,
      createdAt: timestamp,
      updatedAt: timestamp,
    } as GraphNode;

    store.insertNode(node);
  });

  let createdEdgeCount = 0;
  for (const edge of result.edges) {
    const from = provisionalToReal.get(edge.from);
    const to = provisionalToReal.get(edge.to);
    if (!from || !to) continue;
    const realEdge: GraphEdge = {
      id: generateId("edge"),
      from,
      to,
      relationType: "depends_on",
      createdAt: now(),
    } as GraphEdge;
    try {
      store.insertEdge(realEdge);
      createdEdgeCount++;
    } catch (err) {
      logger.warn("auto-decompose:edge_insert_failed", {
        from,
        to,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info("auto-decompose:persisted", {
    parentId: result.parentId,
    subtasks: createdNodeIds.length,
    edges: createdEdgeCount,
  });

  return { createdNodeIds, createdEdgeCount };
}

export type SkipReason =
  | "not_large"
  | "has_children"
  | "insufficient_acs"
  | "too_many_acs"
  | "decompose_failed";

export interface AutoDecomposeReport {
  /** Parents that were successfully decomposed. */
  decomposed: Array<{ parentId: string; subtaskIds: string[] }>;
  /** Candidates that were inspected but intentionally skipped. */
  skipped: Array<{ parentId: string; reason: SkipReason }>;
}

export interface AutoDecomposeOptions {
  /** Maximum subtasks to create per parent. Default 8. */
  maxSubtasks?: number;
  /** Minimum ACs required on the parent before we will split. Default 2. */
  minAcs?: number;
}

const LARGE_XP_THRESHOLD = 4; // L + XL

/**
 * Scan the store for decomposition candidates and persist subtasks for each
 * that passes the guardrails.
 */
export function autoDecomposeLarge(
  store: SqliteStore,
  options: AutoDecomposeOptions = {},
): AutoDecomposeReport {
  const maxSubtasks = options.maxSubtasks ?? 8;
  const minAcs = options.minAcs ?? 2;

  const doc = store.toGraphDocument();
  const decomposed: AutoDecomposeReport["decomposed"] = [];
  const skipped: AutoDecomposeReport["skipped"] = [];

  for (const node of doc.nodes) {
    if (node.type !== "task") continue;

    const ord = XP_SIZE_ORDER[node.xpSize ?? ""] ?? 0;
    if (ord < LARGE_XP_THRESHOLD) {
      // M/S/XS silently — they are not candidates, don't clutter the report.
      continue;
    }

    const hasChildren = doc.nodes.some((n) => n.parentId === node.id);
    if (hasChildren) {
      skipped.push({ parentId: node.id, reason: "has_children" });
      continue;
    }

    const acChildren = doc.nodes.filter(
      (n) => n.type === "acceptance_criteria" && n.parentId === node.id,
    );
    const acCount = (node.acceptanceCriteria?.length ?? 0) + acChildren.length;
    if (acCount < minAcs) {
      skipped.push({ parentId: node.id, reason: "insufficient_acs" });
      continue;
    }
    if (acCount > maxSubtasks) {
      skipped.push({ parentId: node.id, reason: "too_many_acs" });
      continue;
    }

    const resultValue = smartDecompose(store, node.id);
    if (!resultValue) {
      skipped.push({ parentId: node.id, reason: "decompose_failed" });
      continue;
    }

    const persisted = persistDecomposition(store, resultValue);
    decomposed.push({ parentId: node.id, subtaskIds: persisted.createdNodeIds });
  }

  logger.info("auto-decompose:scan_complete", {
    decomposed: decomposed.length,
    skipped: skipped.length,
  });

  return { decomposed, skipped };
}
