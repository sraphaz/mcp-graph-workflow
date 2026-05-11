/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 4.3 — evidence-validator + gate anti-alucinação.
 *
 * AC1: strict + click without screenshot → ok=false, code=missing_evidence
 * AC2: advisory + same situation → ok=true + warning
 * AC3: checkBrowserTestEvidenceComplete passes when all steps have evidence
 */

import { describe, it, expect } from "vitest";
import {
  validateEvidence,
  checkBrowserTestEvidenceComplete,
  SCREENSHOT_REQUIRED_ACTIONS,
} from "../core/browser-harness/evidence-validator.js";

describe("evidence-validator — AC1: strict mode blocks missing screenshot", () => {
  it("click without screenshot → ok=false + missing_evidence", () => {
    const result = validateEvidence({ op: "click", evidences: [] }, "strict");
    expect(result.ok).toBe(false);
    expect(result.code).toBe("missing_evidence");
    expect(result.missing).toContain("screenshot");
  });

  it("type without screenshot → ok=false + missing_evidence", () => {
    const result = validateEvidence({ op: "type", evidences: [] }, "strict");
    expect(result.ok).toBe(false);
    expect(result.code).toBe("missing_evidence");
  });

  it("click WITH screenshot → ok=true", () => {
    const result = validateEvidence({ op: "click", evidences: ["screenshot"] }, "strict");
    expect(result.ok).toBe(true);
    expect(result.code).toBeUndefined();
  });
});

describe("evidence-validator — AC2: advisory mode warns, does not block", () => {
  it("click without screenshot → ok=true + warning", () => {
    const result = validateEvidence({ op: "click", evidences: [] }, "advisory");
    expect(result.ok).toBe(true);
    expect(result.warning).toMatch(/missing_evidence/);
    expect(result.missing).toContain("screenshot");
  });

  it("op with no evidence requirement → ok=true, no warning", () => {
    const result = validateEvidence({ op: "helpers_list", evidences: [] }, "advisory");
    expect(result.ok).toBe(true);
    expect(result.warning).toBeUndefined();
  });
});

describe("evidence-validator — AC3: checkBrowserTestEvidenceComplete", () => {
  it("all click/type steps with screenshots → true", () => {
    const evidences = [
      { selector: "#btn", action: "click", screenshot: "base64data" },
      { selector: "#inp", action: "type", screenshot: "base64data2" },
    ];
    expect(checkBrowserTestEvidenceComplete(evidences)).toBe(true);
  });

  it("click step without screenshot → false", () => {
    const evidences = [
      { selector: "#btn", action: "click" },
    ];
    expect(checkBrowserTestEvidenceComplete(evidences)).toBe(false);
  });

  it("non-screenshot-required actions pass even without screenshot", () => {
    const evidences = [
      { selector: "", action: "page_info" },
      { selector: "", action: "wait_for_load" },
    ];
    expect(checkBrowserTestEvidenceComplete(evidences)).toBe(true);
  });
});

describe("evidence-validator — SCREENSHOT_REQUIRED_ACTIONS export", () => {
  it("contains click and type", () => {
    expect(SCREENSHOT_REQUIRED_ACTIONS.has("click")).toBe(true);
    expect(SCREENSHOT_REQUIRED_ACTIONS.has("type")).toBe(true);
  });

  it("does not contain read-only ops", () => {
    expect(SCREENSHOT_REQUIRED_ACTIONS.has("helpers_list")).toBe(false);
    expect(SCREENSHOT_REQUIRED_ACTIONS.has("page_info")).toBe(false);
  });
});
