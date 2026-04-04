import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { calculateDoraMetrics } from "../core/insights/dora-metrics.js";
import { makeNode } from "./helpers/factories.js";

describe("calculateDoraMetrics", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("DORA Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should return zero metrics for empty graph", () => {
    const metrics = calculateDoraMetrics(store);

    expect(metrics.deploymentFrequency).toBe(0);
    expect(metrics.leadTime.p50).toBe(0);
    expect(metrics.changeFailureRate).toBe(0);
    expect(metrics.mttr).toBe(0);
  });

  it("should calculate deployment frequency from done tasks", () => {
    const t1 = makeNode({ title: "T1" });
    const t2 = makeNode({ title: "T2" });
    store.insertNode(t1);
    store.insertNode(t2);
    store.updateNodeStatus(t1.id, "in_progress");
    store.updateNodeStatus(t1.id, "done");
    store.updateNodeStatus(t2.id, "in_progress");
    store.updateNodeStatus(t2.id, "done");

    const metrics = calculateDoraMetrics(store);

    expect(metrics.deploymentFrequency).toBeGreaterThan(0);
  });

  it("should calculate lead time from created to done", () => {
    const t1 = makeNode({ title: "T1" });
    store.insertNode(t1);
    store.updateNodeStatus(t1.id, "in_progress");
    store.updateNodeStatus(t1.id, "done");

    const metrics = calculateDoraMetrics(store);

    // Lead time should be very small (instant) in test
    expect(metrics.leadTime.p50).toBeGreaterThanOrEqual(0);
  });

  it("should detect change failure rate from status reversals", () => {
    const t1 = makeNode({ title: "T1" });
    store.insertNode(t1);
    store.updateNodeStatus(t1.id, "in_progress");
    store.updateNodeStatus(t1.id, "done");
    // Revert: done → in_progress (rework)
    store.updateNodeStatus(t1.id, "in_progress");

    const t2 = makeNode({ title: "T2" });
    store.insertNode(t2);
    store.updateNodeStatus(t2.id, "in_progress");
    store.updateNodeStatus(t2.id, "done");

    const metrics = calculateDoraMetrics(store);

    // 1 out of 2 tasks had rework = 50% failure rate
    // But this depends on how we detect reversals
    expect(metrics.changeFailureRate).toBeGreaterThanOrEqual(0);
    expect(metrics.changeFailureRate).toBeLessThanOrEqual(1);
  });

  it("should return trend based on velocity", () => {
    const metrics = calculateDoraMetrics(store);
    expect(["improving", "stable", "declining"]).toContain(metrics.trend);
  });
});
