import { describe, it, expect } from 'vitest';
import type {
  ViolationDetail,
  RemediationSuggestion,
  ValidationResult,
  HarnessDimension,
  RemediationCategory,
} from '../../core/harness/violation-detail.js';

describe('ViolationDetail types', () => {
  describe('ViolationDetail', () => {
    it('should accept valid violation with all required fields', () => {
      const violation: ViolationDetail = {
        file: 'src/core/store.ts',
        line: 42,
        dimension: 'types',
        violationType: 'any_usage',
        evidence: 'const x: any',
        confidence: 1.0,
      };
      expect(violation.file).toBe('src/core/store.ts');
      expect(violation.line).toBe(42);
      expect(violation.dimension).toBe('types');
      expect(violation.confidence).toBe(1.0);
    });

    it('should accept optional column and suggestedFix', () => {
      const violation: ViolationDetail = {
        file: 'src/core/store.ts',
        line: 42,
        column: 10,
        dimension: 'types',
        violationType: 'any_usage',
        evidence: 'const x: any',
        confidence: 1.0,
        suggestedFix: 'Replace any with explicit type',
      };
      expect(violation.column).toBe(10);
      expect(violation.suggestedFix).toBe('Replace any with explicit type');
    });

    it('should support all 7 harness dimensions', () => {
      const dimensions: HarnessDimension[] = [
        'types', 'tests', 'naming', 'errors', 'context', 'docs', 'fitness',
      ];
      expect(dimensions).toHaveLength(7);
      for (const dim of dimensions) {
        const v: ViolationDetail = {
          file: 'test.ts',
          line: 1,
          dimension: dim,
          violationType: 'test',
          evidence: 'test',
          confidence: 1.0,
        };
        expect(v.dimension).toBe(dim);
      }
    });
  });

  describe('RemediationSuggestion', () => {
    it('should accept valid suggestion with all fields', () => {
      const suggestion: RemediationSuggestion = {
        ruleId: 'R001',
        violation: {
          file: 'src/core/store.ts',
          line: 42,
          dimension: 'types',
          violationType: 'any_usage',
          evidence: 'const x: any',
          confidence: 1.0,
        },
        suggestedFix: 'Replace any with explicit type in src/core/store.ts:42',
        confidence: 1.0,
        category: 'replace',
        priority: 90,
      };
      expect(suggestion.ruleId).toBe('R001');
      expect(suggestion.category).toBe('replace');
      expect(suggestion.priority).toBe(90);
    });

    it('should support all remediation categories', () => {
      const categories: RemediationCategory[] = ['remove', 'replace', 'add', 'refactor'];
      expect(categories).toHaveLength(4);
    });
  });

  describe('ValidationResult', () => {
    it('should represent a confirmed fix', () => {
      const result: ValidationResult = {
        ruleId: 'R001',
        file: 'src/core/store.ts',
        violationType: 'any_usage',
        scoreBefore: 65,
        scoreAfter: 72,
        confirmed: true,
        autoSuppressed: false,
      };
      expect(result.confirmed).toBe(true);
      expect(result.autoSuppressed).toBe(false);
      expect(result.scoreAfter).toBeGreaterThan(result.scoreBefore);
    });

    it('should represent an auto-suppressed fix (score did not improve)', () => {
      const result: ValidationResult = {
        ruleId: 'R005',
        file: 'src/core/utils.ts',
        violationType: 'generic_name',
        scoreBefore: 70,
        scoreAfter: 70,
        confirmed: false,
        autoSuppressed: true,
      };
      expect(result.confirmed).toBe(false);
      expect(result.autoSuppressed).toBe(true);
    });
  });
});
