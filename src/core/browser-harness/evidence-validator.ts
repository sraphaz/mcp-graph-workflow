/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-browser-harness — Task 4.3: Evidence-validator + gate anti-alucinação.
 * Pure module — no side effects, no imports from mcp/ or cli/.
 */

export type ValidationMode = "strict" | "advisory";

export interface EvidenceCheckInput {
  op: string;
  evidences: string[];
}

export interface EvidenceValidationResult {
  ok: boolean;
  missing: string[];
  code?: "missing_evidence";
  warning?: string;
}

export const SCREENSHOT_REQUIRED_ACTIONS: ReadonlySet<string> = new Set([
  "click", "type", "select", "submit",
]);

const EVIDENCE_REQUIREMENTS: Record<string, string[]> = {
  click: ["screenshot"],
  type: ["screenshot"],
  select: ["screenshot"],
  submit: ["screenshot"],
};

/**
 * Validate that a browser op has the required evidence items.
 * In strict mode, missing evidence → ok=false + code="missing_evidence".
 * In advisory mode, missing evidence → ok=true + warning string.
 */
export function validateEvidence(
  input: EvidenceCheckInput,
  mode: ValidationMode,
): EvidenceValidationResult {
  const required = EVIDENCE_REQUIREMENTS[input.op] ?? [];
  const missing = required.filter((e) => !input.evidences.includes(e));

  if (missing.length === 0) {
    return { ok: true, missing: [] };
  }

  if (mode === "strict") {
    return { ok: false, missing, code: "missing_evidence" };
  }

  return {
    ok: true,
    missing,
    warning: `missing_evidence: ${missing.join(",")} for op "${input.op}"`,
  };
}

/**
 * Check function for analyze(implement_done) gate: browser_test_evidence_complete.
 * Returns true when every screenshot-required step has a screenshot.
 */
export function checkBrowserTestEvidenceComplete(
  evidences: Array<{ action: string; screenshot?: string }>,
): boolean {
  return evidences.every(
    (e) => !SCREENSHOT_REQUIRED_ACTIONS.has(e.action) || e.screenshot != null,
  );
}
