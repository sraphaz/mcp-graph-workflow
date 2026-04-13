import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../../core/store/migrations.js';
import { evaluate } from '../../core/harness/remediation-engine.js';
import { SuppressionStore } from '../../core/harness/remediation-suppression.js';
import type { ViolationDetail } from '../../core/harness/violation-detail.js';

function makeViolation(overrides: Partial<ViolationDetail> = {}): ViolationDetail {
  return {
    file: 'src/core/store.ts',
    line: 42,
    dimension: 'types',
    violationType: 'any_usage',
    evidence: 'const x: any',
    confidence: 1.0,
    ...overrides,
  };
}

describe('Remediation Engine — evaluate()', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
  });

  it('should return suggestions for known violation types sorted by priority desc', () => {
    const violations: ViolationDetail[] = [
      makeViolation({ violationType: 'any_usage', file: 'a.ts', line: 1 }),         // R001 pri=90
      makeViolation({ violationType: 'missing_test', file: 'b.ts', dimension: 'tests' }), // R003 pri=80
      makeViolation({ violationType: 'raw_throw', file: 'c.ts', dimension: 'errors' }),   // R007 pri=85
      makeViolation({ violationType: 'generic_name', file: 'd.ts', dimension: 'naming' }), // R005 pri=60
      makeViolation({ violationType: 'missing_jsdoc', file: 'e.ts', dimension: 'context' }), // R010 pri=40
    ];

    const result = evaluate(violations);
    expect(result.length).toBe(5);

    // Sorted by priority desc: 90, 85, 80, 60, 40
    expect(result[0].ruleId).toBe('R001');
    expect(result[0].priority).toBe(90);
    expect(result[1].ruleId).toBe('R007');
    expect(result[1].priority).toBe(85);
    expect(result[2].ruleId).toBe('R003');
    expect(result[2].priority).toBe(80);
    expect(result[3].ruleId).toBe('R005');
    expect(result[3].priority).toBe(60);
    expect(result[4].ruleId).toBe('R010');
    expect(result[4].priority).toBe(40);
  });

  it('should resolve template with actual file/line/evidence', () => {
    const violations = [makeViolation({ file: 'src/foo.ts', line: 10, evidence: 'const x: any' })];
    const result = evaluate(violations);
    expect(result[0].suggestedFix).toContain('src/foo.ts');
    expect(result[0].suggestedFix).toContain('10');
  });

  it('should exclude suppressed violations', () => {
    const store = new SuppressionStore(db);
    store.suppress('a.ts', 'any_usage', 'types', 'false positive');

    const violations = [
      makeViolation({ file: 'a.ts', violationType: 'any_usage' }),  // suppressed
      makeViolation({ file: 'b.ts', violationType: 'raw_throw', dimension: 'errors' }), // not suppressed
    ];

    const result = evaluate(violations, db);
    expect(result.length).toBe(1);
    expect(result[0].violation.file).toBe('b.ts');
  });

  it('should return deterministic output (same input 2x = same output)', () => {
    const violations = [
      makeViolation({ file: 'a.ts', line: 1, violationType: 'any_usage' }),
      makeViolation({ file: 'b.ts', line: 2, violationType: 'raw_throw', dimension: 'errors' }),
      makeViolation({ file: 'c.ts', line: 3, violationType: 'generic_name', dimension: 'naming' }),
    ];

    const result1 = evaluate(violations);
    const result2 = evaluate(violations);
    expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
  });

  it('should return empty array for empty violations', () => {
    const result = evaluate([]);
    expect(result).toEqual([]);
  });

  it('should return empty array for unknown violation types', () => {
    const violations = [makeViolation({ violationType: 'completely_unknown' })];
    const result = evaluate(violations);
    expect(result.length).toBe(0);
  });

  it('should include correct category from the rule', () => {
    const violations = [makeViolation({ violationType: 'any_usage' })];
    const result = evaluate(violations);
    expect(result[0].category).toBe('replace');
  });

  it('should include the original violation in each suggestion', () => {
    const v = makeViolation({ file: 'test.ts', line: 99 });
    const result = evaluate([v]);
    expect(result[0].violation.file).toBe('test.ts');
    expect(result[0].violation.line).toBe(99);
  });

  it('should work without db parameter (no suppression check)', () => {
    const violations = [makeViolation()];
    const result = evaluate(violations);
    expect(result.length).toBe(1);
  });
});
