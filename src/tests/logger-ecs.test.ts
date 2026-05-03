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

import { describe, it, expect, beforeEach } from "vitest";
import { toEcs, SERVICE_NAME, SERVICE_VERSION } from "../core/utils/ecs-formatter.js";
import { logger, clearLogBuffer, getLogBuffer } from "../core/utils/logger.js";
import type { LogEntry } from "../schemas/log.schema.js";

function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: 1,
    level: "info",
    message: "hello",
    timestamp: "2026-05-03T12:00:00.000Z",
    ...overrides,
  };
}

describe("ecs-formatter — toEcs", () => {
  it("maps base fields to ECS shape", () => {
    const ecs = toEcs(makeEntry({ message: "ping" }));

    expect(ecs["@timestamp"]).toBe("2026-05-03T12:00:00.000Z");
    expect(ecs["log.level"]).toBe("info");
    expect(ecs["message"]).toBe("ping");
    expect(ecs["service.name"]).toBe(SERVICE_NAME);
    expect(ecs["service.version"]).toBe(SERVICE_VERSION);
  });

  it("promotes layer to labels.layer when present in context", () => {
    const ecs = toEcs(
      makeEntry({ context: { layer: "api", source: "src/api/routes/foo.ts" } }),
    );

    expect(ecs["labels.layer"]).toBe("api");
    expect(ecs["labels.source"]).toBe("src/api/routes/foo.ts");
  });

  it("promotes traceId/spanId to ECS trace.id/span.id", () => {
    const ecs = toEcs(
      makeEntry({ context: { traceId: "abc-123", spanId: "span-1" } }),
    );

    expect(ecs["trace.id"]).toBe("abc-123");
    expect(ecs["span.id"]).toBe("span-1");
  });

  it("maps event helpers to event.* fields", () => {
    const ecs = toEcs(
      makeEntry({
        context: {
          eventAction: "task.finish",
          eventCategory: "process",
          eventOutcome: "success",
        },
      }),
    );

    expect(ecs["event.action"]).toBe("task.finish");
    expect(ecs["event.category"]).toBe("process");
    expect(ecs["event.outcome"]).toBe("success");
  });

  it("extracts error.message / error.stack_trace / error.type from Error in context", () => {
    const err = new TypeError("bad input");
    const ecs = toEcs(makeEntry({ level: "error", context: { error: err } }));

    expect(ecs["error.message"]).toBe("bad input");
    expect(ecs["error.type"]).toBe("TypeError");
    expect(typeof ecs["error.stack_trace"]).toBe("string");
    // raw Error must not leak through (would not be JSON-serializable)
    expect(ecs["error"]).toBeUndefined();
  });

  it("preserves remaining context under labels.*", () => {
    const ecs = toEcs(makeEntry({ context: { userId: "u-42", durationMs: 17 } }));

    expect(ecs["labels.userId"]).toBe("u-42");
    expect(ecs["labels.durationMs"]).toBe(17);
  });
});

describe("logger.event — business event helper", () => {
  beforeEach(() => clearLogBuffer());

  it("emits an info entry tagged with event.action/category/outcome context", () => {
    logger.event({ action: "task.start", category: "process", outcome: "success" }, "task started");

    const entries = getLogBuffer();
    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe("info");
    expect(entries[0].message).toBe("task started");
    expect(entries[0].context?.eventAction).toBe("task.start");
    expect(entries[0].context?.eventCategory).toBe("process");
    expect(entries[0].context?.eventOutcome).toBe("success");
  });
});

describe("logger.error — auto error extraction", () => {
  beforeEach(() => clearLogBuffer());

  it("converts Error in context into ECS-friendly fields on the entry", () => {
    const err = new RangeError("out of bounds");
    logger.error("operation failed", { error: err });

    const entries = getLogBuffer();
    expect(entries).toHaveLength(1);
    expect(entries[0].context?.errorMessage).toBe("out of bounds");
    expect(entries[0].context?.errorType).toBe("RangeError");
    expect(typeof entries[0].context?.errorStackTrace).toBe("string");
    // The raw Error instance must not survive in the buffer (not serializable)
    expect(entries[0].context?.error).toBeUndefined();
  });
});

describe("logger.warn — auto error extraction", () => {
  beforeEach(() => clearLogBuffer());

  it("normalizes Error in context the same way logger.error does", () => {
    const err = new TypeError("nope");
    logger.warn("recoverable failure", { error: err, retry: 2 });

    const entries = getLogBuffer();
    expect(entries).toHaveLength(1);
    expect(entries[0].context?.errorMessage).toBe("nope");
    expect(entries[0].context?.errorType).toBe("TypeError");
    expect(entries[0].context?.error).toBeUndefined();
    // Non-error context survives untouched
    expect(entries[0].context?.retry).toBe(2);
  });
});

describe("logger.event — auto error extraction", () => {
  beforeEach(() => clearLogBuffer());

  it("normalizes Error in business-event context without losing event tags", () => {
    const err = new Error("downstream timeout");
    logger.event(
      { action: "task.finish", category: "process", outcome: "failure" },
      "task crashed",
      { error: err, taskId: "t-1" },
    );

    const entries = getLogBuffer();
    expect(entries).toHaveLength(1);
    expect(entries[0].context?.errorMessage).toBe("downstream timeout");
    expect(entries[0].context?.error).toBeUndefined();
    expect(entries[0].context?.eventAction).toBe("task.finish");
    expect(entries[0].context?.eventOutcome).toBe("failure");
    expect(entries[0].context?.taskId).toBe("t-1");
  });
});
