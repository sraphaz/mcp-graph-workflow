/**
 * TDD: Harness topic in help tool.
 * Validates that help(topic: "harness") returns comprehensive harness reference.
 */

import { describe, it, expect } from "vitest";
import { getHarnessReference } from "../core/config/reference-content.js";

describe("help topic: harness", () => {
  const content = getHarnessReference();

  it("should return non-empty content", () => {
    expect(content.length).toBeGreaterThan(100);
  });

  it("should include all 7 dimension names", () => {
    expect(content).toContain("Type Coverage");
    expect(content).toContain("Test Coverage");
    expect(content).toContain("Architecture Fitness");
    expect(content).toContain("Docs Coverage");
    expect(content).toContain("Naming Clarity");
    expect(content).toContain("Error Handling");
    expect(content).toContain("Context Density");
  });

  it("should include correct weights", () => {
    expect(content).toContain("25%");
    expect(content).toContain("15%");
    expect(content).toContain("10%");
    expect(content).toContain("5%");
  });

  it("should include grade thresholds", () => {
    expect(content).toMatch(/A.*85/);
    expect(content).toMatch(/B.*70/);
    expect(content).toMatch(/C.*55/);
    expect(content).toMatch(/D.*55/);
  });

  it("should include the 3 analyze modes", () => {
    expect(content).toContain("harness_scan");
    expect(content).toContain("harness_trend");
    expect(content).toContain("harness_advice");
  });

  it("should include workflow per phase", () => {
    expect(content).toContain("ANALYZE");
    expect(content).toContain("DESIGN");
    expect(content).toContain("PLAN");
    expect(content).toContain("IMPLEMENT");
    expect(content).toContain("VALIDATE");
    expect(content).toContain("REVIEW");
    expect(content).toContain("HANDOFF");
    expect(content).toContain("DEPLOY");
    expect(content).toContain("LISTENING");
  });

  it("should mention security as parallel quality gate", () => {
    expect(content).toContain("Security");
    expect(content).toMatch(/quality gate/i);
  });

  it("should mention issue pattern tracker", () => {
    expect(content).toContain("Issue Pattern Tracker");
  });
});
