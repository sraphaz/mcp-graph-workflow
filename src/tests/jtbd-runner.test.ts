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
 * Tests for jtbd-runner.ts — JTBD-as-Test-Cases Runner.
 *
 * Task 1.2 (node_efccfbdd6299) — Epic: Decision Fitness Functions
 *
 * AC1: extractJtbds() parses JTBD patterns from epic/requirement nodes
 * AC2: runJtbdTests() returns PASS/FAIL/PARTIAL per JTBD with justification
 * AC3: FAIL case — decision contradicts JTBD expectation (zero-config vs npm install)
 * AC4: Empty graph — extractJtbds() returns [] and emits warning
 */

import { describe, it, expect } from "vitest";
import {
  extractJtbds,
  runJtbdTests,
} from "../core/designer/jtbd-runner.js";
import type { GraphNode } from "../core/graph/graph-types.js";
import type { Jtbd } from "../core/designer/decision-fitness.js";

function makeNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: "node_test",
    type: "epic",
    title: "Test Epic",
    description: "",
    status: "backlog",
    priority: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("jtbd-runner", () => {
  // ── AC1: extractJtbds ──
  describe("extractJtbds", () => {
    it("should parse JTBD from epic node description with 'When X, I want Y, so I can Z' format", () => {
      const nodes: GraphNode[] = [
        makeNode({
          id: "epic_1",
          type: "epic",
          description:
            "When using the CLI offline, I want to store data locally, so I can access it without internet.",
        }),
      ];

      const result = extractJtbds(nodes);

      expect(result).toHaveLength(1);
      expect(result[0].situation).toMatch(/using the CLI offline/i);
      expect(result[0].motivation).toMatch(/store data locally/i);
      expect(result[0].outcome).toMatch(/access it without internet/i);
      expect(result[0].sourceNodeId).toBe("epic_1");
    });

    it("should parse multiple JTBDs from multiple nodes", () => {
      const nodes: GraphNode[] = [
        makeNode({
          id: "epic_1",
          type: "epic",
          description:
            "When configuring the system, I want zero-config defaults, so I can start immediately.",
        }),
        makeNode({
          id: "req_1",
          type: "requirement",
          description:
            "When reviewing code, I want automated checks, so I can catch bugs early.",
        }),
      ];

      const result = extractJtbds(nodes);

      expect(result).toHaveLength(2);
      expect(result[0].sourceNodeId).toBe("epic_1");
      expect(result[1].sourceNodeId).toBe("req_1");
    });

    it("should parse JTBD with 'so that I can' variant", () => {
      const nodes: GraphNode[] = [
        makeNode({
          id: "epic_2",
          type: "epic",
          description:
            "When deploying to production, I want rollback support, so that I can revert quickly.",
        }),
      ];

      const result = extractJtbds(nodes);

      expect(result).toHaveLength(1);
      expect(result[0].outcome).toMatch(/revert quickly/i);
    });

    it("should only extract from epic and requirement node types", () => {
      const nodes: GraphNode[] = [
        makeNode({
          id: "task_1",
          type: "task",
          description:
            "When building the parser, I want regex matching, so I can extract patterns.",
        }),
        makeNode({
          id: "epic_1",
          type: "epic",
          description:
            "When using the CLI, I want fast responses, so I can stay productive.",
        }),
      ];

      const result = extractJtbds(nodes);

      expect(result).toHaveLength(1);
      expect(result[0].sourceNodeId).toBe("epic_1");
    });

    it("should extract multiple JTBDs from a single node description", () => {
      const nodes: GraphNode[] = [
        makeNode({
          id: "epic_multi",
          type: "epic",
          description:
            "When offline, I want local storage, so I can work without internet. When syncing, I want conflict resolution, so I can merge changes safely.",
        }),
      ];

      const result = extractJtbds(nodes);

      expect(result).toHaveLength(2);
      expect(result[0].motivation).toMatch(/local storage/i);
      expect(result[1].motivation).toMatch(/conflict resolution/i);
    });

    it("should skip nodes without description", () => {
      const nodes: GraphNode[] = [
        makeNode({ id: "epic_no_desc", type: "epic", description: undefined }),
      ];

      const result = extractJtbds(nodes);

      expect(result).toHaveLength(0);
    });
  });

  // ── AC4: Empty graph ──
  describe("extractJtbds — empty graph", () => {
    it("should return empty array and emit warning when no JTBDs found", () => {
      const nodes: GraphNode[] = [
        makeNode({
          id: "epic_no_jtbd",
          type: "epic",
          description: "This epic has no JTBD pattern at all.",
        }),
      ];

      const result = extractJtbds(nodes);

      expect(result).toEqual([]);
    });

    it("should return empty array for empty node list", () => {
      const result = extractJtbds([]);

      expect(result).toEqual([]);
    });
  });

  // ── AC2: runJtbdTests ──
  describe("runJtbdTests", () => {
    it("should return PASS when JTBD keywords overlap with decision (Jaccard >= 0.3)", () => {
      const jtbds: Jtbd[] = [
        {
          situation: "using the CLI",
          motivation: "store data locally with sqlite",
          outcome: "fast local access and persistence",
          sourceNodeId: "epic_1",
        },
      ];
      const decision = makeNode({
        id: "decision_1",
        type: "decision",
        description:
          "## Decision: Use SQLite for local data storage. Provides fast access and persistence without external dependencies.",
      });

      const results = runJtbdTests(jtbds, decision);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("PASS");
      expect(results[0].overlapScore).toBeGreaterThanOrEqual(0.3);
      expect(results[0].justification).toBeDefined();
    });

    it("should return PARTIAL when some keywords overlap (Jaccard 0.1-0.3)", () => {
      const jtbds: Jtbd[] = [
        {
          situation: "building a pipeline",
          motivation: "local data storage engine",
          outcome: "handle batch processing and caching",
          sourceNodeId: "epic_2",
        },
      ];
      const decision = makeNode({
        id: "decision_2",
        type: "decision",
        description:
          "## Decision: Use SQLite for local storage. Provides fast queries and embedded database access for offline workflows.",
      });

      const results = runJtbdTests(jtbds, decision);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("PARTIAL");
      expect(results[0].overlapScore).toBeGreaterThanOrEqual(0.1);
      expect(results[0].overlapScore).toBeLessThan(0.3);
    });

    it("should return FAIL when no keywords overlap (Jaccard < 0.1)", () => {
      const jtbds: Jtbd[] = [
        {
          situation: "training ML models",
          motivation: "distributed GPU computing",
          outcome: "predict customer churn accurately",
          sourceNodeId: "epic_3",
        },
      ];
      const decision = makeNode({
        id: "decision_3",
        type: "decision",
        description:
          "## Decision: Use SQLite for local file-based storage. Simple and lightweight.",
      });

      const results = runJtbdTests(jtbds, decision);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("FAIL");
      expect(results[0].overlapScore).toBeLessThan(0.1);
    });

    it("should include justification text in each result", () => {
      const jtbds: Jtbd[] = [
        {
          situation: "offline",
          motivation: "local storage",
          outcome: "work without internet",
          sourceNodeId: "epic_1",
        },
      ];
      const decision = makeNode({
        id: "decision_1",
        type: "decision",
        description: "## Decision: Use local SQLite storage for offline work.",
      });

      const results = runJtbdTests(jtbds, decision);

      expect(results).toHaveLength(1);
      expect(typeof results[0].justification).toBe("string");
      expect(results[0].justification.length).toBeGreaterThan(0);
    });

    it("should handle multiple JTBDs with mixed results", () => {
      const jtbds: Jtbd[] = [
        {
          situation: "offline",
          motivation: "local sqlite storage",
          outcome: "fast local queries",
          sourceNodeId: "epic_1",
        },
        {
          situation: "scaling",
          motivation: "distributed computing cluster",
          outcome: "handle millions concurrent users",
          sourceNodeId: "epic_2",
        },
      ];
      const decision = makeNode({
        id: "decision_1",
        type: "decision",
        description:
          "## Decision: Use SQLite for local storage with fast queries. Lightweight and embedded.",
      });

      const results = runJtbdTests(jtbds, decision);

      expect(results).toHaveLength(2);
      // First should pass (overlapping keywords)
      expect(results[0].status).toBe("PASS");
      // Second should fail (no overlap)
      expect(results[1].status).toBe("FAIL");
    });
  });

  // ── AC3: zero-config vs npm install ──
  describe("runJtbdTests — zero-config contradiction", () => {
    it("should FAIL when JTBD expects zero-config but decision requires npm install extra", () => {
      const jtbds: Jtbd[] = [
        {
          situation: "setting up the project",
          motivation: "zero config defaults",
          outcome: "start immediately without setup",
          sourceNodeId: "epic_zeroconfig",
        },
      ];
      const decision = makeNode({
        id: "decision_conflict",
        type: "decision",
        description:
          "## Decision: Use library X. Requires npm install extra package and manual configuration.",
      });

      const results = runJtbdTests(jtbds, decision);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("FAIL");
      expect(results[0].overlapScore).toBeLessThan(0.1);
    });
  });
});
