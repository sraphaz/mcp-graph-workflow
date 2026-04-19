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

import type { SqliteStore } from "../store/sqlite-store.js";
import type { GraphDocument } from "../graph/graph-types.js";
import { checkInvariants, getBuiltInInvariants } from "./property-invariants.js";
import { logger } from "../utils/logger.js";

export interface MutationRecord { type: "dangling_edge" | "status_regression" | "self_cycle" | "duplicate_edge"; description: string; detected: boolean; }
export interface SyntheticValidationResult { passed: boolean; mutationsApplied: number; mutationsCaught: number; score: number; mutations: MutationRecord[]; durationMs: number; }

export function runSyntheticValidation(store: SqliteStore): SyntheticValidationResult {
  const start = performance.now();
  const doc = store.toGraphDocument();
  if (doc.nodes.length === 0) { return { passed: true, mutationsApplied: 0, mutationsCaught: 0, score: 100, mutations: [], durationMs: Math.round(performance.now() - start) }; }

  const mutations: MutationRecord[] = [];
  const invariants = getBuiltInInvariants();

  if (doc.nodes.length > 0) {
    const mutated = cloneDoc(doc);
    mutated.edges.push({ id: "mut_dangling", from: doc.nodes[0].id, to: "nonexistent_mutation_target", relationType: "depends_on", createdAt: new Date().toISOString() });
    const r = checkInvariants(mutated, invariants);
    mutations.push({ type: "dangling_edge", description: "Added edge to nonexistent node", detected: !r.passed });
  }

  if (doc.nodes.some((n) => n.status === "done")) {
    const mutated = cloneDoc(doc);
    const doneNode = mutated.nodes.find((n) => n.status === "done");
    if (doneNode) {
      doneNode.status = "backlog";
      doneNode.metadata = { ...doneNode.metadata, previousStatus: "done" };
      const r = checkInvariants(mutated, invariants);
      mutations.push({ type: "status_regression", description: "Regressed node from done to backlog", detected: !r.passed });
    }
  }

  if (doc.nodes.length > 0) {
    const mutated = cloneDoc(doc);
    const t = mutated.nodes[0];
    mutated.edges.push({ id: "mut_self_cycle", from: t.id, to: t.id, relationType: "depends_on", createdAt: new Date().toISOString() });
    const r = checkInvariants(mutated, invariants);
    mutations.push({ type: "self_cycle", description: "Added self-dependency", detected: !r.passed });
  }

  const caught = mutations.filter((m) => m.detected).length;
  const total = mutations.length;
  const score = total > 0 ? Math.round((caught / total) * 100) : 100;
  const durationMs = Math.round(performance.now() - start);
  logger.info("synthetic-validation:result", { mutationsApplied: total, mutationsCaught: caught, score, durationMs });
  return { passed: score >= 50, mutationsApplied: total, mutationsCaught: caught, score, mutations, durationMs };
}

function cloneDoc(doc: GraphDocument): GraphDocument {
  return { ...doc, nodes: doc.nodes.map((n) => ({ ...n, metadata: { ...n.metadata } })), edges: doc.edges.map((e) => ({ ...e })) };
}
