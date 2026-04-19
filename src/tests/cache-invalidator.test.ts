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
import {
  getPhaseTtlMs,
  invalidateDependentCaches,
  getCacheTokenStats,
} from "../core/rag/cache-invalidator.js";

describe("Cache Invalidator — Cache Coherence Protocol", () => {
  describe("getPhaseTtlMs", () => {
    it("should return 30min for IMPLEMENT phase", () => {
      expect(getPhaseTtlMs("IMPLEMENT")).toBe(30 * 60 * 1000);
    });

    it("should return 2h for DESIGN phase", () => {
      expect(getPhaseTtlMs("DESIGN")).toBe(2 * 60 * 60 * 1000);
    });

    it("should return 1h for PLAN phase", () => {
      expect(getPhaseTtlMs("PLAN")).toBe(60 * 60 * 1000);
    });

    it("should return default 30min for unknown phases", () => {
      expect(getPhaseTtlMs("VALIDATE")).toBe(30 * 60 * 1000);
    });
  });

  describe("invalidateDependentCaches", () => {
    it("should return list of invalidated node IDs based on edges", () => {
      const edges = [
        { from: "node-a", to: "node-b", relationType: "depends_on" },
        { from: "node-c", to: "node-b", relationType: "depends_on" },
        { from: "node-d", to: "node-x", relationType: "depends_on" },
      ];

      // When node-b changes, nodes that depend on it (a and c) should be invalidated
      const invalidated = invalidateDependentCaches("node-b", edges);

      expect(invalidated).toContain("node-a");
      expect(invalidated).toContain("node-c");
      expect(invalidated).not.toContain("node-d");
      expect(invalidated).not.toContain("node-b"); // source node not invalidated
    });

    it("should return empty array when no dependents", () => {
      const edges = [
        { from: "node-a", to: "node-b", relationType: "depends_on" },
      ];

      const invalidated = invalidateDependentCaches("node-x", edges);
      expect(invalidated).toEqual([]);
    });
  });

  describe("getCacheTokenStats", () => {
    it("should compute tokens_saved from hit count and average tokens", () => {
      const stats = getCacheTokenStats(10, 500);

      expect(stats.hits).toBe(10);
      expect(stats.avgTokensPerHit).toBe(500);
      expect(stats.tokensSaved).toBe(5000);
    });

    it("should return 0 tokens_saved when no hits", () => {
      const stats = getCacheTokenStats(0, 500);
      expect(stats.tokensSaved).toBe(0);
    });
  });
});
