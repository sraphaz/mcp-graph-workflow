import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../../core/store/migrations.js';
import {
  SuppressionStore,
} from '../../core/harness/remediation-suppression.js';

describe('Suppression Store', () => {
  let db: Database.Database;
  let store: SuppressionStore;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    store = new SuppressionStore(db);
  });

  it('should suppress and check suppression', () => {
    store.suppress('foo.ts', 'any_usage', 'types', 'false positive in comment');
    expect(store.isSuppressed('foo.ts', 'any_usage')).toBe(true);
  });

  it('should return false for non-suppressed pair', () => {
    expect(store.isSuppressed('foo.ts', 'any_usage')).toBe(false);
  });

  it('should handle idempotent suppress (same pair twice)', () => {
    store.suppress('foo.ts', 'any_usage', 'types', 'reason 1');
    expect(() => {
      store.suppress('foo.ts', 'any_usage', 'types', 'reason 2');
    }).not.toThrow();
    expect(store.isSuppressed('foo.ts', 'any_usage')).toBe(true);
  });

  it('should list all suppressions', () => {
    store.suppress('a.ts', 'any_usage', 'types');
    store.suppress('b.ts', 'raw_throw', 'errors');
    store.suppress('c.ts', 'generic_name', 'naming');

    const list = store.listSuppressions();
    expect(list.length).toBe(3);
  });

  it('should remove suppression by id', () => {
    store.suppress('foo.ts', 'any_usage', 'types');
    const list = store.listSuppressions();
    expect(list.length).toBe(1);

    store.removeSuppression(list[0].id);
    expect(store.isSuppressed('foo.ts', 'any_usage')).toBe(false);
    expect(store.listSuppressions().length).toBe(0);
  });

  it('should allow same file with different violationType', () => {
    store.suppress('foo.ts', 'any_usage', 'types');
    store.suppress('foo.ts', 'as_any_cast', 'types');

    expect(store.isSuppressed('foo.ts', 'any_usage')).toBe(true);
    expect(store.isSuppressed('foo.ts', 'as_any_cast')).toBe(true);
    expect(store.listSuppressions().length).toBe(2);
  });

  it('should include all fields in suppression record', () => {
    store.suppress('foo.ts', 'any_usage', 'types', 'my reason');
    const list = store.listSuppressions();
    const s = list[0];
    expect(s.id).toBeTruthy();
    expect(s.file).toBe('foo.ts');
    expect(s.violationType).toBe('any_usage');
    expect(s.dimension).toBe('types');
    expect(s.reason).toBe('my reason');
    expect(s.suppressedAt).toBeTruthy();
  });
});
