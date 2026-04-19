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

import { describe, it, expect } from "vitest";
import { checkSecurityScan } from "../core/analyzer/security-scanner.js";

describe("checkSecurityScan", () => {
  it("should return a report with correct shape", () => {
    const report = checkSecurityScan(process.cwd());

    expect(report).toHaveProperty("mode", "security_scan");
    expect(report).toHaveProperty("score");
    expect(report).toHaveProperty("grade");
    expect(report).toHaveProperty("checks");
    expect(report).toHaveProperty("findings");
    expect(report).toHaveProperty("passed");
    expect(typeof report.score).toBe("number");
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(Array.isArray(report.checks)).toBe(true);
    expect(Array.isArray(report.findings)).toBe(true);
  });

  it("should include dependency_audit check", () => {
    const report = checkSecurityScan(process.cwd());
    const depCheck = report.checks.find((c) => c.name === "dependency_audit");

    expect(depCheck).toBeDefined();
    expect(depCheck!.passed).toBeDefined();
  });

  it("should include secrets_scan check", () => {
    const report = checkSecurityScan(process.cwd());
    const secretsCheck = report.checks.find((c) => c.name === "secrets_scan");

    expect(secretsCheck).toBeDefined();
  });

  it("should include eslint_security check", () => {
    const report = checkSecurityScan(process.cwd());
    const eslintCheck = report.checks.find((c) => c.name === "eslint_security");

    expect(eslintCheck).toBeDefined();
  });

  it("should return a numeric score between 0 and 100", () => {
    const report = checkSecurityScan(process.cwd());

    // Score depends on npm audit results which vary — just verify range
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(typeof report.grade).toBe("string");
    expect(report.grade.length).toBe(1);
  });

  it("should classify findings by severity", () => {
    const report = checkSecurityScan(process.cwd());

    for (const finding of report.findings) {
      expect(["critical", "high", "medium", "low", "info"]).toContain(finding.severity);
      expect(finding.message).toBeTruthy();
    }
  });
});
