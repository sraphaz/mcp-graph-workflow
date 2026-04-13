import { describe, it, expect } from 'vitest';
import {
  reciprocalRankFusion,
  weightedReciprocalRankFusion,
  DEFAULT_RRF_WEIGHTS,
} from '../core/rag/multi-strategy-retrieval.js';

describe('RRF Weight Tuning for Hybrid Mode', () => {
  const listA = [
    { id: 'doc-1', score: 0.9 },
    { id: 'doc-2', score: 0.7 },
    { id: 'doc-3', score: 0.5 },
  ];
  const listB = [
    { id: 'doc-2', score: 0.95 },
    { id: 'doc-4', score: 0.8 },
    { id: 'doc-1', score: 0.6 },
  ];

  describe('DEFAULT_RRF_WEIGHTS', () => {
    it('should export default weights object', () => {
      expect(DEFAULT_RRF_WEIGHTS).toBeDefined();
      expect(typeof DEFAULT_RRF_WEIGHTS.fts).toBe('number');
      expect(typeof DEFAULT_RRF_WEIGHTS.onnx_semantic).toBe('number');
    });

    it('should have weights that sum to approximately 1.0', () => {
      const sum = Object.values(DEFAULT_RRF_WEIGHTS).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 1);
    });

    it('should have onnx_semantic weight of 0.25', () => {
      expect(DEFAULT_RRF_WEIGHTS.onnx_semantic).toBe(0.25);
    });

    it('should have fts weight of 0.3', () => {
      expect(DEFAULT_RRF_WEIGHTS.fts).toBe(0.3);
    });
  });

  describe('weightedReciprocalRankFusion', () => {
    it('should apply weights to strategy contributions', () => {
      const result = weightedReciprocalRankFusion(
        [
          { name: 'fts', results: listA },
          { name: 'semantic', results: listB },
        ],
        { fts: 0.7, semantic: 0.3 },
      );

      expect(result.length).toBeGreaterThan(0);
      // doc-1 and doc-2 appear in both lists
      const doc1 = result.find(r => r.id === 'doc-1');
      const doc2 = result.find(r => r.id === 'doc-2');
      expect(doc1).toBeDefined();
      expect(doc2).toBeDefined();
    });

    it('should rank higher when strategy weight is higher', () => {
      // doc-4 only appears in listB (semantic)
      const highSemantic = weightedReciprocalRankFusion(
        [
          { name: 'fts', results: listA },
          { name: 'semantic', results: listB },
        ],
        { fts: 0.1, semantic: 0.9 },
      );

      const lowSemantic = weightedReciprocalRankFusion(
        [
          { name: 'fts', results: listA },
          { name: 'semantic', results: listB },
        ],
        { fts: 0.9, semantic: 0.1 },
      );

      const doc4High = highSemantic.find(r => r.id === 'doc-4')!;
      const doc4Low = lowSemantic.find(r => r.id === 'doc-4')!;

      // doc-4 should score higher when semantic weight is higher
      expect(doc4High.rrfScore).toBeGreaterThan(doc4Low.rrfScore);
    });

    it('should handle missing weights gracefully (default to equal)', () => {
      const result = weightedReciprocalRankFusion(
        [
          { name: 'fts', results: listA },
          { name: 'unknown_strategy', results: listB },
        ],
        { fts: 0.5 }, // no weight for unknown_strategy
      );

      // Should not crash, unknown strategy gets default weight
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('original reciprocalRankFusion backward compat', () => {
    it('should still work without weights (unweighted)', () => {
      const result = reciprocalRankFusion([listA, listB]);
      expect(result.length).toBe(4); // 4 unique IDs
      expect(result[0].rrfScore).toBeGreaterThan(0);
    });
  });
});
