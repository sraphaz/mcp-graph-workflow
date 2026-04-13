/**
 * Community Summarizer — Label Propagation community detection + TF-IDF summaries.
 *
 * Task 2.2 (node_25ccc0ff5465) — Epic: Community Detection e Community Summaries
 * Based on GraphRAG (Edge et al., Microsoft, arxiv 2404.16130).
 *
 * Pure algorithm functions (detectCommunities, generateCommunitySummary) plus
 * a rebuildCommunities() function that reads from SqliteStore and persists results.
 */

import type { GraphNode, GraphEdge } from "../graph/graph-types.js";
import type { SqliteStore } from "../store/sqlite-store.js";
import { tokenize } from "../search/tokenizer.js";
import { generateId } from "../utils/id.js";
import { logger } from "../utils/logger.js";

// ── Types ───────────────────────────────────────────────

export interface Community {
  communityId: string;
  memberNodeIds: string[];
}

export interface CommunitySummaryResult {
  communityId: string;
  title: string;
  summary: string;
  memberNodeIds: string[];
  memberCount: number;
  topTerms: string[];
}

// ── Label Propagation ───────────────────────────────────

/**
 * Detect communities via Label Propagation.
 * Each node starts with its own label. Iteratively, each node adopts
 * the most frequent label among its neighbors.
 * Iterations = min(10, ceil(sqrt(|nodes|))).
 * Isolated nodes become singleton communities.
 */
export function detectCommunities(nodes: GraphNode[], edges: GraphEdge[]): Community[] {
  if (nodes.length === 0) return [];

  // Build adjacency list (undirected)
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    adjacency.set(node.id, []);
  }
  for (const edge of edges) {
    const fromList = adjacency.get(edge.from);
    const toList = adjacency.get(edge.to);
    if (fromList) fromList.push(edge.to);
    if (toList) toList.push(edge.from);
  }

  // Initialize labels: each node is its own label
  const labels = new Map<string, string>();
  for (const node of nodes) {
    labels.set(node.id, node.id);
  }

  const maxIter = Math.min(10, Math.ceil(Math.sqrt(nodes.length)));

  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;

    // Process nodes in shuffled order for stability
    const shuffled = [...nodes].sort(() => Math.random() - 0.5);

    for (const node of shuffled) {
      const neighbors = adjacency.get(node.id) ?? [];
      if (neighbors.length === 0) continue; // isolated → keep own label

      // Count neighbor labels
      const labelCounts = new Map<string, number>();
      for (const neighborId of neighbors) {
        const nLabel = labels.get(neighborId) ?? neighborId;
        labelCounts.set(nLabel, (labelCounts.get(nLabel) ?? 0) + 1);
      }

      // Find most frequent label
      let bestLabel = labels.get(node.id) ?? node.id;
      let bestCount = 0;
      for (const [label, count] of labelCounts) {
        if (count > bestCount) {
          bestCount = count;
          bestLabel = label;
        }
      }

      if (bestLabel !== labels.get(node.id)) {
        labels.set(node.id, bestLabel);
        changed = true;
      }
    }

    if (!changed) break; // converged
  }

  // Group nodes by label
  const groups = new Map<string, string[]>();
  for (const [nodeId, label] of labels) {
    const group = groups.get(label);
    if (group) {
      group.push(nodeId);
    } else {
      groups.set(label, [nodeId]);
    }
  }

  const communities: Community[] = [];
  for (const [label, memberNodeIds] of groups) {
    communities.push({
      communityId: `comm_${label}`,
      memberNodeIds,
    });
  }

  logger.debug("community-summarizer:detect", {
    nodes: nodes.length,
    edges: edges.length,
    communities: communities.length,
  });

  return communities;
}

// ── TF-IDF Summary Generation ───────────────────────────

/**
 * Generate a textual summary for a community using TF-IDF.
 * Extracts top 10 terms from member nodes' title + description corpus.
 */
export function generateCommunitySummary(
  community: Community,
  allNodes: GraphNode[],
): CommunitySummaryResult {
  const memberSet = new Set(community.memberNodeIds);
  const memberNodes = allNodes.filter((n) => memberSet.has(n.id));

  // Extract unique tokens and score them
  const tokenScores = extractTopTerms(memberNodes);
  const topTerms = tokenScores.slice(0, 10);

  // Generate title from top 3 terms
  const title = topTerms.length > 0
    ? `Community: ${topTerms.slice(0, 3).join(", ")}`
    : `Community: ${community.communityId}`;

  // Generate summary from top terms
  const summary = topTerms.length > 0
    ? `Cluster of ${memberNodes.length} nodes focused on: ${topTerms.join(", ")}.`
    : `Cluster of ${memberNodes.length} nodes.`;

  return {
    communityId: community.communityId,
    title,
    summary,
    memberNodeIds: community.memberNodeIds,
    memberCount: memberNodes.length,
    topTerms,
  };
}

