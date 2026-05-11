/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-local-model-hub — Task 4.1: SSE /api/model-hub/stream
 *
 * AC1: GIVEN inference running WHEN SSE client connected THEN receives inference.started in <500ms
 * AC2: GIVEN flood > 10/s WHEN coalesce runs THEN client receives stable rate
 * AC3: GIVEN eventBus undefined WHEN client connects THEN 503 structured error
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createTestApp, type TestContext } from "./helpers/test-app.js";
import { createApiRouter } from "../api/router.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { GraphEventBus } from "../core/events/event-bus.js";
import { EventCoalescer, type CoalescedEvent } from "../core/browser-harness/event-coalescer.js";

// ── AC3: 503 when no eventBus ─────────────────────────────────────────────

describe("GET /api/v1/model-hub/stream — no eventBus", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  it("AC3: returns 503 when eventBus is not wired", async () => {
    const res = await request(ctx.app).get("/api/v1/model-hub/stream");
    expect(res.status).toBe(503);
  });

  it("AC3: 503 body has an error field", async () => {
    const res = await request(ctx.app).get("/api/v1/model-hub/stream");
    expect(res.body).toHaveProperty("error");
    expect(typeof res.body.error).toBe("string");
  });
});

// ── AC1: SSE headers when eventBus is wired ───────────────────────────────

describe("GET /api/v1/model-hub/stream — with eventBus", () => {
  it("AC1: returns text/event-stream content-type", async () => {
    const store = SqliteStore.open(":memory:");
    store.initProject("Test");
    const eventBus = new GraphEventBus();

    const app = express();
    app.use(express.json());
    app.use("/api/v1", createApiRouter({ store, eventBus }));

    const server = app.listen(0);
    const port = (server.address() as AddressInfo).port;

    await new Promise<void>((resolve, reject) => {
      const req = http.request(
        { hostname: "127.0.0.1", port, path: "/api/v1/model-hub/stream" },
        (res) => {
          expect(res.statusCode).toBe(200);
          expect(res.headers["content-type"]).toMatch(/text\/event-stream/);
          req.destroy();
          resolve();
        },
      );
      req.on("error", (e) => {
        if ((e as NodeJS.ErrnoException).code === "ECONNRESET") {
          resolve(); // expected after destroy()
        } else {
          reject(e);
        }
      });
      req.end();
    });

    server.close();
    store.close();
  });
});

// ── AC2: EventCoalescer caps 10 evt/s per backend ────────────────────────

describe("EventCoalescer — model-hub flood protection (AC2)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("AC2: limits output to ≤10 events per flush window per backend", () => {
    const flushed: CoalescedEvent[] = [];
    const coalescer = new EventCoalescer(100, (events) => flushed.push(...events));

    for (let i = 0; i < 30; i++) {
      coalescer.push({ type: "inference.started", runId: "backend-1", payload: { i } });
    }

    vi.advanceTimersByTime(110);
    expect(flushed.length).toBeLessThanOrEqual(10);
  });

  it("AC2: different backends each capped independently to 10/s", () => {
    const flushed: CoalescedEvent[] = [];
    const coalescer = new EventCoalescer(100, (events) => flushed.push(...events));

    for (let i = 0; i < 20; i++) {
      coalescer.push({ type: "inference.started", runId: "backend-A", payload: {} });
      coalescer.push({ type: "inference.completed", runId: "backend-B", payload: {} });
    }

    vi.advanceTimersByTime(110);
    expect(flushed.length).toBeLessThanOrEqual(20);
    // Each backend ≤ 10
    const aCount = flushed.filter((e) => e.runId === "backend-A").length;
    const bCount = flushed.filter((e) => e.runId === "backend-B").length;
    expect(aCount).toBeLessThanOrEqual(10);
    expect(bCount).toBeLessThanOrEqual(10);
  });

  it("AC2: model-hub event types are accepted by coalescer", () => {
    const MODEL_HUB_EVENTS = [
      "backend.online", "backend.offline", "model.loaded",
      "inference.started", "inference.completed", "inference.failed",
    ];
    const flushed: CoalescedEvent[] = [];
    const coalescer = new EventCoalescer(100, (events) => flushed.push(...events));

    for (const type of MODEL_HUB_EVENTS) {
      coalescer.push({ type, runId: "be-1", payload: {} });
    }

    vi.advanceTimersByTime(110);
    expect(flushed.length).toBe(MODEL_HUB_EVENTS.length);
  });
});
