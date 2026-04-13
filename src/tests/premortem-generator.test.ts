/**
 * Tests for premortem-generator.ts — Pre-Mortem failure mode generator.
 *
 * Covers all 4 acceptance criteria:
 * AC1: generatePreMortem returns >= 3 failure modes with required fields
 * AC2: Constraint-conflicting decisions reference specific constraint nodeIds
 * AC3: Severity uses probability x impact matrix (critical/warning/info)
 * AC4: Missing Consequences => failure mode "missing consequences analysis"
 */

import { describe, it, expect } from "vitest";
import {
  generatePreMortem,
  calculateSeverity,
  FAILURE_MODE_CATEGORIES,
  type FailureMode,
  type PreMortreGraphDoc,
} from "../core/designer/premortem-generator.js";
import type { GraphNode } from "../core/graph/graph-types.js";

// ── Factories ──────────────────────────────────────────

function makeDecisionNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: "node_decision_001",
    type: "decision",
    title: "ADR-001: Use SQLite for storage",
    description:
      "## Status: Accepted\n## Context: Need local-first storage for execution graphs.\n## Decision: Use SQLite with WAL mode.\n## Consequences: Fast reads, single-file persistence, no external deps.",
    status: "backlog",
    priority: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeConstraintNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: "node_constraint_001",
    type: "constraint",
    title: "No external infrastructure",
    description: "System must run without Docker, databases, or cloud services.",
    status: "backlog",
    priority: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeGraphDoc(overrides: Partial<PreMortreGraphDoc> = {}): PreMortreGraphDoc {
  return {
    nodes: [],
    edges: [],
    ...overrides,
  };
}

