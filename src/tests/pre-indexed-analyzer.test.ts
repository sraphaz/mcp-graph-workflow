/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { analyzeFromIndex } from "../core/translation/pre-indexed-analyzer.js";
import type { CodeStore } from "../core/code/code-store.js";
import type { CodeSymbol, CodeIndexMeta } from "../core/code/code-types.js";

// Minimal CodeSymbol factory — only the fields analyzeFromIndex actually
// reads (file, kind, projectId). The schema requires more, but the
// runtime path doesn't validate; cast keeps the test focused.
function symbol(overrides: Partial<CodeSymbol> & Pick<CodeSymbol, "file" | "kind">): CodeSymbol {
  return {
    id: "sym",
    projectId: "p",
    name: "x",
    startLine: 1,
    endLine: 1,
    exported: true,
    ...overrides,
  } as CodeSymbol;
}

// Build a CodeStore stub that returns the configured payload.
function stubStore(opts: {
  meta?: CodeIndexMeta | null;
  symbols?: CodeSymbol[];
  throwOn?: "meta" | "symbols";
}): CodeStore {
  const stub: Partial<CodeStore> = {
    getIndexMeta: () => {
      if (opts.throwOn === "meta") throw new Error("boom-meta");
      return opts.meta ?? null;
    },
    getAllSymbols: () => {
      if (opts.throwOn === "symbols") throw new Error("boom-symbols");
      return opts.symbols ?? [];
    },
  };
  return stub as CodeStore;
}

const META: CodeIndexMeta = {
  projectId: "p",
  totalSymbols: 100,
  totalRelations: 50,
  lastIndexedAt: new Date().toISOString(),
  fileCount: 10,
  languages: ["typescript"],
} as unknown as CodeIndexMeta;

describe("analyzeFromIndex", () => {
  it("returns null when index meta is missing", () => {
    const r = analyzeFromIndex(stubStore({ meta: null }), "p", "src/foo.ts");
    expect(r).toBeNull();
  });

  it("returns null when no symbols match the file", () => {
    const r = analyzeFromIndex(
      stubStore({
        meta: META,
        symbols: [symbol({ file: "src/other.ts", kind: "function" })],
      }),
      "p",
      "src/foo.ts",
    );
    expect(r).toBeNull();
  });

  it("maps function/method/class/interface kinds to UCR constructs", () => {
    const r = analyzeFromIndex(
      stubStore({
        meta: META,
        symbols: [
          symbol({ file: "src/foo.ts", kind: "function" }),
          symbol({ file: "src/foo.ts", kind: "method" }),
          symbol({ file: "src/foo.ts", kind: "class" }),
          symbol({ file: "src/foo.ts", kind: "interface" }),
        ],
      }),
      "p",
      "src/foo.ts",
    );
    expect(r).not.toBeNull();
    if (!r) return;
    const names = r.analysis.constructs.map((c) => c.canonicalName).sort();
    expect(names).toContain("uc_fn_def");      // function + method collapse here
    expect(names).toContain("uc_class_def");
    expect(names).toContain("uc_interface");
  });

  it("collapses function and method into a single uc_fn_def with summed count", () => {
    const r = analyzeFromIndex(
      stubStore({
        meta: META,
        symbols: [
          symbol({ file: "src/foo.ts", kind: "function" }),
          symbol({ file: "src/foo.ts", kind: "method" }),
          symbol({ file: "src/foo.ts", kind: "method" }),
        ],
      }),
      "p",
      "src/foo.ts",
    );
    expect(r).not.toBeNull();
    if (!r) return;
    const fn = r.analysis.constructs.find((c) => c.canonicalName === "uc_fn_def");
    expect(fn?.count).toBe(3);
  });

  it("detects language from file extension", () => {
    const cases: Array<[string, string]> = [
      ["src/x.ts", "typescript"],
      ["src/x.tsx", "typescript"],
      ["src/x.py", "python"],
      ["src/x.go", "go"],
      ["src/x.java", "java"],
      ["src/x.rs", "rust"],
    ];
    for (const [path, expected] of cases) {
      const r = analyzeFromIndex(
        stubStore({
          meta: META,
          symbols: [symbol({ file: path, kind: "function" })],
        }),
        "p",
        path,
      );
      expect(r?.analysis.detectedLanguage).toBe(expected);
    }
  });

  it("returns 'unknown' language for unrecognized extensions", () => {
    const r = analyzeFromIndex(
      stubStore({
        meta: META,
        symbols: [symbol({ file: "src/foo.weird", kind: "function" })],
      }),
      "p",
      "src/foo.weird",
    );
    expect(r?.analysis.detectedLanguage).toBe("unknown");
  });

  it("computes complexityScore as uniqueConstructs / 15, capped at 1", () => {
    // Single construct kind → complexity = 1/15 ≈ 0.067
    const r = analyzeFromIndex(
      stubStore({
        meta: META,
        symbols: [symbol({ file: "src/foo.ts", kind: "function" })],
      }),
      "p",
      "src/foo.ts",
    );
    expect(r?.analysis.complexityScore).toBeCloseTo(1 / 15, 5);
  });

  it("returns null gracefully when CodeStore throws on getIndexMeta", () => {
    const r = analyzeFromIndex(stubStore({ throwOn: "meta" }), "p", "src/foo.ts");
    expect(r).toBeNull();
  });

  it("returns null gracefully when CodeStore throws on getAllSymbols", () => {
    const r = analyzeFromIndex(
      stubStore({ meta: META, throwOn: "symbols" }),
      "p",
      "src/foo.ts",
    );
    expect(r).toBeNull();
  });

  it("flags fromIndex=true on every successful analysis", () => {
    const r = analyzeFromIndex(
      stubStore({
        meta: META,
        symbols: [symbol({ file: "src/foo.ts", kind: "function" })],
      }),
      "p",
      "src/foo.ts",
    );
    expect(r?.fromIndex).toBe(true);
  });

  it("sets estimatedTranslatability to 0 when no mappable constructs found", () => {
    // 'module' is a valid kind but has no entry in KIND_TO_CONSTRUCT, so
    // it's a known-unmappable symbol — exercises the count=0 branch.
    const r = analyzeFromIndex(
      stubStore({
        meta: META,
        symbols: [symbol({ file: "src/foo.ts", kind: "module" })],
      }),
      "p",
      "src/foo.ts",
    );
    expect(r?.analysis.totalConstructs).toBe(0);
    expect(r?.analysis.estimatedTranslatability).toBe(0);
  });
});
