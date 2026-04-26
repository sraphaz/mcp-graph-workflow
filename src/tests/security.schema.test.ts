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
import {
  SanitizationReportSchema,
  ExfiltrationReportSchema,
  ToolArgsSanitizationResultSchema,
  SecurityEventSchema,
} from "../schemas/security.schema.js";

describe("SanitizationReportSchema", () => {
  const valid = {
    sanitized: "clean text",
    injectionDetected: false,
    injectionPatterns: [],
    invisibleCharsRemoved: 0,
  };

  it("should accept the minimal clean report", () => {
    expect(SanitizationReportSchema.safeParse(valid).success).toBe(true);
  });

  it("should accept a report with detected injection patterns", () => {
    expect(
      SanitizationReportSchema.safeParse({
        ...valid,
        injectionDetected: true,
        injectionPatterns: ["IGNORE PREVIOUS INSTRUCTIONS"],
        invisibleCharsRemoved: 3,
      }).success,
    ).toBe(true);
  });

  it("should reject negative invisibleCharsRemoved", () => {
    expect(
      SanitizationReportSchema.safeParse({ ...valid, invisibleCharsRemoved: -1 }).success,
    ).toBe(false);
  });

  it("should reject non-integer invisibleCharsRemoved", () => {
    expect(
      SanitizationReportSchema.safeParse({ ...valid, invisibleCharsRemoved: 1.5 }).success,
    ).toBe(false);
  });
});

describe("ExfiltrationReportSchema", () => {
  it("should accept a clean exfiltration report", () => {
    expect(
      ExfiltrationReportSchema.safeParse({
        detected: false,
        suspiciousUrls: [],
        base64Blocks: [],
        suspiciousCommands: [],
      }).success,
    ).toBe(true);
  });

  it("should accept a detected exfiltration with payloads", () => {
    expect(
      ExfiltrationReportSchema.safeParse({
        detected: true,
        suspiciousUrls: ["http://evil.example/steal"],
        base64Blocks: ["aGVsbG8="],
        suspiciousCommands: ["curl"],
      }).success,
    ).toBe(true);
  });
});

describe("ToolArgsSanitizationResultSchema", () => {
  it("should accept arbitrary record shape for sanitized field", () => {
    expect(
      ToolArgsSanitizationResultSchema.safeParse({
        sanitized: { foo: "bar", count: 1, nested: { a: true } },
        injectionDetected: false,
        invisibleCharsRemoved: 0,
      }).success,
    ).toBe(true);
  });
});

describe("SecurityEventSchema", () => {
  const valid = {
    id: "evt-1",
    eventType: "injection_detected" as const,
    severity: "high" as const,
    inputHash: "deadbeef",
    details: "Detected ignore-instructions pattern",
    createdAt: "2026-04-26T12:00:00.000Z",
  };

  it("should accept minimal valid event", () => {
    expect(SecurityEventSchema.safeParse(valid).success).toBe(true);
  });

  it.each(["low", "medium", "high", "critical"] as const)(
    "should accept severity '%s'",
    (severity) => {
      expect(SecurityEventSchema.safeParse({ ...valid, severity }).success).toBe(true);
    },
  );

  it("should reject unknown severity", () => {
    expect(
      SecurityEventSchema.safeParse({ ...valid, severity: "doom" }).success,
    ).toBe(false);
  });

  it("should reject unknown eventType", () => {
    expect(
      SecurityEventSchema.safeParse({ ...valid, eventType: "spam" }).success,
    ).toBe(false);
  });
});
