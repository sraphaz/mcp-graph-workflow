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
 * Graph RAG Strategy — uses execution graph topology for retrieval.
 *
 * Leverages the typed execution graph (nodes, edges, parent/child relationships)
 * to find knowledge documents that are topologically related to the query.
 *
 * Strategy:
 * 1. Match query against execution graph nodes via FTS
 * 2. Expand matched nodes: parent, children, dependencies (BFS 1-2 hops)
 * 3. Collect knowledge docs linked to expanded node set via metadata.nodeId
 * 4. Score by graph proximity (distance from query-matched node)
 */

import type Database from "better-sqlite3";
import type { SqliteStore } from "../store/sqlite-store.js";
import type { GraphNode } from "../graph/graph-types.js";
import { KnowledgeStore } from "../store/knowledge-store.js";
import { computePPR } from "./personalized-pagerank.js";
import { tokenize } from "../search/tokenizer.js";
import { logger } from "../utils/logger.js";

export interface GraphRagResult {
  id: string;
  sourceType: string;
  sourceId: string;
  title: string;
  content: string;
  score: number;
  graphDistance: number;
  linkedNodeId: string;
  strategies: string[];
}

export interface GraphRagOptions {
  limit?: number;
  maxHops?: number;
  /** Use Personalized PageRank for scoring instead of BFS distance. Default: false */
  ppr?: boolean;
  /** Enable community summary injection for broad queries. Default: false */
  communitySearch?: boolean;
}

/**
 * Compute proximity score based on graph distance.
 * Uses inverse distance: score = 1 / (1 + distance)
 */
export function graphProximityScore(distance: number): number {
  return 1 / (1 + distance);
}

/**
 * Search the execution graph for nodes matching the query,
 * expand to neighbors, and collect linked knowledge documents.
 */
