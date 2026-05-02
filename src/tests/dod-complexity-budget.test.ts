/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluateComplexityBudget } from "../core/implementer/complexity-budget.js";

describe("evaluateComplexityBudget", () => {
  let workDir: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), "dod-complexity-"));
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  function writeFile(relPath: string, lines: number): string {
    const abs = join(workDir, relPath);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, "x\n".repeat(lines));
    return abs;
  }

  it("passes when no implementation files declared (not applicable)", () => {
    const result = evaluateComplexityBudget({
      implementationFiles: [],
      testFiles: [],
      hasChildren: false,
    });

    expect(result.passed).toBe(true);
    expect(result.details).toMatch(/n\/a|not applicable|sem arquivos/i);
    expect(result.violations).toHaveLength(0);
  });

  it("passes for small file (< 200 LOC) without children", () => {
    const f = writeFile("src/small.ts", 50);

    const result = evaluateComplexityBudget({
      implementationFiles: [f],
      testFiles: [],
      hasChildren: false,
    });

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("fails when a single file exceeds 200 LOC and node has no children", () => {
    const f = writeFile("src/big.ts", 250);

    const result = evaluateComplexityBudget({
      implementationFiles: [f],
      testFiles: [],
      hasChildren: false,
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].kind).toBe("file_too_large");
    expect(result.violations[0].loc).toBeGreaterThan(200);
  });

  it("passes for >200 LOC file when node has children (decomposed)", () => {
    const f = writeFile("src/big.ts", 300);

    const result = evaluateComplexityBudget({
      implementationFiles: [f],
      testFiles: [],
      hasChildren: true,
    });

    expect(result.passed).toBe(true);
    expect(result.violations.filter((v) => v.kind === "file_too_large")).toHaveLength(0);
  });

  it("fails when impl:test LOC ratio exceeds 5:1", () => {
    const impl = writeFile("src/feature.ts", 600);
    const test = writeFile("src/feature.test.ts", 100);

    const result = evaluateComplexityBudget({
      implementationFiles: [impl],
      testFiles: [test],
      hasChildren: true, // disable file_too_large to isolate ratio
    });

    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.kind === "test_ratio_low")).toBe(true);
  });

  it("passes when impl:test ratio is within 5:1", () => {
    const impl = writeFile("src/feature.ts", 100);
    const test = writeFile("src/feature.test.ts", 50);

    const result = evaluateComplexityBudget({
      implementationFiles: [impl],
      testFiles: [test],
      hasChildren: false,
    });

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("skips ratio check when no test files declared (avoid false positive)", () => {
    const impl = writeFile("src/feature.ts", 100);

    const result = evaluateComplexityBudget({
      implementationFiles: [impl],
      testFiles: [],
      hasChildren: false,
    });

    expect(result.violations.filter((v) => v.kind === "test_ratio_low")).toHaveLength(0);
  });

  it("ignores files that don't exist on disk gracefully", () => {
    const result = evaluateComplexityBudget({
      implementationFiles: ["/nonexistent/path.ts"],
      testFiles: [],
      hasChildren: false,
    });

    expect(result.passed).toBe(true);
    expect(result.details).toMatch(/skip|not found|0 files/i);
  });
});
