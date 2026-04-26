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

import { describe, it, expect } from "vitest";
import { LogLevelSchema, LogEntrySchema } from "../schemas/log.schema.js";

describe("LogLevelSchema", () => {
  it.each(["info", "warn", "error", "success", "debug"] as const)(
    "should accept '%s'",
    (level) => {
      expect(LogLevelSchema.safeParse(level).success).toBe(true);
    },
  );

  it("should reject unknown levels", () => {
    expect(LogLevelSchema.safeParse("trace").success).toBe(false);
    expect(LogLevelSchema.safeParse("").success).toBe(false);
    expect(LogLevelSchema.safeParse(null).success).toBe(false);
  });
});

describe("LogEntrySchema", () => {
  const baseEntry = {
    id: 1,
    level: "info" as const,
    message: "Hello",
    timestamp: "2026-04-26T12:00:00.000Z",
  };

  it("should accept the minimal valid entry shape", () => {
    expect(LogEntrySchema.safeParse(baseEntry).success).toBe(true);
  });

  it("should accept an optional context record", () => {
    const result = LogEntrySchema.safeParse({
      ...baseEntry,
      context: { agent: "claude", duration: 42 },
    });
    expect(result.success).toBe(true);
  });

  it("should reject non-integer ids", () => {
    expect(LogEntrySchema.safeParse({ ...baseEntry, id: 1.5 }).success).toBe(false);
    expect(LogEntrySchema.safeParse({ ...baseEntry, id: "1" }).success).toBe(false);
  });

  it("should reject missing required fields", () => {
    expect(LogEntrySchema.safeParse({ ...baseEntry, message: undefined }).success).toBe(false);
    expect(LogEntrySchema.safeParse({ ...baseEntry, level: undefined }).success).toBe(false);
    expect(LogEntrySchema.safeParse({ ...baseEntry, timestamp: undefined }).success).toBe(false);
  });

  it("should reject invalid level enum values", () => {
    expect(
      LogEntrySchema.safeParse({ ...baseEntry, level: "verbose" }).success,
    ).toBe(false);
  });
});
