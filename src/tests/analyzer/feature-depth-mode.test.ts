/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * parseFeatureDepthAudit — pure parser for the Go tool's JSON output.
 *
 * AC1 — extracts avgScore + totalFiles from the top-level keys
 * AC2 — derives gradeDistribution (A/B/C/D/F) from each file's Score
 * AC3 — returns the worst-N files (default 10) sorted ascending
 * AC4 — every worst entry carries {relPath, score, grade, hasTest}
 * AC5 — empty files array produces an empty distribution + empty worst list
 * AC6 — invalid JSON throws a structured InvalidArgumentError
 */

import { describe, it, expect } from "vitest";
import {
  parseFeatureDepthAudit,
  type FeatureDepthResult,
} from "../../core/analyzer/feature-depth-mode.js";
import { InvalidArgumentError } from "../../core/utils/errors.js";

const sampleJson = JSON.stringify({
  tool: "feature-depth",
  mode: "file",
  totalFiles: 5,
  avgScore: 60,
  files: [
    { RelPath: "a.ts", Module: "core", LOC: 100, TestLOC: 80, HasTest: true, Score: 85 },
    { RelPath: "b.ts", Module: "core", LOC: 100, TestLOC: 50, HasTest: true, Score: 70 },
    { RelPath: "c.ts", Module: "core", LOC: 100, TestLOC: 30, HasTest: true, Score: 55 },
    { RelPath: "d.ts", Module: "core", LOC: 100, TestLOC: 0, HasTest: false, Score: 40 },
    { RelPath: "e.ts", Module: "core", LOC: 100, TestLOC: 0, HasTest: false, Score: 25 },
  ],
});

describe("parseFeatureDepthAudit", () => {
  it("AC1 — extracts avgScore and totalFiles", () => {
    const result = parseFeatureDepthAudit(sampleJson);
    expect(result.avgScore).toBe(60);
    expect(result.totalFiles).toBe(5);
  });

  it("AC2 — derives grade distribution from per-file Score", () => {
    const result = parseFeatureDepthAudit(sampleJson);
    expect(result.gradeDistribution).toEqual({ A: 1, B: 1, C: 1, D: 1, F: 1 });
  });

  it("AC3 — returns worst-N files sorted ascending by score", () => {
    const result = parseFeatureDepthAudit(sampleJson, { worstN: 3 });
    expect(result.worstFiles.map((f) => f.relPath)).toEqual(["e.ts", "d.ts", "c.ts"]);
  });

  it("AC4 — each worst entry carries relPath, score, grade, hasTest", () => {
    const result = parseFeatureDepthAudit(sampleJson, { worstN: 1 });
    const worst = result.worstFiles[0];
    expect(worst.relPath).toBe("e.ts");
    expect(worst.score).toBe(25);
    expect(worst.grade).toBe("F");
    expect(worst.hasTest).toBe(false);
  });

  it("AC5 — empty files array produces empty distribution + empty worst list", () => {
    const empty = JSON.stringify({
      tool: "feature-depth",
      mode: "file",
      totalFiles: 0,
      avgScore: 0,
      files: [],
    });
    const result = parseFeatureDepthAudit(empty);
    expect(result.totalFiles).toBe(0);
    expect(result.worstFiles).toEqual([]);
    expect(result.gradeDistribution).toEqual({ A: 0, B: 0, C: 0, D: 0, F: 0 });
  });

  it("AC6 — non-JSON input throws InvalidArgumentError", () => {
    expect(() => parseFeatureDepthAudit("not-json")).toThrow(InvalidArgumentError);
  });

  it("AC6 — JSON without files array throws InvalidArgumentError", () => {
    expect(() => parseFeatureDepthAudit(JSON.stringify({ avgScore: 1 }))).toThrow(
      InvalidArgumentError,
    );
  });

  it("default worstN is 10", () => {
    const big = JSON.stringify({
      tool: "feature-depth",
      mode: "file",
      totalFiles: 15,
      avgScore: 50,
      files: Array.from({ length: 15 }, (_, i) => ({
        RelPath: `f${i}.ts`,
        Module: "core",
        LOC: 100,
        TestLOC: 0,
        HasTest: false,
        Score: i * 5,
      })),
    });
    const result: FeatureDepthResult = parseFeatureDepthAudit(big);
    expect(result.worstFiles).toHaveLength(10);
  });
});
