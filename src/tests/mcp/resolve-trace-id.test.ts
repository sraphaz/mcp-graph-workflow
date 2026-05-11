/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC — Story 5 subtask: Tools MCP recebem traceId via param opcional; geram próprio se ausente
 *
 * AC1: GIVEN traceId is provided WHEN resolveTraceId called THEN returns the provided value unchanged
 * AC2: GIVEN traceId is undefined WHEN resolveTraceId called THEN returns a non-empty generated string
 * AC3: GIVEN two calls with undefined WHEN resolveTraceId called twice THEN returns distinct values
 */

import { describe, it, expect } from "vitest";
import { resolveTraceId } from "../../mcp/resolve-trace-id.js";

describe("resolveTraceId — AC1: propagates upstream traceId", () => {
  it("AC1: returns the provided traceId unchanged", () => {
    expect(resolveTraceId("upstream-abc-123")).toBe("upstream-abc-123");
  });

  it("AC1: returns the provided traceId even when it looks auto-generated", () => {
    const id = "0lkv9z1q2r3s4t5u6v7w";
    expect(resolveTraceId(id)).toBe(id);
  });
});

describe("resolveTraceId — AC2: self-generates when absent", () => {
  it("AC2: returns a non-empty string when traceId is undefined", () => {
    const id = resolveTraceId(undefined);
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("AC2: generated id is alphanumeric (no special chars except dashes)", () => {
    const id = resolveTraceId(undefined);
    expect(id).toMatch(/^[0-9a-z-]+$/i);
  });
});

describe("resolveTraceId — AC3: uniqueness", () => {
  it("AC3: two calls with undefined return distinct ids", () => {
    const id1 = resolveTraceId(undefined);
    const id2 = resolveTraceId(undefined);
    expect(id1).not.toBe(id2);
  });

  it("AC3: 10 consecutive calls all produce distinct ids", () => {
    const ids = Array.from({ length: 10 }, () => resolveTraceId(undefined));
    const unique = new Set(ids);
    expect(unique.size).toBe(10);
  });
});