/**
 * Extract top TF-IDF terms from a set of nodes.
 * Builds per-node term frequency and global document frequency,
 * then ranks terms by average TF-IDF across documents.
 */
function extractTopTerms(nodes: GraphNode[]): string[] {
  if (nodes.length === 0) return [];

  // Build term frequency per document and document frequency
  const docFreq = new Map<string, number>();
  const docTermFreqs: Array<Map<string, number>> = [];
  const docLengths: number[] = [];

  for (const node of nodes) {
    const text = `${node.title} ${node.description ?? ""}`.trim();
    const tokens = tokenize(text);
    const tf = new Map<string, number>();

    for (const token of tokens) {
      tf.set(token, (tf.get(token) ?? 0) + 1);
    }

    // Update document frequency
    for (const term of tf.keys()) {
      docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
    }

    docTermFreqs.push(tf);
    docLengths.push(tokens.length || 1);
  }

  const n = nodes.length;

  // Score each term by average TF-IDF across all documents
  const termScores = new Map<string, number>();
  for (const [term, df] of docFreq) {
    const idf = Math.log(1 + n / df);
    let totalTfIdf = 0;

    for (let i = 0; i < docTermFreqs.length; i++) {
      const tf = (docTermFreqs[i].get(term) ?? 0) / docLengths[i];
      totalTfIdf += tf * idf;
    }

    termScores.set(term, totalTfIdf / n);
  }

  // Sort by score descending
  return [...termScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([term]) => term);
}

// ── Rebuild Communities (SQLite persistence) ─────────────

/**
 * Rebuild all communities from the execution graph and persist to SQLite.
 * Reads nodes/edges from the store, runs Label Propagation + TF-IDF,
 * and writes results to community_summaries table.
 */
export function rebuildCommunities(store: SqliteStore): CommunitySummaryResult[] {
  const db = store.getDb();
  const project = store.getProject();
  if (!project) {
    logger.warn("community-summarizer:rebuild", { message: "No active project" });
    return [];
  }

  // Read all nodes and edges for the active project
  const nodeRows = db
    .prepare(
      "SELECT id, type, title, description, status, priority, created_at, updated_at FROM nodes WHERE project_id = ?",
    )
    .all(project.id) as Array<{
      id: string;
      type: string;
      title: string;
      description: string | null;
      status: string;
      priority: number;
      created_at: string;
      updated_at: string;
    }>;

  const nodes: GraphNode[] = nodeRows.map((r) => ({
    id: r.id,
    type: r.type as GraphNode["type"],
    title: r.title,
    description: r.description ?? undefined,
    status: r.status as GraphNode["status"],
    priority: r.priority as GraphNode["priority"],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  const edgeRows = db
    .prepare(
      "SELECT id, from_node, to_node, relation_type, created_at FROM edges WHERE project_id = ?",
    )
    .all(project.id) as Array<{
      id: string;
      from_node: string;
      to_node: string;
      relation_type: string;
      created_at: string;
    }>;

  const edges: GraphEdge[] = edgeRows.map((r) => ({
    id: r.id,
    from: r.from_node,
    to: r.to_node,
    relationType: r.relation_type as GraphEdge["relationType"],
    createdAt: r.created_at,
  }));

  // Detect communities
  const communities = detectCommunities(nodes, edges);

  // Generate summaries
  const summaries = communities.map((c) => generateCommunitySummary(c, nodes));

  // Persist: clear old data, insert new
  const now = new Date().toISOString();
  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM community_summaries").run();

    const insert = db.prepare(`
      INSERT INTO community_summaries (id, community_id, title, summary, member_node_ids, member_count, top_terms, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const s of summaries) {
      insert.run(
        generateId("comm"),
        s.communityId,
        s.title,
        s.summary,
        JSON.stringify(s.memberNodeIds),
        s.memberCount,
        JSON.stringify(s.topTerms),
        now,
        now,
      );
    }
  });

  transaction();

  logger.info("community-summarizer:rebuild", {
    communities: summaries.length,
    totalNodes: nodes.length,
  });

  return summaries;
}
