/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-vendor-insights-scanner — Task 1.4: persist architectural signals
 *
 * AC1: GIVEN scan retorna sinal WHEN persisto THEN record architectural_signal salvo com schema válido
 * AC2: GIVEN N records persistidos WHEN consulto trend THEN retornados em ordem cronológica
 * AC3: GIVEN session_end com delta WHEN persisto THEN record carrega session_id e delta_score
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../core/store/migrations.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import {
  persistSignal,
  getSignalTrend,
  type ArchitecturalSignalRecord,
} from "../core/vendor-scan/signal-store.js";

function makeSignal(over: Partial<ArchitecturalSignalRecord> = {}): ArchitecturalSignalRecord {
  return {
    timestamp: new Date().toISOString(),
    score: 75,
    breakdown: {
      typeCoverage: 80,
      testCoverage: 70,
      architectureFitness: 75,
      docsCoverage: 65,
      namingClarity: 85,
    },
    ...over,
  };
}

describe("architectural-signal-store — AC1: persist with valid schema", () => {
  let store: KnowledgeStore;

  beforeEach(() => {
    const db = new Database(":memory:");
    runMigrations(db);
    store = new KnowledgeStore(db);
  });

  it("AC1: persistSignal saves a document with sourceType architectural_signal", () => {
    const signal = makeSignal();
    const doc = persistSignal(store, signal);
    expect(doc.sourceType).toBe("architectural_signal");
  });

  it("AC1: persisted document content round-trips to a valid ArchitecturalSignalRecord", () => {
    const signal = makeSignal({ score: 88 });
    const doc = persistSignal(store, signal);
    const parsed = JSON.parse(doc.content) as ArchitecturalSignalRecord;
    expect(parsed.score).toBe(88);
    expect(parsed.breakdown).toBeDefined();
    expect(Object.keys(parsed.breakdown)).toHaveLength(5);
  });

  it("AC1: store count for architectural_signal increments on persist", () => {
    persistSignal(store, makeSignal());
    persistSignal(store, makeSignal({ score: 90, timestamp: new Date(Date.now() + 1000).toISOString() }));
    expect(store.count("architectural_signal")).toBe(2);
  });
});

describe("architectural-signal-store — AC2: trend in chronological order", () => {
  let store: KnowledgeStore;

  beforeEach(() => {
    const db = new Database(":memory:");
    runMigrations(db);
    store = new KnowledgeStore(db);
  });

  it("AC2: getSignalTrend returns records in ascending timestamp order", () => {
    const t1 = "2026-01-01T00:00:00.000Z";
    const t2 = "2026-01-02T00:00:00.000Z";
    const t3 = "2026-01-03T00:00:00.000Z";
    persistSignal(store, makeSignal({ timestamp: t3, score: 30 }));
    persistSignal(store, makeSignal({ timestamp: t1, score: 10 }));
    persistSignal(store, makeSignal({ timestamp: t2, score: 20 }));
    const trend = getSignalTrend(store);
    expect(trend).toHaveLength(3);
    expect(trend[0]!.timestamp).toBe(t1);
    expect(trend[1]!.timestamp).toBe(t2);
    expect(trend[2]!.timestamp).toBe(t3);
  });

  it("AC2: trend scores reflect insertion values", () => {
    persistSignal(store, makeSignal({ timestamp: "2026-01-01T00:00:00.000Z", score: 55 }));
    persistSignal(store, makeSignal({ timestamp: "2026-01-02T00:00:00.000Z", score: 72 }));
    const trend = getSignalTrend(store);
    expect(trend[0]!.score).toBe(55);
    expect(trend[1]!.score).toBe(72);
  });

  it("AC2: empty store returns empty trend", () => {
    expect(getSignalTrend(store)).toEqual([]);
  });
});

describe("architectural-signal-store — AC3: session_id and delta_score", () => {
  let store: KnowledgeStore;

  beforeEach(() => {
    const db = new Database(":memory:");
    runMigrations(db);
    store = new KnowledgeStore(db);
  });

  it("AC3: persisted record carries session_id when provided", () => {
    const signal = makeSignal({ sessionId: "sess-abc-123" });
    const doc = persistSignal(store, signal);
    const parsed = JSON.parse(doc.content) as ArchitecturalSignalRecord;
    expect(parsed.sessionId).toBe("sess-abc-123");
  });

  it("AC3: persisted record carries delta_score when provided", () => {
    const signal = makeSignal({ deltaScore: +5.2 });
    const doc = persistSignal(store, signal);
    const parsed = JSON.parse(doc.content) as ArchitecturalSignalRecord;
    expect(parsed.deltaScore).toBeCloseTo(5.2);
  });

  it("AC3: getSignalTrend returns session_id and delta_score in parsed records", () => {
    persistSignal(store, makeSignal({ sessionId: "s1", deltaScore: -2.0 }));
    const trend = getSignalTrend(store);
    expect(trend[0]!.sessionId).toBe("s1");
    expect(trend[0]!.deltaScore).toBe(-2.0);
  });
});
