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
 * Self-Healing Benchmark — measures monitorGraph scan performance at various graph sizes.
 */

import { bench, describe } from "vitest";
import { monitorGraph, DEFAULT_HEALING_CONFIG } from "../core/skills/self-healing-engine.js";
import type { GraphDocument, GraphNode, GraphEdge } from "../core/graph/graph-types.js";

// ── Graph fixture factory ─────────────────────────────

function makeNode(id: string, overrides?: Partial<GraphNode>): GraphNode {
  const ts = new Date().toISOString();
  return {
    id,
    type: "task",
    title: `Task ${id}`,
    status: "ready",
    priority: 3,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

function makeEdge(from: string, to: string, id?: string): GraphEdge {
  return {
    id: id ?? `e_${from}_${to}`,
    from,
    to,
    relationType: "depends_on",
    createdAt: new Date().toISOString(),
  };
}

function buildGraphFixture(nodeCount: number): GraphDocument {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const staleDate = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

  for (let i = 0; i < nodeCount; i++) {
    const id = `node_${i}`;
    const isStale = i % 10 === 0;
    const isBlocked = i % 15 === 0;
    const isDone = i % 7 === 0;

    nodes.push(
      makeNode(id, {
        status: isDone ? "done" : isBlocked ? "blocked" : "in_progress",
        updatedAt: isStale ? staleDate : new Date().toISOString(),
      }),
    );

    // Create dependency edges (linear chain with some cross-links)
    if (i > 0) {
      edges.push(makeEdge(`node_${i - 1}`, id));
    }
    // Cross-link every 8th node to create graph complexity
    if (i > 8 && i % 8 === 0) {
      edges.push(makeEdge(`node_${i - 8}`, id, `e_cross_${i}`));
    }
  }

  // Add orphan edges (pointing to non-existent nodes) for issue detection
  edges.push(makeEdge("node_0", "ghost_node_1", "e_orphan_1"));
  edges.push(makeEdge("ghost_node_2", "node_1", "e_orphan_2"));

  const byId: Record<string, number> = {};
  nodes.forEach((n, idx) => {
    byId[n.id] = idx;
  });

  return {
    version: "1.0",
    project: {
      id: "proj_bench",
      name: "Benchmark Project",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    nodes,
    edges,
    indexes: {
      byId,
      childrenByParent: {},
      incomingByNode: {},
      outgoingByNode: {},
    },
    meta: {
      sourceFiles: [],
      lastImport: null,
    },
  };
}

// ── Pre-built fixtures ────────────────────────────────

const graph50 = buildGraphFixture(50);
const graph100 = buildGraphFixture(100);
const graph200 = buildGraphFixture(200);

const config = { ...DEFAULT_HEALING_CONFIG, staleHours: 48 };

// ── Benchmarks ────────────────────────────────────────

describe("Self-Healing monitorGraph scan", () => {
  bench("scan 50 nodes", () => {
    monitorGraph(graph50, config);
  });

  bench("scan 100 nodes", () => {
    monitorGraph(graph100, config);
  });

  bench("scan 200 nodes", () => {
    monitorGraph(graph200, config);
  });
});
