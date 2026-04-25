/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * assembleSiblingContext — v11 Context-Pollination Assembly helper.
 *
 * Given an epic and a subtask, returns the siblings (done subtasks the subtask
 * depends on, transitively) with their persisted artifacts, ordered
 * topologically with created_at as tiebreak, and a pre-rendered markdown.
 *
 * Implements:
 * - ADR-v11-003: topological sort + created_at tiebreak, fallback warning
 *   when depends_on edges are missing.
 * - ADR-v11-004: token budget (default 4000) truncate-oldest-first.
 * - ADR-v11-006: siblingContext as ready-to-prompt markdown.
 */

import type { SqliteStore } from "../store/sqlite-store.js";
import { SubtaskArtifactsStore } from "../store/subtask-artifacts-store.js";
import type {
  ArtifactKind,
  SubtaskArtifact,
} from "../store/subtask-artifacts-store.js";
import { estimateTokens } from "../context/token-estimator.js";
import { logger } from "../utils/logger.js";

export interface AssembleSiblingContextOptions {
  epicId: string;
  subtaskId: string;
  /** Hard cap for assembled tokens (default 4000). */
  tokenBudget?: number;
}

export interface SiblingSummary {
  id: string;
  title: string;
  createdAt: string;
  artifacts: Array<{
    kind: ArtifactKind;
    path: string | null;
    content: string;
  }>;
}

export interface AssembledSiblingContext {
  siblings: SiblingSummary[];
  /** How many ancestor siblings were dropped by the budget cap. */
  truncatedCount: number;
  /** Approximate token count of the assembled markdown (post-truncation). */
  totalTokens: number;
  /** Ready-to-prompt markdown. Empty string when no siblings. */
  markdown: string;
}

const DEFAULT_TOKEN_BUDGET = 4000;

function fenceLang(kind: ArtifactKind, path: string | null): string {
  if (kind === "diff") return "diff";
  if (kind === "file" || kind === "interface") {
    if (path && path.endsWith(".py")) return "python";
    if (path && path.endsWith(".go")) return "go";
    if (path && path.endsWith(".rs")) return "rust";
    return "ts";
  }
  return ""; // note, decision — render as plain markdown
}

function renderSibling(s: SiblingSummary): string {
  const header = `### Subtask ${s.id}: ${s.title}`;
  const artifactChunks = s.artifacts.map((a) => {
    const lang = fenceLang(a.kind, a.path);
    const label = a.path ? ` — ${a.path}` : "";
    if (lang) {
      return `**${a.kind}**${label}\n\`\`\`${lang}\n${a.content}\n\`\`\``;
    }
    return `**${a.kind}**${label}\n\n${a.content}`;
  });
  return [header, ...artifactChunks].join("\n\n");
}

/**
 * Topological sort via Kahn's algorithm. Given a set of nodes and `depends_on`
 * edges (edge from→to means `from depends_on to`, i.e. `to` is a prerequisite),
 * return the nodes in dependency-first order: prerequisites come before dependents.
 * Ties are broken by created_at ASC.
 *
 * Returns null on cycle.
 */
function topologicalSort(
  nodes: Array<{ id: string; createdAt: string }>,
  depsMap: Map<string, Set<string>>,
): string[] | null {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const indegree = new Map<string, number>();
  const reverseDeps = new Map<string, Set<string>>(); // prereq -> set of dependents

  for (const id of nodeIds) indegree.set(id, 0);
  for (const [dependent, prereqs] of depsMap) {
    if (!nodeIds.has(dependent)) continue;
    for (const prereq of prereqs) {
      if (!nodeIds.has(prereq)) continue;
      indegree.set(dependent, (indegree.get(dependent) ?? 0) + 1);
      let deps = reverseDeps.get(prereq);
      if (!deps) {
        deps = new Set();
        reverseDeps.set(prereq, deps);
      }
      deps.add(dependent);
    }
  }

  const createdAtMap = new Map(nodes.map((n) => [n.id, n.createdAt]));
  const pickNext = (candidates: string[]): string => {
    candidates.sort((a, b) => {
      const ta = createdAtMap.get(a) ?? "";
      const tb = createdAtMap.get(b) ?? "";
      if (ta !== tb) return ta < tb ? -1 : 1;
      return a < b ? -1 : 1;
    });
    return candidates[0];
  };

  const out: string[] = [];
  const zeroIn: string[] = [];
  for (const [id, deg] of indegree) if (deg === 0) zeroIn.push(id);

  while (zeroIn.length > 0) {
    const next = pickNext(zeroIn);
    zeroIn.splice(zeroIn.indexOf(next), 1);
    out.push(next);
    const deps = reverseDeps.get(next);
    if (deps) {
      for (const d of deps) {
        const newDeg = (indegree.get(d) ?? 0) - 1;
        indegree.set(d, newDeg);
        if (newDeg === 0) zeroIn.push(d);
      }
    }
  }

  if (out.length !== nodeIds.size) return null; // cycle
  return out;
}

