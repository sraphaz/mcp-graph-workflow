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
 * §Story-10 / node_563489f587dc — USE metrics wired
 *
 * AC1: Opening a SqliteStore increments sqlite.connections.active
 * AC2: Closing a SqliteStore decrements sqlite.connections.active
 * AC3: GraphEventBus.emit() increments event_bus.queue.depth
 * AC4: errorHandler invocation increments errors.rate
 */

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import {
  sqliteConnectionsActive,
  eventBusQueueDepth,
  errorsRate,
  resetAll,
} from "../core/observability/metrics.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { GraphEventBus } from "../core/events/event-bus.js";
import { errorHandler } from "../api/middleware/error-handler.js";

beforeEach(() => {
  resetAll();
});

// ── AC1: open increments sqlite.connections.active ────────────────────────────

describe("AC1: sqlite.connections.active increments on store open", () => {
  it("increments by 1 when a store is opened", () => {
    const store = SqliteStore.openDb(":memory:");
    expect(sqliteConnectionsActive.get()).toBe(1);
    store.close();
  });

  it("increments by 2 when two stores are opened", () => {
    const s1 = SqliteStore.openDb(":memory:");
    const s2 = SqliteStore.openDb(":memory:");
    expect(sqliteConnectionsActive.get()).toBe(2);
    s1.close();
    s2.close();
  });
});

// ── AC2: close decrements sqlite.connections.active ──────────────────────────

describe("AC2: sqlite.connections.active decrements on store close", () => {
  it("returns to 0 after open + close", () => {
    const store = SqliteStore.openDb(":memory:");
    store.close();
    expect(sqliteConnectionsActive.get()).toBe(0);
  });

  it("returns to 1 after two opens and one close", () => {
    const s1 = SqliteStore.openDb(":memory:");
    const s2 = SqliteStore.openDb(":memory:");
    s1.close();
    expect(sqliteConnectionsActive.get()).toBe(1);
    s2.close();
  });
});

// ── AC3: eventBusQueueDepth increments on emit ───────────────────────────────

describe("AC3: event_bus.queue.depth increments on GraphEventBus.emit()", () => {
  it("increments by 1 on first emit", () => {
    const bus = new GraphEventBus();
    bus.emit({ type: "node:created", timestamp: new Date().toISOString(), payload: {} });
    expect(eventBusQueueDepth.get()).toBe(1);
    bus.removeAllListeners();
  });

  it("increments by N after N emits", () => {
    const bus = new GraphEventBus();
    bus.emit({ type: "node:created", timestamp: new Date().toISOString(), payload: {} });
    bus.emit({ type: "node:created", timestamp: new Date().toISOString(), payload: {} });
    bus.emit({ type: "node:created", timestamp: new Date().toISOString(), payload: {} });
    expect(eventBusQueueDepth.get()).toBe(3);
    bus.removeAllListeners();
  });
});

// ── AC4: errorsRate increments in errorHandler ────────────────────────────────

describe("AC4: errors.rate increments on errorHandler invocation", () => {
  function makeApp(): express.Express {
    const app = express();
    app.use(express.json());
    app.get("/boom", () => { throw new Error("test error"); });
    app.use(errorHandler);
    return app;
  }

  it("increments by 1 after one error response", async () => {
    await request(makeApp()).get("/boom");
    expect(errorsRate.get()).toBe(1);
  });

  it("increments by 2 after two error responses", async () => {
    const app = makeApp();
    await request(app).get("/boom");
    await request(app).get("/boom");
    expect(errorsRate.get()).toBe(2);
  });
});
