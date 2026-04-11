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

interface GraphRagOptions {
  limit?: number;
  maxHops?: number;
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

  // Step 3: Collect knowledge docs linked to the expanded node set
  const knowledgeStore = new KnowledgeStore(db);
  const docScores = new Map<string, { score: number; distance: number; nodeId: string }>();

  for (const [nodeId, distance] of nodeDistances) {
    const docs = findDocsLinkedToNode(db, nodeId);
    const proximity = graphProximityScore(distance);

    for (const doc of docs) {
      const existing = docScores.get(doc.id);
      // Keep the best score (closest graph distance)
      if (!existing || proximity > existing.score) {
        docScores.set(doc.id, { score: proximity, distance, nodeId });
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

  // Sort by score descending, then limit
  results.sort((a, b) => b.score - a.score);

  logger.info("graph-rag: execution graph search complete", {
    matchedNodes: matchedNodes.length,
    expandedNodes: nodeDistances.size,
    docsFound: results.length,
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
    for (const r of results) matchedNodeSet.add(r.id);
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
