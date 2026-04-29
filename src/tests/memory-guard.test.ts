/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  MemoryGuard,
  HEAVY_TOOLS,
  type MemoryPressureLevel,
} from "../core/utils/memory-guard.js";

afterEach(() => vi.restoreAllMocks());

const MB = 1024 * 1024;

function makeGuard(heapMb: number): MemoryGuard {
  return new MemoryGuard({
    warnThresholdMb: 600,
    rejectThresholdMb: 800,
    readHeap: () => heapMb * MB,
  });
}

describe("MemoryGuard — pressure detection", () => {
  it("returns 'ok' when heap is below warn threshold", () => {
    const guard = makeGuard(400);
    expect(guard.pressureLevel()).toBe<MemoryPressureLevel>("ok");
  });

  it("returns 'warning' when heap is at or above 600MB", () => {
    expect(makeGuard(600).pressureLevel()).toBe<MemoryPressureLevel>("warning");
    expect(makeGuard(750).pressureLevel()).toBe<MemoryPressureLevel>("warning");
  });

  it("returns 'critical' when heap is at or above 800MB", () => {
    expect(makeGuard(800).pressureLevel()).toBe<MemoryPressureLevel>("critical");
    expect(makeGuard(1200).pressureLevel()).toBe<MemoryPressureLevel>("critical");
  });
});

describe("MemoryGuard — checkForTool()", () => {
  it("returns null for a heavy tool when heap is ok", () => {
    const guard = makeGuard(300);
    expect(guard.checkForTool("context")).toBeNull();
    expect(guard.checkForTool("analyze")).toBeNull();
  });

  it("returns MEMORY_PRESSURE error for heavy tool when heap ≥ 800MB", () => {
    const guard = makeGuard(850);
    const result = guard.checkForTool("context");
    expect(result).not.toBeNull();
    expect(result?.isError).toBe(true);
    expect(result?.content[0].text).toContain("MEMORY_PRESSURE");
    expect(result?.content[0].text).toContain("850MB");
    expect(result?.content[0].text).toContain("800MB");
    expect(result?.content[0].text).toContain("restart");
  });

  it("returns null for a light tool even when heap ≥ 800MB", () => {
    const guard = makeGuard(900);
    // Light tools are NOT in HEAVY_TOOLS list
    expect(guard.checkForTool("node")).toBeNull();
    expect(guard.checkForTool("list")).toBeNull();
    expect(guard.checkForTool("show")).toBeNull();
    expect(guard.checkForTool("update_status")).toBeNull();
  });

  it("error message includes restart instructions", () => {
    const guard = makeGuard(900);
    const result = guard.checkForTool("search");
    expect(result?.content[0].text).toContain("mcp-graph daemon restart");
  });
});

describe("MemoryGuard — snapshot()", () => {
  it("returns structured snapshot with heap stats", () => {
    const guard = makeGuard(450);
    const snap = guard.snapshot();
    expect(snap.heapUsedMb).toBeCloseTo(450, 0);
    expect(snap.warnThresholdMb).toBe(600);
    expect(snap.rejectThresholdMb).toBe(800);
    expect(snap.level).toBe("ok");
  });
});

describe("HEAVY_TOOLS constant", () => {
  it("includes the expected heavy tool names", () => {
    expect(HEAVY_TOOLS).toContain("context");
    expect(HEAVY_TOOLS).toContain("analyze");
    expect(HEAVY_TOOLS).toContain("search");
    expect(HEAVY_TOOLS).toContain("export");
  });

  it("does NOT include light tools", () => {
    expect(HEAVY_TOOLS).not.toContain("node");
    expect(HEAVY_TOOLS).not.toContain("list");
    expect(HEAVY_TOOLS).not.toContain("show");
    expect(HEAVY_TOOLS).not.toContain("update_status");
  });
});
