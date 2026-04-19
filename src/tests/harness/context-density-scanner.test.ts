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
 * TDD: Task 2.3 — context-density-scanner.ts
 *
 * Detects exported functions without JSDoc documentation.
 * Covers: export function, export async function, export const ... = (
 * Score = % of exported functions with preceding JSDoc (0–100).
 * Test/bench files are excluded.
 * Type/interface exports are NOT counted (only functions).
 */
import { describe, it, expect } from "vitest";
import {
  scanContextDensity,
  type ContextDensityResult,
} from "../../core/harness/context-density-scanner.js";
import type { FileContent } from "../../core/harness/type-coverage-scanner.js";

describe("scanContextDensity", () => {
  it("should return contextDensityScore=100 for empty file list", () => {
    const result: ContextDensityResult = scanContextDensity([]);
    expect(result.contextDensityScore).toBe(100);
    expect(result.totalExports).toBe(0);
    expect(result.documentedExports).toBe(0);
  });

  it("should flag export function without JSDoc and penalize score", () => {
    const files: FileContent[] = [
      {
        path: "src/utils.ts",
        content: `
export function doWork() {
  return 42;
}
`,
      },
    ];
    const result = scanContextDensity(files);
    expect(result.totalExports).toBe(1);
    expect(result.documentedExports).toBe(0);
    expect(result.contextDensityScore).toBeLessThan(100);
  });

  it("should count export function with preceding JSDoc as documented", () => {
    const files: FileContent[] = [
      {
        path: "src/utils.ts",
        content: `
/** Calcula X e retorna resultado */
export function doWork() {
  return 42;
}
`,
      },
    ];
    const result = scanContextDensity(files);
    expect(result.totalExports).toBe(1);
    expect(result.documentedExports).toBe(1);
    expect(result.contextDensityScore).toBe(100);
  });

  it("should exclude *.test.ts files from scanning", () => {
    const files: FileContent[] = [
      {
        path: "src/utils.test.ts",
        content: `
export function helper() {}
export async function asyncHelper() {}
`,
      },
    ];
    const result = scanContextDensity(files);
    expect(result.totalExports).toBe(0);
    expect(result.contextDensityScore).toBe(100);
  });

  it("should NOT count type/interface exports as functions", () => {
    const files: FileContent[] = [
      {
        path: "src/types.ts",
        content: `
export type MyType = { id: string };
export interface MyInterface { name: string; }
`,
      },
    ];
    const result = scanContextDensity(files);
    expect(result.totalExports).toBe(0);
    expect(result.contextDensityScore).toBe(100);
  });

  it("should score 70 when 7 of 10 exports have JSDoc", () => {
    const documented = Array.from(
      { length: 7 },
      (_, i) => `/** Doc ${i} */\nexport function fn${i}() {}`,
    ).join("\n");
    const undocumented = Array.from(
      { length: 3 },
      (_, i) => `export function bad${i}() {}`,
    ).join("\n");
    const files: FileContent[] = [
      { path: "src/mixed.ts", content: `${documented}\n${undocumented}` },
    ];
    const result = scanContextDensity(files);
    expect(result.totalExports).toBe(10);
    expect(result.documentedExports).toBe(7);
    expect(result.contextDensityScore).toBe(70);
  });

  it("should handle export async function", () => {
    const files: FileContent[] = [
      {
        path: "src/async.ts",
        content: `
/** Fetch data */
export async function fetchData() {
  return await api.get();
}
`,
      },
    ];
    const result = scanContextDensity(files);
    expect(result.totalExports).toBe(1);
    expect(result.documentedExports).toBe(1);
    expect(result.contextDensityScore).toBe(100);
  });

  it("should handle export const arrow functions", () => {
    const files: FileContent[] = [
      {
        path: "src/arrow.ts",
        content: `
export const transform = (x: number) => x * 2;

/** With JSDoc */
export const calculate = (x: number): number => x + 1;
`,
      },
    ];
    const result = scanContextDensity(files);
    expect(result.totalExports).toBe(2);
    expect(result.documentedExports).toBe(1);
    expect(result.contextDensityScore).toBe(50);
  });
});
