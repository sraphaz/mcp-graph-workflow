/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 3.4: Downgrade automático por evidência invalidada
 * AC1 — GIVEN node validated referenciando test_run WHEN test_run vira failing THEN tier reverte para cited
 * AC2 — GIVEN reversão ocorre WHEN consulto histórico THEN evento com antes/depois/causa registrado
 * AC3 — GIVEN node em strict mode WHEN downgrade ocorre em fase REVIEW THEN bloqueia avanço para HANDOFF
 */

import { describe, it, expect } from "vitest";
import {
  downgradeTier,
  canAdvanceToHandoff,
  DowngradeBlockedError,
  type DowngradeInput,
  type DowngradeResult,
} from "../../core/provenance/tier-downgrade.js";

describe("AC1 — validated → cited when test_run becomes failing", () => {
  it("should revert tier from validated to cited", () => {
    const input: DowngradeInput = {
      nodeId: "node-abc",
      currentTier: "validated",
      test_run_id: "run-123",
      cause: "test suite failed after dependency update",
    };
    const result = downgradeTier(input);
    expect(result.tier).toBe("cited");
  });

  it("should only allow downgrade from validated (not from claim or cited)", () => {
    expect(() =>
      downgradeTier({
        nodeId: "n",
        currentTier: "claim",
        test_run_id: "run-x",
        cause: "some failure",
      }),
    ).toThrow();

    expect(() =>
      downgradeTier({
        nodeId: "n",
        currentTier: "cited",
        test_run_id: "run-x",
        cause: "some failure",
      }),
    ).toThrow();
  });

  it("should accept downgrade from proven to validated as well", () => {
    const result = downgradeTier({
      nodeId: "n",
      currentTier: "proven",
      test_run_id: "run-yz",
      cause: "receipt invalidated",
    });
    expect(result.tier).toBe("validated");
  });

  it("should require a non-empty cause", () => {
    expect(() =>
      downgradeTier({
        nodeId: "n",
        currentTier: "validated",
        test_run_id: "run-1",
        cause: "",
      }),
    ).toThrow();
  });
});

describe("AC2 — downgrade event has before/after/cause in history", () => {
  it("should emit a downgrade event with correct before/after", () => {
    const input: DowngradeInput = {
      nodeId: "node-xyz",
      currentTier: "validated",
      test_run_id: "run-456",
      cause: "CI pipeline failure",
    };
    const result = downgradeTier(input);
    expect(result.event.type).toBe("tier_downgraded");
    expect(result.event.nodeId).toBe("node-xyz");
    expect(result.event.from).toBe("validated");
    expect(result.event.to).toBe("cited");
    expect(result.event.cause).toBe("CI pipeline failure");
  });

  it("should include a timestamp in the event", () => {
    const result = downgradeTier({
      nodeId: "n",
      currentTier: "validated",
      test_run_id: "run-1",
      cause: "timeout",
    });
    expect(typeof result.event.timestamp).toBe("string");
    expect(result.event.timestamp.length).toBeGreaterThan(0);
  });

  it("should include the test_run_id in the event for auditability", () => {
    const result = downgradeTier({
      nodeId: "n",
      currentTier: "validated",
      test_run_id: "run-audit-id",
      cause: "flaky test",
    });
    expect(result.event.test_run_id).toBe("run-audit-id");
  });

  it("should return a DowngradeResult with both tier and event", () => {
    const result: DowngradeResult = downgradeTier({
      nodeId: "n",
      currentTier: "validated",
      test_run_id: "r",
      cause: "failure",
    });
    expect(result).toHaveProperty("tier");
    expect(result).toHaveProperty("event");
  });
});

describe("AC3 — strict mode blocks HANDOFF advancement after downgrade in REVIEW", () => {
  it("should throw DowngradeBlockedError when strict + phase REVIEW has downgrade", () => {
    expect(() =>
      canAdvanceToHandoff({
        mode: "strict",
        phase: "REVIEW",
        hasDowngradeInCurrentPhase: true,
      }),
    ).toThrow(DowngradeBlockedError);
  });

  it("should not throw in advisory mode even with downgrade in REVIEW", () => {
    expect(() =>
      canAdvanceToHandoff({
        mode: "advisory",
        phase: "REVIEW",
        hasDowngradeInCurrentPhase: true,
      }),
    ).not.toThrow();
  });

  it("should not block when there is no downgrade in current phase", () => {
    expect(() =>
      canAdvanceToHandoff({
        mode: "strict",
        phase: "REVIEW",
        hasDowngradeInCurrentPhase: false,
      }),
    ).not.toThrow();
  });

  it("should not block advancement in non-REVIEW phases even with downgrade", () => {
    expect(() =>
      canAdvanceToHandoff({
        mode: "strict",
        phase: "IMPLEMENT",
        hasDowngradeInCurrentPhase: true,
      }),
    ).not.toThrow();
  });

  it("should include human-readable instructions in the DowngradeBlockedError message", () => {
    let err: unknown;
    try {
      canAdvanceToHandoff({ mode: "strict", phase: "REVIEW", hasDowngradeInCurrentPhase: true });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(DowngradeBlockedError);
    const msg = (err as DowngradeBlockedError).message.toLowerCase();
    expect(msg).toMatch(/handoff|downgrade|review/i);
  });
});
