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
 * Personalized PageRank via Power Iteration.
 *
 * Algorithm: s_{t+1} = (1-α) * A_norm * s_t + α * seed
 * Where A_norm is column-normalized adjacency (stochastic matrix),
 * α=0.15 (damping/teleport), ε=1e-6 convergence, max 20 iterations.
 *
 * Based on HippoRAG (Zhang et al., arxiv 2405.14831) adaptation
 * for execution graph RAG scoring.
 */

import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "rag", source: "personalized-pagerank.ts" });

// ── Types ───────────────────────────────────────────────

export interface PprInput {
  nodeIds: string[];
  edges: Array<{ from: string; to: string }>;
  seedNodeIds: string[];
  /** Damping/teleport factor. Default: 0.15 */
  alpha?: number;
  /** Convergence threshold. Default: 1e-6 */
  epsilon?: number;
  /** Maximum iterations. Default: 20 */
  maxIterations?: number;
}

export interface PprResult {
  scores: Map<string, number>;
  iterations: number;
  converged: boolean;
}

// ── Constants ───────────────────────────────────────────

const DEFAULT_ALPHA = 0.15;
const DEFAULT_EPSILON = 1e-6;
const DEFAULT_MAX_ITERATIONS = 100;

// ── Main Function ───────────────────────────────────────

/**
 * Compute Personalized PageRank scores via power iteration.
 *
 * Returns a map of nodeId → PPR score. Scores sum to ~1.0.
 * Empty graph or empty seed returns an empty map.
 */
export function computePPR(input: PprInput): PprResult {
  const { nodeIds, edges, seedNodeIds } = input;
  const alpha = input.alpha ?? DEFAULT_ALPHA;
  const epsilon = input.epsilon ?? DEFAULT_EPSILON;
  const maxIterations = input.maxIterations ?? DEFAULT_MAX_ITERATIONS;

  // Filter seed nodes to only those in the graph
  const nodeSet = new Set(nodeIds);
  const validSeeds = seedNodeIds.filter((id) => nodeSet.has(id));

  // Early exit: empty graph or no valid seeds
  if (nodeIds.length === 0 || validSeeds.length === 0) {
    return { scores: new Map(), iterations: 0, converged: true };
  }

  const nVar = nodeIds.length;
  const nodeIndex = new Map<string, number>();
  for (let i = 0; i < nVar; i++) {
    nodeIndex.set(nodeIds[i], i);
  }

  // Build adjacency list (outgoing edges per node)
  const outEdges = new Array<number[]>(nVar);
  for (let i = 0; i < nVar; i++) outEdges[i] = [];

  for (const edge of edges) {
    const fromIdx = nodeIndex.get(edge.from);
    const toIdx = nodeIndex.get(edge.to);
    if (fromIdx !== undefined && toIdx !== undefined) {
      outEdges[fromIdx].push(toIdx);
    }
  }

  // Build seed vector (uniform over valid seeds)
  const seed = new Float64Array(nVar);
  const seedWeight = 1.0 / validSeeds.length;
  for (const seedId of validSeeds) {
    const idx = nodeIndex.get(seedId);
    if (idx !== undefined) seed[idx] = seedWeight;
  }

  // Initialize score vector = seed
  let scores = new Float64Array(seed);
  let converged = false;
  let iterations = 0;

  for (let iter = 0; iter < maxIterations; iter++) {
    iterations = iter + 1;
    const next = new Float64Array(nVar);

    // Propagate: for each node, distribute its score equally to outgoing neighbors
    for (let i = 0; i < nVar; i++) {
      const outs = outEdges[i];
      if (outs.length > 0) {
        const share = scores[i] / outs.length;
        for (const j of outs) {
          next[j] += share;
        }
      }
      // Dangling nodes (no outgoing): their score "teleports" back to seed
      // This is handled implicitly by the teleport term below
    }

    // Apply damping: s_{t+1} = (1-α) * propagated + α * seed
    let maxDiff = 0;
    for (let i = 0; i < nVar; i++) {
      next[i] = (1 - alpha) * next[i] + alpha * seed[i];
      const dVar = Math.abs(next[i] - scores[i]);
      if (dVar > maxDiff) maxDiff = dVar;
    }

    scores = next;

    // Check convergence (L∞ norm — max element-wise difference)
    if (maxDiff < epsilon) {
      converged = true;
      break;
    }
  }

  // Build result map (include all nodes, even with score 0)
  const resultValue = new Map<string, number>();
  for (let i = 0; i < nVar; i++) {
    resultValue.set(nodeIds[i], scores[i]);
  }

  log.debug("ppr:computed", {
    nodes: nVar,
    seeds: validSeeds.length,
    iterations,
    converged,
  });

  return { scores: resultValue, iterations, converged };
}