describe("premortem-generator", () => {
  // ── AC1: generatePreMortem returns >= 3 failure modes ──
  describe("AC1: generatePreMortem returns >= 3 failure modes with required fields", () => {
    it("should return >= 3 failure modes for a decision with Context/Decision/Consequences", () => {
      const decision = makeDecisionNode();
      const doc = makeGraphDoc();

      const result = generatePreMortem(decision, doc);

      expect(result.length).toBeGreaterThanOrEqual(3);
    });

    it("should return failure modes with all required fields", () => {
      const decision = makeDecisionNode();
      const doc = makeGraphDoc();

      const result = generatePreMortem(decision, doc);

      for (const fm of result) {
        expect(fm.description).toBeDefined();
        expect(typeof fm.description).toBe("string");
        expect(fm.description.length).toBeGreaterThan(0);

        expect(FAILURE_MODE_CATEGORIES).toContain(fm.category);

        expect(["critical", "warning", "info"]).toContain(fm.severity);

        expect(Array.isArray(fm.relatedNodeIds)).toBe(true);
      }
    });

    it("should return failure modes with categories from the 4 allowed types", () => {
      const decision = makeDecisionNode({
        description:
          "## Context: Need high-performance storage.\n## Decision: Use Redis cluster with schema migration.\n## Consequences: Breaking change for existing users, requires npm install, data exposure risk.",
      });
      const doc = makeGraphDoc();

      const result = generatePreMortem(decision, doc);
      const categories = new Set(result.map((fm) => fm.category));

      // At least 1 category should be present
      expect(categories.size).toBeGreaterThanOrEqual(1);
      for (const cat of categories) {
        expect(["technical", "adoption", "operational", "security"]).toContain(cat);
      }
    });
  });

  // ── AC2: Constraint-conflicting decisions reference constraint nodeIds ──
  describe("AC2: constraint conflicts reference specific constraint nodeId", () => {
    it("should reference constraint nodeId when decision conflicts with a constraint", () => {
      const decision = makeDecisionNode({
        description:
          "## Context: Need distributed storage.\n## Decision: Use PostgreSQL with Docker.\n## Consequences: Requires Docker infrastructure, external database dependency.",
      });

      const constraint = makeConstraintNode({
        id: "node_constraint_no_docker",
        title: "No external infrastructure",
        description: "System must run without Docker, databases, or cloud services.",
      });

      const doc = makeGraphDoc({
        nodes: [constraint],
        edges: [
          {
            id: "edge_001",
            from: decision.id,
            to: constraint.id,
            relationType: "related_to",
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const result = generatePreMortem(decision, doc);

      const constraintRefs = result.filter((fm) =>
        fm.relatedNodeIds.includes("node_constraint_no_docker"),
      );
      expect(constraintRefs.length).toBeGreaterThanOrEqual(1);
    });

    it("should detect constraint conflicts via keyword overlap even without explicit edges", () => {
      const decision = makeDecisionNode({
        description:
          "## Context: Need distributed cache.\n## Decision: Use Redis with Docker compose.\n## Consequences: Requires Docker and external Redis server.",
      });

      const constraint = makeConstraintNode({
        id: "node_constraint_local",
        title: "Local-only execution",
        description: "No Docker, no external servers, no cloud dependencies.",
      });

      const doc = makeGraphDoc({
        nodes: [constraint],
        edges: [],
      });

      const result = generatePreMortem(decision, doc);

      const constraintRefs = result.filter((fm) =>
        fm.relatedNodeIds.includes("node_constraint_local"),
      );
      expect(constraintRefs.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── AC3: Severity matrix (probability x impact) ──
  describe("AC3: severity uses probability x impact matrix", () => {
    it("should return critical for high probability + high impact", () => {
      const fm: FailureMode = {
        description: "All users experience data loss and downtime every time they deploy",
        category: "technical",
        severity: "info", // will be recalculated
        relatedNodeIds: [],
      };

      const severity = calculateSeverity(fm);
      expect(severity).toBe("critical");
    });

    it("should return warning for high probability but low impact", () => {
      const fm: FailureMode = {
        description: "Users always encounter slower performance during startup",
        category: "operational",
        severity: "info",
        relatedNodeIds: [],
      };

      const severity = calculateSeverity(fm);
      expect(severity).toBe("warning");
    });

    it("should return info for low probability + low impact", () => {
      const fm: FailureMode = {
        description: "Minor cosmetic issue in edge case scenario",
        category: "adoption",
        severity: "info",
        relatedNodeIds: [],
      };

      const severity = calculateSeverity(fm);
      expect(severity).toBe("info");
    });

    it("should elevate severity when composite fitness score < 40", () => {
      const fm: FailureMode = {
        description: "Minor cosmetic issue in edge case scenario",
        category: "adoption",
        severity: "info",
        relatedNodeIds: [],
      };

      // With low fitness score, severity should be elevated
      const severity = calculateSeverity(fm, 30);
      expect(["warning", "critical"]).toContain(severity);
    });
  });

  // ── AC4: Missing Consequences ──
  describe("AC4: missing consequences => failure mode with severity warning", () => {
    it("should include 'missing consequences analysis' when Consequences section is empty", () => {
      const decision = makeDecisionNode({
        description: "## Status: Accepted\n## Context: Need storage.\n## Decision: Use SQLite.",
      });
      const doc = makeGraphDoc();

      const result = generatePreMortem(decision, doc);

      const missingConsequences = result.find((fm) =>
        fm.description.toLowerCase().includes("missing consequences"),
      );
      expect(missingConsequences).toBeDefined();
      expect(missingConsequences!.severity).toBe("warning");
    });

    it("should include 'missing consequences analysis' when description has no Consequences heading", () => {
      const decision = makeDecisionNode({
        description: "Just a plain decision without ADR structure.",
      });
      const doc = makeGraphDoc();

      const result = generatePreMortem(decision, doc);

      const missingConsequences = result.find((fm) =>
        fm.description.toLowerCase().includes("missing consequences"),
      );
      expect(missingConsequences).toBeDefined();
      expect(missingConsequences!.severity).toBe("warning");
    });

    it("should NOT include 'missing consequences' when Consequences are present", () => {
      const decision = makeDecisionNode(); // default has Consequences section
      const doc = makeGraphDoc();

      const result = generatePreMortem(decision, doc);

      const missingConsequences = result.find((fm) =>
        fm.description.toLowerCase().includes("missing consequences"),
      );
      expect(missingConsequences).toBeUndefined();
    });
  });
});
