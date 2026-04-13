import { describe, it, expect } from 'vitest';
import {
  listRules,
  findRule,
  resolveTemplate,
  type RemediationRule,
} from '../../core/harness/remediation-rules.js';

describe('Remediation Rules — 16 deterministic rules', () => {
  describe('listRules', () => {
    it('should return exactly 16 rules', () => {
      const rules = listRules();
      expect(rules.length).toBe(16);
    });

    it('should cover all 7 dimensions', () => {
      const rules = listRules();
      const dims = new Set(rules.map((r: RemediationRule) => r.dimension));
      expect(dims.size).toBe(7);
      expect(dims).toContain('types');
      expect(dims).toContain('tests');
      expect(dims).toContain('naming');
      expect(dims).toContain('errors');
      expect(dims).toContain('context');
      expect(dims).toContain('docs');
      expect(dims).toContain('fitness');
    });

    it('should have correct distribution: types(2), tests(2), naming(2), errors(3), context(1), docs(3), fitness(3)', () => {
      const rules = listRules();
      const counts: Record<string, number> = {};
      for (const r of rules) {
        counts[r.dimension] = (counts[r.dimension] || 0) + 1;
      }
      expect(counts['types']).toBe(2);
      expect(counts['tests']).toBe(2);
      expect(counts['naming']).toBe(2);
      expect(counts['errors']).toBe(3);
      expect(counts['context']).toBe(1);
      expect(counts['docs']).toBe(3);
      expect(counts['fitness']).toBe(3);
    });

    it('should have unique IDs for all rules', () => {
      const rules = listRules();
      const ids = rules.map((r: RemediationRule) => r.id);
      expect(new Set(ids).size).toBe(16);
    });

    it('should have confidence >= 0.8 for all rules', () => {
      const rules = listRules();
      for (const r of rules) {
        expect(r.confidence).toBeGreaterThanOrEqual(0.8);
      }
    });

    it('should have priority between 0 and 100 for all rules', () => {
      const rules = listRules();
      for (const r of rules) {
        expect(r.priority).toBeGreaterThanOrEqual(0);
        expect(r.priority).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('findRule', () => {
    it('should find R001 for any_usage', () => {
      const rule = findRule('any_usage');
      expect(rule).not.toBeNull();
      expect(rule!.id).toBe('R001');
      expect(rule!.confidence).toBe(1.0);
      expect(rule!.dimension).toBe('types');
    });

    it('should find R002 for as_any_cast', () => {
      const rule = findRule('as_any_cast');
      expect(rule).not.toBeNull();
      expect(rule!.id).toBe('R002');
    });

    it('should find R003 for missing_test', () => {
      const rule = findRule('missing_test');
      expect(rule).not.toBeNull();
      expect(rule!.id).toBe('R003');
      expect(rule!.dimension).toBe('tests');
    });

    it('should find R007 for raw_throw', () => {
      const rule = findRule('raw_throw');
      expect(rule).not.toBeNull();
      expect(rule!.id).toBe('R007');
      expect(rule!.dimension).toBe('errors');
    });

    it('should return null for unknown violationType', () => {
      const rule = findRule('completely_unknown_type');
      expect(rule).toBeNull();
    });
  });

  describe('resolveTemplate', () => {
    it('should substitute {file}, {line}, {evidence} placeholders', () => {
      const template = 'Replace any with explicit type in {file}:{line}';
      const result = resolveTemplate(template, 'src/core/store.ts', 42, 'const x: any');
      expect(result).toBe('Replace any with explicit type in src/core/store.ts:42');
    });

    it('should handle template with {evidence}', () => {
      const template = 'Rename {evidence} in {file}:{line} to descriptive name';
      const result = resolveTemplate(template, 'utils.ts', 10, 'data');
      expect(result).toBe('Rename data in utils.ts:10 to descriptive name');
    });

    it('should handle template without placeholders', () => {
      const template = 'Create CLAUDE.md';
      const result = resolveTemplate(template, '', 0, '');
      expect(result).toBe('Create CLAUDE.md');
    });
  });
});
