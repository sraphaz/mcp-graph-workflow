/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import {
  validateInvest,
  type InvestCandidate,
} from "../../core/planner/invest-validator.js";

function makeCandidate(overrides: Partial<InvestCandidate> = {}): InvestCandidate {
  return {
    title: "Process payment callback",
    description: "Handle the webhook and update status",
    xpSize: "S",
    acceptanceCriteria: [
      "GIVEN payment WHEN callback received THEN status updated",
      "GIVEN error WHEN callback fails THEN retry scheduled",
    ],
    ...overrides,
  };
}

describe("validateInvest", () => {
  describe("Testable criterion", () => {
    it("should pass when ACs contain GIVEN/WHEN/THEN pattern", () => {
      const result = validateInvest(makeCandidate());
      expect(result.passed).toBe(true);
    });

    it("should pass when ACs contain 'should' keyword", () => {
      const result = validateInvest(
        makeCandidate({ acceptanceCriteria: ["should return 200 on success", "should log errors"] }),
      );
      expect(result.passed).toBe(true);
    });

    it("should reject when no AC is testable (no GIVEN/WHEN/THEN or should)", () => {
      const result = validateInvest(
        makeCandidate({ acceptanceCriteria: ["works correctly", "behaves as expected"] }),
      );
      expect(result.passed).toBe(false);
      expect(result.rejectedReasons.some((r: string) => r.toLowerCase().includes("testable"))).toBe(true);
    });
  });

  describe("Valuable criterion", () => {
    it("should reject when there are no acceptance criteria", () => {
      const result = validateInvest(makeCandidate({ acceptanceCriteria: [] }));
      expect(result.passed).toBe(false);
      expect(result.rejectedReasons.some((r: string) => r.toLowerCase().includes("valuable") || r.toLowerCase().includes("ac"))).toBe(true);
    });
  });

  describe("Small criterion", () => {
    it("should reject when xpSize is L", () => {
      const result = validateInvest(makeCandidate({ xpSize: "L" }));
      expect(result.passed).toBe(false);
      expect(result.rejectedReasons.some((r: string) => r.toLowerCase().includes("small"))).toBe(true);
    });

    it("should reject when xpSize is XL", () => {
      const result = validateInvest(makeCandidate({ xpSize: "XL" }));
      expect(result.passed).toBe(false);
      expect(result.rejectedReasons.some((r: string) => r.toLowerCase().includes("small"))).toBe(true);
    });

    it("should pass for xpSize M", () => {
      const result = validateInvest(makeCandidate({ xpSize: "M" }));
      expect(result.passed).toBe(true);
    });

    it("should pass for xpSize XS", () => {
      const result = validateInvest(makeCandidate({ xpSize: "XS" }));
      expect(result.passed).toBe(true);
    });
  });

  describe("Estimable criterion", () => {
    it("should reject when xpSize is absent", () => {
      const result = validateInvest(makeCandidate({ xpSize: undefined }));
      expect(result.passed).toBe(false);
      expect(result.rejectedReasons.some((r: string) => r.toLowerCase().includes("estimable"))).toBe(true);
    });
  });

  describe("Multiple violations", () => {
    it("should collect all reasons when multiple criteria fail", () => {
      const result = validateInvest({
        title: "Do stuff",
        xpSize: "XL",
        acceptanceCriteria: [],
      });
      expect(result.passed).toBe(false);
      expect(result.rejectedReasons.length).toBeGreaterThanOrEqual(2);
    });
  });
});
