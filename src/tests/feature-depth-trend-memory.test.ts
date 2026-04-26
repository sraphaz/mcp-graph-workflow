/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import {
  isoWeekOf,
  buildTrendSnapshot,
  renderTrendMarkdown,
} from "../core/feature-depth/trend-memory.js";
import { upsertBaseline } from "../core/feature-depth/baselines-store.js";

describe("isoWeekOf", () => {
  it("returns the year-week format YYYY-WNN", () => {
    expect(isoWeekOf(new Date("2026-04-26T00:00:00Z"))).toMatch(/^2026-W\d{2}$/);
  });

  it("January 1 might belong to the previous year's last week", () => {
    // 2027-01-01 is a Friday; ISO week 53 of 2026 spans Dec 28 - Jan 3.
    const w = isoWeekOf(new Date("2027-01-01T00:00:00Z"));
    expect(w === "2026-W53" || w === "2027-W01").toBe(true);
  });

  it("zero-pads single-digit weeks", () => {
    const w = isoWeekOf(new Date("2026-01-05T00:00:00Z"));
    expect(w).toMatch(/W0\d/);
  });
});

describe("buildTrendSnapshot", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("trend-test");
  });

  it("returns null when no baselines exist", () => {
    expect(buildTrendSnapshot(store.getDb())).toBeNull();
  });

  it("aggregates avg / quadrants / modules", () => {
    upsertBaseline(store.getDb(), {
      relPath: "src/core/rag/a.ts", module: "rag", score: 80,
      quadrant: "MATURE", testLoc: 100, sourceLoc: 50,
    });
    upsertBaseline(store.getDb(), {
      relPath: "src/core/rag/b.ts", module: "rag", score: 60,
      quadrant: "SPECIALIZED", testLoc: 50, sourceLoc: 50,
    });
    upsertBaseline(store.getDb(), {
      relPath: "src/core/utils/c.ts", module: "utils", score: 40,
      quadrant: "SHALLOW", testLoc: 0, sourceLoc: 80,
    });

    const snap = buildTrendSnapshot(store.getDb());
    expect(snap).not.toBeNull();
    if (!snap) return;

    expect(snap.totalFiles).toBe(3);
    expect(snap.avgScore).toBeCloseTo(60, 5);
    expect(snap.quadrants.MATURE).toBe(1);
    expect(snap.quadrants.SPECIALIZED).toBe(1);
    expect(snap.quadrants.SHALLOW).toBe(1);
    expect(snap.quadrants.INCIPIENT).toBe(0);

    const ragRow = snap.modulesByAvg.find((m) => m.module === "rag");
    expect(ragRow?.avgScore).toBe(70);
    expect(ragRow?.files).toBe(2);
  });

  it("sorts modulesByAvg descending", () => {
    upsertBaseline(store.getDb(), {
      relPath: "a.ts", module: "low", score: 30,
      quadrant: "SHALLOW", testLoc: 0, sourceLoc: 100,
    });
    upsertBaseline(store.getDb(), {
      relPath: "b.ts", module: "high", score: 90,
      quadrant: "MATURE", testLoc: 100, sourceLoc: 100,
    });
    const snap = buildTrendSnapshot(store.getDb());
    expect(snap?.modulesByAvg[0].module).toBe("high");
    expect(snap?.modulesByAvg[1].module).toBe("low");
  });

  it("bottomFiles is sorted ascending and capped at 10", () => {
    for (let i = 0; i < 15; i++) {
      upsertBaseline(store.getDb(), {
        relPath: `f${i}.ts`, module: "x", score: i * 5,
        quadrant: i * 5 < 30 ? "INCIPIENT" : "SHALLOW",
        testLoc: 0, sourceLoc: 50,
      });
    }
    const snap = buildTrendSnapshot(store.getDb());
    expect(snap?.bottomFiles).toHaveLength(10);
    expect(snap?.bottomFiles[0].score).toBeLessThan(snap?.bottomFiles[9].score ?? Infinity);
  });
});

describe("renderTrendMarkdown", () => {
  it("includes summary, modules, and bottom files sections", () => {
    const md = renderTrendMarkdown({
      date: "2026-04-26",
      isoWeek: "2026-W17",
      totalFiles: 5,
      avgScore: 65.4,
      quadrants: { MATURE: 1, SPECIALIZED: 2, SHALLOW: 1, INCIPIENT: 1 },
      modulesByAvg: [{ module: "rag", avgScore: 72, files: 3 }],
      bottomFiles: [{ relPath: "src/x/foo.ts", module: "x", score: 22 }],
    });
    expect(md).toContain("# feature-depth trend — 2026-W17");
    expect(md).toContain("Files tracked: **5**");
    expect(md).toContain("Avg score: **65.4**");
    expect(md).toContain("MATURE 1");
    expect(md).toContain("`rag`");
    expect(md).toContain("`src/x/foo.ts`");
  });
});
