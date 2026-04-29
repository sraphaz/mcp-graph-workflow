/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Hierarchical topology: a single queen agent dispatches work to N workers
 * and aggregates their reports. Pure-function layout (no SQL, no I/O) — the
 * coordinator wires this into runtime via swarm-coordinator + lock-manager.
 *
 * Conventions:
 * - First agent in the list is the queen.
 * - Remaining agents are workers (order preserved).
 */

import { McpGraphError } from "../../utils/errors.js";

export interface HierarchicalLayout {
  queen: string;
  workers: string[];
  /** Queen → list of workers (fan-out). */
  dispatch: Record<string, string[]>;
  /** Worker → queen (fan-in). */
  report: Record<string, string>;
}

export function getQueenId(agentIds: string[]): string {
  const queen = agentIds[0];
  if (queen === undefined) {
    throw new McpGraphError("Hierarchical topology requires at least one agent (the queen)");
  }
  return queen;
}

export function getWorkerIds(agentIds: string[]): string[] {
  return agentIds.slice(1);
}

export function buildDispatchRoutes(queen: string, workers: string[]): Record<string, string[]> {
  return { [queen]: [...workers] };
}

export function buildReportRoutes(queen: string, workers: string[]): Record<string, string> {
  const routes: Record<string, string> = {};
  for (const w of workers) {
    routes[w] = queen;
  }
  return routes;
}

export function buildHierarchicalLayout(agentIds: string[]): HierarchicalLayout {
  const queen = getQueenId(agentIds);
  const workers = getWorkerIds(agentIds);
  return {
    queen,
    workers,
    dispatch: buildDispatchRoutes(queen, workers),
    report: buildReportRoutes(queen, workers),
  };
}
