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
 * HNSW Index — Hierarchical Navigable Small World graph for approximate k-NN.
 *
 * Based on Malkov & Yashunin, IEEE TPAMI 2020 (arxiv 1603.09320).
 * Pure TypeScript, zero dependencies. Cosine similarity.
 *
 * Parameters: M=16, efConstruction=200, maxLevel via log distribution.
 * Falls back to linear scan for < 100 vectors (overhead not worthwhile).
 */

import { logger } from "../utils/logger.js";

// ── Types ───────────────────────────────────────────────

export interface HNSWConfig {
  dimension: number;
  M?: number;               // max connections per layer (default: 16)
  efConstruction?: number;   // search width during construction (default: 200)
  linearThreshold?: number;  // fallback to linear below this (default: 100)
}

export interface SearchResult {
  id: string;
  score: number;
}

interface HNSWNode {
  id: string;
  vector: number[];
  layers: Map<string, number>[];  // layers[level] = Map<neighborId, similarity>
  level: number;                  // max level this node participates in
}

interface SerializedIndex {
  dimension: number;
  M: number;
  efConstruction: number;
  linearThreshold: number;
  entryPointId: string | null;
  maxLevel: number;
  nodes: Array<{
    id: string;
    vector: number[];
    level: number;
    layers: Array<Array<[string, number]>>;
  }>;
}

// ── Cosine Similarity ───────────────────────────────────

/** Compute cosine similarity between two vectors. */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ── Linear Search ───────────────────────────────────────

