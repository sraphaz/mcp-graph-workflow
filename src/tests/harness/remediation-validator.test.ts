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
import {
  RemediationValidator,
} from '../../core/harness/remediation-validator.js';
import { SuppressionStore } from '../../core/harness/remediation-suppression.js';
import type { ViolationDetail } from '../../core/harness/violation-detail.js';

function makeViolation(file: string, type: string): ViolationDetail {
  return {
    file,
    line: 1,
    dimension: 'types',
    violationType: type,
    evidence: 'test',
    confidence: 1.0,
  };
}

describe('Remediation Validator — Post-Fix Feedback Loop', () => {
  let db: Database.Database;
  let validator: RemediationValidator;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    validator = new RemediationValidator(db);
  });

  describe('recordPreFixState + validatePostFix', () => {
    it('should confirm fixes when violation count decreases', () => {
      const preFix = [
        makeViolation('a.ts', 'any_usage'),
        makeViolation('a.ts', 'any_usage'),
        makeViolation('b.ts', 'raw_throw'),
        makeViolation('c.ts', 'generic_name'),
        makeViolation('d.ts', 'missing_jsdoc'),
      ];
      const snapshotId = validator.recordPreFixState(preFix);

      // Post-fix: a.ts any_usage reduced from 2 to 1, b.ts raw_throw gone, rest same
      const postFix = [
        makeViolation('a.ts', 'any_usage'),
        makeViolation('c.ts', 'generic_name'),
        makeViolation('d.ts', 'missing_jsdoc'),
      ];

      const result = validator.validatePostFix(snapshotId, postFix);
      // a.ts any_usage: 2→1 = confirmed
      // b.ts raw_throw: 1→0 = confirmed
      // c.ts generic_name: 1→1 = unchanged (auto-suppress)
      // d.ts missing_jsdoc: 1→1 = unchanged (auto-suppress)
      expect(result.confirmed).toBe(2);
      expect(result.autoSuppressed).toBe(2);
      expect(result.total).toBe(4);
    });

    it('should auto-suppress unchanged violations in suppression store', () => {
      const preFix = [makeViolation('a.ts', 'any_usage')];
      const snapshotId = validator.recordPreFixState(preFix);

      // Same violation still present → auto-suppress
      const postFix = [makeViolation('a.ts', 'any_usage')];
      validator.validatePostFix(snapshotId, postFix);

      const store = new SuppressionStore(db);
      expect(store.isSuppressed('a.ts', 'any_usage')).toBe(true);
    });

    it('should NOT auto-suppress when count decreased', () => {
      const preFix = [
        makeViolation('a.ts', 'any_usage'),
        makeViolation('a.ts', 'any_usage'),
      ];
      const snapshotId = validator.recordPreFixState(preFix);

      const postFix = [makeViolation('a.ts', 'any_usage')];
      validator.validatePostFix(snapshotId, postFix);

      const store = new SuppressionStore(db);
      expect(store.isSuppressed('a.ts', 'any_usage')).toBe(false);
    });

    it('should record validation in remediation_validations table', () => {
      const preFix = [makeViolation('a.ts', 'any_usage')];
      const snapshotId = validator.recordPreFixState(preFix);
      const postFix: ViolationDetail[] = [];
      validator.validatePostFix(snapshotId, postFix);

      const rows = db.prepare('SELECT * FROM remediation_validations').all();
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('extractMetaRule', () => {
    it('should create meta-rule after 3+ confirmations for same rule', () => {
      // Simulate 3 confirmed validations for R001 (any_usage)
      for (let i = 0; i < 3; i++) {
        db.prepare(`INSERT INTO remediation_validations
          (id, rule_id, file, applied, score_before, score_after, confirmed, validated_at)
          VALUES (?, 'R001', 'a.ts', 1, 60, 70, 1, ?)
        `).run(`v${i}`, new Date().toISOString());
      }

      const created = validator.extractMetaRules();
      expect(created).toBeGreaterThanOrEqual(1);

      const meta = db.prepare('SELECT * FROM remediation_meta_rules WHERE violation_type = ?').get('any_usage') as Record<string, unknown> | undefined;
      expect(meta).toBeDefined();
      expect(meta!.confidence).toBe(0.8);
      expect(meta!.confirmations).toBe(3);
    });

    it('should NOT create meta-rule with only 2 confirmations', () => {
      for (let i = 0; i < 2; i++) {
        db.prepare(`INSERT INTO remediation_validations
          (id, rule_id, file, applied, score_before, score_after, confirmed, validated_at)
          VALUES (?, 'R001', 'a.ts', 1, 60, 70, 1, ?)
        `).run(`v${i}`, new Date().toISOString());
      }

      const created = validator.extractMetaRules();
      expect(created).toBe(0);
    });

    it('should not duplicate meta-rule if already exists', () => {
      for (let i = 0; i < 5; i++) {
        db.prepare(`INSERT INTO remediation_validations
          (id, rule_id, file, applied, score_before, score_after, confirmed, validated_at)
          VALUES (?, 'R001', 'a.ts', 1, 60, 70, 1, ?)
        `).run(`v${i}`, new Date().toISOString());
      }

      validator.extractMetaRules();
      validator.extractMetaRules(); // second call

      const count = db.prepare('SELECT COUNT(*) as c FROM remediation_meta_rules WHERE violation_type = ?').get('any_usage') as { c: number };
      expect(count.c).toBe(1);
    });
  });
});
