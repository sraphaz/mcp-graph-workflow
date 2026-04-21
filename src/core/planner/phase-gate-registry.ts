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

/**
 * Phase Gate Registry — canonical source of truth for lifecycle transitions.
 *
 * Maps every declared lifecycle transition to:
 *   - gateMode: "required" (blocks in strict) | "advisory" (warns) | "ungated" (free)
 *   - analyzeModes: analyze tool modes that must run before this transition
 *   - description: human-readable intent for the dashboard timeline
 *
 * Lint invariant: every entry in this registry must have a gateMode set.
 * Transition not in registry = unknown transition → blocked in strict mode.
 *
 * This file is the single authoritative source for the dashboard gate timeline.
 */

import type { LifecyclePhase } from "./lifecycle-phase.js";

export { type LifecyclePhase };

export const LIFECYCLE_PHASES: readonly LifecyclePhase[] = [
  "ANALYZE",
  "DESIGN",
  "PLAN",
  "IMPLEMENT",
  "VALIDATE",
  "REVIEW",
  "HANDOFF",
  "DEPLOY",
  "LISTENING",
] as const;

export type TransitionKey = `${LifecyclePhase}_to_${LifecyclePhase}`;

export type GateMode = "required" | "advisory" | "ungated";

export interface TransitionGateEntry {
  readonly from: LifecyclePhase;
  readonly to: LifecyclePhase;
  readonly gateMode: GateMode;
  readonly description: string;
  /** Analyze modes that must be called before this transition (e.g., ["design_ready"]). */
  readonly analyzeModes: readonly string[];
}

export const PHASE_TRANSITION_REGISTRY: Partial<Record<TransitionKey, TransitionGateEntry>> & Record<string, TransitionGateEntry> = {
  // ── Forward transitions (primary lifecycle flow) ────────────────────────
  ANALYZE_to_DESIGN: {
    from: "ANALYZE", to: "DESIGN", gateMode: "required",
    description: "Requer pelo menos 1 epic ou requirement antes de entrar em DESIGN.",
    analyzeModes: [],
  },
  DESIGN_to_PLAN: {
    from: "DESIGN", to: "PLAN", gateMode: "required",
    description: "Requer design_ready: interfaces, ADRs e dependências definidas.",
    analyzeModes: ["design_ready"],
  },
  PLAN_to_IMPLEMENT: {
    from: "PLAN", to: "IMPLEMENT", gateMode: "required",
    description: "Requer sync_stack_docs + plan_sprint antes de codificar.",
    analyzeModes: [],
  },
  IMPLEMENT_to_VALIDATE: {
    from: "IMPLEMENT", to: "VALIDATE", gateMode: "required",
    description: "Requer ≥1 task done com AC testável e sem blockers abertos.",
    analyzeModes: ["validate_ready"],
  },
  VALIDATE_to_REVIEW: {
    from: "VALIDATE", to: "REVIEW", gateMode: "required",
    description: "Requer validate(ac) + analyze(validate_ready) aprovados.",
    analyzeModes: ["validate_ready"],
  },
  REVIEW_to_HANDOFF: {
    from: "REVIEW", to: "HANDOFF", gateMode: "required",
    description: "Requer analyze(review_ready) + export antes de handoff.",
    analyzeModes: ["review_ready"],
  },
  HANDOFF_to_DEPLOY: {
    from: "HANDOFF", to: "DEPLOY", gateMode: "required",
    description: "Requer analyze(deploy_ready) + snapshot + write_memory.",
    analyzeModes: ["deploy_ready"],
  },
  HANDOFF_to_LISTENING: {
    from: "HANDOFF", to: "LISTENING", gateMode: "required",
    description: "Requer analyze(handoff_ready) + snapshot + write_memory.",
    analyzeModes: ["handoff_ready"],
  },
  DEPLOY_to_LISTENING: {
    from: "DEPLOY", to: "LISTENING", gateMode: "required",
    description: "Requer analyze(deploy_ready) + snapshot pós-release.",
    analyzeModes: ["deploy_ready"],
  },

  // ── Backward / re-entry transitions (advisory) ─────────────────────────
  IMPLEMENT_to_PLAN: {
    from: "IMPLEMENT", to: "PLAN", gateMode: "advisory",
    description: "Re-planejamento permitido; recomendado snapshot antes.",
    analyzeModes: [],
  },
  VALIDATE_to_IMPLEMENT: {
    from: "VALIDATE", to: "IMPLEMENT", gateMode: "advisory",
    description: "Retorno para corrigir falhas encontradas em VALIDATE.",
    analyzeModes: [],
  },
  REVIEW_to_IMPLEMENT: {
    from: "REVIEW", to: "IMPLEMENT", gateMode: "advisory",
    description: "Retorno para corrigir feedback de review.",
    analyzeModes: [],
  },

  // ── Phase resets (ungated — allowed in any strictness) ─────────────────
  DESIGN_to_ANALYZE: {
    from: "DESIGN", to: "ANALYZE", gateMode: "ungated",
    description: "Reset para ANALYZE (sem restrições).",
    analyzeModes: [],
  },
  PLAN_to_ANALYZE: {
    from: "PLAN", to: "ANALYZE", gateMode: "ungated",
    description: "Reset para ANALYZE (sem restrições).",
    analyzeModes: [],
  },
  IMPLEMENT_to_ANALYZE: {
    from: "IMPLEMENT", to: "ANALYZE", gateMode: "ungated",
    description: "Reset completo para ANALYZE.",
    analyzeModes: [],
  },
  LISTENING_to_ANALYZE: {
    from: "LISTENING", to: "ANALYZE", gateMode: "ungated",
    description: "Novo ciclo: reinicia em ANALYZE com novas informações.",
    analyzeModes: [],
  },
} satisfies Partial<Record<TransitionKey, TransitionGateEntry>>;

