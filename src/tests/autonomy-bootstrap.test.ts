/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22 — autonomy bootstrap tests.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import { bootstrapAutonomy } from "../core/autonomy/autonomy-bootstrap.js";
import type { ReactorBus } from "../core/autonomy/event-reactor.js";

function makeBus(): ReactorBus & {
  handlers: Map<string, Array<(payload: unknown) => void | Promise<void>>>;
} {
  const handlers = new Map<string, Array<(payload: unknown) => void | Promise<void>>>();
  return {
    handlers,
    on(event, handler) {
      const arr = handlers.get(event) ?? [];
      arr.push(handler);
      handlers.set(event, arr);
    },
    async emit(event, payload) {
      for (const h of handlers.get(event) ?? []) {
        await h(payload);
      }
    },
  };
}

describe("autonomy-bootstrap", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it("starts the autonomy stack and reports running=true", () => {
    const handle = bootstrapAutonomy({
      db,
      bus: makeBus(),
      retryExecutor: async () => {},
      dispatcher: async () => {},
      env: {},
    });
    expect(handle.isRunning()).toBe(true);
    expect(handle.retryWorker).toBeDefined();
    expect(handle.scheduler).toBeDefined();
    expect(handle.reactor).toBeDefined();
    handle.stop();
    expect(handle.isRunning()).toBe(false);
  });

  it("registers EventReactor handlers on the bus", () => {
    const bus = makeBus();
    const handle = bootstrapAutonomy({
      db,
      bus,
      retryExecutor: async () => {},
      dispatcher: async () => {},
      env: {},
    });
    expect(bus.handlers.has("cost:budget_exceeded")).toBe(true);
    expect(bus.handlers.has("error:retry_exhausted")).toBe(true);
    handle.stop();
  });

  it("does NOT start scheduler when MCP_GRAPH_AUTOPILOT_PAUSED='true'", () => {
    let dispatched = 0;
    const handle = bootstrapAutonomy({
      db,
      bus: makeBus(),
      retryExecutor: async () => {},
      dispatcher: async () => {
        dispatched++;
      },
      env: { MCP_GRAPH_AUTOPILOT_PAUSED: "true" } as NodeJS.ProcessEnv,
      schedulerTickMs: 10,
    });
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(dispatched).toBe(0);
        handle.stop();
        resolve();
      }, 50);
    });
  });

  it("stop() is idempotent", () => {
    const handle = bootstrapAutonomy({
      db,
      bus: makeBus(),
      retryExecutor: async () => {},
      dispatcher: async () => {},
      env: {},
    });
    handle.stop();
    handle.stop(); // should not throw
    expect(handle.isRunning()).toBe(false);
  });

  it("retryWorker uses provided retryIntervalMs", async () => {
    const handle = bootstrapAutonomy({
      db,
      bus: makeBus(),
      retryExecutor: async () => {},
      dispatcher: async () => {},
      env: { MCP_GRAPH_AUTOPILOT_PAUSED: "true" } as NodeJS.ProcessEnv,
      retryIntervalMs: 50,
    });
    expect(handle.retryWorker).toBeDefined();
    handle.stop();
  });
});
