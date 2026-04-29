/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 18 — Evals + Golden Dataset.
 * AC-quality scorer — wraps existing validateAcQuality (INVEST checks).
 */

import { validateAcQuality } from "../../analyzer/ac-validator.js";
import type { GraphDocument, GraphNode } from "../../graph/graph-types.js";
import type { Scorer, ScorerResult } from "./types.js";

export interface AcQualityInput {
  /** Either an array of AC strings, or newline-separated string. */
  output: string | string[];
  /** Pass threshold on 0..100 INVEST score. Default 60 (matches DoD ac_quality_pass). */
  threshold?: number;
}

function toAcs(output: string | string[]): string[] {
  if (Array.isArray(output)) return output.filter((s) => s.trim().length > 0);
  return output
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function makeScratchDoc(acs: string[]): GraphDocument {
  const ts = new Date().toISOString();
  const node: GraphNode = {
    id: "scratch",
    type: "task",
    title: "scratch",
    status: "backlog",
    priority: 3,
    acceptanceCriteria: acs,
    createdAt: ts,
    updatedAt: ts,
  };
  return {
    version: "1.0",
    project: { id: "scratch", name: "scratch", createdAt: ts, updatedAt: ts },
    nodes: [node],
    edges: [],
    indexes: { byId: { scratch: 0 }, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
    meta: { sourceFiles: [], lastImport: null },
  };
}

export const acQualityScorer: Scorer<AcQualityInput> = {
  kind: "ac-quality",
  score(input: AcQualityInput): ScorerResult {
    const acs = toAcs(input.output);
    if (acs.length === 0) {
      return { score: 0, passed: false, details: "no acceptance criteria provided" };
    }
    const threshold = input.threshold ?? 60;
    const doc = makeScratchDoc(acs);
    const report = validateAcQuality(doc, "scratch");
    const score = report.overallScore / 100;
    return {
      score,
      passed: report.overallScore >= threshold,
      details: report.summary,
    };
  },
};
