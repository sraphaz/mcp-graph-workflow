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

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createClientLogger,
  type ClientLoggerOptions,
} from "./client-logger.js";

function makeOptions(overrides: Partial<ClientLoggerOptions> = {}): ClientLoggerOptions {
  return {
    ingestUrl: "/api/v1/logs/ingest",
    flushIntervalMs: 100,
    maxBuffer: 5,
    ...overrides,
  };
}

describe("clientLogger — buffering", () => {
  let beacon: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    beacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", { sendBeacon: beacon });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("enqueues entries without sending immediately", () => {
    vi.useFakeTimers();
    const logger = createClientLogger(makeOptions());

    logger.error("boom", { component: "Tab" });

    expect(beacon).not.toHaveBeenCalled();
    logger.destroy();
  });

  it("sends buffered entries when flush() is called", () => {
    const logger = createClientLogger(makeOptions());

    logger.error("bad thing", { code: 42 });
    logger.warn("meh");
    logger.flush();

    expect(beacon).toHaveBeenCalledOnce();
    const [url, blob] = beacon.mock.calls[0] as [string, Blob];
    expect(url).toBe("/api/v1/logs/ingest");

    const text = blob instanceof Blob ? blob : null;
    expect(text).not.toBeNull();
    logger.destroy();
  });

  it("payload contains correct level and message", async () => {
    const logger = createClientLogger(makeOptions());

    logger.error("something failed");
    logger.flush();

    expect(beacon).toHaveBeenCalledOnce();
    const blob = beacon.mock.calls[0][1] as Blob;
    const text = await blob.text();
    const payload = JSON.parse(text) as { entries: Array<{ level: string; message: string }> };

    expect(payload.entries).toHaveLength(1);
    expect(payload.entries[0].level).toBe("error");
    expect(payload.entries[0].message).toBe("something failed");
    logger.destroy();
  });

  it("flushes automatically when buffer reaches maxBuffer", () => {
    vi.useFakeTimers();
    const logger = createClientLogger(makeOptions({ maxBuffer: 3 }));

    logger.error("e1");
    logger.error("e2");
    expect(beacon).not.toHaveBeenCalled();

    logger.error("e3"); // hits maxBuffer=3 → auto-flush
    expect(beacon).toHaveBeenCalledOnce();
    logger.destroy();
  });

  it("does not send if buffer is empty on flush", () => {
    const logger = createClientLogger(makeOptions());
    logger.flush();
    expect(beacon).not.toHaveBeenCalled();
    logger.destroy();
  });

  it("clears buffer after flush so entries are not re-sent", () => {
    const logger = createClientLogger(makeOptions());

    logger.warn("once");
    logger.flush();
    logger.flush(); // second flush — buffer empty

    expect(beacon).toHaveBeenCalledOnce();
    logger.destroy();
  });

  it("flushes on timer interval", () => {
    vi.useFakeTimers();
    const logger = createClientLogger(makeOptions({ flushIntervalMs: 200 }));

    logger.info("hello");
    expect(beacon).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(beacon).toHaveBeenCalledOnce();
    logger.destroy();
  });
});

describe("clientLogger — reportError", () => {
  let beacon: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    beacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", { sendBeacon: beacon });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reportError sends immediately with error details", async () => {
    const logger = createClientLogger(makeOptions());
    const err = new TypeError("null is not an object");

    logger.reportError(err, { component: "GraphTab" });

    expect(beacon).toHaveBeenCalledOnce();
    const blob = beacon.mock.calls[0][1] as Blob;
    const text = await blob.text();
    const payload = JSON.parse(text) as {
      entries: Array<{ level: string; message: string; context: Record<string, unknown> }>;
    };

    expect(payload.entries[0].level).toBe("error");
    expect(payload.entries[0].message).toContain("null is not an object");
    expect(payload.entries[0].context.errorType).toBe("TypeError");
    expect(typeof payload.entries[0].context.errorStack).toBe("string");
    logger.destroy();
  });
});

describe("clientLogger — global handlers", () => {
  let beacon: ReturnType<typeof vi.fn>;
  let originalOnerror: typeof window.onerror;
  let originalOnunhandledrejection: typeof window.onunhandledrejection;

  beforeEach(() => {
    beacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", { sendBeacon: beacon });
    originalOnerror = window.onerror;
    originalOnunhandledrejection = window.onunhandledrejection;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.onerror = originalOnerror;
    window.onunhandledrejection = originalOnunhandledrejection;
  });

  it("installGlobalHandlers wires window.onerror", async () => {
    const logger = createClientLogger(makeOptions());
    logger.installGlobalHandlers();

    // Simulate window.onerror
    const event = new ErrorEvent("error", {
      message: "Script error",
      error: new RangeError("out of bounds"),
    });
    window.dispatchEvent(event);

    expect(beacon).toHaveBeenCalled();
    logger.destroy();
  });

  it("installGlobalHandlers wires unhandledrejection", async () => {
    const logger = createClientLogger(makeOptions());
    logger.installGlobalHandlers();

    const reason = new Error("promise rejected");
    const evt = new PromiseRejectionEvent("unhandledrejection", {
      promise: Promise.resolve(),
      reason,
    });
    window.dispatchEvent(evt);

    expect(beacon).toHaveBeenCalled();
    logger.destroy();
  });
});
