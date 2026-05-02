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
 * RAG citation → quality feedback loop.
 *
 * Closes the loop the Hu et al. (2026) survey calls out as an open problem
 * (§7.3): memory ratings are write-only unless something connects retrieval
 * outcomes back to quality scores. This module derives a feedback signal from
 * a finished task's DoD grade + test gate result, and applies it to every
 * memory the task's start_task surfaced via RAG.
 */

import type Database from "better-sqlite3";
import { applyFeedback } from "./knowledge-feedback.js";
import { logger } from "../utils/logger.js";

export type FeedbackSignal = "helpful" | "unhelpful" | "neutral";
export type DodGrade = "A" | "B" | "C" | "D" | "F";
export type TestGateStatus = "passed" | "failed" | "skipped" | "blocked";

/**
 * Map a finished task's outcome to a feedback signal for the memories it
 * cited. Conservative: a single test failure on a B-grade task is "neutral"
 * (ambiguous), not "unhelpful". A grade-D outcome — or two test failures
 * (catastrophic) — is "unhelpful". A clean grade-A or grade-B with tests
 * passing is "helpful".
 *
 * Threshold mirrors the autopilot's "2 consecutive failures" pause heuristic
 * in the mcp-graph-autopilot skill.
 */
export function deriveFeedbackSignal(
  grade: DodGrade,
  testGate: TestGateStatus,
  testFailureCount: number,
): FeedbackSignal {
  if (grade === "D" || grade === "F") return "unhelpful";
  if (testFailureCount >= 2) return "unhelpful";
  if ((grade === "A" || grade === "B") && testGate === "passed") return "helpful";
  return "neutral";
}

/**
 * Apply the derived feedback signal to every docId that was surfaced to the
 * task. Unknown docIds are skipped with a warning (don't crash the pipeline);
 * "neutral" is a no-op (don't move quality on ambiguous signal).
 */
export function applyRagFeedback(
  db: Database.Database,
  docIds: readonly string[],
  signal: FeedbackSignal,
  query: string,
): { applied: number; skipped: number } {
  if (signal === "neutral" || docIds.length === 0) {
    return { applied: 0, skipped: docIds.length };
  }

  let applied = 0;
  let skipped = 0;
  for (const docId of docIds) {
    try {
      const exists = db
        .prepare("SELECT 1 FROM knowledge_documents WHERE id = ?")
        .get(docId);
      if (!exists) {
        skipped += 1;
        logger.debug("rag-feedback:skip:unknown_doc", { docId });
        continue;
      }
      applyFeedback(db, docId, query, signal);
      applied += 1;
    } catch (err) {
      skipped += 1;
      logger.warn("rag-feedback:apply_failed", { docId, error: String(err) });
    }
  }

  logger.info("rag-feedback:applied", { signal, applied, skipped, query });
  return { applied, skipped };
}

/**
 * Extract the unique docIds an `AssembledContext` surfaced from its sections'
 * citations. Used by start_task to persist `node.metadata.ragOffered` so
 * finish_task can score them later.
 */
export function extractOfferedDocIds(
  sections: ReadonlyArray<{ citations?: ReadonlyArray<{ docId: string }> }>,
): string[] {
  const set = new Set<string>();
  for (const section of sections) {
    for (const citation of section.citations ?? []) {
      if (citation.docId) set.add(citation.docId);
    }
  }
  return Array.from(set);
}