/**
 * Collect transitive ancestors of `subtaskId` via `depends_on` edges, restricted
 * to sibling nodes (same epic).
 */
function collectAncestors(
  store: SqliteStore,
  subtaskId: string,
  siblingIds: Set<string>,
): Set<string> {
  const visited = new Set<string>();
  const stack = [subtaskId];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) break;
    const edges = store.getEdgesFrom(current);
    for (const e of edges) {
      if (e.relationType !== "depends_on") continue;
      if (!siblingIds.has(e.to)) continue;
      if (visited.has(e.to)) continue;
      visited.add(e.to);
      stack.push(e.to);
    }
  }
  return visited;
}

export function assembleSiblingContext(
  store: SqliteStore,
  opts: AssembleSiblingContextOptions,
): AssembledSiblingContext {
  const tokenBudget = opts.tokenBudget ?? DEFAULT_TOKEN_BUDGET;
  const doc = store.toGraphDocument();
  const allNodes = doc.nodes;

  // 1. Collect sibling subtasks under the epic (excluding the subtaskId itself)
  const siblings = allNodes.filter(
    (n) => n.parentId === opts.epicId && n.id !== opts.subtaskId,
  );
  const siblingIds = new Set(siblings.map((s) => s.id));

  if (siblings.length === 0) {
    return { siblings: [], truncatedCount: 0, totalTokens: 0, markdown: "" };
  }

  // 2. Determine ancestors (siblings subtaskId depends_on, transitively)
  const ancestors = collectAncestors(store, opts.subtaskId, siblingIds);

  // Fallback: if 0 ancestors found (no depends_on edges from subtaskId), log
  // warning and return empty (per ADR-v11-003 the fallback is created_at, but
  // without any dep signal we can't know which siblings matter; emptiness is safer).
  if (ancestors.size === 0) {
    logger.warn("assembly:missing_deps_fallback", {
      epicId: opts.epicId,
      subtaskId: opts.subtaskId,
      siblingCount: siblings.length,
    });
    return { siblings: [], truncatedCount: 0, totalTokens: 0, markdown: "" };
  }

  // 3. Build deps map (dependent → Set of prerequisites) for ancestors only
  const ancestorNodes = siblings
    .filter((s) => ancestors.has(s.id))
    .map((s) => ({
      id: s.id,
      title: s.title,
      createdAt: s.createdAt ?? "",
    }));

  const depsMap = new Map<string, Set<string>>();
  for (const a of ancestorNodes) {
    const edges = store.getEdgesFrom(a.id);
    const prereqs = new Set<string>();
    for (const e of edges) {
      if (e.relationType === "depends_on" && ancestors.has(e.to)) {
        prereqs.add(e.to);
      }
    }
    depsMap.set(a.id, prereqs);
  }

  // 4. Topological sort
  const sortedIds = topologicalSort(ancestorNodes, depsMap);
  if (!sortedIds) {
    logger.warn("assembly:cycle_detected", {
      epicId: opts.epicId,
      subtaskId: opts.subtaskId,
    });
    // fallback to created_at-only
    ancestorNodes.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  }

  const orderIds = sortedIds ?? ancestorNodes.map((n) => n.id);

  // 5. Load artifacts per ancestor — skip siblings with zero artifacts
  // (emitting only a header with no content pollutes the prompt).
  const artifactsStore = new SubtaskArtifactsStore(store);
  const siblingSummaries: SiblingSummary[] = orderIds
    .map((id) => {
      const node = ancestorNodes.find((n) => n.id === id);
      if (!node) {
        throw new Error(`assembleSiblingContext: ordered id ${id} not in ancestorNodes (invariant violation)`);
      }
      const artifacts = artifactsStore.listByNode(id);
      return {
        id,
        title: node.title,
        createdAt: node.createdAt,
        artifacts: artifacts.map((a: SubtaskArtifact) => ({
          kind: a.kind,
          path: a.path,
          content: a.content,
        })),
      };
    })
    .filter((s) => s.artifacts.length > 0);

  // 6. Apply budget (truncate-oldest-first) — drop siblings from the start
  // until total fits. Count tokens on rendered markdown.
  let rendered = siblingSummaries.map(renderSibling).join("\n\n");
  let totalTokens = estimateTokens(rendered);
  let truncatedCount = 0;
  const keptSiblings = [...siblingSummaries];

  while (totalTokens > tokenBudget && keptSiblings.length > 0) {
    keptSiblings.shift(); // drop oldest (first in topological order = earliest dep)
    truncatedCount++;
    rendered = keptSiblings.map(renderSibling).join("\n\n");
    totalTokens = rendered.length === 0 ? 0 : estimateTokens(rendered);
  }

  if (truncatedCount > 0) {
    logger.info("assembly:truncated", {
      epicId: opts.epicId,
      subtaskId: opts.subtaskId,
      truncatedCount,
      keptCount: keptSiblings.length,
      totalTokens,
    });
  }

  return {
    siblings: keptSiblings,
    truncatedCount,
    totalTokens,
    markdown: rendered,
  };
}
