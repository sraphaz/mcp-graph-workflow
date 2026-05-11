/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

/**
 * §Story-10 / node_82ebe2869374 — AC ratification: skill reporta RED 3/3, USE 3/3
 *
 * RED 3/3: http.requests.total, http.errors.total, http.duration.ms (p50/p95/p99)
 * USE 3/3: sqlite.connections.active, event_bus.queue.depth, errors.rate
 *
 * All 6 metrics are registered in the global registry. This test confirms
 * getSnapshot() returns all 6 metric keys — no new code needed, just ratification.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  getSnapshot,
  resetAll,
} from "../core/observability/metrics.js";

beforeEach(() => {
  resetAll();
});

const RED_COUNTERS = ["http.requests.total", "http.errors.total"];
const RED_HISTOGRAMS = ["http.duration.ms"];
const USE_COUNTERS = ["sqlite.connections.active", "event_bus.queue.depth", "errors.rate"];

describe("Story 10 AC — RED 3/3 metrics registered", () => {
  it("RED counter keys are present in snapshot", () => {
    const snap = getSnapshot();
    for (const key of RED_COUNTERS) {
      expect(snap.counters).toHaveProperty(key);
    }
  });

  it("RED histogram (duration) is present in snapshot with p50/p95/p99", () => {
    const snap = getSnapshot();
    for (const key of RED_HISTOGRAMS) {
      expect(snap.histograms).toHaveProperty(key);
      const h = snap.histograms[key]!;
      expect(typeof h.p50).toBe("number");
      expect(typeof h.p95).toBe("number");
      expect(typeof h.p99).toBe("number");
    }
  });
});

describe("Story 10 AC — USE 3/3 metrics registered", () => {
  it("USE counter keys are present in snapshot", () => {
    const snap = getSnapshot();
    for (const key of USE_COUNTERS) {
      expect(snap.counters).toHaveProperty(key);
    }
  });
});

describe("Story 10 AC — full 6-metric coverage", () => {
  it("snapshot contains all 6 RED+USE metric keys", () => {
    const snap = getSnapshot();
    const allKeys = [...Object.keys(snap.counters), ...Object.keys(snap.histograms)];
    const required = [...RED_COUNTERS, ...RED_HISTOGRAMS, ...USE_COUNTERS];
    for (const key of required) {
      expect(allKeys).toContain(key);
    }
    expect(allKeys.length).toBeGreaterThanOrEqual(6);
  });
});
