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

import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import {
  HarnessDimensionSchema,
  RemediationCategorySchema,
  ViolationDetailSchema,
  RemediationSuggestionSchema,
  ValidationResultSchema,
} from '../../schemas/remediation-schema.js';

describe('Remediation Zod schemas', () => {
  describe('ViolationDetailSchema', () => {
    it('should parse valid violation data', () => {
      const data = {
        file: 'src/core/store.ts',
        line: 42,
        dimension: 'types',
        violationType: 'any_usage',
        evidence: 'const x: any',
        confidence: 1.0,
      };
      const result = ViolationDetailSchema.parse(data);
      expect(result.file).toBe('src/core/store.ts');
      expect(result.line).toBe(42);
      expect(result.dimension).toBe('types');
      expect(result.confidence).toBe(1.0);
    });

    it('should accept optional column and suggestedFix', () => {
      const data = {
        file: 'src/core/store.ts',
        line: 42,
        column: 10,
        dimension: 'types',
        violationType: 'any_usage',
        evidence: 'const x: any',
        confidence: 1.0,
        suggestedFix: 'Replace any with explicit type',
      };
      const result = ViolationDetailSchema.parse(data);
      expect(result.column).toBe(10);
      expect(result.suggestedFix).toBe('Replace any with explicit type');
    });

    it('should reject confidence > 1.0', () => {
      const data = {
        file: 'test.ts',
        line: 1,
        dimension: 'types',
        violationType: 'any_usage',
        evidence: 'x',
        confidence: 1.5,
      };
      expect(() => ViolationDetailSchema.parse(data)).toThrow();
    });

    it('should reject confidence < 0', () => {
      const data = {
        file: 'test.ts',
        line: 1,
        dimension: 'types',
        violationType: 'any_usage',
        evidence: 'x',
        confidence: -0.1,
      };
      expect(() => ViolationDetailSchema.parse(data)).toThrow();
    });

    it('should reject invalid dimension', () => {
      const data = {
        file: 'test.ts',
        line: 1,
        dimension: 'invalid',
        violationType: 'any_usage',
        evidence: 'x',
        confidence: 1.0,
      };
      expect(() => ViolationDetailSchema.parse(data)).toThrow();
    });

    it('should accept all 7 valid dimensions', () => {
      const dims = ['types', 'tests', 'naming', 'errors', 'context', 'docs', 'fitness'];
      for (const dim of dims) {
        const result = HarnessDimensionSchema.parse(dim);
        expect(result).toBe(dim);
      }
    });
  });

  describe('RemediationSuggestionSchema', () => {
    it('should parse valid suggestion', () => {
      const data = {
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
      const result = RemediationSuggestionSchema.parse(data);
      expect(result.ruleId).toBe('R001');
      expect(result.category).toBe('replace');
      expect(result.priority).toBe(90);
    });

    it('should accept all 4 categories', () => {
      const cats = ['remove', 'replace', 'add', 'refactor'];
      for (const cat of cats) {
        const result = RemediationCategorySchema.parse(cat);
        expect(result).toBe(cat);
      }
    });

    it('should reject priority > 100', () => {
      const data = {
        ruleId: 'R001',
        violation: {
          file: 'test.ts', line: 1, dimension: 'types',
          violationType: 'x', evidence: 'x', confidence: 1.0,
        },
        suggestedFix: 'fix',
        confidence: 1.0,
        category: 'replace',
        priority: 101,
      };
      expect(() => RemediationSuggestionSchema.parse(data)).toThrow();
    });
  });

  describe('ValidationResultSchema', () => {
    it('should parse confirmed fix', () => {
      const data = {
        ruleId: 'R001',
        file: 'src/core/store.ts',
        violationType: 'any_usage',
        scoreBefore: 65,
        scoreAfter: 72,
        confirmed: true,
        autoSuppressed: false,
      };
      const result = ValidationResultSchema.parse(data);
      expect(result.confirmed).toBe(true);
      expect(result.scoreAfter).toBeGreaterThan(result.scoreBefore);
    });

    it('should parse auto-suppressed result', () => {
      const data = {
        ruleId: 'R005',
        file: 'src/core/utils.ts',
        violationType: 'generic_name',
        scoreBefore: 70,
        scoreAfter: 70,
        confirmed: false,
        autoSuppressed: true,
      };
      const result = ValidationResultSchema.parse(data);
      expect(result.autoSuppressed).toBe(true);
    });
  });

  describe('z.infer type compatibility', () => {
    it('should produce inferred types that compile', () => {
      type InferredViolation = z.infer<typeof ViolationDetailSchema>;
      type InferredSuggestion = z.infer<typeof RemediationSuggestionSchema>;
      type InferredValidation = z.infer<typeof ValidationResultSchema>;

      const v: InferredViolation = {
        file: 'test.ts', line: 1, dimension: 'types',
        violationType: 'any_usage', evidence: 'x', confidence: 1.0,
      };
      const s: InferredSuggestion = {
        ruleId: 'R001', violation: v, suggestedFix: 'fix',
        confidence: 1.0, category: 'replace', priority: 90,
      };
      const r: InferredValidation = {
        ruleId: 'R001', file: 'test.ts', violationType: 'any_usage',
        scoreBefore: 60, scoreAfter: 70, confirmed: true, autoSuppressed: false,
      };
      expect(v).toBeDefined();
      expect(s).toBeDefined();
      expect(r).toBeDefined();
    });
  });
});
