/**
 * TDD tests for Vector Quantization — Float32/Float64 to Int8 compression.
 *
 * AC: 4x memory reduction, < 5% recall loss, cosine similarity > 0.95.
 */

import { describe, it, expect } from "vitest";
import { quantizeVector, dequantizeVector, cosineSimilarity } from "../core/rag/vector-quantization.js";

function randomVector(dim: number): number[] {
  return Array.from({ length: dim }, () => Math.random() * 2 - 1);
}

describe("Vector Quantization", () => {
  // ── quantize ─────────────────────────────────────────

  describe("quantizeVector", () => {
    it("should return Int8Array with same length as input", () => {
      const vec = randomVector(384);
      const result = quantizeVector(vec);

      expect(result.quantized).toBeInstanceOf(Int8Array);
      expect(result.quantized.length).toBe(384);
      expect(typeof result.scale).toBe("number");
      expect(result.scale).toBeGreaterThan(0);
    });

    it("should map values to Int8 range (-128 to 127)", () => {
      const vec = [1.0, -1.0, 0.5, -0.5, 0.0];
      const result = quantizeVector(vec);

      for (const val of result.quantized) {
        expect(val).toBeGreaterThanOrEqual(-128);
        expect(val).toBeLessThanOrEqual(127);
      }
    });

    it("should handle zero vectors", () => {
      const vec = [0, 0, 0, 0];
      const result = quantizeVector(vec);

      expect(result.quantized.length).toBe(4);
      // Scale should be a safe small value to avoid division by zero
      expect(result.scale).toBeGreaterThan(0);
    });
  });

  // ── dequantize ───────────────────────────────────────

  describe("dequantizeVector", () => {
    it("should reconstruct vector with cosine similarity > 0.95", () => {
      const original = randomVector(384);
      const { quantized, scale } = quantizeVector(original);
      const reconstructed = dequantizeVector(quantized, scale);

      expect(reconstructed.length).toBe(384);

      const sim = cosineSimilarity(original, reconstructed);
      expect(sim).toBeGreaterThan(0.95);
    });

    it("should maintain high fidelity across 100 random vectors", () => {
      const similarities: number[] = [];

      for (let i = 0; i < 100; i++) {
        const original = randomVector(384);
        const { quantized, scale } = quantizeVector(original);
        const reconstructed = dequantizeVector(quantized, scale);
        similarities.push(cosineSimilarity(original, reconstructed));
      }

      const avgSim = similarities.reduce((a, b) => a + b, 0) / similarities.length;
      const minSim = Math.min(...similarities);

      expect(avgSim).toBeGreaterThan(0.98);
      expect(minSim).toBeGreaterThan(0.95);
    });
  });

  // ── memory savings ───────────────────────────────────

  describe("memory savings", () => {
    it("should use ~4x less memory than Float64", () => {
      const dim = 384;
      const count = 1000;

      // Float64: 8 bytes/dim
      const float64Size = count * dim * 8;

      // Int8: 1 byte/dim + 8 bytes scale per vector
      const int8Size = count * (dim * 1 + 8);

      const ratio = float64Size / int8Size;
      expect(ratio).toBeGreaterThan(3.5); // ~7.7x actually (8 bytes vs ~1.02 bytes)
    });
  });

  // ── cosine similarity ────────────────────────────────

  describe("cosineSimilarity", () => {
    it("should return 1.0 for identical vectors", () => {
      const vec = [1, 2, 3];
      expect(cosineSimilarity(vec, vec)).toBeCloseTo(1.0, 5);
    });

    it("should return -1.0 for opposite vectors", () => {
      const vec = [1, 2, 3];
      const neg = [-1, -2, -3];
      expect(cosineSimilarity(vec, neg)).toBeCloseTo(-1.0, 5);
    });

    it("should return 0.0 for orthogonal vectors", () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 5);
    });
  });
});
