/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import {
  AmbiguityAuditSchema,
  shouldWarnMissingAudit,
} from "../core/decisions/ambiguity-audit-types.js";

describe("AmbiguityAuditSchema", () => {
  it("accepts a fully specified audit", () => {
    const result = AmbiguityAuditSchema.safeParse({
      specified: ["uses Zod v4", "stores in metadata"],
      partial: ["error format"],
      unspecified: [
        { item: "fallback policy", alternatives: ["throw", "warn", "silent"] },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty audit (all arrays default to [])", () => {
    const result = AmbiguityAuditSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.specified).toEqual([]);
      expect(result.data.partial).toEqual([]);
      expect(result.data.unspecified).toEqual([]);
    }
  });

  it("rejects unspecified entry without alternatives", () => {
    const result = AmbiguityAuditSchema.safeParse({
      unspecified: [{ item: "x" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-string entries in specified/partial", () => {
    const result = AmbiguityAuditSchema.safeParse({ specified: [123] });
    expect(result.success).toBe(false);
  });
});

describe("shouldWarnMissingAudit", () => {
  it("warns when AC count >= 3 and no audit", () => {
    expect(shouldWarnMissingAudit(3, undefined)).toBe(true);
    expect(shouldWarnMissingAudit(5, null)).toBe(true);
  });

  it("does not warn when AC count < 3", () => {
    expect(shouldWarnMissingAudit(2, undefined)).toBe(false);
    expect(shouldWarnMissingAudit(0, undefined)).toBe(false);
  });

  it("does not warn when audit is provided", () => {
    expect(shouldWarnMissingAudit(5, { specified: ["a"], partial: [], unspecified: [] })).toBe(false);
  });
});
