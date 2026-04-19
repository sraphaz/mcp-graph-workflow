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
 * Kanban Orchestrator — type definitions.
 *
 * All types for the Kanban board visualization, orchestration,
 * and move validation. Built on top of existing GraphNode/GraphEdge types.
 */

import type { GraphNode, NodeStatus } from "../graph/graph-types.js";

/** A single card on the Kanban board, wrapping a GraphNode with computed metadata. */
export interface KanbanCard {
  node: GraphNode;
  blockerCount: number;
  dependencyCount: number;
  isNext: boolean;
  epicTitle?: string;
}

/** A status column on the Kanban board. */
export interface KanbanColumn {
  status: NodeStatus;
  title: string;
  wipLimit: number;
  cards: KanbanCard[];
}

/** A WIP limit violation for a specific column. */
export interface WipViolation {
  column: NodeStatus;
  limit: number;
  actual: number;
}

/** Aggregate Kanban flow metrics. */
export interface KanbanMetrics {
  wipViolations: WipViolation[];
  throughput: number;
  avgCycleTime: number;
  avgLeadTime: number;
  blockedPercentage: number;
}

/** A horizontal swimlane grouping cards by epic or sprint. */
export interface KanbanSwimlane {
  id: string;
  label: string;
  nodeIds: string[];
}

/** The full Kanban board state. */
export interface KanbanBoard {
  columns: KanbanColumn[];
  swimlanes: KanbanSwimlane[];
  metrics: KanbanMetrics;
}

/** Swimlane grouping mode. */
export type SwimlaneMode = "epic" | "sprint" | "none";

/** User-configurable Kanban settings. */
export interface KanbanConfig {
  wipLimits: Record<NodeStatus, number>;
  swimlaneMode: SwimlaneMode;
  showOnlyTasks: boolean;
}

/** Default WIP limits per status column. */
export const DEFAULT_WIP_LIMITS: Record<NodeStatus, number> = {
  backlog: 0,
  ready: 10,
  in_progress: 3,
  blocked: 0,
  done: 0,
};

/** Default Kanban configuration. */
export const DEFAULT_KANBAN_CONFIG: KanbanConfig = {
  wipLimits: { ...DEFAULT_WIP_LIMITS },
  swimlaneMode: "none",
  showOnlyTasks: true,
};

/** Result of a card move operation. */
export interface KanbanMoveResult {
  success: boolean;
  node: GraphNode;
  previousStatus: NodeStatus;
  newStatus: NodeStatus;
  warnings: string[];
}

/** An orchestration suggestion for the user. */
export interface KanbanSuggestion {
  nodeId: string;
  nodeTitle: string;
  action: string;
  reason: string;
  priority: number;
}

/** Column display order. */
export const COLUMN_ORDER: readonly NodeStatus[] = [
  "backlog",
  "ready",
  "in_progress",
  "blocked",
  "done",
] as const;

/** Human-readable column titles. */
export const COLUMN_TITLES: Record<NodeStatus, string> = {
  backlog: "Backlog",
  ready: "Ready",
  in_progress: "In Progress",
  blocked: "Blocked",
  done: "Done",
};
