/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Public-phase façade — maps the 9 internal lifecycle phases to the 4
 * user-facing phases the official onboarding guide and Copilot CLI skills
 * use (ANALYZE → DESIGN → PLAN → IMPLEMENT).
 *
 * Why two layers:
 *   - Internally we keep 9 phases (memory rule "9-phase methodology mandatory")
 *     because gates/quality checks/skills/etc. need fine-grained granularity.
 *   - Publicly users only ever see 4. The user's onboarding doc and the
 *     /graph-analyze/design/plan/implement Copilot skills speak in 4.
 *
 * Mapping (T4.9 of v10.2.0 DX overhaul):
 *
 *   ANALYZE   (internal) → ANALYZE   (public)
 *   DESIGN              → DESIGN
 *   PLAN                → PLAN
 *   IMPLEMENT           → IMPLEMENT
 *   VALIDATE            → IMPLEMENT  (TDD red→green→refactor cycle)
 *   REVIEW              → IMPLEMENT  (last gate before handoff)
 *   HANDOFF             → IMPLEMENT  (PR opened)
 *   DEPLOY              → IMPLEMENT  (post-merge release)
 *   LISTENING           → ANALYZE    (next cycle starting)
 */

import type { LifecyclePhase } from "../planner/lifecycle-phase.js";

/** Re-export under a clearer name for the public/internal distinction. */
export type InternalPhase = LifecyclePhase;

/** The 4 phases users actually see. */
export type PublicPhase = "ANALYZE" | "DESIGN" | "PLAN" | "IMPLEMENT";

/** Ordered list — useful for UI rendering (steps progress bar) and validation. */
export const PUBLIC_PHASE_ORDER: readonly PublicPhase[] = [
  "ANALYZE",
  "DESIGN",
  "PLAN",
  "IMPLEMENT",
] as const;

/**
 * Canonical many-to-one mapping. Total over the LifecyclePhase union — the
 * type checker would error if a new internal phase were added without
 * updating this table.
 */
const INTERNAL_TO_PUBLIC: Record<InternalPhase, PublicPhase> = {
  ANALYZE: "ANALYZE",
  DESIGN: "DESIGN",
  PLAN: "PLAN",
  IMPLEMENT: "IMPLEMENT",
  VALIDATE: "IMPLEMENT",
  REVIEW: "IMPLEMENT",
  HANDOFF: "IMPLEMENT",
  DEPLOY: "IMPLEMENT",
  LISTENING: "ANALYZE",
};

/** Returns the public phase for any internal phase. Total function — no fallback needed. */
export function getPublicPhase(internal: InternalPhase): PublicPhase {
  return INTERNAL_TO_PUBLIC[internal];
}

/** Human-readable label for a public phase, in PT-BR (matches the user's onboarding guide). */
export function getPublicPhaseLabel(phase: PublicPhase): string {
  switch (phase) {
    case "ANALYZE":
      return "ANALYZE — Análise de Requisitos";
    case "DESIGN":
      return "DESIGN — Arquitetura e Decisões";
    case "PLAN":
      return "PLAN — Planejamento e Decomposição";
    case "IMPLEMENT":
      return "IMPLEMENT — Execução com TDD";
  }
}

/**
 * Validates that a transition between public phases is allowed.
 *
 * Allowed transitions (simple linear with backtrack):
 *   - same phase (no-op)
 *   - one step forward (e.g. ANALYZE → DESIGN)
 *   - any step backward (e.g. IMPLEMENT → DESIGN, when blockers surface)
 *   - IMPLEMENT → ANALYZE (cycle restart, mirrors LISTENING → ANALYZE internally)
 *
 * Skipping forward (e.g. ANALYZE → IMPLEMENT) is rejected — gates would be unmet.
 */
export function isValidTransition(from: PublicPhase, to: PublicPhase): boolean {
  if (from === to) return true;
  const fromIdx = PUBLIC_PHASE_ORDER.indexOf(from);
  const toIdx = PUBLIC_PHASE_ORDER.indexOf(to);
  // Backwards always allowed.
  if (toIdx < fromIdx) return true;
  // One step forward allowed.
  if (toIdx === fromIdx + 1) return true;
  // Cycle restart (IMPLEMENT → ANALYZE) explicitly handled by the backwards rule above
  // since ANALYZE is index 0 and IMPLEMENT is index 3. No special case needed.
  return false;
}

/** Lists every internal phase that maps to a given public phase. Useful for `status --verbose`. */
export function listInternalPhasesFor(publicPhase: PublicPhase): InternalPhase[] {
  return Object.entries(INTERNAL_TO_PUBLIC)
    .filter(([, p]) => p === publicPhase)
    .map(([internal]) => internal as InternalPhase);
}
