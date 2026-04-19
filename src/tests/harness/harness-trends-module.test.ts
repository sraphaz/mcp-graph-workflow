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
import { getTrends, predictGradeTarget } from '../../core/harness/harness-trends.js';

function insertHistory(db: Database.Database, scores: number[]): void {
  const stmt = db.prepare(
    'INSERT INTO harness_history (id, project_id, score, grade, breakdown, git_commit, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  for (let i = 0; i < scores.length; i++) {
    const score = scores[i];
    const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : 'D';
    stmt.run(`h${i}`, 'proj_local', score, grade, '{}', null, new Date(Date.now() - (scores.length - i) * 60000).toISOString());
  }
}

describe('Harness Trends Module', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
  });

  describe('getTrends', () => {
    it('should return direction=unknown with 0 records', () => {
      const result = getTrends(db);
      expect(result.direction).toBe('unknown');
      expect(result.min).toBe(0);
      expect(result.max).toBe(0);
      expect(result.avg).toBe(0);
      expect(result.slope).toBe(0);
      expect(result.dataPoints).toBe(0);
    });

    it('should calculate improving direction when slope > 0.5', () => {
      // Scores increasing: 50, 52, 54, 56, 58, 60, 62, 64, 66, 68
      insertHistory(db, [50, 52, 54, 56, 58, 60, 62, 64, 66, 68]);
      const result = getTrends(db);
      expect(result.direction).toBe('improving');
      expect(result.slope).toBeGreaterThan(0.5);
      expect(result.min).toBe(50);
      expect(result.max).toBe(68);
      expect(result.dataPoints).toBe(10);
    });

    it('should calculate declining direction when slope < -0.5', () => {
      insertHistory(db, [80, 78, 76, 74, 72, 70, 68, 66, 64, 62]);
      const result = getTrends(db);
      expect(result.direction).toBe('declining');
      expect(result.slope).toBeLessThan(-0.5);
    });

    it('should calculate stable direction when slope between -0.5 and 0.5', () => {
      insertHistory(db, [70, 70, 71, 70, 69, 70, 70, 71, 70, 70]);
      const result = getTrends(db);
      expect(result.direction).toBe('stable');
    });

    it('should calculate correct avg', () => {
      insertHistory(db, [60, 70, 80]);
      const result = getTrends(db);
      expect(result.avg).toBe(70);
    });

    it('should limit to last 30 records', () => {
      const scores = Array.from({ length: 50 }, (_, i) => 50 + i);
      insertHistory(db, scores);
      const result = getTrends(db);
      expect(result.dataPoints).toBeLessThanOrEqual(30);
    });
  });

  describe('predictGradeTarget', () => {
    it('should predict scans needed to reach grade B from score 65 with +2/scan slope', () => {
      // 65 with slope +2 → need 70 for B → (70-65)/2 = 2.5 → ceil = 3 scans
      insertHistory(db, [55, 57, 59, 61, 63, 65]);
      const prediction = predictGradeTarget(db, 'B');
      expect(prediction).not.toBeNull();
      expect(prediction!.targetScore).toBe(70);
      expect(prediction!.scansNeeded).toBeGreaterThanOrEqual(1);
    });

    it('should return null if already at or above target grade', () => {
      insertHistory(db, [85, 86, 87, 88, 89, 90]);
      const prediction = predictGradeTarget(db, 'A');
      expect(prediction).toBeNull();
    });

    it('should return null if slope is negative (declining)', () => {
      insertHistory(db, [80, 78, 76, 74, 72, 70]);
      const prediction = predictGradeTarget(db, 'A');
      expect(prediction).toBeNull();
    });

    it('should return null with insufficient data (< 3 records)', () => {
      insertHistory(db, [60, 62]);
      const prediction = predictGradeTarget(db, 'B');
      expect(prediction).toBeNull();
    });
  });
});
