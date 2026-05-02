/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.D2 — Auto-approval policy.
 * Pure decision: dado risco + confiança + (opcional) read-only flag,
 * decide se aprovação é auto-granted ou requer humano. Caller emite
 * approval:auto-granted ou repassa approval:required.
 */

import type { RiskLevel } from "./risk-classifier.js";

export const AUTO_APPROVAL_MIN_CONFIDENCE = 0.95;

export interface AutoApprovalInput {
  risk: RiskLevel;
  confidence: number;
  readOnly?: boolean;
}

export interface AutoApprovalDecision {
  autoGranted: boolean;
  reason: string;
}

/** isAutoApprovalDisabled — auto-generated description placeholder. */
export function isAutoApprovalDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.MCP_GRAPH_AUTO_APPROVAL === "off";
}

/** decideAutoApproval — auto-generated description placeholder. */
export function decideAutoApproval(
  input: AutoApprovalInput,
  env: NodeJS.ProcessEnv = process.env,
): AutoApprovalDecision {
  if (isAutoApprovalDisabled(env)) {
    return { autoGranted: false, reason: "policy-disabled" };
  }
  if (input.confidence < AUTO_APPROVAL_MIN_CONFIDENCE) {
    return { autoGranted: false, reason: "confidence-below-threshold" };
  }
  if (input.risk === "trivial") {
    return { autoGranted: true, reason: "auto-policy:trivial" };
  }
  if (input.risk === "low" && input.readOnly === true) {
    return { autoGranted: true, reason: "auto-policy:low-readonly" };
  }
  if (input.risk === "low") {
    return { autoGranted: false, reason: "low-not-readonly" };
  }
  return { autoGranted: false, reason: `risk-${input.risk}-requires-human` };
}