export function executionGraphSearch(
  db: Database.Database,
  store: SqliteStore,
  query: string,
  options?: GraphRagOptions,
): GraphRagResult[] {
  const limit = options?.limit ?? 20;
  const maxHops = options?.maxHops ?? 2;

  // Step 1: Find execution graph nodes matching the query via FTS
  let matchedNodes: Array<GraphNode & { score: number }> = [];
  try {
    matchedNodes = store.searchNodes(query, 5);
  } catch {
    logger.debug("graph-rag: FTS search on execution graph returned no results");
  }

  // Fallback: try substring match if FTS returns nothing
  if (matchedNodes.length === 0) {
    try {
      const allNodes = store.getAllNodes();
      const lowerQuery = query.toLowerCase();
      const words = lowerQuery.split(/\s+/).filter((w) => w.length > 2);
      if (words.length > 0) {
        const matched = allNodes
          .filter((n) =>
            words.some(
              (w) =>
                n.title.toLowerCase().includes(w) ||
                (n.description ?? "").toLowerCase().includes(w),
            ),
          )
          .slice(0, 5);
        matchedNodes = matched.map((node) => ({ ...node, score: 0.5 }));
      }
    } catch {
      logger.debug("graph-rag: substring fallback also failed");
    }
  }

  if (matchedNodes.length === 0) {
    return [];
  }

  // Step 2: Expand matched nodes via graph topology (BFS)
  // Map: nodeId → { distance from nearest matched node }
  const nodeDistances = new Map<string, number>();
  for (const node of matchedNodes) {
    nodeDistances.set(node.id, 0);
  }

  // BFS expansion: parent, children, dependencies
  const visited = new Set<string>(matchedNodes.map((n) => n.id));
  let frontier = matchedNodes.map((n) => n.id);

  for (let hop = 1; hop <= maxHops; hop++) {
    const nextFrontier: string[] = [];

    for (const nodeId of frontier) {
      const neighbors = collectNeighbors(store, nodeId);
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          nodeDistances.set(neighborId, hop);
          nextFrontier.push(neighborId);
        }
      }
    }

    frontier = nextFrontier;
    if (frontier.length === 0) break;
  }

  // Step 3: Score nodes — PPR or BFS
  const usePpr = options?.ppr === true;
  let pprScores: Map<string, number> | null = null;

  if (usePpr) {
    // Collect subgraph edges for PPR
    const subgraphEdges: Array<{ from: string; to: string }> = [];
    for (const nodeId of visited) {
      const outgoing = safeGetEdgesFrom(store, nodeId);
      for (const edge of outgoing) {
        if (visited.has(edge.to)) {
          subgraphEdges.push({ from: edge.from, to: edge.to });
        }
      }
      const incoming = safeGetEdgesTo(store, nodeId);
      for (const edge of incoming) {
        if (visited.has(edge.from)) {
          subgraphEdges.push({ from: edge.from, to: edge.to });
        }
      }
      // Parent/child edges
      const node = store.getNodeById(nodeId);
      if (node?.parentId && visited.has(node.parentId)) {
        subgraphEdges.push({ from: node.parentId, to: nodeId });
      }
      const children = safeGetChildren(store, nodeId);
      for (const child of children) {
        if (visited.has(child.id)) {
          subgraphEdges.push({ from: nodeId, to: child.id });
        }
      }
    }

    // Add reverse edges for undirected PPR (proximity matters both directions)
    const biEdges = [
      ...subgraphEdges,
      ...subgraphEdges.map((e) => ({ from: e.to, to: e.from })),
    ];

    const pprResult = computePPR({
      nodeIds: [...visited],
      edges: biEdges,
      seedNodeIds: matchedNodes.map((n) => n.id),
    });
    pprScores = pprResult.scores;

    logger.debug("graph-rag: PPR computed", {
      nodes: visited.size,
      edges: subgraphEdges.length,
      iterations: pprResult.iterations,
      converged: pprResult.converged,
    });
  }

  // Step 4: Collect knowledge docs linked to the expanded node set
  const knowledgeStore = new KnowledgeStore(db);
  const docScores = new Map<string, { score: number; distance: number; nodeId: string }>();

  for (const [nodeId, distance] of nodeDistances) {
    const docs = findDocsLinkedToNode(db, nodeId);
    const nodeScore = usePpr && pprScores
      ? (pprScores.get(nodeId) ?? 0)
      : graphProximityScore(distance);

    for (const doc of docs) {
      const existing = docScores.get(doc.id);
      // Keep the best score
      if (!existing || nodeScore > existing.score) {
        docScores.set(doc.id, { score: nodeScore, distance, nodeId });
      }
    }
  }

  // Step 4: Build results
  const results: GraphRagResult[] = [];
  for (const [docId, meta] of docScores) {
    const doc = knowledgeStore.getById(docId);
    if (!doc) continue;

    results.push({
      id: doc.id,
      sourceType: doc.sourceType,
      sourceId: doc.sourceId,
      title: doc.title,
      content: doc.content,
      score: Math.round(meta.score * 10000) / 10000,
      graphDistance: meta.distance,
      linkedNodeId: meta.nodeId,
      strategies: ["exec_graph"],
    });
  }

  // Inject community summaries for broad queries (feature flag)
  if (options?.communitySearch) {
    const communityResults = findByCommunity(store, query);
    for (const cr of communityResults) {
      results.push({
        id: cr.communityId,
        sourceType: "community_summary",
        sourceId: cr.communityId,
        title: cr.title,
        content: cr.summary,
        score: cr.score,
        graphDistance: 0,
        linkedNodeId: cr.communityId,
        strategies: ["community"],
      });
    }
  }

  // Sort by score descending, then limit
  results.sort((a, b) => b.score - a.score);

  logger.info("graph-rag: execution graph search complete", {
    matchedNodes: matchedNodes.length,
    expandedNodes: nodeDistances.size,
    docsFound: results.length,
    communityResults: options?.communitySearch ? results.filter((r) => r.strategies.includes("community")).length : 0,
  });

  return results.slice(0, limit);
}

/**
 * Collect neighboring node IDs from the execution graph.
 * Includes: parent, children, edge targets (depends_on, blocks, related_to, implements).
 */
