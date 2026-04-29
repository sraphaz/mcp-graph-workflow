/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.B3 — cost auto-fallback tests.
 */

import { describe, it, expect } from "vitest";
import {
  shouldEngageCostFallback,
  applyCostFallback,
  isCostFallbackDisabled,
  COST_FALLBACK_THRESHOLD,
  FALLBACK_MODEL,
} from "../core/autonomy/cost-fallback.js";

describe("cost-fallback (E22.B3)", () => {
  it("COST_FALLBACK_THRESHOLD = 0.8", () => {
    expect(COST_FALLBACK_THRESHOLD).toBe(0.8);
  });

  it("FALLBACK_MODEL is haiku", () => {
    expect(FALLBACK_MODEL).toBe("haiku");
  });

  it("engages when ratio > threshold (81% spend)", () => {
    const d = shouldEngageCostFallback({ totalUsd: 0.081, capUsdPerRun: 0.1 });
    expect(d.engage).toBe(true);
    expect(d.reason).toBe("threshold_exceeded");
    expect(d.ratio).toBeCloseTo(0.81);
  });

  it("does NOT engage at exactly 80% (boundary, strictly greater than)", () => {
    const d = shouldEngageCostFallback({ totalUsd: 0.08, capUsdPerRun: 0.1 });
    expect(d.engage).toBe(false);
    expect(d.reason).toBe("below_threshold");
  });

  it("does NOT engage when no cap configured", () => {
    const d = shouldEngageCostFallback({ totalUsd: 100, capUsdPerRun: undefined });
    expect(d.engage).toBe(false);
    expect(d.reason).toBe("no_cap");
  });

  it("does NOT engage when cap is 0 or negative", () => {
    expect(shouldEngageCostFallback({ totalUsd: 1, capUsdPerRun: 0 }).engage).toBe(false);
    expect(shouldEngageCostFallback({ totalUsd: 1, capUsdPerRun: -1 }).engage).toBe(false);
  });

  it("supports custom threshold", () => {
    const d = shouldEngageCostFallback({ totalUsd: 0.06, capUsdPerRun: 0.1, threshold: 0.5 });
    expect(d.engage).toBe(true);
  });

  it("applyCostFallback mutates payload.modelHint to haiku when engaged", () => {
    const payload: { modelHint?: string } = { modelHint: "sonnet" };
    const result = applyCostFallback(payload, { engage: true, ratio: 0.85, reason: "threshold_exceeded" });
    expect(payload.modelHint).toBe("haiku");
    expect(result.engaged).toBe(true);
    expect(result.originalModel).toBe("sonnet");
    expect(result.fallbackModel).toBe("haiku");
  });

  it("applyCostFallback does NOT mutate payload when decision is no engage", () => {
    const payload: { modelHint?: string } = { modelHint: "opus" };
    const result = applyCostFallback(payload, { engage: false, ratio: 0.5, reason: "below_threshold" });
    expect(payload.modelHint).toBe("opus");
    expect(result.engaged).toBe(false);
  });

  it("isCostFallbackDisabled respects env var MCP_GRAPH_COST_FALLBACK=off", () => {
    expect(isCostFallbackDisabled({ MCP_GRAPH_COST_FALLBACK: "off" })).toBe(true);
    expect(isCostFallbackDisabled({ MCP_GRAPH_COST_FALLBACK: "on" })).toBe(false);
    expect(isCostFallbackDisabled({})).toBe(false);
  });
});
