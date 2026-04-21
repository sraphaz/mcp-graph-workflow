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
 * Tests for batch confidence formula.
 *
 * node_70154cdbd26b — "Definir formula de confianca por lote de resultados"
 * Parent: WP1 — Confidence signal (wave-03-loop-reflexivo-retrieval)
 *
 * A BatchConfidenceSignal exposes mean, min, and a composite score
 * (weighted mean by result score) that is used as the canonical
 * confidence signal for a retrieval batch.
 */

import { describe, it, expect } from "vitest";
import { computeBatchConfidence } from "../../core/rag/corrective-rag.js";
import type { ValidationResult } from "../../core/rag/corrective-rag.js";

function makeValidation(confidenceScore: number, docId: string): ValidationResult {
  return {
    docId,
    isValid: confidenceScore >= 0.3,
    confidenceScore,
    staleness: "fresh",
    issues: [],
  };
}

describe("computeBatchConfidence", () => {
  describe("empty batch", () => {
    it("should return zero signal for empty validations", () => {
      const signal = computeBatchConfidence([]);
      expect(signal.mean).toBe(0);
      expect(signal.min).toBe(0);
      expect(signal.composite).toBe(0);
      expect(signal.count).toBe(0);
    });
  });

  describe("single result", () => {
    it("should return the single confidence as mean, min, and composite", () => {
      const signal = computeBatchConfidence([makeValidation(0.8, "a")]);
      expect(signal.mean).toBeCloseTo(0.8, 4);
      expect(signal.min).toBeCloseTo(0.8, 4);
      expect(signal.composite).toBeCloseTo(0.8, 4);
      expect(signal.count).toBe(1);
    });
  });

  describe("multiple results", () => {
    it("should compute correct mean", () => {
      const validations = [
        makeValidation(0.6, "a"),
        makeValidation(0.8, "b"),
        makeValidation(1.0, "c"),
      ];
      const signal = computeBatchConfidence(validations);
      expect(signal.mean).toBeCloseTo(0.8, 4);
    });

    it("should compute correct min", () => {
      const validations = [
        makeValidation(0.9, "a"),
        makeValidation(0.3, "b"),
        makeValidation(0.7, "c"),
      ];
      const signal = computeBatchConfidence(validations);
      expect(signal.min).toBeCloseTo(0.3, 4);
    });

    it("should return count equal to number of validations", () => {
      const validations = [
        makeValidation(0.5, "a"),
        makeValidation(0.6, "b"),
        makeValidation(0.7, "c"),
        makeValidation(0.8, "d"),
      ];
      const signal = computeBatchConfidence(validations);
      expect(signal.count).toBe(4);
    });

    it("composite should be between min and 1", () => {
      const validations = [
        makeValidation(0.4, "a"),
        makeValidation(0.9, "b"),
      ];
      const signal = computeBatchConfidence(validations);
      expect(signal.composite).toBeGreaterThanOrEqual(signal.min);
      expect(signal.composite).toBeLessThanOrEqual(1.0);
    });
  });

  describe("signal consistency", () => {
    it("higher confidence results should produce higher composite", () => {
      const lowBatch = [makeValidation(0.2, "a"), makeValidation(0.3, "b")];
      const highBatch = [makeValidation(0.8, "a"), makeValidation(0.9, "b")];

      const low = computeBatchConfidence(lowBatch);
      const high = computeBatchConfidence(highBatch);

      expect(high.composite).toBeGreaterThan(low.composite);
      expect(high.mean).toBeGreaterThan(low.mean);
    });

    it("composite is always >= 0 and <= 1", () => {
      const validations = [
        makeValidation(0.0, "a"),
        makeValidation(1.0, "b"),
        makeValidation(0.5, "c"),
      ];
      const signal = computeBatchConfidence(validations);
      expect(signal.composite).toBeGreaterThanOrEqual(0);
      expect(signal.composite).toBeLessThanOrEqual(1);
    });
  });
});
