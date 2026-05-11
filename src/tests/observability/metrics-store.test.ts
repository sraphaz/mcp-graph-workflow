/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * §EPIC-observability / node_cf608ec0381b
 * Counter/histogram in-memory — RED/USE metrics
 *
 * AC1: Counter increments and reads correctly
 * AC2: Histogram records values and computes p50/p95/p99
 * AC3: getSnapshot() returns all registered counters and histograms
 * AC4: Named metrics (http.*, sqlite.*, event_bus.*, errors.*) exist and are functional
 * AC5: resetAll() zeroes all counters and histograms
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createCounter,
  createHistogram,
  getSnapshot,
  resetAll,
  httpRequestsTotal,
  httpErrorsTotal,
  httpDurationMs,
  sqliteConnectionsActive,
  eventBusQueueDepth,
  errorsRate,
} from "../../core/observability/metrics.js";

beforeEach(() => {
  resetAll();
});

// ── AC1: Counter ──────────────────────────────────────────────────────────────

describe("Counter", () => {
  it("starts at zero", () => {
    const c = createCounter("test.ac1.zero");
    expect(c.get()).toBe(0);
  });

  it("increments by 1 by default", () => {
    const c = createCounter("test.ac1.incr1");
    c.increment();
    expect(c.get()).toBe(1);
  });

  it("increments by a custom amount", () => {
    const c = createCounter("test.ac1.incrN");
    c.increment(5);
    expect(c.get()).toBe(5);
  });

  it("accumulates across multiple increments", () => {
    const c = createCounter("test.ac1.accum");
    c.increment(3);
    c.increment(2);
    expect(c.get()).toBe(5);
  });

  it("reset() zeroes the counter", () => {
    const c = createCounter("test.ac1.reset");
    c.increment(10);
    c.reset();
    expect(c.get()).toBe(0);
  });
});

// ── AC2: Histogram ────────────────────────────────────────────────────────────

describe("Histogram", () => {
  it("returns 0 for all percentiles when empty", () => {
    const h = createHistogram("test.ac2.empty");
    expect(h.percentile(0.5)).toBe(0);
    expect(h.percentile(0.95)).toBe(0);
    expect(h.percentile(0.99)).toBe(0);
  });

  it("returns the single value for all percentiles when one observation", () => {
    const h = createHistogram("test.ac2.single");
    h.observe(42);
    expect(h.percentile(0.5)).toBe(42);
    expect(h.percentile(0.95)).toBe(42);
    expect(h.percentile(0.99)).toBe(42);
  });

  it("computes p50 correctly for odd-length sorted data", () => {
    const h = createHistogram("test.ac2.p50odd");
    [10, 20, 30, 40, 50].forEach(v => h.observe(v));
    expect(h.percentile(0.5)).toBe(30);
  });

  it("computes p95 from 100 uniform samples", () => {
    const h = createHistogram("test.ac2.p95");
    for (let i = 1; i <= 100; i++) h.observe(i);
    expect(h.percentile(0.95)).toBe(95);
  });

  it("computes p99 from 100 uniform samples", () => {
    const h = createHistogram("test.ac2.p99");
    for (let i = 1; i <= 100; i++) h.observe(i);
    expect(h.percentile(0.99)).toBe(99);
  });

  it("reset() empties the histogram", () => {
    const h = createHistogram("test.ac2.histReset");
    h.observe(100);
    h.reset();
    expect(h.percentile(0.5)).toBe(0);
    expect(h.count()).toBe(0);
  });
});

// ── AC3: Snapshot ─────────────────────────────────────────────────────────────

describe("getSnapshot()", () => {
  it("includes counters created via createCounter", () => {
    const c = createCounter("snap.counter");
    c.increment(7);
    const snap = getSnapshot();
    expect(snap.counters["snap.counter"]).toBe(7);
  });

  it("includes histograms created via createHistogram", () => {
    const h = createHistogram("snap.hist");
    h.observe(100);
    const snap = getSnapshot();
    expect(snap.histograms["snap.hist"]).toBeDefined();
    expect(snap.histograms["snap.hist"].p50).toBe(100);
    expect(snap.histograms["snap.hist"].count).toBe(1);
  });

  it("snapshot is a point-in-time copy (mutations after don't affect it)", () => {
    const c = createCounter("snap.copy");
    c.increment(1);
    const snap = getSnapshot();
    c.increment(99);
    expect(snap.counters["snap.copy"]).toBe(1);
  });
});

// ── AC4: Named metrics ────────────────────────────────────────────────────────

describe("Named RED/USE metrics", () => {
  it("httpRequestsTotal is a functional counter", () => {
    httpRequestsTotal.increment(3);
    expect(httpRequestsTotal.get()).toBe(3);
  });

  it("httpErrorsTotal is a functional counter", () => {
    httpErrorsTotal.increment(1);
    expect(httpErrorsTotal.get()).toBe(1);
  });

  it("httpDurationMs is a functional histogram with p50/p95/p99", () => {
    [10, 20, 30, 40, 50].forEach(v => httpDurationMs.observe(v));
    expect(httpDurationMs.percentile(0.5)).toBe(30);
    expect(httpDurationMs.percentile(0.95)).toBeGreaterThanOrEqual(45);
    expect(httpDurationMs.percentile(0.99)).toBeGreaterThanOrEqual(48);
  });

  it("sqliteConnectionsActive is a functional counter", () => {
    sqliteConnectionsActive.increment(2);
    expect(sqliteConnectionsActive.get()).toBe(2);
  });

  it("eventBusQueueDepth is a functional counter", () => {
    eventBusQueueDepth.increment(10);
    expect(eventBusQueueDepth.get()).toBe(10);
  });

  it("errorsRate is a functional counter", () => {
    errorsRate.increment(5);
    expect(errorsRate.get()).toBe(5);
  });

  it("named metrics appear in snapshot", () => {
    httpRequestsTotal.increment(2);
    httpDurationMs.observe(50);
    const snap = getSnapshot();
    expect(snap.counters["http.requests.total"]).toBe(2);
    expect(snap.histograms["http.duration.ms"]).toBeDefined();
  });
});

// ── AC5: resetAll ─────────────────────────────────────────────────────────────

describe("resetAll()", () => {
  it("zeroes all counters", () => {
    httpRequestsTotal.increment(100);
    resetAll();
    expect(httpRequestsTotal.get()).toBe(0);
  });

  it("empties all histograms", () => {
    httpDurationMs.observe(999);
    resetAll();
    expect(httpDurationMs.percentile(0.5)).toBe(0);
    expect(httpDurationMs.count()).toBe(0);
  });
});
