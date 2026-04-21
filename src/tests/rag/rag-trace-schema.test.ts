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

import { describe, it, expect } from "vitest";
import {
  RagQueryTraceSchema,
  applyRetentionPolicy,
  type RagQueryTrace,
} from "../../core/rag/rag-query-trace.js";

// ── Helpers ───────────────────────────────────────────────────────────────

function makeCandidate(id: string, score: number, selected: boolean) {
  return { docId: id, score, selected, snippet: `snippet-${id}` };
}

function makeTrace(overrides: Partial<RagQueryTrace> = {}): RagQueryTrace {
  return {
    traceId: "trace_001",
    query: "test query",
    timestamp: "2026-01-01T00:00:00.000Z",
    candidates: [
      makeCandidate("doc-1", 0.9, true),
      makeCandidate("doc-2", 0.7, false),
    ],
    selectedCount: 1,
    totalCandidates: 2,
    rerankingPasses: [],
    finalDecision: { selectedDocIds: ["doc-1"], rationale: "top score" },
    ...overrides,
  };
}

// ── AC 1: 50 candidates with score + selected flag ─────────────────────────

describe("RagQueryTrace (AC 1 — candidate tracking)", () => {
  it("should include all candidates with score and selected flag", () => {
    const candidates = Array.from({ length: 50 }, (_, i) => ({
      docId: `doc-${i}`,
      score: 1 - i * 0.01,
      selected: i < 5,
      snippet: `snippet-${i}`,
    }));

    const trace = makeTrace({
      candidates,
      selectedCount: 5,
      totalCandidates: 50,
    });

    expect(trace.candidates).toHaveLength(50);
    expect(trace.candidates.filter(c => c.selected)).toHaveLength(5);
    expect(trace.candidates.filter(c => !c.selected)).toHaveLength(45);
    expect(trace.totalCandidates).toBe(50);
    expect(trace.selectedCount).toBe(5);
  });

  it("should preserve score for every candidate", () => {
    const candidates = Array.from({ length: 50 }, (_, i) => makeCandidate(`doc-${i}`, i * 0.02, i < 5));
    const trace = makeTrace({ candidates, totalCandidates: 50, selectedCount: 5 });

    for (const c of trace.candidates) {
      expect(typeof c.score).toBe("number");
    }
  });

  it("should mark exactly selectedCount candidates as selected=true", () => {
    const candidates = Array.from({ length: 10 }, (_, i) => makeCandidate(`d-${i}`, 0.9 - i * 0.05, i < 3));
    const trace = makeTrace({ candidates, totalCandidates: 10, selectedCount: 3 });

    const selected = trace.candidates.filter(c => c.selected);
    expect(selected.length).toBe(trace.selectedCount);
  });
});

// ── AC 2: Zod validation ──────────────────────────────────────────────────

describe("RagQueryTraceSchema (AC 2 — Zod validation)", () => {
  it("should parse a valid trace without errors", () => {
    const trace = makeTrace();
    const result = RagQueryTraceSchema.safeParse(trace);

    expect(result.success).toBe(true);
  });

  it("should reject trace missing required traceId", () => {
    const trace = makeTrace();
    const { traceId: _, ...withoutId } = trace;
    const result = RagQueryTraceSchema.safeParse(withoutId);

    expect(result.success).toBe(false);
  });

  it("should reject candidate with missing score", () => {
    const trace = makeTrace({
      candidates: [{ docId: "doc-1", selected: true, snippet: "s" } as never],
    });
    const result = RagQueryTraceSchema.safeParse(trace);

    expect(result.success).toBe(false);
  });

  it("should parse trace with 50 candidates successfully", () => {
    const candidates = Array.from({ length: 50 }, (_, i) => makeCandidate(`d-${i}`, 0.9 - i * 0.01, i < 5));
    const trace = makeTrace({ candidates, totalCandidates: 50, selectedCount: 5 });

    const result = RagQueryTraceSchema.safeParse(trace);
    expect(result.success).toBe(true);
  });
});

// ── AC 3: retention policy — rotate traces older than N days ──────────────

describe("applyRetentionPolicy (AC 3 — retention rotation)", () => {
  it("should remove traces older than retentionDays", () => {
    const now = new Date("2026-02-01T00:00:00Z");
    const traces: RagQueryTrace[] = [
      makeTrace({ traceId: "old", timestamp: "2026-01-01T00:00:00Z" }),
      makeTrace({ traceId: "recent", timestamp: "2026-01-31T00:00:00Z" }),
    ];

    const result = applyRetentionPolicy(traces, { retentionDays: 30, now });

    expect(result.retained.some(t => t.traceId === "old")).toBe(false);
    expect(result.retained.some(t => t.traceId === "recent")).toBe(true);
  });

  it("should report the count of rotated traces", () => {
    const now = new Date("2026-02-01T00:00:00Z");
    const traces: RagQueryTrace[] = [
      makeTrace({ traceId: "t1", timestamp: "2025-12-01T00:00:00Z" }),
      makeTrace({ traceId: "t2", timestamp: "2025-12-15T00:00:00Z" }),
      makeTrace({ traceId: "t3", timestamp: "2026-01-31T00:00:00Z" }),
    ];

    const result = applyRetentionPolicy(traces, { retentionDays: 30, now });

    expect(result.rotatedCount).toBe(2);
    expect(result.retained).toHaveLength(1);
  });

  it("should retain all traces when none are older than retentionDays", () => {
    const now = new Date("2026-02-01T00:00:00Z");
    const traces: RagQueryTrace[] = [
      makeTrace({ traceId: "t1", timestamp: "2026-01-30T00:00:00Z" }),
      makeTrace({ traceId: "t2", timestamp: "2026-01-31T00:00:00Z" }),
    ];

    const result = applyRetentionPolicy(traces, { retentionDays: 30, now });

    expect(result.rotatedCount).toBe(0);
    expect(result.retained).toHaveLength(2);
  });
});
