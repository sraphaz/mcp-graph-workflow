/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-12.T08 — heap telemetry tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  HeapTelemetry,
  memoryHealth,
  recommendForSnapshot,
  TELEMETRY_INTERVAL_MS,
} from "../core/observability/heap-telemetry.js";

describe("heap-telemetry (E12.T08)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("TELEMETRY_INTERVAL_MS = 30_000", () => {
    expect(TELEMETRY_INTERVAL_MS).toBe(30_000);
  });

  describe("recommendForSnapshot", () => {
    it("flags heap > 500MB", () => {
      const recs = recommendForSnapshot({ heapMB: 600, externalMB: 0, rssMB: 200, ts: 0 });
      expect(recs.join(" ")).toContain("batch size");
    });

    it("flags rss > 1GB", () => {
      const recs = recommendForSnapshot({ heapMB: 100, externalMB: 0, rssMB: 1500, ts: 0 });
      expect(recs.join(" ")).toContain("restart daemon");
    });

    it("flags external > 200MB", () => {
      const recs = recommendForSnapshot({ heapMB: 100, externalMB: 250, rssMB: 200, ts: 0 });
      expect(recs.join(" ")).toContain("Buffers");
    });

    it("returns 'memory healthy' when nothing flagged", () => {
      const recs = recommendForSnapshot({ heapMB: 100, externalMB: 50, rssMB: 200, ts: 0 });
      expect(recs).toEqual(["memory healthy"]);
    });

    it("can flag multiple recommendations simultaneously", () => {
      const recs = recommendForSnapshot({ heapMB: 600, externalMB: 250, rssMB: 1500, ts: 0 });
      expect(recs.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("memoryHealth", () => {
    it("returns snapshot + recommendations from sampler", () => {
      const r = memoryHealth(() => ({ heapMB: 100, externalMB: 50, rssMB: 200, ts: 1000 }));
      expect(r.heapMB).toBe(100);
      expect(r.recommendations).toBeDefined();
    });
  });

  describe("HeapTelemetry", () => {
    it("start sets up interval that emits at every tick", () => {
      const emitted: number[] = [];
      let now = 0;
      const t = new HeapTelemetry(
        () => ({ heapMB: now, externalMB: 0, rssMB: 0, ts: now }),
        (snap) => emitted.push(snap.heapMB),
        100,
      );
      t.start();
      now = 1; vi.advanceTimersByTime(100);
      now = 2; vi.advanceTimersByTime(100);
      now = 3; vi.advanceTimersByTime(100);
      expect(emitted).toEqual([1, 2, 3]);
      t.stop();
    });

    it("stop clears the interval (no further emits)", () => {
      const emitted: number[] = [];
      const t = new HeapTelemetry(
        () => ({ heapMB: 1, externalMB: 0, rssMB: 0, ts: 0 }),
        (s) => emitted.push(s.heapMB),
        50,
      );
      t.start();
      vi.advanceTimersByTime(50);
      expect(emitted).toHaveLength(1);
      t.stop();
      vi.advanceTimersByTime(500);
      expect(emitted).toHaveLength(1);
    });

    it("start is idempotent (calling twice does not double-tick)", () => {
      const emitted: number[] = [];
      const t = new HeapTelemetry(
        () => ({ heapMB: 1, externalMB: 0, rssMB: 0, ts: 0 }),
        (s) => emitted.push(s.heapMB),
        100,
      );
      t.start();
      t.start();
      vi.advanceTimersByTime(100);
      expect(emitted).toHaveLength(1);
      t.stop();
    });

    it("emitter throwing does not crash the loop", () => {
      const t = new HeapTelemetry(
        () => ({ heapMB: 1, externalMB: 0, rssMB: 0, ts: 0 }),
        () => {
          throw new Error("boom");
        },
        50,
      );
      t.start();
      expect(() => vi.advanceTimersByTime(150)).not.toThrow();
      t.stop();
    });

    it("isRunning reflects timer state", () => {
      const t = new HeapTelemetry();
      expect(t.isRunning()).toBe(false);
      t.start();
      expect(t.isRunning()).toBe(true);
      t.stop();
      expect(t.isRunning()).toBe(false);
    });
  });
});
