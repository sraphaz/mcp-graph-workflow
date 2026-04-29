/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-5.T07 — learning actions tests.
 */

import { describe, it, expect } from "vitest";
import {
  actionExport,
  actionExplain,
  actionImport,
  actionRecord,
  actionRoute,
  actionStats,
  createMemoryStore,
  isReadOnlyAction,
  LEARNING_ACTIONS,
  READ_ONLY_ACTIONS,
} from "../core/learning/learning-actions.js";
import type { PerfRecord } from "../core/learning/performance-tracker.js";

function rec(
  agentId: string,
  harnessDelta: number,
  acPassed: boolean,
  cycleTimeMs: number,
  ts = 0,
): PerfRecord {
  return { agentId, nodeId: `n-${ts}`, harnessDelta, acPassed, cycleTimeMs, ts };
}

const STRONG: PerfRecord[] = Array.from({ length: 10 }, (_, i) =>
  rec("alpha", 5, true, 100, i),
);

describe("learning-actions (E5.T07)", () => {
  it("LEARNING_ACTIONS lists all 6 actions", () => {
    expect(LEARNING_ACTIONS).toHaveLength(6);
    for (const a of ["route", "record", "stats", "explain", "export", "import"]) {
      expect(LEARNING_ACTIONS).toContain(a as never);
    }
  });

  it("READ_ONLY_ACTIONS includes route/stats/explain/export and excludes record/import", () => {
    expect(READ_ONLY_ACTIONS.has("route")).toBe(true);
    expect(READ_ONLY_ACTIONS.has("stats")).toBe(true);
    expect(READ_ONLY_ACTIONS.has("explain")).toBe(true);
    expect(READ_ONLY_ACTIONS.has("export")).toBe(true);
    expect(READ_ONLY_ACTIONS.has("record")).toBe(false);
    expect(READ_ONLY_ACTIONS.has("import")).toBe(false);
  });

  it("isReadOnlyAction predicate matches the set", () => {
    expect(isReadOnlyAction("export")).toBe(true);
    expect(isReadOnlyAction("import")).toBe(false);
  });

  describe("actionRoute", () => {
    it("default strategy=manual returns fallback", () => {
      const r = actionRoute(createMemoryStore(STRONG));
      expect(r.strategy).toBe("manual");
    });

    it("strategy='sona' with strong history picks the agent", () => {
      const r = actionRoute(createMemoryStore(STRONG), "sona");
      expect(r.strategy).toBe("sona");
      expect(r.agentId).toBe("alpha");
    });

    it("rejects invalid strategy", () => {
      expect(() => actionRoute(createMemoryStore(STRONG), "auto" as never))
        .toThrow(/strategy/);
    });
  });

  describe("actionRecord", () => {
    it("appends to the store and returns the record", () => {
      const store = createMemoryStore();
      const r = actionRecord(store, rec("a", 1, true, 100));
      expect(r.agentId).toBe("a");
      expect(store.readAll()).toHaveLength(1);
    });

    it("rejects records missing agentId/nodeId or with invalid cycleTimeMs", () => {
      const store = createMemoryStore();
      expect(() => actionRecord(store, { ...rec("", 1, true, 100) })).toThrow(/agentId/);
      expect(() => actionRecord(store, { ...rec("a", 1, true, 100), nodeId: "" })).toThrow(/nodeId/);
      expect(() => actionRecord(store, { ...rec("a", 1, true, -5) })).toThrow(/cycleTimeMs/);
      expect(() => actionRecord(store, { ...rec("a", 1, true, Number.NaN) })).toThrow(/cycleTimeMs/);
    });
  });

  describe("actionStats", () => {
    it("returns totalRecords + agents", () => {
      const r = actionStats(createMemoryStore(STRONG));
      expect(r.totalRecords).toBe(STRONG.length);
      expect(r.agents).toHaveLength(1);
      expect(r.agents[0].agentId).toBe("alpha");
    });

    it("empty store returns totalRecords=0 and agents=[]", () => {
      expect(actionStats(createMemoryStore())).toEqual({ totalRecords: 0, agents: [] });
    });
  });

  describe("actionExplain", () => {
    it("returns decision + contributions + strategy field", () => {
      const r = actionExplain(createMemoryStore(STRONG), "sona");
      expect(r.strategy).toBe("sona");
      expect(r.contributions.length).toBeGreaterThan(0);
    });
  });

  describe("actionExport / actionImport", () => {
    it("round-trips records via export/import", () => {
      const src = createMemoryStore(STRONG);
      const payload = actionExport(src);
      expect(payload.schemaVersion).toBe(1);
      expect(payload.records).toHaveLength(STRONG.length);

      const dst = createMemoryStore();
      const result = actionImport(dst, payload);
      expect(result.imported).toBe(STRONG.length);
      expect(dst.readAll()).toHaveLength(STRONG.length);
    });

    it("import is atomic: invalid record rejects whole batch (store untouched)", () => {
      const dst = createMemoryStore([rec("existing", 1, true, 50)]);
      const bad = {
        schemaVersion: 1 as const,
        exportedAt: "x",
        records: [rec("ok", 1, true, 50), { ...rec("bad", 1, true, 50), agentId: "" }],
      };
      expect(() => actionImport(dst, bad)).toThrow(/agentId/);
      // Original record still intact.
      expect(dst.readAll()).toHaveLength(1);
      expect(dst.readAll()[0].agentId).toBe("existing");
    });

    it("rejects unsupported schemaVersion", () => {
      const dst = createMemoryStore();
      expect(() =>
        actionImport(dst, {
          schemaVersion: 99 as 1,
          exportedAt: "x",
          records: [],
        }),
      ).toThrow(/schemaVersion/);
    });

    it("trims to maxPerAgent when option provided", () => {
      const dst = createMemoryStore();
      const many: PerfRecord[] = [];
      for (const id of ["a", "b"]) {
        for (let i = 0; i < 10; i++) many.push(rec(id, 0, true, 10, i));
      }
      const r = actionImport(
        dst,
        { schemaVersion: 1, exportedAt: "x", records: many },
        { maxPerAgent: 3 },
      );
      expect(r.imported).toBe(6); // 3 * 2 agents
      expect(r.trimmed).toBe(many.length - 6);
    });
  });
});
