/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 6.1: Dimensão de provenance no harness_scan
 * AC1 — GIVEN base sem provenance WHEN scan roda THEN nova dimensao pontua 0 e score total ajustado
 * AC2 — GIVEN 80% dos nodes com receipt WHEN scan THEN dimensao pontua 80
 * AC3 — GIVEN documento atualizado THEN help(topic: "harness") reflete a 8a dimensao
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../../core/store/migrations.js";
import { scanProvenance } from "../../core/harness/provenance-scanner.js";
import { computeHarnessabilityScore } from "../../core/harness/harnessability-score.js";
import { getHarnessReference } from "../../core/config/reference-content.js";

function makeDb(): Database.Database {
  const db = new Database(":memory:");
  configureDb(db);
  runMigrations(db);
  return db;
}

function insertNode(db: Database.Database, id: string, sourceFile: string | null): void {
  db.prepare(`
    INSERT INTO nodes (id, project_id, type, title, status, priority, blocked, created_at, updated_at, source_file)
    VALUES (?, 'proj_local', 'task', ?, 'backlog', 3, 0, '2026-01-01', '2026-01-01', ?)
  `).run(id, `Task ${id}`, sourceFile);
}

function insertProject(db: Database.Database): void {
  db.prepare(`
    INSERT OR IGNORE INTO projects (id, name, created_at, updated_at)
    VALUES ('proj_local', 'test', '2026-01-01', '2026-01-01')
  `).run();
}

describe("AC1 — base sem provenance pontua 0", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
    insertProject(db);
  });

  it("should return provenanceScore=0 when no nodes have source_file", () => {
    insertNode(db, "n1", null);
    insertNode(db, "n2", null);
    insertNode(db, "n3", null);

    const result = scanProvenance(db);
    expect(result.provenanceScore).toBe(0);
    expect(result.totalNodes).toBe(3);
    expect(result.nodesWithReceipt).toBe(0);
  });

  it("should return provenanceScore=100 when db has no nodes at all (nothing to penalize)", () => {
    const result = scanProvenance(db);
    expect(result.provenanceScore).toBe(100);
    expect(result.totalNodes).toBe(0);
    expect(result.nodesWithReceipt).toBe(0);
  });

  it("should include provenance in harnessability score when provenanceScore=0", () => {
    const result = computeHarnessabilityScore({
      typeScore: 100,
      testScore: 100,
      fitnessScore: 100,
      docsScore: 100,
      namingScore: 100,
      errorHandlingScore: 100,
      contextDensityScore: 100,
      provenanceScore: 0,
    });
    // Score should be < 100 because provenance contributes 5%
    expect(result.score).toBeLessThan(100);
    expect(result.breakdown.provenance).toBeDefined();
    expect(result.breakdown.provenance.score).toBe(0);
  });
});

describe("AC2 — 80% dos nodes com receipt pontua 80", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
    insertProject(db);
  });

  it("should return provenanceScore=80 when 4 of 5 nodes have source_file", () => {
    insertNode(db, "n1", "prd-feature.md");
    insertNode(db, "n2", "prd-feature.md");
    insertNode(db, "n3", "prd-feature.md");
    insertNode(db, "n4", "prd-feature.md");
    insertNode(db, "n5", null);

    const result = scanProvenance(db);
    expect(result.provenanceScore).toBe(80);
    expect(result.nodesWithReceipt).toBe(4);
    expect(result.totalNodes).toBe(5);
  });

  it("should return provenanceScore=100 when all nodes have source_file", () => {
    insertNode(db, "n1", "prd.md");
    insertNode(db, "n2", "prd.md");

    const result = scanProvenance(db);
    expect(result.provenanceScore).toBe(100);
  });

  it("should compute correct weighted contribution in harnessability score", () => {
    const resultWith80 = computeHarnessabilityScore({
      typeScore: 100,
      testScore: 100,
      fitnessScore: 100,
      docsScore: 100,
      namingScore: 100,
      errorHandlingScore: 100,
      contextDensityScore: 100,
      provenanceScore: 80,
    });
    const resultWith100 = computeHarnessabilityScore({
      typeScore: 100,
      testScore: 100,
      fitnessScore: 100,
      docsScore: 100,
      namingScore: 100,
      errorHandlingScore: 100,
      contextDensityScore: 100,
      provenanceScore: 100,
    });

    // With 5% weight: difference should be (100-80)*0.05 = 1 point
    expect(resultWith100.score - resultWith80.score).toBeCloseTo(1, 1);
  });
});

describe("AC3 — help(topic: 'harness') reflete a 8a dimensao", () => {
  it("should mention Provenance Coverage in harness reference", () => {
    const content = getHarnessReference();
    expect(content).toMatch(/Provenance Coverage/i);
  });

  it("should mention 8 dimensions in harness reference", () => {
    const content = getHarnessReference();
    expect(content).toMatch(/8 Dimens/i);
  });

  it("should include provenance weight in the table", () => {
    const content = getHarnessReference();
    // Must include provenance row
    expect(content).toMatch(/Provenance.*5%|5%.*Provenance/i);
  });
});
