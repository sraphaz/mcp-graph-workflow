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
 * Pure utility functions for graph node filtering.
 * Shared between Graph Tab, PRD Backlog Tab, and tests.
 * No React/DOM dependencies — fully testable.
 */

export const TOP_LEVEL_TYPES: ReadonlySet<string> = new Set([
  "epic",
  "milestone",
  "requirement",
  "constraint",
]);

/**
 * Filter nodes to show only top-level types or nodes without a parent.
 * When showFullGraph is true, returns all nodes unchanged.
 */
export function filterTopLevelNodes<T extends { type: string; parentId?: string | null }>(
  nodes: T[],
  showFullGraph: boolean,
): T[] {
  if (showFullGraph) return nodes;
  return nodes.filter((n) => TOP_LEVEL_TYPES.has(n.type) || !n.parentId);
}

/**
 * Get incoming and outgoing edges for a specific node.
 * Pure function — no side effects, fully testable.
 */
export function getNodeEdgeSummary<T extends { from: string; to: string }>(
  nodeId: string,
  edges: T[],
): { outgoing: T[]; incoming: T[] } {
  const outgoing: T[] = [];
  const incoming: T[] = [];
  for (const edge of edges) {
    if (edge.from === nodeId) outgoing.push(edge);
    if (edge.to === nodeId) incoming.push(edge);
  }
  return { outgoing, incoming };
}
