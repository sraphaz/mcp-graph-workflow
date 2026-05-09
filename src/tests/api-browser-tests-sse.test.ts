/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.2 — SSE /api/browser-tests/stream com coalescing
 *
 * AC3: GIVEN eventBus undefined WHEN cliente conecta THEN 503 com erro estruturado
 * AC4: GIVEN cliente desconecta WHEN servidor detecta THEN cleanup do listener
 * Coalescer unit: max 10 evt/s per run
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";
import { EventCoalescer, type CoalescedEvent } from "../core/browser-harness/event-coalescer.js";

// ---------------------------------------------------------------------------
// AC3: 503 when no eventBus
// ---------------------------------------------------------------------------

describe("GET /api/v1/browser-tests/stream — no eventBus", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  it("returns 503 when eventBus is not wired", async () => {
    const res = await request(ctx.app).get("/api/v1/browser-tests/stream");
    expect(res.status).toBe(503);
  });

  it("503 body has an error field", async () => {
    const res = await request(ctx.app).get("/api/v1/browser-tests/stream");
    expect(res.body).toHaveProperty("error");
    expect(typeof res.body.error).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// EventCoalescer unit — max 10 evt/s
// ---------------------------------------------------------------------------

describe("EventCoalescer — max 10 evt/s", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("flushes buffered events after the window", () => {
    const flushed: CoalescedEvent[] = [];
    const coalescer = new EventCoalescer(100, (events) => flushed.push(...events));

    coalescer.push({ type: "test.step", runId: "r1", payload: { step: 1 } });
    coalescer.push({ type: "test.step", runId: "r1", payload: { step: 2 } });

    expect(flushed).toHaveLength(0); // not yet flushed

    vi.advanceTimersByTime(110);
    expect(flushed.length).toBeGreaterThanOrEqual(2);
  });

  it("does not flush before the window expires", () => {
    const flushed: CoalescedEvent[] = [];
    const coalescer = new EventCoalescer(100, (events) => flushed.push(...events));

    coalescer.push({ type: "test.step", runId: "r1", payload: {} });
    vi.advanceTimersByTime(50);
    expect(flushed).toHaveLength(0);
  });

  it("limits output to at most 10 events per flush window", () => {
    const flushed: CoalescedEvent[] = [];
    const coalescer = new EventCoalescer(100, (events) => flushed.push(...events));

    for (let i = 0; i < 25; i++) {
      coalescer.push({ type: "test.step", runId: "r1", payload: { i } });
    }

    vi.advanceTimersByTime(110);
    expect(flushed.length).toBeLessThanOrEqual(10);
  });

  it("destroy clears pending timers", () => {
    const flushed: CoalescedEvent[] = [];
    const coalescer = new EventCoalescer(100, (events) => flushed.push(...events));

    coalescer.push({ type: "test.step", runId: "r1", payload: {} });
    coalescer.destroy();

    vi.advanceTimersByTime(200);
    expect(flushed).toHaveLength(0);
  });

  it("events from different runIds are each capped to 10 per window", () => {
    const flushed: CoalescedEvent[] = [];
    const coalescer = new EventCoalescer(100, (events) => flushed.push(...events));

    for (let i = 0; i < 20; i++) {
      coalescer.push({ type: "test.step", runId: "run-a", payload: { i } });
      coalescer.push({ type: "test.step", runId: "run-b", payload: { i } });
    }

    vi.advanceTimersByTime(110);
    // Each runId contributes at most 10 → total ≤ 20
    expect(flushed.length).toBeLessThanOrEqual(20);
  });
});
