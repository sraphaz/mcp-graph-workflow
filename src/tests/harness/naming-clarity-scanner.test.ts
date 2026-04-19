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
 * TDD: Task 2.1 — naming-clarity-scanner.ts
 *
 * Scanner that detects poor identifier names in TypeScript files:
 * - Single-char variables (except i/j/k in loops, e in catch)
 * - Generic forbidden names: data, result, item, obj, temp, val, res
 *
 * Score = % of symbols with clear names (0–100).
 * Test files (*.test.ts, *.bench.ts) are excluded.
 */
import { describe, it, expect } from "vitest";
import { scanNamingClarity, type NamingClarityResult } from "../../core/harness/naming-clarity-scanner.js";
import type { FileContent } from "../../core/harness/type-coverage-scanner.js";

describe("scanNamingClarity", () => {
  it("should return score=100 and zeros for empty file list", () => {
    const result: NamingClarityResult = scanNamingClarity([]);
    expect(result).toEqual({ namingScore: 100, totalSymbols: 0, flaggedSymbols: 0 });
  });

  it("should flag single-char and generic names and return score < 80", () => {
    const files: FileContent[] = [
      {
        path: "src/utils.ts",
        content: [
          "const x = 1;",
          "const y = 2;",
          "const data = fetchAll();",
          "const result = compute();",
        ].join("\n"),
      },
    ];
    const result = scanNamingClarity(files);
    expect(result.namingScore).toBeLessThan(80);
    expect(result.flaggedSymbols).toBeGreaterThanOrEqual(4);
    expect(result.totalSymbols).toBeGreaterThanOrEqual(4);
  });

  it("should return score=100 for files with clear descriptive names", () => {
    const files: FileContent[] = [
      {
        path: "src/parser.ts",
        content: [
          "const userId = 42;",
          "const taskTitle = 'fix bug';",
          "const parseResult = parse(input);",
        ].join("\n"),
      },
    ];
    const result = scanNamingClarity(files);
    expect(result.namingScore).toBe(100);
    expect(result.flaggedSymbols).toBe(0);
  });

  it("should exclude *.test.ts files from the calculation", () => {
    const files: FileContent[] = [
      {
        // test file — must be ignored
        path: "src/utils.test.ts",
        content: "const x = 1; const data = 2;",
      },
      {
        path: "src/real.ts",
        content: "const userId = 1;",
      },
    ];
    const result = scanNamingClarity(files);
    expect(result.namingScore).toBe(100);
    expect(result.totalSymbols).toBeGreaterThanOrEqual(1);
    expect(result.flaggedSymbols).toBe(0);
  });

  it("should exclude *.bench.ts files from the calculation", () => {
    const files: FileContent[] = [
      {
        path: "src/perf.bench.ts",
        content: "const x = 1; const data = 2;",
      },
      {
        path: "src/real.ts",
        content: "const userId = 1;",
      },
    ];
    const result = scanNamingClarity(files);
    expect(result.namingScore).toBe(100);
    expect(result.flaggedSymbols).toBe(0);
  });

  it("should allow i/j/k single-char names (loop counters)", () => {
    const files: FileContent[] = [
      {
        path: "src/loop.ts",
        content: [
          "for (let i = 0; i < 10; i++) {}",
          "for (let j = 0; j < 10; j++) {}",
          "for (let k = 0; k < 10; k++) {}",
        ].join("\n"),
      },
    ];
    const result = scanNamingClarity(files);
    expect(result.flaggedSymbols).toBe(0);
    expect(result.namingScore).toBe(100);
  });

  it("should allow 'e' single-char name in catch blocks", () => {
    const files: FileContent[] = [
      {
        path: "src/handler.ts",
        content: "try { run(); } catch (e) { logger.error(e); }",
      },
    ];
    const result = scanNamingClarity(files);
    expect(result.flaggedSymbols).toBe(0);
    expect(result.namingScore).toBe(100);
  });

  it("should flag all 7 generic forbidden names", () => {
    const files: FileContent[] = [
      {
        path: "src/generic.ts",
        content: [
          "const data = 1;",
          "const result = 2;",
          "const item = 3;",
          "const obj = 4;",
          "const temp = 5;",
          "const val = 6;",
          "const res = 7;",
        ].join("\n"),
      },
    ];
    const result = scanNamingClarity(files);
    expect(result.flaggedSymbols).toBe(7);
    expect(result.namingScore).toBeLessThan(100);
  });
});
