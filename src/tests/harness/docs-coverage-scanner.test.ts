/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { scanDocsCoverage } from "../../core/harness/docs-coverage-scanner.js";

describe("scanDocsCoverage", () => {
  it("perfect coverage returns 100", () => {
    const result = scanDocsCoverage({
      hasClaudeMd: true,
      hasReadme: true,
      rulesCount: 10,
      srcDirsCount: 10,
      hasDocsDir: true,
    });
    expect(result.docsScore).toBe(100);
  });

  it("zero coverage returns 30 (no dirs case still gets full rules-coverage)", () => {
    // With srcDirsCount=0, the rules portion grants full 30 points
    // (documented: "no dirs = full score" — division-by-zero guard).
    const result = scanDocsCoverage({
      hasClaudeMd: false,
      hasReadme: false,
      rulesCount: 0,
      srcDirsCount: 0,
      hasDocsDir: false,
    });
    expect(result.docsScore).toBe(30);
  });

  it("each weight contributes correctly", () => {
    expect(
      scanDocsCoverage({ hasClaudeMd: true, hasReadme: false, rulesCount: 0, srcDirsCount: 1, hasDocsDir: false }).docsScore,
    ).toBe(30);
    expect(
      scanDocsCoverage({ hasClaudeMd: false, hasReadme: true, rulesCount: 0, srcDirsCount: 1, hasDocsDir: false }).docsScore,
    ).toBe(20);
    expect(
      scanDocsCoverage({ hasClaudeMd: false, hasReadme: false, rulesCount: 0, srcDirsCount: 1, hasDocsDir: true }).docsScore,
    ).toBe(20);
  });

  it("rules coverage proportional to srcDirsCount, capped at 1.0", () => {
    expect(
      scanDocsCoverage({ hasClaudeMd: false, hasReadme: false, rulesCount: 5, srcDirsCount: 10, hasDocsDir: false }).docsScore,
    ).toBe(15); // 50% × 30
    expect(
      scanDocsCoverage({ hasClaudeMd: false, hasReadme: false, rulesCount: 50, srcDirsCount: 10, hasDocsDir: false }).docsScore,
    ).toBe(30); // capped
  });

  it("returns the documented shape", () => {
    const result = scanDocsCoverage({
      hasClaudeMd: true,
      hasReadme: false,
      rulesCount: 3,
      srcDirsCount: 5,
      hasDocsDir: true,
    });
    expect(result).toHaveProperty("docsScore");
    expect(result.hasClaudeMd).toBe(true);
    expect(result.hasReadme).toBe(false);
    expect(result.rulesCount).toBe(3);
    expect(result.dirsCount).toBe(5);
  });
});
