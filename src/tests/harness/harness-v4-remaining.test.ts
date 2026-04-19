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
import { getEvolutionReport } from '../../core/harness/harness-evolution.js';
import { getHarnessMemory, saveHarnessMemory } from '../../core/harness/cross-session-memory.js';
import { calculateParetoPriority, type DimensionGap } from '../../core/harness/pareto-priority.js';
import { ContractSchema } from '../../schemas/contract-schema.js';

function insertBaseline(db: Database.Database, score: number, phase: string, ts: string): void {
  db.prepare(
    'INSERT INTO harness_history (id, project_id, score, grade, breakdown, git_commit, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(`b_${phase}_${ts}`, 'proj_local', score, score >= 70 ? 'B' : 'C', '{}', null, ts);
}

// ── Task 1.4: Evolution Report ───────────────────────────

describe('Harness Evolution Report', () => {
  let db: Database.Database;
  beforeEach(() => { db = new Database(':memory:'); runMigrations(db); });

  it('should compare two baselines and return delta', () => {
    insertBaseline(db, 60, 'PLAN', '2026-01-01T00:00:00Z');
    insertBaseline(db, 72, 'IMPLEMENT', '2026-01-02T00:00:00Z');
    const report = getEvolutionReport(db);
    expect(report.delta).toBe(12);
    expect(report.earliest.score).toBe(60);
    expect(report.latest.score).toBe(72);
    expect(report.direction).toBe('improving');
  });

  it('should return direction=declining when score dropped', () => {
    insertBaseline(db, 80, 'PLAN', '2026-01-01T00:00:00Z');
    insertBaseline(db, 65, 'IMPLEMENT', '2026-01-02T00:00:00Z');
    const report = getEvolutionReport(db);
    expect(report.direction).toBe('declining');
    expect(report.delta).toBe(-15);
  });

  it('should return null with 0 baselines', () => {
    const report = getEvolutionReport(db);
    expect(report).toBeNull();
  });
});

// ── Task 1.5: Cross-Session Memory ──────────────────────

describe('Cross-Session Harness Memory', () => {
  let db: Database.Database;
  beforeEach(() => { db = new Database(':memory:'); runMigrations(db); });

  it('should save and retrieve harness memory', () => {
    saveHarnessMemory(db, { lastScore: 75, lastGrade: 'B', patterns: ['missing_ac'] });
    const mem = getHarnessMemory(db);
    expect(mem).not.toBeNull();
    expect(mem!.lastScore).toBe(75);
    expect(mem!.lastGrade).toBe('B');
    expect(mem!.patterns).toEqual(['missing_ac']);
  });

  it('should return null when no memory saved', () => {
    const mem = getHarnessMemory(db);
    expect(mem).toBeNull();
  });

  it('should overwrite previous memory', () => {
    saveHarnessMemory(db, { lastScore: 60, lastGrade: 'C', patterns: [] });
    saveHarnessMemory(db, { lastScore: 80, lastGrade: 'B', patterns: ['x'] });
    const mem = getHarnessMemory(db);
    expect(mem!.lastScore).toBe(80);
  });
});

// ── Task 2.3: Pareto Priority ────────────────────────────

describe('Pareto Priority Score', () => {
  it('should rank types higher than naming when types has more weighted impact', () => {
    const gaps: DimensionGap[] = [
      { dimension: 'types', score: 50, weight: 0.25, gap: 50 },
      { dimension: 'naming', score: 90, weight: 0.10, gap: 10 },
    ];
    const ranked = calculateParetoPriority(gaps);
    expect(ranked[0].dimension).toBe('types');
    expect(ranked[0].impact).toBeGreaterThan(ranked[1].impact);
  });

  it('should identify top 20% dimensions', () => {
    const gaps: DimensionGap[] = [
      { dimension: 'types', score: 40, weight: 0.25, gap: 60 },
      { dimension: 'tests', score: 50, weight: 0.25, gap: 50 },
      { dimension: 'naming', score: 80, weight: 0.10, gap: 20 },
      { dimension: 'errors', score: 90, weight: 0.05, gap: 10 },
      { dimension: 'context', score: 85, weight: 0.05, gap: 15 },
    ];
    const ranked = calculateParetoPriority(gaps);
    const pareto = ranked.filter((r) => r.isPareto);
    expect(pareto.length).toBeGreaterThanOrEqual(1);
    expect(pareto[0].dimension).toBe('types');
  });

  it('should return empty for empty input', () => {
    expect(calculateParetoPriority([])).toEqual([]);
  });
});

// ── Task 4.1: Contract Schema ────────────────────────────

describe('Contract Schema (Zod)', () => {
  it('should parse valid contract', () => {
    const data = {
      taskId: 'node_abc123',
      implementorClaims: ['Created API endpoint', 'Added tests'],
      validationCriteria: ['Endpoint returns 200', 'Tests pass'],
      results: [],
    };
    const result = ContractSchema.parse(data);
    expect(result.taskId).toBe('node_abc123');
    expect(result.implementorClaims).toHaveLength(2);
  });

  it('should reject contract without taskId', () => {
    expect(() => ContractSchema.parse({
      implementorClaims: ['x'],
      validationCriteria: ['y'],
      results: [],
    })).toThrow();
  });

  it('should accept contract with fulfilled results', () => {
    const data = {
      taskId: 'node_abc123',
      implementorClaims: ['Feature done'],
      validationCriteria: ['Tests pass'],
      results: [{ claim: 'Feature done', validated: true, evidence: 'Tests green' }],
    };
    const result = ContractSchema.parse(data);
    expect(result.results[0].validated).toBe(true);
  });
});
