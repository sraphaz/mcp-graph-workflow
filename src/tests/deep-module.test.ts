/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-9.T03 — deep-module analyzer tests.
 */

import { describe, it, expect } from "vitest";
import {
  analyzeDeepModule,
  classifyDepth,
  countExportLines,
  countNonTrivialLines,
  summarizeDepth,
  DEEP_RATIO_MAX,
  SHALLOW_RATIO_MIN,
} from "../core/analyzer/deep-module.js";

describe("deep-module (E9.T03)", () => {
  it("constants: DEEP_RATIO_MAX=0.2, SHALLOW_RATIO_MIN=0.5", () => {
    expect(DEEP_RATIO_MAX).toBe(0.2);
    expect(SHALLOW_RATIO_MIN).toBe(0.5);
  });

  it("countNonTrivialLines ignores blank + comment lines", () => {
    const code = `// header\n\nconst x = 1;\n/* block */\n* multi\nlet y = 2;`;
    expect(countNonTrivialLines(code)).toBe(2);
  });

  it("countExportLines matches export declarations", () => {
    const code = [
      "export function fn() {}",
      "export const X = 1;",
      "export class C {}",
      "export interface I {}",
      "export type T = number;",
      "function private_() {}",
      "const internal = 1;",
    ].join("\n");
    expect(countExportLines(code)).toBe(5);
  });

  it("countExportLines matches re-exports", () => {
    expect(countExportLines("export { foo } from './x';")).toBe(1);
    expect(countExportLines("export * from './y';")).toBe(1);
  });

  it("classifyDepth thresholds", () => {
    expect(classifyDepth(0.1)).toBe("deep");
    expect(classifyDepth(0.3)).toBe("medium");
    expect(classifyDepth(0.6)).toBe("shallow");
  });

  it("analyzeDeepModule: deep module has 1 export, 20 LOC body", () => {
    const body = Array.from({ length: 19 }, (_, i) => `const v${i} = ${i};`).join("\n");
    const code = `export function fn() {}\n${body}`;
    const r = analyzeDeepModule("deep.ts", code);
    expect(r.depth).toBe("deep");
    expect(r.exportLoc).toBe(1);
    expect(r.totalLoc).toBe(20);
    expect(r.ratio).toBeCloseTo(0.05);
    expect(r.suggestion).toContain("good");
  });

  it("analyzeDeepModule: shallow module (mostly exports)", () => {
    const code = [
      "export const A = 1;",
      "export const B = 2;",
      "export const C = 3;",
      "export const D = 4;",
      "export const E = 5;",
      "const internal = 0;",
      "const helper = 0;",
      "const x = 0;",
      "const y = 0;",
      "const z = 0;",
    ].join("\n");
    const r = analyzeDeepModule("shallow.ts", code);
    expect(r.totalLoc).toBe(10);
    expect(r.exportLoc).toBe(5);
    expect(r.ratio).toBeCloseTo(0.5);
    // 0.5 is exactly threshold (not > 0.5) → medium
    expect(r.depth).toBe("medium");
  });

  it("analyzeDeepModule: clearly shallow (more exports than impl)", () => {
    const exports = Array.from({ length: 8 }, (_, i) => `export const A${i} = ${i};`);
    const internals = Array.from({ length: 3 }, (_, i) => `const i${i} = ${i};`);
    const code = [...exports, ...internals].join("\n");
    const r = analyzeDeepModule("very-shallow.ts", code);
    expect(r.depth).toBe("shallow");
    expect(r.suggestion).toContain("deepening");
  });

  it("analyzeDeepModule: tiny module flagged as below evaluation threshold", () => {
    const r = analyzeDeepModule("tiny.ts", "export const x = 1;");
    expect(r.totalLoc).toBeLessThan(10);
    expect(r.suggestion).toContain("too small");
  });

  it("summarizeDepth aggregates byDepth + shallowCandidates", () => {
    const shallowCode = [
      ...Array.from({ length: 8 }, (_, i) => `export const a${i} = ${i};`),
      ...Array.from({ length: 3 }, (_, i) => `const i${i} = ${i};`),
    ].join("\n");
    const reports = [
      analyzeDeepModule("shallow.ts", shallowCode),
      analyzeDeepModule(
        "deep.ts",
        "export function fn() {}\n" +
          Array.from({ length: 19 }, (_, i) => `const v${i} = ${i};`).join("\n"),
      ),
    ];
    const summary = summarizeDepth(reports);
    expect(summary.byDepth.shallow).toBe(1);
    expect(summary.byDepth.deep).toBe(1);
    expect(summary.shallowCandidates).toContain("shallow.ts");
    expect(summary.shallowCandidates).not.toContain("deep.ts");
  });
});
