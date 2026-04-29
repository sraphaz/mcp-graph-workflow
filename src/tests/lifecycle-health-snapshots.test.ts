/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §SprintD — Lifecycle Health Snapshots store + success_rate.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import {
  recordSnapshot,
  computeSuccessRate,
} from "../core/analyzer/lifecycle-health-snapshots.js";
import type { LifecycleHealthReport } from "../core/analyzer/prd-lifecycle-health.js";

function fakeReport(epicId: string | null, passedAll: boolean): LifecycleHealthReport {
  return {
    epicId: epicId ?? "",
    phases: {} as LifecycleHealthReport["phases"],
    passedCount: passedAll ? 9 : 5,
    passedAll,
    summary: passedAll ? "all green" : "some red",
  };
}

describe("lifecycle-health-snapshots", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("snapshot-test");
  });

  afterEach(() => {
    store.close();
  });

  it("recordSnapshot persists the report and exposes passedAll", () => {
    const snap = recordSnapshot(store.getDb(), fakeReport("epic-1", true));
    expect(snap.passedAll).toBe(true);
    expect(snap.epicId).toBe("epic-1");
    const row = store
      .getDb()
      .prepare("SELECT passed_all, epic_id FROM lifecycle_health_snapshots WHERE id = ?")
      .get(snap.id) as { passed_all: number; epic_id: string };
    expect(row.passed_all).toBe(1);
    expect(row.epic_id).toBe("epic-1");
  });

  it("recordSnapshot is idempotent per (epic_id, day) — same-day re-runs collapse to one row", () => {
    const day = "2026-04-29T08:00:00.000Z";
    recordSnapshot(store.getDb(), fakeReport("epic-1", false), day);
    recordSnapshot(
      store.getDb(),
      fakeReport("epic-1", true),
      "2026-04-29T18:00:00.000Z",
    );
    const rows = store
      .getDb()
      .prepare("SELECT passed_all FROM lifecycle_health_snapshots WHERE epic_id = ?")
      .all("epic-1") as Array<{ passed_all: number }>;
    expect(rows).toHaveLength(1);
    // Last write wins.
    expect(rows[0].passed_all).toBe(1);
  });

  it("recordSnapshot keeps separate rows per day", () => {
    recordSnapshot(store.getDb(), fakeReport("epic-1", true), "2026-04-28T12:00:00.000Z");
    recordSnapshot(store.getDb(), fakeReport("epic-1", false), "2026-04-29T12:00:00.000Z");
    const rows = store
      .getDb()
      .prepare("SELECT passed_all FROM lifecycle_health_snapshots WHERE epic_id = ?")
      .all("epic-1");
    expect(rows).toHaveLength(2);
  });

  it("computeSuccessRate returns zero samples when no snapshots exist", () => {
    const r = computeSuccessRate(store.getDb());
    expect(r.samples).toBe(0);
    expect(r.successRate).toBe(0);
    expect(r.latestPassedAll).toBeNull();
  });

  it("computeSuccessRate counts passes over the most recent N", () => {
    // 3 fail + 2 pass over 5 days
    const days = [
      "2026-04-25T12:00:00.000Z",
      "2026-04-26T12:00:00.000Z",
      "2026-04-27T12:00:00.000Z",
      "2026-04-28T12:00:00.000Z",
      "2026-04-29T12:00:00.000Z",
    ];
    const passes = [false, false, true, false, true];
    for (let i = 0; i < days.length; i++) {
      recordSnapshot(store.getDb(), fakeReport("epic-1", passes[i]), days[i]);
    }
    const r = computeSuccessRate(store.getDb(), { window: 5 });
    expect(r.samples).toBe(5);
    expect(r.passed).toBe(2);
    expect(r.successRate).toBeCloseTo(0.4, 5);
    expect(r.latestPassedAll).toBe(true);
  });

  it("computeSuccessRate window caps the lookback", () => {
    const days = ["2026-04-25", "2026-04-26", "2026-04-27", "2026-04-28", "2026-04-29"]
      .map((d) => `${d}T12:00:00.000Z`);
    for (let i = 0; i < days.length; i++) {
      recordSnapshot(store.getDb(), fakeReport(`e${i}`, i % 2 === 0), days[i]);
    }
    const r = computeSuccessRate(store.getDb(), { window: 3 });
    expect(r.samples).toBe(3);
  });

  it("computeSuccessRate scopes to a specific epic when epicId is provided", () => {
    recordSnapshot(store.getDb(), fakeReport("epic-A", true), "2026-04-28T12:00:00.000Z");
    recordSnapshot(store.getDb(), fakeReport("epic-B", false), "2026-04-29T12:00:00.000Z");
    const r = computeSuccessRate(store.getDb(), { epicId: "epic-A" });
    expect(r.samples).toBe(1);
    expect(r.passed).toBe(1);
  });
});
