/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-21.T01 — citation coverage guard tests.
 */

import { describe, it, expect } from "vitest";
import {
  checkCitationCoverage,
  isCitationGuardDisabled,
} from "../core/hooks/citation-coverage-guard.js";

const WITH_CITATION = "/* §EPIC-21.T01 — guard */ export const x = 1;";
const NO_CITATION = "export const x = 1;";

describe("citation-coverage-guard (E21.T01)", () => {
  it("flags src/core/ file without §-citation as missing", () => {
    const report = checkCitationCoverage([
      { file: "src/core/foo/bar.ts", content: NO_CITATION },
    ]);
    expect(report.missing).toEqual(["src/core/foo/bar.ts"]);
    expect(report.scanned).toBe(1);
    expect(report.skipped).toBe(0);
  });

  it("does NOT flag file with §EPIC- citation", () => {
    const report = checkCitationCoverage([
      { file: "src/core/foo/bar.ts", content: WITH_CITATION },
    ]);
    expect(report.missing).toEqual([]);
    expect(report.scanned).toBe(1);
  });

  it("skips src/tests/ files", () => {
    const report = checkCitationCoverage([
      { file: "src/tests/foo.test.ts", content: NO_CITATION },
    ]);
    expect(report.missing).toEqual([]);
    expect(report.scanned).toBe(0);
    expect(report.skipped).toBe(1);
  });

  it("skips src/cli/, src/web/, src/api/, docs/, tools/", () => {
    const report = checkCitationCoverage([
      { file: "src/cli/index.ts", content: NO_CITATION },
      { file: "src/web/dashboard/app.tsx", content: NO_CITATION },
      { file: "src/api/router.ts", content: NO_CITATION },
      { file: "tools/cli/x.ts", content: NO_CITATION },
      { file: "docs/foo.md", content: NO_CITATION },
    ]);
    expect(report.missing).toEqual([]);
    expect(report.skipped).toBe(5);
  });

  it("skips non-.ts files in src/core/ (e.g., .md/.json)", () => {
    const report = checkCitationCoverage([
      { file: "src/core/foo/README.md", content: NO_CITATION },
    ]);
    expect(report.skipped).toBe(1);
    expect(report.scanned).toBe(0);
  });

  it("mixed batch: scans only relevant core files", () => {
    const report = checkCitationCoverage([
      { file: "src/core/a.ts", content: WITH_CITATION },
      { file: "src/core/b.ts", content: NO_CITATION },
      { file: "src/tests/c.test.ts", content: NO_CITATION },
      { file: "src/core/d.ts", content: "/* §ADR-0042 */" },
    ]);
    expect(report.missing).toEqual(["src/core/b.ts"]);
    expect(report.scanned).toBe(3);
    expect(report.skipped).toBe(1);
  });

  it("isCitationGuardDisabled respects MCP_GRAPH_CITATION_GUARD=off", () => {
    expect(isCitationGuardDisabled({ MCP_GRAPH_CITATION_GUARD: "off" })).toBe(true);
    expect(isCitationGuardDisabled({})).toBe(false);
  });

  it("returns empty report on empty input", () => {
    const report = checkCitationCoverage([]);
    expect(report.missing).toEqual([]);
    expect(report.scanned).toBe(0);
    expect(report.skipped).toBe(0);
  });
});
