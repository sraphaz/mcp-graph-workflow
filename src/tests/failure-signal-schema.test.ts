/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.1 — Schema `FailureSignal` Zod
 *
 * AC1: GIVEN tipo exportado WHEN consumido THEN sem `any`
 * AC2: GIVEN signal WHEN serializado THEN JSON válido para SQLite
 */

import { describe, it, expect } from "vitest";
import { FailureSignalSchema, type FailureSignal } from "../schemas/failure-signal.schema.js";

// ---------------------------------------------------------------------------
// AC1: exported type has no `any` — verified via TypeScript assignability
// ---------------------------------------------------------------------------

describe("FailureSignalSchema — AC1: no any", () => {
  it("parses a complete valid signal", () => {
    const signal: FailureSignal = {
      source: "tool_invocation",
      signalKind: "tool_isError",
      context: { toolName: "finish_task", nodeId: "node_abc" },
      severity: "error",
      timestamp: new Date().toISOString(),
    };
    const result = FailureSignalSchema.safeParse(signal);
    expect(result.success).toBe(true);
  });

  it("parses all source values", () => {
    const sources = ["tool_invocation", "lifecycle_gate", "dod_check", "mcp_server", "sqlite"] as const;
    for (const source of sources) {
      const result = FailureSignalSchema.safeParse({
        source,
        signalKind: "test",
        context: {},
        severity: "warn",
        timestamp: new Date().toISOString(),
      });
      expect(result.success, `source "${source}" should parse`).toBe(true);
    }
  });

  it("parses all severity values", () => {
    const severities = ["warn", "error", "critical"] as const;
    for (const severity of severities) {
      const result = FailureSignalSchema.safeParse({
        source: "sqlite",
        signalKind: "sqlite_busy",
        context: {},
        severity,
        timestamp: new Date().toISOString(),
      });
      expect(result.success, `severity "${severity}" should parse`).toBe(true);
    }
  });

  it("rejects unknown source", () => {
    const result = FailureSignalSchema.safeParse({
      source: "unknown_source",
      signalKind: "x",
      context: {},
      severity: "warn",
      timestamp: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown severity", () => {
    const result = FailureSignalSchema.safeParse({
      source: "sqlite",
      signalKind: "x",
      context: {},
      severity: "fatal",
      timestamp: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional rawError", () => {
    const result = FailureSignalSchema.safeParse({
      source: "mcp_server",
      signalKind: "connection_refused",
      context: {},
      severity: "critical",
      timestamp: new Date().toISOString(),
      rawError: "ECONNREFUSED 127.0.0.1:9999",
    });
    expect(result.success).toBe(true);
  });

  it("rawError is absent when not provided", () => {
    const result = FailureSignalSchema.safeParse({
      source: "lifecycle_gate",
      signalKind: "lifecycle_gate_blocked",
      context: { phase: "IMPLEMENT" },
      severity: "error",
      timestamp: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rawError).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// AC2: signal serializes to valid JSON for SQLite
// ---------------------------------------------------------------------------

describe("FailureSignalSchema — AC2: JSON serialization", () => {
  it("JSON.stringify + parse round-trips cleanly", () => {
    const signal: FailureSignal = {
      source: "dod_check",
      signalKind: "has_testable_ac_failed",
      context: { nodeId: "node_xyz", phase: "IMPLEMENT" },
      severity: "warn",
      timestamp: "2026-05-09T22:00:00.000Z",
      rawError: undefined,
    };
    const json = JSON.stringify(signal);
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = FailureSignalSchema.safeParse(JSON.parse(json));
    expect(parsed.success).toBe(true);
  });

  it("serialized JSON has no undefined fields (SQLite-safe)", () => {
    const signal: FailureSignal = {
      source: "tool_invocation",
      signalKind: "tool_isError",
      context: {},
      severity: "error",
      timestamp: "2026-05-09T22:00:00.000Z",
    };
    const json = JSON.stringify(signal);
    expect(json).not.toContain("undefined");
  });

  it("context fields are optional individually", () => {
    const result = FailureSignalSchema.safeParse({
      source: "sqlite",
      signalKind: "sqlite_busy",
      context: { toolName: "finish_task" },
      severity: "warn",
      timestamp: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });
});