/** Exact k-NN via linear scan. Baseline for recall comparison. */
export function linearSearch(
  vectors: Array<{ id: string; vector: number[] }>,
  query: number[],
  k: number,
): SearchResult[] {
  const scored = vectors.map((v) => ({
    id: v.id,
    score: cosineSimilarity(query, v.vector),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

// ── HNSW Index ──────────────────────────────────────────

export class HNSWIndex {
  private readonly dimension: number;
  private readonly M: number;
  private readonly efConstruction: number;
  private readonly linearThreshold: number;
  private readonly mMax0: number;  // max connections at layer 0 (2 * M)

  private nodes = new Map<string, HNSWNode>();
  private entryPointId: string | null = null;
  private maxLevel = 0;

  constructor(config: HNSWConfig) {
    this.dimension = config.dimension;
    this.M = config.M ?? 16;
    this.efConstruction = config.efConstruction ?? 200;
    this.linearThreshold = config.linearThreshold ?? 100;
    this.mMax0 = this.M * 2;
  }

  /** Number of indexed vectors. */
  size(): number {
    return this.nodes.size;
  }

  /** Whether the index is using linear fallback (< threshold). */
  isUsingLinearFallback(): boolean {
    return this.nodes.size < this.linearThreshold;
  }

  /** Number of HNSW layers (0 if using linear fallback). */
  layerCount(): number {
    if (this.isUsingLinearFallback()) return 0;
    return this.maxLevel + 1;
  }

  /** Insert a vector into the index. Updates if id already exists. */
  insert(id: string, vector: number[]): void {
    // Handle duplicate: remove old entry first
    if (this.nodes.has(id)) {
      this.remove(id);
    }

    const level = this.randomLevel();
    const node: HNSWNode = {
      id,
      vector,
      level,
      layers: Array.from({ length: level + 1 }, () => new Map()),
    };

    this.nodes.set(id, node);

    // If below threshold, don't build graph structure
    if (this.isUsingLinearFallback()) {
      if (!this.entryPointId) this.entryPointId = id;
      return;
    }

    // If this is the first node above threshold, rebuild graph
    if (this.nodes.size === this.linearThreshold) {
      this.rebuildGraph();
      return;
    }

    // No entry point yet
    if (!this.entryPointId) {
      this.entryPointId = id;
      if (level > this.maxLevel) this.maxLevel = level;
      return;
    }

    // Insert into graph
    this.insertIntoGraph(node);
  }

  /** Search for k nearest neighbors. */
  search(query: number[], k: number): SearchResult[] {
    if (this.nodes.size === 0) return [];

    const effectiveK = Math.min(k, this.nodes.size);

    // Linear fallback for small collections
    if (this.isUsingLinearFallback()) {
      const vectors = [...this.nodes.values()].map((n) => ({ id: n.id, vector: n.vector }));
      return linearSearch(vectors, query, effectiveK);
    }

    // HNSW search
    return this.hnswSearch(query, effectiveK);
  }

  /** Serialize the index to JSON. */
  toJSON(): string {
    const serialized: SerializedIndex = {
      dimension: this.dimension,
      M: this.M,
      efConstruction: this.efConstruction,
      linearThreshold: this.linearThreshold,
      entryPointId: this.entryPointId,
      maxLevel: this.maxLevel,
      nodes: [...this.nodes.values()].map((n) => ({
        id: n.id,
        vector: n.vector,
        level: n.level,
        layers: n.layers.map((layer) => [...layer.entries()]),
      })),
    };
    return JSON.stringify(serialized);
  }

  /** Deserialize an index from JSON. */
  static fromJSON(json: string): HNSWIndex {
    const dataValue = JSON.parse(json) as SerializedIndex;
    const index = new HNSWIndex({
      dimension: dataValue.dimension,
      M: dataValue.M,
      efConstruction: dataValue.efConstruction,
      linearThreshold: dataValue.linearThreshold,
    });

    index.entryPointId = dataValue.entryPointId;
    index.maxLevel = dataValue.maxLevel;

    for (const nodeData of dataValue.nodes) {
      const node: HNSWNode = {
        id: nodeData.id,
        vector: nodeData.vector,
        level: nodeData.level,
        layers: nodeData.layers.map((entries) => new Map(entries)),
      };
      index.nodes.set(node.id, node);
    }

    return index;
  }

  // ── Private: Graph Construction ───────────────────────

  /** Generate random level using exponential distribution. */
  private randomLevel(): number {
    let level = 0;
    while (Math.random() < 1 / this.M && level < 10) {
      level++;
    }
    return level;
  }

  /** Remove a node from the graph (for updates). */
  private remove(id: string): void {
    const node = this.nodes.get(id);
    if (!node) return;

    // Remove from neighbors' connection lists
    for (let lVar = 0; lVar <= node.level; lVar++) {
      for (const neighborId of node.layers[lVar].keys()) {
        const neighbor = this.nodes.get(neighborId);
        if (neighbor && neighbor.layers[lVar]) {
          neighbor.layers[lVar].delete(id);
        }
      }
    }

    this.nodes.delete(id);

    // Update entry point if needed
    if (this.entryPointId === id) {
      this.entryPointId = this.nodes.size > 0 ? this.nodes.keys().next().value ?? null : null;
    }
  }

  /** Rebuild the entire graph (called when crossing linear threshold). */
  private rebuildGraph(): void {
    const allNodes = [...this.nodes.values()];

    // Reset all connections
    for (const node of allNodes) {
      node.layers = Array.from({ length: node.level + 1 }, () => new Map());
    }

    // Find the highest-level node as entry point
    let maxLvl = 0;
    let epId: string | null = null;
    for (const node of allNodes) {
      if (node.level > maxLvl) {
        maxLvl = node.level;
        epId = node.id;
      }
    }
    this.maxLevel = maxLvl;
    this.entryPointId = epId;

    // Re-insert all nodes
    for (const node of allNodes) {
      if (node.id === this.entryPointId) continue;
      this.insertIntoGraph(node);
    }

    logger.debug("hnsw:rebuild", { nodes: allNodes.length, maxLevel: this.maxLevel });
  }

  /** Insert a node into the HNSW graph structure. */
  private insertIntoGraph(node: HNSWNode): void {
    if (this.entryPointId === null) return;
    const ep = this.nodes.get(this.entryPointId);
    if (!ep) return;

    let currentBest = this.entryPointId;

    // Phase 1: Greedy traverse from top to node.level + 1
    for (let lVar = this.maxLevel; lVar > node.level; lVar--) {
      currentBest = this.greedyClosest(node.vector, currentBest, lVar);
    }

    // Phase 2: Insert at each level from node.level down to 0
    for (let lVar = Math.min(node.level, this.maxLevel); lVar >= 0; lVar--) {
      const mMax = lVar === 0 ? this.mMax0 : this.M;

      // Find neighbors at this level
      const candidates = this.searchLayer(node.vector, currentBest, this.efConstruction, lVar);

      // Select M closest
      const neighbors = candidates.slice(0, mMax);

      // Connect node to neighbors (bidirectional)
      for (const neighbor of neighbors) {
        if (neighbor.id === node.id) continue;

        const sim = neighbor.score;
        node.layers[lVar].set(neighbor.id, sim);

        const nNode = this.nodes.get(neighbor.id);
        if (nNode && nNode.layers[lVar]) {
          nNode.layers[lVar].set(node.id, sim);

          // Prune if too many connections
          if (nNode.layers[lVar].size > mMax) {
            this.pruneConnections(nNode, lVar, mMax);
          }
        }
      }

      if (candidates.length > 0) {
        currentBest = candidates[0].id;
      }
    }

    // Update entry point if new node has higher level
    if (node.level > this.maxLevel) {
      this.maxLevel = node.level;
      this.entryPointId = node.id;
    }
  }

  /** Greedy search for the closest node to query at a given level. */
  private greedyClosest(query: number[], startId: string, level: number): string {
    let bestId = startId;
    const startNode = this.nodes.get(startId);
    if (!startNode) return startId;
    let bestSim = cosineSimilarity(query, startNode.vector);

    let improved = true;
    while (improved) {
      improved = false;
      const node = this.nodes.get(bestId);
      if (!node || !node.layers[level]) break;

      for (const neighborId of node.layers[level].keys()) {
        const neighbor = this.nodes.get(neighborId);
        if (!neighbor) continue;

        const sim = cosineSimilarity(query, neighbor.vector);
        if (sim > bestSim) {
          bestSim = sim;
          bestId = neighborId;
          improved = true;
        }
      }
    }

    return bestId;
  }

  /** Search a single layer, returning sorted candidates. */
  private searchLayer(
    query: number[],
    startId: string,
    ef: number,
    level: number,
  ): SearchResult[] {
    const visited = new Set<string>([startId]);
    const startNode = this.nodes.get(startId);
    if (!startNode) return [];
    const startSim = cosineSimilarity(query, startNode.vector);

    // Candidates sorted by similarity (descending)
    const candidates: SearchResult[] = [{ id: startId, score: startSim }];
    // Dynamic list (working set)
    const working: SearchResult[] = [{ id: startId, score: startSim }];

    while (working.length > 0) {
      // Get closest unprocessed candidate
      working.sort((a, b) => b.score - a.score);
      const current = working.shift();
      if (!current) break;

      // If current is worse than the worst in candidates and we have enough, stop
      if (candidates.length >= ef) {
        candidates.sort((a, b) => b.score - a.score);
        if (current.score < candidates[ef - 1].score) break;
      }

      // Expand neighbors
      const node = this.nodes.get(current.id);
      if (!node || !node.layers[level]) continue;

      for (const neighborId of node.layers[level].keys()) {
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);

        const neighbor = this.nodes.get(neighborId);
        if (!neighbor) continue;

        const sim = cosineSimilarity(query, neighbor.vector);
        const resultValue = { id: neighborId, score: sim };

        candidates.push(resultValue);
        working.push(resultValue);
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, ef);
  }

  /** Prune connections for a node at a given level. Keep closest M. */
  private pruneConnections(node: HNSWNode, level: number, maxConn: number): void {
    const entries = [...node.layers[level].entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxConn);

    node.layers[level] = new Map(entries);
  }

  /** HNSW search: traverse from top layer down, then expand at layer 0. */
  private hnswSearch(query: number[], k: number): SearchResult[] {
    if (!this.entryPointId) return [];

    let currentBest = this.entryPointId;

    // Traverse from top layer to layer 1
    for (let lVar = this.maxLevel; lVar >= 1; lVar--) {
      currentBest = this.greedyClosest(query, currentBest, lVar);
    }

    // Search at layer 0 with ef = max(k, efConstruction)
    const ef = Math.max(k, 50); // Use reasonable ef for search
    const candidates = this.searchLayer(query, currentBest, ef, 0);

    return candidates.slice(0, k);
  }
}