// ── Public API ─────────────────────────────────────────────────────────────

export interface RegistryCompletenessResult {
  readonly complete: boolean;
  readonly missing: TransitionKey[];
}

/**
 * Lint check: validates that all entries in the registry have a defined gateMode.
 * Returns `complete: true` when the registry satisfies the invariant.
 */
export function validateRegistryCompleteness(): RegistryCompletenessResult {
  const missing: TransitionKey[] = [];

  for (const [key, entry] of Object.entries(PHASE_TRANSITION_REGISTRY) as [TransitionKey, TransitionGateEntry][]) {
    if (!entry.gateMode || !["required", "advisory", "ungated"].includes(entry.gateMode)) {
      missing.push(key);
    }
  }

  return { complete: missing.length === 0, missing };
}

export interface RegistryTransitionResult {
  readonly registered: boolean;
  readonly allowed: boolean;
  readonly gateMode: GateMode | null;
  readonly analyzeModes: readonly string[];
  readonly message: string | undefined;
}

/**
 * Check if a transition is registered and whether it is allowed under the given strictness mode.
 *
 * - Registered + any gateMode → allowed: true (gate enforcement is done by validatePhaseTransition)
 * - Not registered + strict → allowed: false, actionable message pointing to this file + phase
 * - Not registered + advisory → allowed: true with warning message
 */
export function checkRegistryTransition(
  from: LifecyclePhase,
  to: LifecyclePhase,
  mode: "strict" | "advisory",
): RegistryTransitionResult {
  const key = `${from}_to_${to}` as TransitionKey;
  const entry = PHASE_TRANSITION_REGISTRY[key];

  if (entry) {
    return {
      registered: true,
      allowed: true,
      gateMode: entry.gateMode,
      analyzeModes: entry.analyzeModes,
      message: undefined,
    };
  }

  const hint = `Transition "${from}" → "${to}" not found in phase-gate-registry.ts. ` +
    `To allow this transition, add an entry for "${key}" in PHASE_TRANSITION_REGISTRY.`;

  if (mode === "strict") {
    return {
      registered: false,
      allowed: false,
      gateMode: null,
      analyzeModes: [],
      message: hint,
    };
  }

  return {
    registered: false,
    allowed: true,
    gateMode: null,
    analyzeModes: [],
    message: `[advisory] ${hint}`,
  };
}

/**
 * Returns all registry entries as a flat array for dashboard consumption.
 * Each entry includes from, to, gateMode, description, analyzeModes.
 */
export function getRegistryForDashboard(): TransitionGateEntry[] {
  return Object.values(PHASE_TRANSITION_REGISTRY);
}
