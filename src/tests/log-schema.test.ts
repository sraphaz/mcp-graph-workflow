/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, expectTypeOf } from "vitest";
import {
  LogEntrySchema,
  LogLayerSchema,
  type LogLayer,
} from "../schemas/log.schema.js";

describe("log.schema — LogLayer extension", () => {
  it("AC1: LogLayerSchema accepts the 6 declared values", () => {
    for (const v of ["core", "api", "mcp", "rag", "web", "cli"] as const) {
      expect(LogLayerSchema.safeParse(v).success).toBe(true);
    }
  });

  it("AC1: LogLayerSchema rejects unknown values", () => {
    expect(LogLayerSchema.safeParse("server").success).toBe(false);
    expect(LogLayerSchema.safeParse("").success).toBe(false);
  });

  it("AC2: LogEntrySchema accepts an optional layer", () => {
    const r = LogEntrySchema.safeParse({
      id: 1,
      level: "info",
      message: "hello",
      timestamp: "2026-05-03T00:00:00.000Z",
      layer: "api",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.layer).toBe("api");
  });

  it("AC3: LogEntry without layer still parses (backward compat)", () => {
    const r = LogEntrySchema.safeParse({
      id: 2,
      level: "info",
      message: "no layer",
      timestamp: "2026-05-03T00:00:00.000Z",
    });
    expect(r.success).toBe(true);
  });

  it("AC4: LogEntry with invalid layer fails with issue on path ['layer']", () => {
    const r = LogEntrySchema.safeParse({
      id: 3,
      level: "info",
      message: "bad",
      timestamp: "2026-05-03T00:00:00.000Z",
      layer: "unknown",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const hit = r.error.issues.find((i) => i.path.join(".") === "layer");
      expect(hit).toBeDefined();
    }
  });

  it("AC5: LogLayer type is the inferred union", () => {
    expectTypeOf<LogLayer>().toEqualTypeOf<
      "core" | "api" | "mcp" | "rag" | "web" | "cli"
    >();
  });
});
