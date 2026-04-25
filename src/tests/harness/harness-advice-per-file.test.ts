/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 6.3: Conselhos remediação por arquivo
 * AC1 — GIVEN type coverage em 60 WHEN advice THEN lista top 10 arquivos com `any`
 * AC2 — GIVEN test coverage < 70 WHEN advice THEN lista módulos sem teste colocalizado
 * AC3 — GIVEN dimensão >= 70 WHEN advice THEN retorna vazio sem erro
 */

import { describe, it, expect } from "vitest";
import {
  buildAdviceEntries,
  type AdviceInput,
} from "../../core/harness/harness-advice-generator.js";

function makeTypesViolations(count: number): AdviceInput["typeViolations"] {
  return Array.from({ length: count }, (_, i) => ({
    file: `src/core/module-${i}.ts`,
    line: i + 1,
    dimension: "types" as const,
    violationType: "any_usage",
    evidence: ": any",
    confidence: 1.0,
  }));
}

function makeTestViolations(count: number): AdviceInput["testViolations"] {
  return Array.from({ length: count }, (_, i) => ({
    file: `src/core/service-${i}.ts`,
    line: 1,
    dimension: "tests" as const,
    violationType: "missing_test",
    evidence: `service-${i}`,
    confidence: 1.0,
  }));
}

describe("AC1 — type coverage 60 returns top 10 files with any", () => {
  it("should return up to 10 files with any usage when type score < 70", () => {
    const entries = buildAdviceEntries({
      breakdown: {
        types: { score: 60, weight: 0.25 },
        tests: { score: 90, weight: 0.25 },
        fitness: { score: 90, weight: 0.15 },
        docs: { score: 90, weight: 0.10 },
        naming: { score: 90, weight: 0.10 },
        errors: { score: 90, weight: 0.05 },
        context: { score: 90, weight: 0.05 },
        provenance: { score: 90, weight: 0.05 },
      },
      typeViolations: makeTypesViolations(15),
      testViolations: [],
    });

    const typesEntry = entries.find((e) => e.dimension === "types");
    expect(typesEntry).toBeDefined();
    expect(typesEntry!.files.length).toBeLessThanOrEqual(10);
    expect(typesEntry!.files.length).toBeGreaterThan(0);
    expect(typesEntry!.files[0]).toHaveProperty("file");
    expect(typesEntry!.files[0]).toHaveProperty("issue");
    expect(typesEntry!.files[0]).toHaveProperty("suggestion");
    // Each file should be a specific path (not a glob pattern)
    expect(typesEntry!.files[0].file).not.toContain("*");
  });

  it("should include the actual file path from violation data", () => {
    const entries = buildAdviceEntries({
      breakdown: {
        types: { score: 50, weight: 0.25 },
        tests: { score: 90, weight: 0.25 },
        fitness: { score: 90, weight: 0.15 },
        docs: { score: 90, weight: 0.10 },
        naming: { score: 90, weight: 0.10 },
        errors: { score: 90, weight: 0.05 },
        context: { score: 90, weight: 0.05 },
        provenance: { score: 90, weight: 0.05 },
      },
      typeViolations: [
        { file: "src/core/specific-file.ts", line: 42, dimension: "types", violationType: "any_usage", evidence: ": any", confidence: 1.0 },
      ],
      testViolations: [],
    });

    const typesEntry = entries.find((e) => e.dimension === "types");
    expect(typesEntry!.files[0].file).toBe("src/core/specific-file.ts");
  });
});

