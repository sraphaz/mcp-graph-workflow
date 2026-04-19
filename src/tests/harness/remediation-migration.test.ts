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

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../../core/store/migrations.js';

describe('Migration v36 — Remediation tables', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
  });

  describe('remediation_suppressions', () => {
    it('should create table with correct columns', () => {
      const info = db.pragma('table_info(remediation_suppressions)') as Array<{
        name: string; type: string; notnull: number;
      }>;
      const colNames = info.map((c) => c.name);
      expect(colNames).toContain('id');
      expect(colNames).toContain('file');
      expect(colNames).toContain('violation_type');
      expect(colNames).toContain('dimension');
      expect(colNames).toContain('reason');
      expect(colNames).toContain('suppressed_at');
    });

    it('should enforce UNIQUE(file, violation_type)', () => {
      db.prepare(`INSERT INTO remediation_suppressions (id, file, violation_type, dimension, suppressed_at)
        VALUES ('s1', 'foo.ts', 'any_usage', 'types', '2026-01-01')`).run();

      expect(() => {
        db.prepare(`INSERT INTO remediation_suppressions (id, file, violation_type, dimension, suppressed_at)
          VALUES ('s2', 'foo.ts', 'any_usage', 'types', '2026-01-02')`).run();
      }).toThrow();
    });

    it('should allow same file with different violation_type', () => {
      db.prepare(`INSERT INTO remediation_suppressions (id, file, violation_type, dimension, suppressed_at)
        VALUES ('s1', 'foo.ts', 'any_usage', 'types', '2026-01-01')`).run();
      db.prepare(`INSERT INTO remediation_suppressions (id, file, violation_type, dimension, suppressed_at)
        VALUES ('s2', 'foo.ts', 'as_any_cast', 'types', '2026-01-01')`).run();

      const count = db.prepare('SELECT COUNT(*) as c FROM remediation_suppressions').get() as { c: number };
      expect(count.c).toBe(2);
    });
  });

  describe('remediation_validations', () => {
    it('should create table with correct columns', () => {
      const info = db.pragma('table_info(remediation_validations)') as Array<{
        name: string; type: string; notnull: number;
      }>;
      const colNames = info.map((c) => c.name);
      expect(colNames).toContain('id');
      expect(colNames).toContain('rule_id');
      expect(colNames).toContain('file');
      expect(colNames).toContain('applied');
      expect(colNames).toContain('score_before');
      expect(colNames).toContain('score_after');
      expect(colNames).toContain('confirmed');
      expect(colNames).toContain('validated_at');
    });

    it('should insert and read validation record', () => {
      db.prepare(`INSERT INTO remediation_validations
        (id, rule_id, file, applied, score_before, score_after, confirmed, validated_at)
        VALUES ('v1', 'R001', 'foo.ts', 1, 65.0, 72.0, 1, '2026-01-01')`).run();

      const row = db.prepare('SELECT * FROM remediation_validations WHERE id = ?').get('v1') as Record<string, unknown>;
      expect(row.rule_id).toBe('R001');
      expect(row.score_before).toBe(65.0);
      expect(row.score_after).toBe(72.0);
      expect(row.confirmed).toBe(1);
    });
  });

  describe('remediation_meta_rules', () => {
    it('should create table with correct columns', () => {
      const info = db.pragma('table_info(remediation_meta_rules)') as Array<{
        name: string; type: string; notnull: number;
      }>;
      const colNames = info.map((c) => c.name);
      expect(colNames).toContain('id');
      expect(colNames).toContain('dimension');
      expect(colNames).toContain('violation_type');
      expect(colNames).toContain('pattern');
      expect(colNames).toContain('fix_template');
      expect(colNames).toContain('confidence');
      expect(colNames).toContain('confirmations');
      expect(colNames).toContain('created_at');
      expect(colNames).toContain('updated_at');
    });

    it('should insert and read meta-rule', () => {
      db.prepare(`INSERT INTO remediation_meta_rules
        (id, dimension, violation_type, pattern, fix_template, confidence, confirmations, created_at, updated_at)
        VALUES ('mr1', 'types', 'any_usage', ':\\s*any\\b', 'Replace any with type', 0.8, 3, '2026-01-01', '2026-01-01')`).run();

      const row = db.prepare('SELECT * FROM remediation_meta_rules WHERE id = ?').get('mr1') as Record<string, unknown>;
      expect(row.dimension).toBe('types');
      expect(row.confidence).toBe(0.8);
      expect(row.confirmations).toBe(3);
    });
  });

  describe('migration versioning', () => {
    it('should record migration v36 in _migrations table', () => {
      const row = db.prepare('SELECT * FROM _migrations WHERE version = 36').get() as Record<string, unknown> | undefined;
      expect(row).toBeDefined();
      expect(row!.version).toBe(36);
    });
  });
});
