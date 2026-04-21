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
 * Tests for RAG retry policy: second pass trigger when confidence < threshold.
 *
 * node_197e66dcf765 — "Disparar segundo passe apenas quando confianca < limiar"
 * Parent: WP2 — Retry policy (wave-03-loop-reflexivo-retrieval)
 *
 * AC: second pass is triggered only when mean confidence of retrieved results
 *     falls below the configured threshold.
 */

import { describe, it, expect } from "vitest";
import { needsRetry, RETRY_CONFIDENCE_THRESHOLD } from "../../core/rag/corrective-rag.js";
import type { ValidationResult } from "../../core/rag/corrective-rag.js";

function makeValidation(confidenceScore: number, docId = "doc_1"): ValidationResult {
  return {
    docId,
    isValid: confidenceScore >= 0.3,
    confidenceScore,
    staleness: "fresh",
    issues: [],
  };
}

describe("needsRetry", () => {
  describe("trigger conditions", () => {
    it("should return true when all results have confidence below threshold", () => {
      const validations = [
        makeValidation(0.2, "a"),
        makeValidation(0.3, "b"),
        makeValidation(0.1, "c"),
      ];
      expect(needsRetry(validations, 0.5)).toBe(true);
    });

    it("should return false when mean confidence is above threshold", () => {
      const validations = [
        makeValidation(0.8, "a"),
        makeValidation(0.9, "b"),
        makeValidation(0.7, "c"),
      ];
      expect(needsRetry(validations, 0.5)).toBe(false);
    });

    it("should return false when mean confidence equals threshold exactly", () => {
      const validations = [
        makeValidation(0.5, "a"),
        makeValidation(0.5, "b"),
      ];
      expect(needsRetry(validations, 0.5)).toBe(false);
    });

    it("should return false for empty validations — nothing to retry", () => {
      expect(needsRetry([], 0.5)).toBe(false);
    });

    it("should return true for a single low-confidence result", () => {
      expect(needsRetry([makeValidation(0.1)], 0.5)).toBe(true);
    });

    it("should return false for a single high-confidence result", () => {
      expect(needsRetry([makeValidation(0.9)], 0.5)).toBe(false);
    });
  });

  describe("threshold sensitivity", () => {
    it("should respect a strict threshold of 0.8", () => {
      const validations = [makeValidation(0.75, "a"), makeValidation(0.7, "b")];
      expect(needsRetry(validations, 0.8)).toBe(true);
    });

    it("should respect a lenient threshold of 0.2", () => {
      const validations = [makeValidation(0.3, "a"), makeValidation(0.4, "b")];
      expect(needsRetry(validations, 0.2)).toBe(false);
    });

    it("uses mean confidence across all results", () => {
      // mean = (0.3 + 0.9) / 2 = 0.6 — above threshold 0.5
      const validations = [makeValidation(0.3, "a"), makeValidation(0.9, "b")];
      expect(needsRetry(validations, 0.5)).toBe(false);
    });

    it("triggers retry when mean just below threshold", () => {
      // mean = (0.3 + 0.6) / 2 = 0.45 — below threshold 0.5
      const validations = [makeValidation(0.3, "a"), makeValidation(0.6, "b")];
      expect(needsRetry(validations, 0.5)).toBe(true);
    });
  });

  describe("exported constant", () => {
    it("RETRY_CONFIDENCE_THRESHOLD should be a number between 0 and 1", () => {
      expect(typeof RETRY_CONFIDENCE_THRESHOLD).toBe("number");
      expect(RETRY_CONFIDENCE_THRESHOLD).toBeGreaterThan(0);
      expect(RETRY_CONFIDENCE_THRESHOLD).toBeLessThan(1);
    });
  });
});
