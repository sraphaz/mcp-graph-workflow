/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-12.T09 — slow query detector tests.
 */

import { describe, it, expect } from "vitest";
import {
  checkSlowQuery,
  getSlowQueryThreshold,
  previewSql,
  sanitizeParamTypes,
  DEFAULT_SLOW_QUERY_MS,
} from "../core/store/slow-query-detector.js";

describe("slow-query-detector (E12.T09)", () => {
  it("DEFAULT_SLOW_QUERY_MS = 500", () => {
    expect(DEFAULT_SLOW_QUERY_MS).toBe(500);
  });

  it("checkSlowQuery: slow=true when duration > threshold", () => {
    const r = checkSlowQuery({ sql: "SELECT 1", durationMs: 600 });
    expect(r.slow).toBe(true);
    expect(r.thresholdMs).toBe(500);
  });

  it("checkSlowQuery: slow=false at exact threshold (strict greater)", () => {
    expect(checkSlowQuery({ sql: "x", durationMs: 500 }).slow).toBe(false);
    expect(checkSlowQuery({ sql: "x", durationMs: 499 }).slow).toBe(false);
  });

  it("checkSlowQuery: custom thresholdMs honored", () => {
    expect(checkSlowQuery({ sql: "x", durationMs: 100, thresholdMs: 50 }).slow).toBe(true);
  });

  it("getSlowQueryThreshold: env override valid", () => {
    expect(getSlowQueryThreshold({ SQLITE_SLOW_QUERY_MS: "1000" })).toBe(1000);
    expect(getSlowQueryThreshold({})).toBe(500);
    expect(getSlowQueryThreshold({ SQLITE_SLOW_QUERY_MS: "abc" })).toBe(500);
    expect(getSlowQueryThreshold({ SQLITE_SLOW_QUERY_MS: "0" })).toBe(500);
    expect(getSlowQueryThreshold({ SQLITE_SLOW_QUERY_MS: "-5" })).toBe(500);
  });

  it("sanitizeParamTypes returns types not values (PII safe)", () => {
    const types = sanitizeParamTypes(["secret", 42, true, null, undefined]);
    expect(types).toEqual(["string", "number", "boolean", "null", "undefined"]);
  });

  it("sanitizeParamTypes detects Date / array / Buffer", () => {
    const types = sanitizeParamTypes([new Date(), [1, 2], Buffer.from("x")]);
    expect(types).toEqual(["Date", "array", "Buffer"]);
  });

  it("sanitizeParamTypes returns [] when params is undefined", () => {
    expect(sanitizeParamTypes(undefined)).toEqual([]);
  });

  it("previewSql collapses whitespace and truncates", () => {
    expect(previewSql("SELECT  1\n FROM\t t")).toBe("SELECT 1 FROM t");
    expect(previewSql("X".repeat(300), 100).length).toBeLessThanOrEqual(100);
    expect(previewSql("X".repeat(300), 100)).toMatch(/\.\.\.$/);
  });

  it("checkSlowQuery: sqlPreview truncated to 200 chars by default", () => {
    const long = "SELECT " + "a, ".repeat(200);
    const r = checkSlowQuery({ sql: long, durationMs: 600 });
    expect(r.sqlPreview.length).toBeLessThanOrEqual(200);
  });

  it("checkSlowQuery: paramTypes sanitized in report", () => {
    const r = checkSlowQuery({ sql: "x", durationMs: 600, params: ["secret", 42] });
    expect(r.paramTypes).toEqual(["string", "number"]);
  });
});
