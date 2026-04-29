/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-12.T04 — MemoryGuard heap thresholds + critical reject path.
 */

import { describe, it, expect } from "vitest";
import { MemoryGuard, MemoryPressureError } from "../core/utils/memory-guard.js";

const MB = 1024 * 1024;

function guardAt(heapMb: number, emitEvent?: unknown) {
  return new MemoryGuard({
    readHeap: () => heapMb * MB,
    emitEvent: emitEvent as never,
  });
}

describe("MemoryGuard heap pressure (E12.T04)", () => {
  it("status='ok' below 600MB", () => {
    expect(guardAt(500).check().status).toBe("ok");
  });

  it("status='warning' at >= 600MB", () => {
    expect(guardAt(600).check().status).toBe("warning");
    expect(guardAt(700).check().status).toBe("warning");
  });

  it("status='critical' at >= 800MB", () => {
    expect(guardAt(800).check().status).toBe("critical");
    expect(guardAt(950).check().status).toBe("critical");
  });

  it("check() returns heapMb computed from readHeap", () => {
    const g = guardAt(650);
    const sample = g.check();
    expect(sample.heapMb).toBeCloseTo(650, 0);
  });

  it("guardOrReject throws MemoryPressureError when critical", () => {
    expect(() => guardAt(900).guardOrReject()).toThrow(MemoryPressureError);
  });

  it("guardOrReject does NOT throw on ok or warning", () => {
    expect(() => guardAt(500).guardOrReject()).not.toThrow();
    expect(() => guardAt(700).guardOrReject()).not.toThrow();
  });

  it("emits MEMORY_PRESSURE_WARNING on ok→warning transition (only once)", () => {
    let heapMb = 500;
    const events: Array<{ event: string; payload: { heapMb: number } }> = [];
    const g = new MemoryGuard({
      readHeap: () => heapMb * MB,
      emitEvent: (event, payload) => events.push({ event, payload }),
    });
    g.check(); // ok
    heapMb = 650;
    g.check(); // ok → warning
    g.check(); // still warning, no re-emit
    expect(events.filter((e) => e.event === "MEMORY_PRESSURE_WARNING")).toHaveLength(1);
  });

  it("emits MEMORY_PRESSURE_CRITICAL on transition to critical", () => {
    let heapMb = 500;
    const events: Array<{ event: string; payload: { heapMb: number } }> = [];
    const g = new MemoryGuard({
      readHeap: () => heapMb * MB,
      emitEvent: (event, payload) => events.push({ event, payload }),
    });
    g.check();
    heapMb = 850;
    g.check();
    expect(events.some((e) => e.event === "MEMORY_PRESSURE_CRITICAL")).toBe(true);
  });

  it("does NOT re-emit warning when going from warning back to ok then warning again", () => {
    let heapMb = 500;
    const events: string[] = [];
    const g = new MemoryGuard({
      readHeap: () => heapMb * MB,
      emitEvent: (event) => events.push(event),
    });
    g.check();
    heapMb = 650;
    g.check();
    heapMb = 500;
    g.check(); // warning → ok (no event)
    heapMb = 650;
    g.check(); // ok → warning again, emit
    expect(events.filter((e) => e === "MEMORY_PRESSURE_WARNING")).toHaveLength(2);
  });

  it("MemoryPressureError carries heapMb + rejectThresholdMb", () => {
    try {
      guardAt(950).guardOrReject();
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(MemoryPressureError);
      const e = err as MemoryPressureError;
      expect(e.heapMb).toBeCloseTo(950, 0);
      expect(e.rejectThresholdMb).toBe(800);
    }
  });
});
