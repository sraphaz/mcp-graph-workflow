/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 7.3: Replay de trace para diff entre runs
 * AC1 — GIVEN trace A e trace B para mesma query WHEN diff executado THEN saída mostra delta de score, adds, removes
 * AC2 — GIVEN traces de queries diferentes WHEN diff THEN erro tipado recusa comparação semântica
 * AC3 — GIVEN diff zero entre runs WHEN reportado THEN confirma determinismo com selo explícito
 */

import { describe, it, expect } from "vitest";
import {
  diffTraces,
  IncompatibleQueryError,
  type TraceDiff,
  type TraceSnapshot,
} from "../../core/rag/trace-diff.js";

function makeTrace(
  query: string,
  docs: Array<{ docId: string; score: number }>,
): TraceSnapshot {
  return {
    traceId: `trace-${Math.random().toString(36).slice(2)}`,
    query,
    timestamp: new Date().toISOString(),
    results: docs,
  };
}

describe("AC1 — diff shows delta of score, adds, and removes", () => {
  it("should identify documents added in trace B that were not in trace A", () => {
    const a = makeTrace("q", [{ docId: "d1", score: 0.9 }]);
    const b = makeTrace("q", [{ docId: "d1", score: 0.9 }, { docId: "d2", score: 0.7 }]);
    const diff = diffTraces(a, b);
    expect(diff.added).toHaveLength(1);
    expect(diff.added[0].docId).toBe("d2");
  });

  it("should identify documents removed from trace B that were in trace A", () => {
    const a = makeTrace("q", [{ docId: "d1", score: 0.9 }, { docId: "d2", score: 0.7 }]);
    const b = makeTrace("q", [{ docId: "d1", score: 0.9 }]);
    const diff = diffTraces(a, b);
    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0].docId).toBe("d2");
  });

  it("should report score delta for documents present in both traces", () => {
    const a = makeTrace("q", [{ docId: "d1", score: 0.6 }]);
    const b = makeTrace("q", [{ docId: "d1", score: 0.9 }]);
    const diff = diffTraces(a, b);
    const d1Delta = diff.scoreDeltas.find((sd) => sd.docId === "d1");
    expect(d1Delta).toBeDefined();
    expect(d1Delta!.delta).toBeCloseTo(0.3, 5);
  });

  it("should report zero delta for identical scores", () => {
    const a = makeTrace("q", [{ docId: "d1", score: 0.8 }]);
    const b = makeTrace("q", [{ docId: "d1", score: 0.8 }]);
    const diff = diffTraces(a, b);
    const d1Delta = diff.scoreDeltas.find((sd) => sd.docId === "d1");
    expect(d1Delta!.delta).toBeCloseTo(0, 5);
  });

  it("should include all three fields (added, removed, scoreDeltas) in the diff result", () => {
    const a = makeTrace("q", [{ docId: "d1", score: 0.5 }]);
    const b = makeTrace("q", [{ docId: "d2", score: 0.8 }]);
    const diff: TraceDiff = diffTraces(a, b);
    expect(diff).toHaveProperty("added");
    expect(diff).toHaveProperty("removed");
    expect(diff).toHaveProperty("scoreDeltas");
  });

  it("should report negative delta when score decreases from A to B", () => {
    const a = makeTrace("q", [{ docId: "doc", score: 0.9 }]);
    const b = makeTrace("q", [{ docId: "doc", score: 0.5 }]);
    const diff = diffTraces(a, b);
    const docDelta = diff.scoreDeltas.find((sd) => sd.docId === "doc");
    expect(docDelta!.delta).toBeCloseTo(-0.4, 5);
  });
});

describe("AC2 — different queries produce IncompatibleQueryError", () => {
  it("should throw IncompatibleQueryError when queries differ", () => {
    const a = makeTrace("query alpha", [{ docId: "d1", score: 0.8 }]);
    const b = makeTrace("query beta", [{ docId: "d2", score: 0.7 }]);
    expect(() => diffTraces(a, b)).toThrow(IncompatibleQueryError);
  });

  it("should include both queries in the error message", () => {
    const a = makeTrace("find users", []);
    const b = makeTrace("delete users", []);
    let err: unknown;
    try { diffTraces(a, b); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(IncompatibleQueryError);
    const msg = (err as IncompatibleQueryError).message;
    expect(msg).toContain("find users");
    expect(msg).toContain("delete users");
  });

  it("should not throw when queries are identical", () => {
    const q = "identical query";
    const a = makeTrace(q, []);
    const b = makeTrace(q, []);
    expect(() => diffTraces(a, b)).not.toThrow();
  });
});

describe("AC3 — zero diff confirms determinism with explicit seal", () => {
  it("should set isDeterministic=true when diff is completely empty", () => {
    const docs = [{ docId: "d1", score: 0.9 }, { docId: "d2", score: 0.7 }];
    const a = makeTrace("stable query", docs);
    const b = makeTrace("stable query", [...docs]);
    const diff = diffTraces(a, b);
    expect(diff.isDeterministic).toBe(true);
  });

  it("should set isDeterministic=false when there are adds", () => {
    const a = makeTrace("q", []);
    const b = makeTrace("q", [{ docId: "new", score: 0.5 }]);
    const diff = diffTraces(a, b);
    expect(diff.isDeterministic).toBe(false);
  });

  it("should set isDeterministic=false when scores changed", () => {
    const a = makeTrace("q", [{ docId: "d1", score: 0.5 }]);
    const b = makeTrace("q", [{ docId: "d1", score: 0.6 }]);
    const diff = diffTraces(a, b);
    expect(diff.isDeterministic).toBe(false);
  });

  it("should include a determinismSeal string when isDeterministic is true", () => {
    const docs = [{ docId: "d1", score: 1.0 }];
    const a = makeTrace("q", docs);
    const b = makeTrace("q", [...docs]);
    const diff = diffTraces(a, b);
    expect(diff.isDeterministic).toBe(true);
    expect(typeof diff.determinismSeal).toBe("string");
    expect(diff.determinismSeal!.length).toBeGreaterThan(0);
  });

  it("should set determinismSeal to undefined when not deterministic", () => {
    const a = makeTrace("q", [{ docId: "d1", score: 0.5 }]);
    const b = makeTrace("q", [{ docId: "d2", score: 0.5 }]);
    const diff = diffTraces(a, b);
    expect(diff.isDeterministic).toBe(false);
    expect(diff.determinismSeal).toBeUndefined();
  });
});
