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

import type { GraphNode, GraphEdge, GraphIndexes } from "./graph-types.js";

/** Build lookup indexes (by-id, children-by-parent, incoming/outgoing edges) for fast graph traversal. */
export function buildIndexes(nodes: GraphNode[], edges: GraphEdge[]): GraphIndexes {
  const byId: Record<string, number> = {};
  const childrenByParent: Record<string, string[]> = {};
  const incomingByNode: Record<string, string[]> = {};
  const outgoingByNode: Record<string, string[]> = {};

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    byId[node.id] = i;

    if (node.parentId) {
      if (!childrenByParent[node.parentId]) {
        childrenByParent[node.parentId] = [];
      }
      childrenByParent[node.parentId].push(node.id);
    }
  }

  for (const edge of edges) {
    if (!outgoingByNode[edge.from]) {
      outgoingByNode[edge.from] = [];
    }
    outgoingByNode[edge.from].push(edge.id);

    if (!incomingByNode[edge.to]) {
      incomingByNode[edge.to] = [];
    }
    incomingByNode[edge.to].push(edge.id);
  }

  return { byId, childrenByParent, incomingByNode, outgoingByNode };
}