describe("AC2 — test coverage < 70 lists modules without test", () => {
  it("should return specific modules without test files when test score < 70", () => {
    const entries = buildAdviceEntries({
      breakdown: {
        types: { score: 90, weight: 0.25 },
        tests: { score: 55, weight: 0.25 },
        fitness: { score: 90, weight: 0.15 },
        docs: { score: 90, weight: 0.10 },
        naming: { score: 90, weight: 0.10 },
        errors: { score: 90, weight: 0.05 },
        context: { score: 90, weight: 0.05 },
        provenance: { score: 90, weight: 0.05 },
      },
      typeViolations: [],
      testViolations: makeTestViolations(5),
    });

    const testsEntry = entries.find((e) => e.dimension === "tests");
    expect(testsEntry).toBeDefined();
    expect(testsEntry!.files.length).toBeLessThanOrEqual(10);
    expect(testsEntry!.files[0]).toHaveProperty("file");
    expect(testsEntry!.files[0].file).not.toContain("*");
  });

  it("should deduplicate violations by file path", () => {
    const entries = buildAdviceEntries({
      breakdown: {
        types: { score: 90, weight: 0.25 },
        tests: { score: 60, weight: 0.25 },
        fitness: { score: 90, weight: 0.15 },
        docs: { score: 90, weight: 0.10 },
        naming: { score: 90, weight: 0.10 },
        errors: { score: 90, weight: 0.05 },
        context: { score: 90, weight: 0.05 },
        provenance: { score: 90, weight: 0.05 },
      },
      typeViolations: [],
      testViolations: [
        { file: "src/core/dup.ts", line: 1, dimension: "tests", violationType: "missing_test", evidence: "dup", confidence: 1.0 },
        { file: "src/core/dup.ts", line: 2, dimension: "tests", violationType: "missing_test", evidence: "dup", confidence: 1.0 },
        { file: "src/core/other.ts", line: 1, dimension: "tests", violationType: "missing_test", evidence: "other", confidence: 1.0 },
      ],
    });

    const testsEntry = entries.find((e) => e.dimension === "tests");
    const uniqueFiles = new Set(testsEntry!.files.map((f) => f.file));
    expect(uniqueFiles.size).toBe(testsEntry!.files.length);
  });
});

describe("AC3 — dimension >= 70 returns empty for that dimension", () => {
  it("should return no entries for dimensions with score >= 70", () => {
    const entries = buildAdviceEntries({
      breakdown: {
        types: { score: 75, weight: 0.25 },
        tests: { score: 80, weight: 0.25 },
        fitness: { score: 90, weight: 0.15 },
        docs: { score: 100, weight: 0.10 },
        naming: { score: 70, weight: 0.10 },
        errors: { score: 85, weight: 0.05 },
        context: { score: 72, weight: 0.05 },
        provenance: { score: 90, weight: 0.05 },
      },
      typeViolations: [],
      testViolations: [],
    });

    expect(entries).toHaveLength(0);
  });

  it("should not throw when all dimensions are healthy", () => {
    expect(() =>
      buildAdviceEntries({
        breakdown: {
          types: { score: 100, weight: 0.25 },
          tests: { score: 100, weight: 0.25 },
          fitness: { score: 100, weight: 0.15 },
          docs: { score: 100, weight: 0.10 },
          naming: { score: 100, weight: 0.10 },
          errors: { score: 100, weight: 0.05 },
          context: { score: 100, weight: 0.05 },
          provenance: { score: 100, weight: 0.05 },
        },
        typeViolations: [],
        testViolations: [],
      }),
    ).not.toThrow();
  });

  it("should only include dimensions with score < 70 in output", () => {
    const entries = buildAdviceEntries({
      breakdown: {
        types: { score: 60, weight: 0.25 },  // below threshold
        tests: { score: 80, weight: 0.25 },  // above — skip
        fitness: { score: 90, weight: 0.15 },
        docs: { score: 90, weight: 0.10 },
        naming: { score: 90, weight: 0.10 },
        errors: { score: 90, weight: 0.05 },
        context: { score: 90, weight: 0.05 },
        provenance: { score: 90, weight: 0.05 },
      },
      typeViolations: makeTypesViolations(3),
      testViolations: [],
    });

    const dims = entries.map((e) => e.dimension);
    expect(dims).toContain("types");
    expect(dims).not.toContain("tests");
  });
});
