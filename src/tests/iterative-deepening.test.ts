/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.C5 — iterative deepening tests.
 */

import { describe, it, expect } from "vitest";
import {
  expandQuery,
  mergeResults,
  SYNONYM_MAP,
} from "../core/rag/iterative-deepening.js";

describe("iterative-deepening (E22.C5)", () => {
  it("expandQuery includes original first and adds synonyms for known tokens", () => {
    const r = expandQuery("auth");
    expect(r.original).toBe("auth");
    expect(r.expanded[0]).toBe("auth");
    expect(r.expanded).toContain("authentication");
    expect(r.expanded).toContain("login");
    expect(r.expanded).toContain("session");
    expect(r.expansionApplied).toBe(true);
  });

  it("expandQuery returns just the original when no token matches", () => {
    const r = expandQuery("xyzzy");
    expect(r.expanded).toEqual(["xyzzy"]);
    expect(r.expansionApplied).toBe(false);
  });

  it("expandQuery handles multi-token queries (expands every matching token)", () => {
    const r = expandQuery("user retry");
    expect(r.expanded).toContain("account");
    expect(r.expanded).toContain("backoff");
  });

  it("expandQuery dedupes synonyms across tokens", () => {
    const r = expandQuery("budget cost");
    const set = new Set(r.expanded);
    expect(set.size).toBe(r.expanded.length);
  });

  it("SYNONYM_MAP is non-empty and includes canonical entries", () => {
    expect(Object.keys(SYNONYM_MAP).length).toBeGreaterThanOrEqual(10);
    expect(SYNONYM_MAP.auth).toBeDefined();
    expect(SYNONYM_MAP.error).toContain("exception");
  });

  it("mergeResults dedupes by docId, keeps higher score", () => {
    const a = [{ docId: "d1", score: 0.5 }, { docId: "d2", score: 0.3 }];
    const b = [{ docId: "d1", score: 0.8 }, { docId: "d3", score: 0.6 }];
    const merged = mergeResults(a, b);
    expect(merged).toHaveLength(3);
    const d1 = merged.find((r) => r.docId === "d1");
    expect(d1?.score).toBe(0.8);
  });

  it("mergeResults sorted by score descending", () => {
    const merged = mergeResults(
      [{ docId: "a", score: 0.2 }],
      [{ docId: "b", score: 0.9 }, { docId: "c", score: 0.5 }],
    );
    expect(merged.map((r) => r.docId)).toEqual(["b", "c", "a"]);
  });

  it("scenario: query 'auth' with low first-pass score → expand → 4+ candidates merged", () => {
    const original = "auth";
    const firstPass = [{ docId: "low", score: 0.1 }];
    const exp = expandQuery(original);
    expect(exp.expanded.length).toBeGreaterThanOrEqual(4);

    const secondPass = [
      { docId: "auth-doc", score: 0.7 },
      { docId: "session-doc", score: 0.6 },
      { docId: "low", score: 0.2 },
    ];
    const merged = mergeResults(firstPass, secondPass);
    expect(merged.find((r) => r.docId === "low")?.score).toBe(0.2);
    expect(merged[0].docId).toBe("auth-doc");
  });
});
