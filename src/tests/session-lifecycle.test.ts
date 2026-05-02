/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  emitSessionStart,
  emitSessionEnd,
  installSessionEndHandlers,
  _resetSessionLifecycleForTesting,
} from "../core/hooks/session-lifecycle.js";
import { EventEmitter } from "node:events";

describe("session-lifecycle idempotency", () => {
  beforeEach(() => {
    _resetSessionLifecycleForTesting();
  });

  it("emitSessionStart is idempotent — same id on repeat calls", () => {
    const id1 = emitSessionStart();
    const id2 = emitSessionStart();
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("emitSessionStart returns a UUID-shaped string", () => {
    const id = emitSessionStart();
    expect(id.length).toBe(36);
    expect(id.split("-").length).toBe(5);
  });

  it("emitSessionEnd returns true on first call, false on subsequent", () => {
    emitSessionStart();
    expect(emitSessionEnd("test-reason")).toBe(true);
    expect(emitSessionEnd("test-reason")).toBe(false);
    expect(emitSessionEnd("different-reason")).toBe(false);
  });

  it("emitSessionEnd works without prior emitSessionStart (sessionId='unknown')", () => {
    expect(emitSessionEnd("orphan")).toBe(true);
  });

  it("after reset, emitSessionStart yields a fresh id", () => {
    const first = emitSessionStart();
    _resetSessionLifecycleForTesting();
    const second = emitSessionStart();
    expect(first).not.toBe(second);
  });
});

describe("installSessionEndHandlers", () => {
  beforeEach(() => {
    _resetSessionLifecycleForTesting();
  });

  it("registers a handler for each requested signal + beforeExit", () => {
    const fakeProc = new EventEmitter() as unknown as NodeJS.Process;
    const dispose = installSessionEndHandlers(fakeProc, ["SIGINT", "SIGTERM"]);
    const emitter = fakeProc as unknown as EventEmitter;
    expect(emitter.listenerCount("SIGINT")).toBe(1);
    expect(emitter.listenerCount("SIGTERM")).toBe(1);
    expect(emitter.listenerCount("beforeExit")).toBe(1);
    dispose();
  });

  it("disposer removes all installed listeners", () => {
    const fakeProc = new EventEmitter() as unknown as NodeJS.Process;
    const dispose = installSessionEndHandlers(fakeProc, ["SIGINT"]);
    const emitter = fakeProc as unknown as EventEmitter;
    expect(emitter.listenerCount("SIGINT")).toBe(1);
    dispose();
    expect(emitter.listenerCount("SIGINT")).toBe(0);
    expect(emitter.listenerCount("beforeExit")).toBe(0);
  });

  it("default signal list installs SIGINT, SIGTERM, SIGHUP", () => {
    const fakeProc = new EventEmitter() as unknown as NodeJS.Process;
    const dispose = installSessionEndHandlers(fakeProc);
    const emitter = fakeProc as unknown as EventEmitter;
    expect(emitter.listenerCount("SIGINT")).toBe(1);
    expect(emitter.listenerCount("SIGTERM")).toBe(1);
    expect(emitter.listenerCount("SIGHUP")).toBe(1);
    dispose();
  });

  it("emitting a signal triggers emitSessionEnd exactly once", () => {
    const fakeProc = new EventEmitter() as unknown as NodeJS.Process;
    const dispose = installSessionEndHandlers(fakeProc, ["SIGINT"]);
    (fakeProc as unknown as EventEmitter).emit("SIGINT");
    // Second emit should NOT trigger session end again (already ended)
    expect(emitSessionEnd("manual")).toBe(false);
    dispose();
  });
});
