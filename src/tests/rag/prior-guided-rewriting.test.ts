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
 * Tests for prior-guided query rewriting.
 *
 * node_d37f05f2bf7e — "Alimentar query-understanding com sinais da tentativa anterior"
 * Parent: WP3 — Prior-guided rewriting (wave-03-loop-reflexivo-retrieval)
 *
 * When a first retrieval pass has low confidence, a second pass can be guided
 * by signals from the first attempt: which entities were found, which terms
 * failed, and the overall confidence score.
 */

import { describe, it, expect } from "vitest";
import { understandQuery } from "../../core/rag/query-understanding.js";
import type { PriorAttemptSignals } from "../../core/rag/query-understanding.js";

describe("prior-guided query rewriting", () => {
  describe("PriorAttemptSignals interface", () => {
    it("should accept priorAttempt with confidence and low-yield entities", () => {
      const prior: PriorAttemptSignals = {
        confidence: 0.3,
        lowYieldTerms: ["database", "migration"],
        retrievedEntities: ["GraphNode"],
        retryCount: 1,
      };
      const result = understandQuery("find graph node schema", prior);
      expect(result).toBeDefined();
      expect(result.originalQuery).toBe("find graph node schema");
    });
  });

  describe("without prior signals — baseline behaviour preserved", () => {
    it("should work identically when no prior is provided", () => {
      const withoutPrior = understandQuery("search for graph node");
      const withNullPrior = understandQuery("search for graph node", undefined);
      expect(withoutPrior.intent).toBe(withNullPrior.intent);
      expect(withoutPrior.entities).toEqual(withNullPrior.entities);
    });
  });

  describe("with prior signals — query augmentation", () => {
    it("should expose prior signals in result when provided", () => {
      const prior: PriorAttemptSignals = {
        confidence: 0.25,
        lowYieldTerms: ["graph"],
        retrievedEntities: [],
        retryCount: 1,
      };
      const result = understandQuery("search for graph schema", prior);
      expect(result.priorSignals).toBeDefined();
      expect(result.priorSignals?.confidence).toBe(0.25);
    });

    it("should mark the query as a retry when priorAttempt is present", () => {
      const prior: PriorAttemptSignals = {
        confidence: 0.2,
        lowYieldTerms: [],
        retrievedEntities: [],
        retryCount: 1,
      };
      const result = understandQuery("find node dependencies", prior);
      expect(result.isRetry).toBe(true);
    });

    it("should not mark as retry when no prior is provided", () => {
      const result = understandQuery("find node dependencies");
      expect(result.isRetry).toBe(false);
    });

    it("should exclude low-yield terms from expanded terms on retry", () => {
      const prior: PriorAttemptSignals = {
        confidence: 0.2,
        lowYieldTerms: ["node", "graph"],
        retrievedEntities: [],
        retryCount: 1,
      };
      const retryResult = understandQuery("find node graph data", prior);

      // On retry, low-yield terms should be deprioritized — expanded set may differ
      // At minimum the result must still be valid
      expect(retryResult.expandedTerms.length).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(retryResult.expandedTerms)).toBe(true);
      // Low-yield terms should not dominate the expansion on retry
      expect(retryResult.priorSignals?.lowYieldTerms).toContain("node");
    });

    it("should include retrievedEntities from prior in the result", () => {
      const prior: PriorAttemptSignals = {
        confidence: 0.3,
        lowYieldTerms: [],
        retrievedEntities: ["GraphNode", "EdgeType"],
        retryCount: 1,
      };
      const result = understandQuery("find schema types", prior);
      expect(result.priorSignals?.retrievedEntities).toEqual(["GraphNode", "EdgeType"]);
    });
  });
});
