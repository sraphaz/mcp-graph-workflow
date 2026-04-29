/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.C3 — autonomic scaling tests.
 */

import { describe, it, expect } from "vitest";
import {
  targetSizeForTask,
  shouldScaleDown,
  getPoolMax,
  SIZE_TO_AGENTS,
  DEFAULT_POOL_MAX,
  POOL_MIN_IDLE,
  IDLE_SCALEDOWN_MS,
} from "../core/autonomy/autonomic-scaling.js";

describe("autonomic-scaling (E22.C3)", () => {
  it("SIZE_TO_AGENTS mapping is XS:1, S:1, M:2, L:3, XL:4", () => {
    expect(SIZE_TO_AGENTS).toEqual({ XS: 1, S: 1, M: 2, L: 3, XL: 4 });
  });

  it("DEFAULT_POOL_MAX = 8, POOL_MIN_IDLE = 2, IDLE_SCALEDOWN_MS = 5min", () => {
    expect(DEFAULT_POOL_MAX).toBe(8);
    expect(POOL_MIN_IDLE).toBe(2);
    expect(IDLE_SCALEDOWN_MS).toBe(5 * 60 * 1000);
  });

  it("scenario: enqueue [XS, M, L] sequentially → pool sizes 1, 2, 3", () => {
    let size = 1;
    size = targetSizeForTask({ xpSize: "XS", currentSize: size });
    expect(size).toBe(1);
    size = targetSizeForTask({ xpSize: "M", currentSize: size });
    expect(size).toBe(2);
    size = targetSizeForTask({ xpSize: "L", currentSize: size });
    expect(size).toBe(3);
  });

  it("does NOT shrink: M task on size=4 keeps size=4", () => {
    expect(targetSizeForTask({ xpSize: "M", currentSize: 4 })).toBe(4);
  });

  it("caps at poolMax", () => {
    expect(targetSizeForTask({ xpSize: "XL", currentSize: 1, poolMax: 3 })).toBe(3);
  });

  it("returns currentSize (≥1) when no xpSize given", () => {
    expect(targetSizeForTask({ currentSize: 5 })).toBe(5);
    expect(targetSizeForTask({ currentSize: 0 })).toBe(1);
  });

  it("getPoolMax respects MCP_GRAPH_AGENT_POOL_MAX env var", () => {
    expect(getPoolMax({ MCP_GRAPH_AGENT_POOL_MAX: "12" })).toBe(12);
    expect(getPoolMax({})).toBe(8);
    expect(getPoolMax({ MCP_GRAPH_AGENT_POOL_MAX: "invalid" })).toBe(8);
    expect(getPoolMax({ MCP_GRAPH_AGENT_POOL_MAX: "0" })).toBe(8);
  });

  it("shouldScaleDown: idle > 5min AND currentSize > 2 → target=2", () => {
    const r = shouldScaleDown({ currentSize: 5, idleMs: 6 * 60 * 1000 });
    expect(r).toEqual({ down: true, targetSize: 2 });
  });

  it("shouldScaleDown: idle < threshold → no change", () => {
    const r = shouldScaleDown({ currentSize: 5, idleMs: 60_000 });
    expect(r).toEqual({ down: false, targetSize: 5 });
  });

  it("shouldScaleDown: respects POOL_MIN_IDLE — does NOT scale below min", () => {
    const r = shouldScaleDown({ currentSize: 2, idleMs: 60 * 60 * 1000 });
    expect(r).toEqual({ down: false, targetSize: 2 });
  });

  it("shouldScaleDown supports custom poolMin and threshold", () => {
    const r = shouldScaleDown({ currentSize: 4, idleMs: 1000, poolMin: 1, idleThresholdMs: 500 });
    expect(r).toEqual({ down: true, targetSize: 1 });
  });
});
