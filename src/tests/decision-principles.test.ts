/**
 * Tests for decision-principles.ts — built-in + custom decision principles.
 *
 * AC1: Built-in principles exist (4 minimum)
 * AC2: Violated principles generate findings with severity
 * AC3: Custom principles from graph nodes with tag "decision"
 */

import { describe, it, expect } from "vitest";
import {
  BUILT_IN_PRINCIPLES,
  evaluateDecisionPrinciples,
  type DecisionPrinciple,
} from "../core/designer/decision-principles.js";
import type { GraphNode } from "../core/graph/graph-types.js";

function makeDecisionNode(description: string): GraphNode {
  return {
    id: "decision-1",
    type: "decision",
    title: "ADR-001: Test Decision",
    description,
    status: "backlog",
    priority: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("decision-principles", () => {
  // AC1: Built-in principles
  it("should have at least 4 built-in principles", () => {
    expect(BUILT_IN_PRINCIPLES.length).toBeGreaterThanOrEqual(4);
  });

  it("should include zero-config, reversible, friction, and use-case principles", () => {
    const ids = BUILT_IN_PRINCIPLES.map((p) => p.id);
    expect(ids).toContain("zero-config-default");
    expect(ids).toContain("prefer-reversible");
    expect(ids).toContain("minimize-friction");
    expect(ids).toContain("align-majority-use-case");
  });

  it("should have dimension mapping for each built-in principle", () => {
    for (const p of BUILT_IN_PRINCIPLES) {
      expect(["friction", "reversibility", "optimality"]).toContain(p.dimension);
    }
  });

  // AC2: Violated principles generate findings
  it("should generate violation for friction-heavy decision", () => {
    const node = makeDecisionNode(
      "## Decision: Requires npm install and manual step. Extra dependency needed. Configuration required for each user.",
    );

    const violations = evaluateDecisionPrinciples(node, BUILT_IN_PRINCIPLES);

    const frictionViolations = violations.filter((v) => v.dimension === "friction");
    expect(frictionViolations.length).toBeGreaterThan(0);
    expect(frictionViolations[0].principleId).toBeDefined();
    expect(frictionViolations[0].severity).toBeDefined();
  });

  it("should NOT generate friction violation for zero-config decision", () => {
    const node = makeDecisionNode(
      "## Decision: Works out of the box with zero configuration. No installation needed.",
    );

    const violations = evaluateDecisionPrinciples(node, BUILT_IN_PRINCIPLES);

    const frictionViolations = violations.filter((v) => v.dimension === "friction");
    expect(frictionViolations.length).toBe(0);
  });

  it("should generate violation for irreversible decision", () => {
    const node = makeDecisionNode(
      "## Decision: Schema migration with permanent data restructuring. Vendor lock-in accepted.",
    );

    const violations = evaluateDecisionPrinciples(node, BUILT_IN_PRINCIPLES);

    const revViolations = violations.filter((v) => v.dimension === "reversibility");
    expect(revViolations.length).toBeGreaterThan(0);
  });

  // AC2: Severity on violations
  it("should include severity and message on each violation", () => {
    const node = makeDecisionNode(
      "## Decision: npm install. manual step. vendor lock-in. breaking change.",
    );

    const violations = evaluateDecisionPrinciples(node, BUILT_IN_PRINCIPLES);

    for (const v of violations) {
      expect(v.severity).toMatch(/^(critical|warning|info)$/);
      expect(v.message.length).toBeGreaterThan(0);
      expect(v.principleId.length).toBeGreaterThan(0);
    }
  });

  // AC3: Custom principles
  it("should evaluate custom principles alongside built-in", () => {
    const custom: DecisionPrinciple = {
      id: "no-external-apis",
      name: "No external API calls",
      description: "All processing must be local",
      dimension: "friction",
      violationKeywords: ["api call", "external service", "cloud"],
    };

    const node = makeDecisionNode(
      "## Decision: Use external service API call for authentication.",
    );

    const violations = evaluateDecisionPrinciples(node, [...BUILT_IN_PRINCIPLES, custom]);

    const customViolation = violations.find((v) => v.principleId === "no-external-apis");
    expect(customViolation).toBeDefined();
  });

  // Edge: empty description
  it("should return empty violations for empty description", () => {
    const node = makeDecisionNode("");
    const violations = evaluateDecisionPrinciples(node, BUILT_IN_PRINCIPLES);
    expect(violations).toEqual([]);
  });
});
