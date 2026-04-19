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

import type Graph from "graphology";

/**
 * BFS traversal to find all nodes within `maxDepth` hops from `anchor`.
 * Returns an empty set if the anchor node is not present in the graph.
 */
export function computeNHopNeighbors(graph: Graph, anchor: string, maxDepth: number): Set<string> {
  if (!graph.hasNode(anchor)) {
    return new Set<string>();
  }

  const visited = new Set<string>([anchor]);
  const queue: Array<[string, number]> = [[anchor, 0]];

  while (queue.length > 0) {
    const [node, depth] = queue.shift()!;
    if (depth >= maxDepth) continue;
    for (const neighbor of graph.neighbors(node)) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([neighbor, depth + 1]);
      }
    }
  }

  return visited;
}
