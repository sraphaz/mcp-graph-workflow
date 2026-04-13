import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../../core/store/migrations.js';
import { runHarnessScan } from '../../core/harness/harness-scan-runner.js';
import { evaluate } from '../../core/harness/remediation-engine.js';

const ROOT = process.cwd();

describe('harness_remediate — end-to-end integration', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
  });

  it('should produce suggestions from real codebase scan', () => {
    // Simulate what analyze(mode: "harness_remediate") does
    const scan = runHarnessScan(ROOT, db, undefined, { collectViolations: true });
    expect(scan.violations).toBeDefined();
    expect(scan.violations!.length).toBeGreaterThan(0);

    const suggestions = evaluate(scan.violations!, db);
    // Real codebase should have some actionable suggestions
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it('should return suggestions with correct shape', () => {
    const scan = runHarnessScan(ROOT, db, undefined, { collectViolations: true });
    const suggestions = evaluate(scan.violations!, db);

    for (const s of suggestions) {
      expect(s.ruleId).toBeTruthy();
      expect(s.violation.file).toBeTruthy();
      expect(s.violation.line).toBeGreaterThanOrEqual(1);
      expect(s.confidence).toBeGreaterThanOrEqual(0.8);
      expect(s.suggestedFix).toBeTruthy();
      expect(['remove', 'replace', 'add', 'refactor']).toContain(s.category);
      expect(s.priority).toBeGreaterThanOrEqual(0);
      expect(s.priority).toBeLessThanOrEqual(100);
    }
  });

  it('should return suggestions sorted by priority desc', () => {
    const scan = runHarnessScan(ROOT, db, undefined, { collectViolations: true });
    const suggestions = evaluate(scan.violations!, db);

    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i - 1].priority).toBeGreaterThanOrEqual(suggestions[i].priority);
    }
  });

  it('should exclude suppressed violations', async () => {
    const { SuppressionStore } = await import('../../core/harness/remediation-suppression.js');
    const scan = runHarnessScan(ROOT, db, undefined, { collectViolations: true });
    const beforeCount = evaluate(scan.violations!, db).length;

    // Suppress the first violation
    if (scan.violations!.length > 0) {
      const v = scan.violations![0];
      const store = new SuppressionStore(db);
      store.suppress(v.file, v.violationType, v.dimension, 'test suppression');

      const afterCount = evaluate(scan.violations!, db).length;
      expect(afterCount).toBeLessThan(beforeCount);
    }
  });
});
