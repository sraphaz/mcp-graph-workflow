/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-23.T04 — daemon autopilot boot tests.
 *
 * Verifies the gating semantics: maybeStartDaemonAutonomy returns undefined
 * unless MCP_GRAPH_AUTONOMY=on, AND when on, returns an AutonomyHandle whose
 * stop() unwires both the scheduler and the retry worker.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../core/store/migrations.js";
import {
  maybeStartDaemonAutonomy,
  isAutonomyEnabled,
  toReactorBus,
  type AnyEventBus,
} from "../core/autonomy/daemon-autonomy-wiring.js";

function makeBus(): AnyEventBus {
  const handlers = new Map<string, Array<(p: unknown) => void>>();
  return {
    on(event, handler) {
      const arr = handlers.get(event) ?? [];
      arr.push(handler);
      handlers.set(event, arr);
    },
    emit(event, payload) {
      const arr = handlers.get(event) ?? [];
      for (const h of arr) h(payload);
    },
  };
}

describe("daemon autonomy boot (E23.T04)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });

  afterEach(() => db.close());

  it("isAutonomyEnabled gates by MCP_GRAPH_AUTONOMY=on", () => {
    expect(isAutonomyEnabled({ MCP_GRAPH_AUTONOMY: "on" } as NodeJS.ProcessEnv)).toBe(true);
    expect(isAutonomyEnabled({ MCP_GRAPH_AUTONOMY: "off" } as NodeJS.ProcessEnv)).toBe(false);
    expect(isAutonomyEnabled({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it("returns undefined when env flag is not 'on'", () => {
    const handle = maybeStartDaemonAutonomy({
      db,
      bus: makeBus(),
      env: { MCP_GRAPH_AUTONOMY: "off" } as NodeJS.ProcessEnv,
    });
    expect(handle).toBeUndefined();
  });

  it("starts the autonomy stack when env flag is 'on' and stop() halts it", () => {
    const handle = maybeStartDaemonAutonomy({
      db,
      bus: makeBus(),
      env: { MCP_GRAPH_AUTONOMY: "on" } as NodeJS.ProcessEnv,
    });
    expect(handle).toBeDefined();
    expect(handle!.isRunning()).toBe(true);
    handle!.stop();
    expect(handle!.isRunning()).toBe(false);
  });

  it("toReactorBus adapts AnyEventBus.emit to a Promise-returning shim", async () => {
    const bus = makeBus();
    const reactor = toReactorBus(bus);
    let received: unknown = null;
    reactor.on("custom:event", async (payload) => {
      received = payload;
    });
    await reactor.emit("custom:event", { foo: "bar" });
    expect(received).toEqual({ foo: "bar" });
  });
});
