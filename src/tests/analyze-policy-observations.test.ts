/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-policy-engine-context-routing — Task 2.1: analyze(mode:"policy_observations")
 *
 * AC1: GIVEN 100 observations WHEN analyze roda THEN reporta % divergência, top-3 regras, providers preferidos
 * AC2: GIVEN cost_estimate de divergência WHEN computado THEN baseado no pricing real (não vaidoso — dado bruto + interpretação do usuário)
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../core/store/migrations.js";
import { analyzePolicyObservations } from "../core/analyzer/policy-observations-analyzer.js";

function insertObs(
  db: Database.Database,
  opts: {
    id?: string;
    projectId?: string;
    timestamp?: string;
    appliedRule?: string;
    chainFirst?: string;
    actualUsed?: string[];
    divergence?: boolean;
  },
) {
  const id = opts.id ?? `obs_${Math.random().toString(36).slice(2)}`;
  const ts = opts.timestamp ?? new Date().toISOString();
  const decision = JSON.stringify({
    chain: [opts.chainFirst ?? "anthropic", "local-hub"],
    reasonsByProvider: {},
    appliedRule: opts.appliedRule ?? "default_chain",
  });
  const actualUsed = JSON.stringify(opts.actualUsed ?? [opts.chainFirst ?? "anthropic"]);
  db.prepare(
    `INSERT INTO policy_observations (id, project_id, timestamp, signals_snapshot, decision, actual_used, divergence)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    opts.projectId ?? "p1",
    ts,
    "{}",
    decision,
    actualUsed,
    opts.divergence ? 1 : 0,
  );
}

describe("analyze(mode:'policy_observations') — AC1: divergence + top rules + preferred providers", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });

  it("AC1: returns totalObservations matching the count inserted", () => {
    for (let i = 0; i < 10; i++) insertObs(db, {});
    const report = analyzePolicyObservations(db, { windowDays: 7, projectId: "p1" });
    expect(report.totalObservations).toBe(10);
  });

  it("AC1: divergencePct is correct for 30/100 divergent rows", () => {
    for (let i = 0; i < 70; i++) insertObs(db, { divergence: false });
    for (let i = 0; i < 30; i++) insertObs(db, { divergence: true });
    const report = analyzePolicyObservations(db, { windowDays: 7, projectId: "p1" });
    expect(report.divergenceCount).toBe(30);
    expect(report.divergencePct).toBeCloseTo(30, 0);
  });

  it("AC1: topRules returns rules sorted by count desc", () => {
    for (let i = 0; i < 50; i++) insertObs(db, { appliedRule: "default_chain" });
    for (let i = 0; i < 30; i++) insertObs(db, { appliedRule: "low_budget" });
    for (let i = 0; i < 20; i++) insertObs(db, { appliedRule: "latency_filter" });
    const report = analyzePolicyObservations(db, { windowDays: 7, projectId: "p1" });
    expect(report.topRules[0]?.rule).toBe("default_chain");
    expect(report.topRules[0]?.count).toBe(50);
    expect(report.topRules[1]?.rule).toBe("low_budget");
    expect(report.topRules[2]?.rule).toBe("latency_filter");
  });

  it("AC1: topRules capped at 3 entries", () => {
    for (const rule of ["a", "b", "c", "d", "e"]) {
      insertObs(db, { appliedRule: rule });
    }
    const report = analyzePolicyObservations(db, { windowDays: 7, projectId: "p1" });
    expect(report.topRules.length).toBeLessThanOrEqual(3);
  });

  it("AC1: preferredProviders reflects decision.chain[0] most common first", () => {
    for (let i = 0; i < 60; i++) insertObs(db, { chainFirst: "local-hub" });
    for (let i = 0; i < 40; i++) insertObs(db, { chainFirst: "anthropic" });
    const report = analyzePolicyObservations(db, { windowDays: 7, projectId: "p1" });
    expect(report.preferredProviders[0]?.provider).toBe("local-hub");
    expect(report.preferredProviders[0]?.count).toBe(60);
  });

  it("AC1: returns empty structure when no observations in window", () => {
    const report = analyzePolicyObservations(db, { windowDays: 7, projectId: "p1" });
    expect(report.totalObservations).toBe(0);
    expect(report.divergencePct).toBe(0);
    expect(report.topRules).toEqual([]);
    expect(report.preferredProviders).toEqual([]);
  });

  it("AC1: topRules include pct field summing to ~100", () => {
    for (let i = 0; i < 60; i++) insertObs(db, { appliedRule: "default_chain" });
    for (let i = 0; i < 40; i++) insertObs(db, { appliedRule: "low_budget" });
    const report = analyzePolicyObservations(db, { windowDays: 7, projectId: "p1" });
    const totalPct = report.topRules.reduce((s: number, r: { pct: number }) => s + r.pct, 0);
    expect(totalPct).toBeCloseTo(100, 0);
  });
});

describe("analyze(mode:'policy_observations') — AC2: cost note raw data, no invented numbers", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });

  it("AC2: costNote is a string (raw data present)", () => {
    insertObs(db, { divergence: true, chainFirst: "local-hub", actualUsed: ["anthropic"] });
    const report = analyzePolicyObservations(db, { windowDays: 7, projectId: "p1" });
    expect(typeof report.costNote).toBe("string");
    expect(report.costNote.length).toBeGreaterThan(0);
  });

  it("AC2: costNote contains divergence count as raw data", () => {
    for (let i = 0; i < 5; i++) insertObs(db, { divergence: true });
    const report = analyzePolicyObservations(db, { windowDays: 7, projectId: "p1" });
    expect(report.costNote).toMatch(/5/);
  });

  it("AC2: costNote does NOT claim a specific dollar amount (no invented numbers)", () => {
    insertObs(db, { divergence: true });
    const report = analyzePolicyObservations(db, { windowDays: 7, projectId: "p1" });
    // Should not contain a made-up $ amount like "$0.42 saved"
    expect(report.costNote).not.toMatch(/\$[\d.]+\s*saved/i);
  });
});