function collectNeighbors(store: SqliteStore, nodeId: string): string[] {
  const neighbors: string[] = [];

  // Parent
  const node = store.getNodeById(nodeId);
  if (node?.parentId) {
    neighbors.push(node.parentId);
  }

  // Children
  try {
    const children = store.getChildNodes(nodeId);
    for (const child of children) {
      neighbors.push(child.id);
    }
  } catch {
    // No children — OK
  }

  // Outgoing edges (depends_on, blocks, related_to, implements, etc.)
  try {
    const outgoing = store.getEdgesFrom(nodeId);
    for (const edge of outgoing) {
      neighbors.push(edge.to);
    }
  } catch {
    // No edges — OK
  }

  // Incoming edges (what depends on this node)
  try {
    const incoming = store.getEdgesTo(nodeId);
    for (const edge of incoming) {
      neighbors.push(edge.from);
    }
  } catch {
    // No edges — OK
  }

  return neighbors;
}

/**
 * Find knowledge documents linked to a specific execution graph node.
 * Searches via metadata.nodeId stored in the knowledge_documents table.
 */
function findDocsLinkedToNode(
  db: Database.Database,
  nodeId: string,
): Array<{ id: string }> {
  try {
    const rows = db
      .prepare(
        `SELECT id FROM knowledge_documents
         WHERE json_extract(metadata, '$.nodeId') = ?`,
      )
      .all(nodeId) as Array<{ id: string }>;
    return rows;
  } catch {
    // json_extract may fail if metadata is null — that's OK
    return [];
  }
}

// ── Safe edge/children accessors (swallow errors) ───

function safeGetEdgesFrom(store: SqliteStore, nodeId: string): Array<{ from: string; to: string }> {
  try {
    return store.getEdgesFrom(nodeId);
  } catch {
    return [];
  }
}

function safeGetEdgesTo(store: SqliteStore, nodeId: string): Array<{ from: string; to: string }> {
  try {
    return store.getEdgesTo(nodeId);
  } catch {
    return [];
  }
}

function safeGetChildren(store: SqliteStore, nodeId: string): Array<{ id: string }> {
  try {
    return store.getChildNodes(nodeId);
  } catch {
    return [];
  }
}

// ── Community Detection ─────────────────────────────

export interface NodeCommunity {
  /** Representative label for the community (derived from the most common parent epic). */
  label: string;
  /** Node IDs belonging to this community. */
  nodeIds: string[];
  /** Knowledge doc IDs linked to this community's nodes. */
  docIds: string[];
}

/**
 * Detect thematic communities in the execution graph.
 *
 * Groups nodes by shared parent epic (hierarchical clustering).
 * Each community represents a cohesive work cluster whose knowledge
 * docs are contextually related.
 *
 * This is a lightweight alternative to Louvain/label propagation,
 * leveraging the existing epic → task hierarchy as a natural cluster.
 */
export function detectCommunities(
  db: Database.Database,
  store: SqliteStore,
): NodeCommunity[] {
  const communities = new Map<string, { label: string; nodeIds: string[]; docIds: Set<string> }>();

  const allNodes = store.getAllNodes();

  for (const node of allNodes) {
    // Find root epic for this node by walking parent chain
    const rootId = findRootEpic(store, node.id);
    const communityKey = rootId ?? "__orphan__";

    if (!communities.has(communityKey)) {
      const root = rootId ? store.getNodeById(rootId) : null;
      communities.set(communityKey, {
        label: root?.title ?? "Uncategorized",
        nodeIds: [],
        docIds: new Set(),
      });
    }

    const community = communities.get(communityKey);
    if (!community) continue;
    community.nodeIds.push(node.id);

    // Collect linked knowledge docs
    const docs = findDocsLinkedToNode(db, node.id);
    for (const doc of docs) {
      community.docIds.add(doc.id);
    }
  }

  return Array.from(communities.values())
    .filter((c) => c.nodeIds.length > 0)
    .map((c) => ({
      label: c.label,
      nodeIds: c.nodeIds,
      docIds: Array.from(c.docIds),
    }));
}

/**
 * Walk the parent chain to find the root epic for a node.
 * Returns the root epic's ID, or null if the node has no parent.
 */
