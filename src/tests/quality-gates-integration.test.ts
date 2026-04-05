import { describe, it, expect } from "vitest";
import { runQualityGates } from "../core/pipeline/quality-gates-runner.js";

describe("runQualityGates", () => {
  const projectPath = process.cwd();

  it("should return empty result when no gates specified", () => {
    const result = runQualityGates(projectPath, []);

    expect(result).toBeNull();
  });

  it("should run observability_check gate and return result", () => {
    const result = runQualityGates(projectPath, ["observability_check"]);

    expect(result).not.toBeNull();
    expect(result!.modes).toContain("observability_check");
    expect(result!.scores.observability_check).toBeDefined();
    expect(typeof result!.scores.observability_check).toBe("number");
    expect(result!.overallScore).toBeGreaterThanOrEqual(0);
    expect(result!.overallScore).toBeLessThanOrEqual(100);
    expect(typeof result!.overallGrade).toBe("string");
  });

  it("should handle unknown gate gracefully", () => {
    const result = runQualityGates(projectPath, ["nonexistent_gate"]);

    expect(result).not.toBeNull();
    expect(result!.scores.nonexistent_gate).toBe(0);
    expect(result!.warnings.length).toBeGreaterThan(0);
  });

  it("should include warnings for low scores", () => {
    const result = runQualityGates(projectPath, ["observability_check"]);

    expect(result).not.toBeNull();
    expect(Array.isArray(result!.warnings)).toBe(true);
  });

  it("should return correct shape", () => {
    const result = runQualityGates(projectPath, ["observability_check"]);

    expect(result).not.toBeNull();
    expect(result).toHaveProperty("modes");
    expect(result).toHaveProperty("scores");
    expect(result).toHaveProperty("overallScore");
    expect(result).toHaveProperty("overallGrade");
    expect(result).toHaveProperty("warnings");
  });
});
