/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 9.2: Log de violações e overrides
 * AC1 — Override registrado contém razão + id do decision node
 * AC2 — Override sem decision node rejeitado em strict
 * AC3 — Query de violações por sprint retorna lista ordenada por gravidade
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../../core/store/migrations.js";
import {
  logViolation,
  queryViolationsBySprint,
  type ViolationSeverity,
} from "../../core/lifecycle/violation-log.js";

function makeDb(): Database.Database {
  const db = new Database(":memory:");
  configureDb(db);
  runMigrations(db);
  return db;
}

describe("AC1 — override registrado contém razão + id do decision node", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
  });

  it("should persist reason and decisionNodeId when logging an override", () => {
    logViolation(db, {
      gateId: "IMPLEMENT_to_VALIDATE",
      nodeId: "task-abc",
      sprint: "sprint-1",
      reason: "deadline urgency — approved in ADR-007",
      decisionNodeId: "node_adr007",
      severity: "medium",
      mode: "advisory",
    });

    const rows = queryViolationsBySprint(db, "sprint-1");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.reason).toBe("deadline urgency — approved in ADR-007");
    expect(rows[0]!.decisionNodeId).toBe("node_adr007");
    expect(rows[0]!.gateId).toBe("IMPLEMENT_to_VALIDATE");
    expect(rows[0]!.nodeId).toBe("task-abc");
  });

  it("should record the timestamp of the override", () => {
    const before = Date.now();
    logViolation(db, {
      gateId: "PLAN_to_IMPLEMENT",
      nodeId: "task-xyz",
      sprint: "sprint-1",
      reason: "approved override",
      decisionNodeId: "node_decision1",
      severity: "low",
      mode: "advisory",
    });
    const after = Date.now();

    const rows = queryViolationsBySprint(db, "sprint-1");
    const ts = new Date(rows[0]!.createdAt).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});

describe("AC2 — override sem decision node rejeitado em strict", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
  });

  it("should throw when decisionNodeId is missing in strict mode", () => {
    expect(() =>
      logViolation(db, {
        gateId: "IMPLEMENT_to_VALIDATE",
        nodeId: "task-abc",
        sprint: "sprint-1",
        reason: "trying to skip without decision",
        decisionNodeId: undefined,
        severity: "high",
        mode: "strict",
      }),
    ).toThrow(/decision node required/i);
  });

  it("should allow logging without decisionNodeId in advisory mode", () => {
    expect(() =>
      logViolation(db, {
        gateId: "IMPLEMENT_to_VALIDATE",
        nodeId: "task-abc",
        sprint: "sprint-1",
        reason: "advisory bypass",
        decisionNodeId: undefined,
        severity: "low",
        mode: "advisory",
      }),
    ).not.toThrow();

    const rows = queryViolationsBySprint(db, "sprint-1");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.decisionNodeId).toBeNull();
  });
});

describe("AC3 — query de violações por sprint retorna lista ordenada por gravidade", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
  });

  it("should return violations ordered: high → medium → low", () => {
    const severities: ViolationSeverity[] = ["low", "high", "medium", "high", "low"];
    for (const severity of severities) {
      logViolation(db, {
        gateId: "DESIGN_to_PLAN",
        nodeId: `task-${severity}`,
        sprint: "sprint-2",
        reason: `${severity} bypass`,
        decisionNodeId: "node_d1",
        severity,
        mode: "advisory",
      });
    }

    const rows = queryViolationsBySprint(db, "sprint-2");
    expect(rows).toHaveLength(5);

    const orderedSeverities = rows.map((r) => r.severity);
    const highIdx = orderedSeverities.indexOf("high");
    const medIdx = orderedSeverities.indexOf("medium");
    const lastLow = orderedSeverities.lastIndexOf("low");

    expect(highIdx).toBeLessThan(medIdx);
    expect(medIdx).toBeLessThan(lastLow);
  });

  it("should return empty array for sprint with no violations", () => {
    const rows = queryViolationsBySprint(db, "nonexistent-sprint");
    expect(rows).toEqual([]);
  });

  it("should isolate violations by sprint", () => {
    logViolation(db, {
      gateId: "DESIGN_to_PLAN",
      nodeId: "task-s1",
      sprint: "sprint-A",
      reason: "sprint A bypass",
      decisionNodeId: "node_d1",
      severity: "medium",
      mode: "advisory",
    });
    logViolation(db, {
      gateId: "DESIGN_to_PLAN",
      nodeId: "task-s2",
      sprint: "sprint-B",
      reason: "sprint B bypass",
      decisionNodeId: "node_d2",
      severity: "high",
      mode: "advisory",
    });

    const sprintA = queryViolationsBySprint(db, "sprint-A");
    const sprintB = queryViolationsBySprint(db, "sprint-B");
    expect(sprintA).toHaveLength(1);
    expect(sprintA[0]!.sprint).toBe("sprint-A");
    expect(sprintB).toHaveLength(1);
    expect(sprintB[0]!.sprint).toBe("sprint-B");
  });
});