function findRootEpic(store: SqliteStore, nodeId: string, maxDepth: number = 10): string | null {
  let currentId: string | null = nodeId;
  let depth = 0;

  while (currentId && depth < maxDepth) {
    const node = store.getNodeById(currentId);
    if (!node) return null;

    if (node.type === "epic" && !node.parentId) {
      return node.id;
    }

    if (!node.parentId) {
      // Node without parent — return itself if epic, null otherwise
      return node.type === "epic" ? node.id : null;
    }

    currentId = node.parentId;
    depth++;
  }

  return currentId;
}

/**
 * Find the community a query belongs to, and return all knowledge docs
 * from that community for enhanced thematic context.
 */
export function findCommunityDocs(
  db: Database.Database,
  store: SqliteStore,
  query: string,
): string[] {
  // Find nodes matching the query
  const matchedNodeSet = new Set<string>();
  try {
    const results = store.searchNodes(query, 3);
    for (const rVar of results) matchedNodeSet.add(rVar.id);
  } catch {
    return [];
  }

  if (matchedNodeSet.size === 0) return [];

  // Detect communities and find which community the matched nodes belong to
  const communities = detectCommunities(db, store);

  const relevantDocIds = new Set<string>();
  for (const community of communities) {
    const hasMatch = community.nodeIds.some((id) => matchedNodeSet.has(id));
    if (hasMatch) {
      for (const docId of community.docIds) {
        relevantDocIds.add(docId);
      }
    }
  }

  return Array.from(relevantDocIds);
}

// ── Community Summary Search (v7 — Task 2.3) ─────────

const COMMUNITY_COVERAGE_THRESHOLD = 0.6;
const COMMUNITY_INJECT_SCORE = 0.85;

export interface CommunitySearchResult {
  communityId: string;
  title: string;
  summary: string;
  score: number;
  coverage: number;
  memberNodeIds: string[];
  topTerms: string[];
}

interface CommunitySummaryRow {
  id: string;
  community_id: string;
  title: string;
  summary: string;
  member_node_ids: string;
  member_count: number;
  top_terms: string;
}

/**
 * Find community summaries that match a broad query.
 *
 * Uses term coverage: if >= 60% of community top_terms appear in the query,
 * the community summary is injected as a high-relevance result (score 0.85).
 * For specific queries (low term overlap), returns empty — no interference.
 *
 * Respects feature flag: `community_summaries_enabled` project setting.
 * Default: enabled (when setting is not set or is "true").
 */
export function findByCommunity(
  store: SqliteStore,
  query: string,
): CommunitySearchResult[] {
  // Feature flag check
  const setting = store.getProjectSetting("community_summaries_enabled");
  if (setting === "false") return [];

  const db = store.getDb();

  // Read all community summaries
  let rows: CommunitySummaryRow[];
  try {
    rows = db
      .prepare("SELECT * FROM community_summaries")
      .all() as CommunitySummaryRow[];
  } catch {
    return [];
  }

  if (rows.length === 0) return [];

  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return [];

  const results: CommunitySearchResult[] = [];

  for (const row of rows) {
    let topTerms: string[];
    let memberNodeIds: string[];
    try {
      topTerms = JSON.parse(row.top_terms) as string[];
      memberNodeIds = JSON.parse(row.member_node_ids) as string[];
    } catch {
      continue;
    }

    if (topTerms.length === 0) continue;

    // Compute coverage: what fraction of community terms appear in the query
    const matchedTerms = topTerms.filter((term) => queryTokens.has(term));
    const coverage = matchedTerms.length / topTerms.length;

    if (coverage >= COMMUNITY_COVERAGE_THRESHOLD) {
      results.push({
        communityId: row.community_id,
        title: row.title,
        summary: row.summary,
        score: COMMUNITY_INJECT_SCORE,
        coverage,
        memberNodeIds,
        topTerms,
      });

      logger.debug("graph-rag:community", {
        communityId: row.community_id,
        coverage: +(coverage * 100).toFixed(1),
        matchedTerms: matchedTerms.length,
        totalTerms: topTerms.length,
      });
    }
  }

  // Sort by coverage descending
  results.sort((a, b) => b.coverage - a.coverage);

  return results;
}
