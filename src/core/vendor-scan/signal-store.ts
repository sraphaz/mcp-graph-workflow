/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-vendor-insights-scanner — Task 1.4: architectural signal persistence.
 *
 * Persists Sentrux scan results as `architectural_signal` knowledge documents.
 * Each record carries timestamp, overall score, 5-dim breakdown, and optional
 * session context (session_id, delta_score).
 */

import { z } from "zod/v4";
import type { KnowledgeStore } from "../store/knowledge-store.js";
import type { KnowledgeDocument } from "../../schemas/knowledge.schema.js";

export const ArchitecturalSignalBreakdownSchema = z.object({
  typeCoverage: z.number().min(0).max(100),
  testCoverage: z.number().min(0).max(100),
  architectureFitness: z.number().min(0).max(100),
  docsCoverage: z.number().min(0).max(100),
  namingClarity: z.number().min(0).max(100),
});

export const ArchitecturalSignalRecordSchema = z.object({
  timestamp: z.string(),
  score: z.number().min(0).max(100),
  breakdown: ArchitecturalSignalBreakdownSchema,
  sessionId: z.string().optional(),
  deltaScore: z.number().optional(),
});

export type ArchitecturalSignalRecord = z.infer<typeof ArchitecturalSignalRecordSchema>;

/**
 * Persist a scan signal as an `architectural_signal` knowledge document.
 * sourceId is timestamp-keyed so each scan creates a distinct record.
 */
export function persistSignal(
  store: KnowledgeStore,
  signal: ArchitecturalSignalRecord,
): KnowledgeDocument {
  return store.insert({
    sourceType: "architectural_signal",
    sourceId: `architectural_signal:${signal.timestamp}`,
    title: `Architectural Signal ${signal.timestamp}`,
    content: JSON.stringify(signal),
    metadata: signal as unknown as Record<string, unknown>,
  });
}

/**
 * Return all persisted signals in chronological order (oldest first).
 * Parses content JSON back to ArchitecturalSignalRecord.
 */
export function getSignalTrend(store: KnowledgeStore): ArchitecturalSignalRecord[] {
  const docs = store.list({ sourceType: "architectural_signal", limit: 1000 });
  // list() returns DESC; re-sort by signal timestamp ASC for trend semantics
  const records = docs.map((doc) => JSON.parse(doc.content) as ArchitecturalSignalRecord);
  return records.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
