/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  MemoryTelemetry,
  buildMemoryHealthReport,
} from "../core/utils/memory-telemetry.js";
import type { GraphEventType } from "../core/events/event-types.js";

afterEach(() => vi.restoreAllMocks());

const MB = 1024 * 1024;

describe("buildMemoryHealthReport()", () => {
  it("returns structured report with heap stats and level", () => {
    const report = buildMemoryHealthReport({
      readHeap: () => 400 * MB,
      agentCount: 2,
    });

    expect(report.heap.heapUsedMb).toBeCloseTo(400, 0);
    expect(report.heap.level).toBe("ok");
    expect(report.thresholds.warnMb).toBe(600);
    expect(report.thresholds.rejectMb).toBe(800);
    expect(report.agents).toBe(2);
    expect(Array.isArray(report.recommendations)).toBe(true);
  });

  it("includes restart recommendation when heap is critical", () => {
    const report = buildMemoryHealthReport({
      readHeap: () => 850 * MB,
      agentCount: 1,
    });

    expect(report.heap.level).toBe("critical");
    expect(report.recommendations.some((r) => r.includes("restart"))).toBe(true);
  });

  it("includes warning recommendation when heap is warning", () => {
    const report = buildMemoryHealthReport({
      readHeap: () => 650 * MB,
      agentCount: 0,
    });

    expect(report.heap.level).toBe("warning");
    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  it("empty recommendations when heap is ok", () => {
    const report = buildMemoryHealthReport({
      readHeap: () => 200 * MB,
      agentCount: 0,
    });

    expect(report.heap.level).toBe("ok");
    expect(report.recommendations).toHaveLength(0);
  });
});

describe("MemoryTelemetry — event emission on thresholds", () => {
  it("emits memory:pressure_warning event when heap crosses 600MB", () => {
    let emittedType: string | null = null;
    const mockBus = { emit: vi.fn((event: { type: string }) => { emittedType = event.type; }) };

    const telemetry = new MemoryTelemetry({
      readHeap: () => 650 * MB,
      eventBus: mockBus as never,
    });

    telemetry.check();

    expect(mockBus.emit).toHaveBeenCalled();
    expect(emittedType).toBe("memory:pressure_warning");
  });

  it("emits memory:pressure_critical event when heap crosses 800MB", () => {
    let emittedType: string | null = null;
    const mockBus = { emit: vi.fn((event: { type: string }) => { emittedType = event.type; }) };

    const telemetry = new MemoryTelemetry({
      readHeap: () => 900 * MB,
      eventBus: mockBus as never,
    });

    telemetry.check();

    expect(mockBus.emit).toHaveBeenCalled();
    expect(emittedType).toBe("memory:pressure_critical");
  });

  it("does not emit events when heap is ok", () => {
    const mockBus = { emit: vi.fn((_event: { type: string }) => {}) };

    const telemetry = new MemoryTelemetry({
      readHeap: () => 300 * MB,
      eventBus: mockBus as never,
    });

    telemetry.check();

    expect(mockBus.emit).not.toHaveBeenCalled();
  });

  it("start() returns a cleanup function that stops the timer", () => {
    vi.useFakeTimers();
    const mockBus = { emit: vi.fn((_event: { type: string }) => {}) };

    const telemetry = new MemoryTelemetry({
      readHeap: () => 300 * MB,
      eventBus: mockBus as never,
      intervalMs: 1000,
    });

    const stop = telemetry.start();
    vi.advanceTimersByTime(3500);
    stop();
    const callsBefore = mockBus.emit.mock.calls.length;
    vi.advanceTimersByTime(3000);
    expect(mockBus.emit.mock.calls.length).toBe(callsBefore);

    vi.useRealTimers();
  });
});

describe("GraphEventType — memory pressure events exist", () => {
  it("memory:pressure_warning is a valid GraphEventType", () => {
    const type: GraphEventType = "memory:pressure_warning";
    expect(type).toBe("memory:pressure_warning");
  });

  it("memory:pressure_critical is a valid GraphEventType", () => {
    const type: GraphEventType = "memory:pressure_critical";
    expect(type).toBe("memory:pressure_critical");
  });
});
