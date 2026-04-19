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
 * Tests for severity-scoring.ts — Finding severity classification system.
 *
 * AC1: 3 severity levels: critical, warning, info
 * AC2: Findings sorted: critical first, then warning, then info
 * AC3: Composite score < 40 → elevate friction/optimality findings to critical
 */

import { describe, it, expect } from "vitest";
import {
  type Finding,
  sortFindings,
  elevateFindings,
  classifyFindingSeverity,
} from "../core/designer/severity-scoring.js";

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    message: "Test finding",
    source: "fitness",
    dimension: "friction",
    severity: "info",
    ...overrides,
  };
}

describe("severity-scoring", () => {
  // AC1: 3 severity levels
  describe("classifyFindingSeverity", () => {
    it("should return critical for score < 20", () => {
      expect(classifyFindingSeverity(10)).toBe("critical");
      expect(classifyFindingSeverity(0)).toBe("critical");
      expect(classifyFindingSeverity(19)).toBe("critical");
    });

    it("should return warning for score 20-59", () => {
      expect(classifyFindingSeverity(20)).toBe("warning");
      expect(classifyFindingSeverity(40)).toBe("warning");
      expect(classifyFindingSeverity(59)).toBe("warning");
    });

    it("should return info for score >= 60", () => {
      expect(classifyFindingSeverity(60)).toBe("info");
      expect(classifyFindingSeverity(80)).toBe("info");
      expect(classifyFindingSeverity(100)).toBe("info");
    });
  });

  // AC2: Sorted by severity
  describe("sortFindings", () => {
    it("should sort critical first, then warning, then info", () => {
      const findings: Finding[] = [
        makeFinding({ message: "info-1", severity: "info" }),
        makeFinding({ message: "critical-1", severity: "critical" }),
        makeFinding({ message: "warning-1", severity: "warning" }),
        makeFinding({ message: "critical-2", severity: "critical" }),
        makeFinding({ message: "info-2", severity: "info" }),
      ];

      const sorted = sortFindings(findings);

      expect(sorted[0].severity).toBe("critical");
      expect(sorted[1].severity).toBe("critical");
      expect(sorted[2].severity).toBe("warning");
      expect(sorted[3].severity).toBe("info");
      expect(sorted[4].severity).toBe("info");
    });

    it("should preserve order within same severity", () => {
      const findings: Finding[] = [
        makeFinding({ message: "a", severity: "warning" }),
        makeFinding({ message: "b", severity: "warning" }),
        makeFinding({ message: "c", severity: "warning" }),
      ];

      const sorted = sortFindings(findings);

      expect(sorted.map((f) => f.message)).toEqual(["a", "b", "c"]);
    });

    it("should return empty array for empty input", () => {
      expect(sortFindings([])).toEqual([]);
    });
  });

  // AC3: Composite score < 40 → elevate friction/optimality to critical
  describe("elevateFindings", () => {
    it("should elevate friction findings to critical when composite < 40", () => {
      const findings: Finding[] = [
        makeFinding({ message: "friction-issue", source: "fitness", dimension: "friction", severity: "warning" }),
        makeFinding({ message: "reversibility-ok", source: "fitness", dimension: "reversibility", severity: "info" }),
      ];

      const elevated = elevateFindings(findings, 30);

      expect(elevated[0].severity).toBe("critical");
      expect(elevated[1].severity).toBe("info"); // reversibility NOT elevated
    });

    it("should elevate optimality findings to critical when composite < 40", () => {
      const findings: Finding[] = [
        makeFinding({ message: "optimality-gap", source: "fitness", dimension: "optimality", severity: "info" }),
      ];

      const elevated = elevateFindings(findings, 35);

      expect(elevated[0].severity).toBe("critical");
    });

    it("should NOT elevate when composite >= 40", () => {
      const findings: Finding[] = [
        makeFinding({ message: "friction-issue", source: "fitness", dimension: "friction", severity: "warning" }),
      ];

      const elevated = elevateFindings(findings, 50);

      expect(elevated[0].severity).toBe("warning"); // unchanged
    });

    it("should elevate findings from any source (fitness, jtbd, premortem)", () => {
      const findings: Finding[] = [
        makeFinding({ source: "jtbd", dimension: "friction", severity: "info" }),
        makeFinding({ source: "premortem", dimension: "optimality", severity: "warning" }),
      ];

      const elevated = elevateFindings(findings, 20);

      expect(elevated[0].severity).toBe("critical");
      expect(elevated[1].severity).toBe("critical");
    });

    it("should not modify original array (immutable)", () => {
      const findings: Finding[] = [
        makeFinding({ dimension: "friction", severity: "warning" }),
      ];

      const elevated = elevateFindings(findings, 30);

      expect(findings[0].severity).toBe("warning"); // original unchanged
      expect(elevated[0].severity).toBe("critical");
    });
  });
});
