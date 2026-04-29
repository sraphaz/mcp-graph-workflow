/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.D2 — auto-approval policy tests.
 */

import { describe, it, expect } from "vitest";
import {
  decideAutoApproval,
  isAutoApprovalDisabled,
  AUTO_APPROVAL_MIN_CONFIDENCE,
} from "../core/autonomy/auto-approval-policy.js";

describe("auto-approval-policy (E22.D2)", () => {
  it("AUTO_APPROVAL_MIN_CONFIDENCE = 0.95", () => {
    expect(AUTO_APPROVAL_MIN_CONFIDENCE).toBe(0.95);
  });

  it("trivial + confidence >= 0.95 → auto-granted", () => {
    const r = decideAutoApproval({ risk: "trivial", confidence: 0.96 }, {});
    expect(r.autoGranted).toBe(true);
    expect(r.reason).toBe("auto-policy:trivial");
  });

  it("trivial + confidence < 0.95 → require human", () => {
    const r = decideAutoApproval({ risk: "trivial", confidence: 0.9 }, {});
    expect(r.autoGranted).toBe(false);
    expect(r.reason).toBe("confidence-below-threshold");
  });

  it("low + readOnly + high confidence → auto-granted", () => {
    const r = decideAutoApproval(
      { risk: "low", confidence: 0.96, readOnly: true },
      {},
    );
    expect(r.autoGranted).toBe(true);
    expect(r.reason).toBe("auto-policy:low-readonly");
  });

  it("low without readOnly → require human", () => {
    const r = decideAutoApproval({ risk: "low", confidence: 0.99 }, {});
    expect(r.autoGranted).toBe(false);
    expect(r.reason).toBe("low-not-readonly");
  });

  it("medium → always require human (even at confidence 1.0)", () => {
    const r = decideAutoApproval(
      { risk: "medium", confidence: 1.0, readOnly: true },
      {},
    );
    expect(r.autoGranted).toBe(false);
    expect(r.reason).toMatch(/risk-medium/);
  });

  it("high → always require human", () => {
    const r = decideAutoApproval({ risk: "high", confidence: 1.0 }, {});
    expect(r.autoGranted).toBe(false);
    expect(r.reason).toMatch(/risk-high/);
  });

  it("toggle MCP_GRAPH_AUTO_APPROVAL=off blocks all auto-grants", () => {
    const r = decideAutoApproval(
      { risk: "trivial", confidence: 1.0 },
      { MCP_GRAPH_AUTO_APPROVAL: "off" },
    );
    expect(r.autoGranted).toBe(false);
    expect(r.reason).toBe("policy-disabled");
  });

  it("isAutoApprovalDisabled respects env", () => {
    expect(isAutoApprovalDisabled({ MCP_GRAPH_AUTO_APPROVAL: "off" })).toBe(true);
    expect(isAutoApprovalDisabled({})).toBe(false);
  });
});
