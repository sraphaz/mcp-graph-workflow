import { describe, it, expect } from "vitest";
import { checkSecurityScan } from "../core/analyzer/security-scanner.js";
import { checkCodeQuality } from "../core/analyzer/code-quality-checker.js";
import { checkTestCoverage } from "../core/analyzer/test-coverage-checker.js";
import { checkObservability } from "../core/analyzer/observability-checker.js";

const PROJECT_PATH = process.cwd();

describe("Quality Gates — All 4 Analyze Modes", () => {
  describe("security_scan", () => {
    it("should return valid report shape", () => {
      const report = checkSecurityScan(PROJECT_PATH);
      expect(report.mode).toBe("security_scan");
      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.score).toBeLessThanOrEqual(100);
      expect(report.checks.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("code_quality", () => {
    it("should export checkCodeQuality function", () => {
      expect(typeof checkCodeQuality).toBe("function");
    });

    it("should return report with correct mode and shape", () => {
      // Run with non-existent path to test graceful error handling
      const report = checkCodeQuality("/tmp/nonexistent-project");
      expect(report.mode).toBe("code_quality");
      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.checks.some((c) => c.name === "lint")).toBe(true);
      expect(report.checks.some((c) => c.name === "type_safety")).toBe(true);
    });
  });

  describe("test_coverage", () => {
    // NOTE: Cannot run nested vitest inside vitest — test the function signature only
    it("should export checkTestCoverage function", () => {
      expect(typeof checkTestCoverage).toBe("function");
    });

    it("should return report with correct mode", () => {
      // Run with a non-existent path to test error handling
      const report = checkTestCoverage("/tmp/nonexistent-project");
      expect(report.mode).toBe("test_coverage");
      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.checks.some((c) => c.name === "test_suite")).toBe(true);
    });
  });

  describe("observability_check", () => {
    it("should return valid report shape", () => {
      const report = checkObservability(PROJECT_PATH);
      expect(report.mode).toBe("observability_check");
      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.checks.some((c) => c.name === "logger_coverage")).toBe(true);
      expect(report.checks.some((c) => c.name === "structured_logging")).toBe(true);
      expect(report.checks.some((c) => c.name === "error_handling")).toBe(true);
      expect(Array.isArray(report.gaps)).toBe(true);
    });

    it("should have high logger coverage for this project", () => {
      const report = checkObservability(PROJECT_PATH);
      const loggerCheck = report.checks.find((c) => c.name === "logger_coverage");
      expect(loggerCheck?.passed).toBe(true);
    });
  });
});
