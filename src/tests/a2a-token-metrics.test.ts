/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 20 — A2A Direct Communication (E20.T06).
 * Tests for token-cost reduction metrics on context handoff.
 */

import { describe, it, expect } from "vitest";
import {
  HandoffMetrics,
  type HandoffSample,
} from "../core/swarm/a2a-token-metrics.js";

describe("A2A token metrics (E20.T06)", () => {
  it("empty metrics report zeros and reductionPercent=0", () => {
    const m = new HandoffMetrics();
    const r = m.summary();
    expect(r.totalHandoffs).toBe(0);
    expect(r.tokensSaved).toBe(0);
    expect(r.reductionPercent).toBe(0);
  });

  it("graph handoffs accumulate cost; A2A handoffs are zero-cost (re-read avoided)", () => {
    const m = new HandoffMetrics();
    m.record({ path: "graph", contextTokens: 1000 });
    m.record({ path: "graph", contextTokens: 2000 });
    m.record({ path: "a2a", contextTokens: 1500 });
    const r = m.summary();
    expect(r.graphTokens).toBe(3000);
    expect(r.a2aSavedTokens).toBe(1500);
    expect(r.totalHandoffs).toBe(3);
  });

  it("reductionPercent = a2aSaved / (a2aSaved + graphTokens) * 100", () => {
    const m = new HandoffMetrics();
    m.record({ path: "a2a", contextTokens: 1000 });
    m.record({ path: "graph", contextTokens: 1000 });
    const r = m.summary();
    expect(r.reductionPercent).toBeCloseTo(50);
  });

  it("graph-fallback path counts as graph cost (still requires re-read)", () => {
    const m = new HandoffMetrics();
    m.record({ path: "graph-fallback", contextTokens: 500 });
    const r = m.summary();
    expect(r.graphTokens).toBe(500);
    expect(r.a2aSavedTokens).toBe(0);
  });

  it("estimateCostUsd applies per-token rate to saved tokens", () => {
    const m = new HandoffMetrics();
    m.record({ path: "a2a", contextTokens: 100_000 });
    m.record({ path: "a2a", contextTokens: 100_000 });
    const r = m.summary({ pricePerKToken: 0.001 });
    expect(r.savedCostUsd).toBeCloseTo(0.2);
  });

  it("samples() returns recorded handoffs in insertion order", () => {
    const m = new HandoffMetrics();
    const a: HandoffSample = { path: "a2a", contextTokens: 100 };
    const b: HandoffSample = { path: "graph", contextTokens: 200 };
    m.record(a);
    m.record(b);
    expect(m.samples()).toEqual([a, b]);
  });

  it("reset clears all samples", () => {
    const m = new HandoffMetrics();
    m.record({ path: "a2a", contextTokens: 100 });
    m.reset();
    expect(m.samples()).toEqual([]);
    expect(m.summary().totalHandoffs).toBe(0);
  });
});
