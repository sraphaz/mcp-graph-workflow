/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22 — daemon autonomy wiring tests.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import {
  isAutonomyEnabled,
  maybeStartDaemonAutonomy,
  toReactorBus,
} from "../core/autonomy/daemon-autonomy-wiring.js";

function makeBus() {
  const handlers = new Map<string, Array<(payload: unknown) => void | Promise<void>>>();
  const emitted: Array<{ event: string; payload: unknown }> = [];
  return {
    handlers,
    emitted,
    on(event: string, handler: (payload: unknown) => void | Promise<void>) {
      const arr = handlers.get(event) ?? [];
      arr.push(handler);
      handlers.set(event, arr);
    },
    emit(event: string, payload?: unknown) {
      emitted.push({ event, payload });
    },
  };
}

describe("daemon-autonomy-wiring", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  describe("isAutonomyEnabled", () => {
    it("returns true ONLY when MCP_GRAPH_AUTONOMY === 'on'", () => {
      expect(isAutonomyEnabled({ MCP_GRAPH_AUTONOMY: "on" })).toBe(true);
      expect(isAutonomyEnabled({ MCP_GRAPH_AUTONOMY: "true" })).toBe(false);
      expect(isAutonomyEnabled({ MCP_GRAPH_AUTONOMY: "" })).toBe(false);
      expect(isAutonomyEnabled({})).toBe(false);
    });
  });

  describe("toReactorBus", () => {
    it("forwards on() to underlying bus", () => {
      const bus = makeBus();
      const reactor = toReactorBus(bus);
      reactor.on("x", () => {});
      expect(bus.handlers.has("x")).toBe(true);
    });

    it("returns a Promise for emit()", () => {
      const bus = makeBus();
      const reactor = toReactorBus(bus);
      const result = reactor.emit("x", { a: 1 });
      expect(result).toBeInstanceOf(Promise);
      return result;
    });

    it("survives a throwing emit() without rethrowing", async () => {
      const bus = {
        on() {},
        emit() {
          throw new Error("boom");
        },
      };
      const reactor = toReactorBus(bus);
      await expect(reactor.emit("x", null)).resolves.toBeUndefined();
    });
  });

  describe("maybeStartDaemonAutonomy", () => {
    it("returns undefined when MCP_GRAPH_AUTONOMY is not 'on'", () => {
      const result = maybeStartDaemonAutonomy({
        db,
        bus: makeBus(),
        env: {} as NodeJS.ProcessEnv,
      });
      expect(result).toBeUndefined();
    });

    it("returns AutonomyHandle when MCP_GRAPH_AUTONOMY=on", () => {
      const handle = maybeStartDaemonAutonomy({
        db,
        bus: makeBus(),
        env: { MCP_GRAPH_AUTONOMY: "on" } as NodeJS.ProcessEnv,
      });
      expect(handle).toBeDefined();
      expect(handle!.isRunning()).toBe(true);
      handle!.stop();
    });

    it("registers EventReactor handlers on the bridged bus", () => {
      const bus = makeBus();
      const handle = maybeStartDaemonAutonomy({
        db,
        bus,
        env: { MCP_GRAPH_AUTONOMY: "on" } as NodeJS.ProcessEnv,
      });
      expect(bus.handlers.has("cost:budget_exceeded")).toBe(true);
      handle!.stop();
    });

    it("scheduler does NOT run when MCP_GRAPH_AUTOPILOT_PAUSED=true even with autonomy=on", async () => {
      let dispatched = 0;
      const handle = maybeStartDaemonAutonomy({
        db,
        bus: makeBus(),
        dispatcher: async () => {
          dispatched++;
        },
        env: {
          MCP_GRAPH_AUTONOMY: "on",
          MCP_GRAPH_AUTOPILOT_PAUSED: "true",
        } as NodeJS.ProcessEnv,
        schedulerTickMs: 10,
      });
      await new Promise((r) => setTimeout(r, 40));
      expect(dispatched).toBe(0);
      handle!.stop();
    });
  });
});
