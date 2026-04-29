/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  timedQuery,
  SLOW_QUERY_THRESHOLD_MS,
} from "../core/utils/slow-query-logger.js";
import { logger } from "../core/utils/logger.js";

afterEach(() => vi.restoreAllMocks());

describe("SLOW_QUERY_THRESHOLD_MS constant", () => {
  it("defaults to 500ms", () => {
    expect(SLOW_QUERY_THRESHOLD_MS).toBe(500);
  });
});

describe("timedQuery()", () => {
  it("returns the result of the wrapped function", () => {
    const result = timedQuery("SELECT 1", () => [{ id: "a" }]);
    expect(result).toEqual([{ id: "a" }]);
  });

  it("does NOT log when query completes in under 500ms", () => {
    const warnSpy = vi.spyOn(logger, "warn");
    timedQuery("SELECT * FROM nodes", () => [], { nowFn: () => 0, thresholdMs: 500 });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("logs warn with slow_query when duration >= threshold", () => {
    const warnSpy = vi.spyOn(logger, "warn");
    let tick = 0;
    timedQuery(
      "SELECT * FROM nodes_fts WHERE nodes_fts MATCH 'typescript AND react'",
      () => [],
      { nowFn: () => (tick++ === 0 ? 0 : 600), thresholdMs: 500 },
    );
    expect(warnSpy).toHaveBeenCalledOnce();
    const [msg, fields] = warnSpy.mock.calls[0] as [string, Record<string, unknown>];
    expect(msg).toBe("slow_query");
    expect(fields["durationMs"]).toBe(600);
    expect((fields["sql"] as string).length).toBeLessThanOrEqual(200);
  });

  it("truncates SQL to 200 chars in the log", () => {
    const warnSpy = vi.spyOn(logger, "warn");
    const longSql = "SELECT ".padEnd(300, "x");
    let tick = 0;
    timedQuery(longSql, () => [], { nowFn: () => (tick++ === 0 ? 0 : 600), thresholdMs: 500 });
    const [, fields] = warnSpy.mock.calls[0] as [string, Record<string, unknown>];
    expect((fields["sql"] as string).length).toBe(200);
  });

  it("does not suppress errors — re-throws from the wrapped function", () => {
    expect(() =>
      timedQuery("SELECT 1", () => { throw new Error("db locked"); }),
    ).toThrow("db locked");
  });
});
