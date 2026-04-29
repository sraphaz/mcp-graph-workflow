/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import type { SqliteStore } from "../store/sqlite-store.js";
import {
  detectCurrentPhase,
  getPhaseGuidance,
  validatePhaseTransition,
  type LifecyclePhase,
  type StrictnessMode,
} from "./lifecycle-phase.js";
import { KnowledgeStore } from "../store/knowledge-store.js";
import { generateAndIndexPhaseSummary } from "../rag/phase-summary.js";
import { runAdrChallengeGate } from "../designer/adr-challenge-gate.js";
import { AutopilotBridge } from "../autonomy/autopilot-bridge.js";
import { invalidateAssemblerCache } from "../context/context-assembler.js";
import { logger } from "../utils/logger.js";

const autopilotBridge = new AutopilotBridge();

export type SetPhaseInput = {
  readonly phase:
    | "ANALYZE"
    | "DESIGN"
    | "PLAN"
    | "IMPLEMENT"
    | "VALIDATE"
    | "REVIEW"
    | "HANDOFF"
    | "DEPLOY"
    | "LISTENING"
    | "auto";
  readonly force?: boolean;
  readonly mode?: StrictnessMode;
  readonly codeIntelligence?: "strict" | "advisory" | "off";
  readonly prerequisites?: "strict" | "advisory" | "off";
  readonly featureDepth?: "strict" | "advisory" | "off";
  readonly teamTask?: boolean;
  readonly wipStrict?: boolean;
  readonly maxInFlight?: number;
  readonly autopilot?: boolean;
  readonly sprintId?: string;
  readonly caveman?: boolean;
};

export type SetPhaseSuccess = {
  readonly ok: true;
  readonly action: "reset_to_auto" | "override";
  readonly phase?: LifecyclePhase;
  readonly detectedPhase?: LifecyclePhase;
  readonly mode: StrictnessMode;
  readonly codeIntelligence: string;
  readonly prerequisites: string;
  readonly reminder: string;
  readonly phaseSummaryIndexed?: boolean;
  readonly cacheInvalidated?: boolean;
  readonly autopilot?: Record<string, unknown>;
  readonly caveman?: boolean;
};

export type SetPhaseBlocked = {
  readonly ok: false;
  readonly kind: "phase_gate_blocked" | "adr_challenge_gate_blocked";
  readonly error: string;
  readonly details?: Record<string, unknown>;
};

export type SetPhaseResult = SetPhaseSuccess | SetPhaseBlocked;

export function setPhaseCore(store: SqliteStore, input: SetPhaseInput): SetPhaseResult {
  const {
    phase,
    force,
    mode,
    codeIntelligence,
    prerequisites,
    featureDepth,
    teamTask,
    wipStrict,
    maxInFlight,
    autopilot,
    sprintId,
    caveman,
  } = input;

  if (caveman !== undefined) {
    store.setProjectSetting("caveman_mode", caveman ? "on" : "off");
    logger.info("set_phase_core:caveman_changed", { caveman });
  }

  logger.debug("set_phase_core", {
    phase,
    force,
    mode,
    codeIntelligence,
    prerequisites,
    teamTask,
    wipStrict,
    maxInFlight,
  });

  if (mode) {
    store.setProjectSetting("lifecycle_strictness_mode", mode);
    logger.info("set_phase_core:mode_changed", { mode });
  }

  if (codeIntelligence) {
    store.setProjectSetting("code_intelligence_mode", codeIntelligence);
    logger.info("set_phase_core:code_intelligence_changed", { codeIntelligence });
  }

  if (prerequisites) {
    store.setProjectSetting("tool_prerequisites_mode", prerequisites);
    logger.info("set_phase_core:prerequisites_changed", { prerequisites });
  }

  if (featureDepth) {
    store.setProjectSetting("feature_depth_mode", featureDepth);
    logger.info("set_phase_core:feature_depth_changed", { featureDepth });
  }

  if (teamTask !== undefined) {
    store.setProjectSetting("team_task_mode", teamTask ? "on" : "off");
    logger.info("set_phase_core:team_task_changed", { teamTask });
  }

  if (wipStrict !== undefined) {
    store.setProjectSetting("wip_strict_mode", wipStrict ? "true" : "false");
    logger.info("set_phase_core:wip_strict_changed", { wipStrict });
  } else if (teamTask !== undefined) {
    store.setProjectSetting("wip_strict_mode", teamTask ? "true" : "false");
  }

  if (maxInFlight !== undefined) {
    store.setProjectSetting("wip_max_in_flight", String(maxInFlight));
    logger.info("set_phase_core:wip_max_in_flight_changed", { maxInFlight });
  }

  if (phase === "auto") {
    store.setProjectSetting("lifecycle_phase_override", "");
    const doc = store.toGraphDocument();
    const detectedPhase = detectCurrentPhase(doc);
    const guidance = getPhaseGuidance(detectedPhase);
    const currentMode =
      mode ?? (store.getProjectSetting("lifecycle_strictness_mode") as StrictnessMode | null) ?? "strict";
    const currentCodeIntel = codeIntelligence ?? store.getProjectSetting("code_intelligence_mode") ?? "off";
    const currentPrereqs = prerequisites ?? store.getProjectSetting("tool_prerequisites_mode") ?? "advisory";

    logger.info("set_phase_core:ok", {
      action: "auto",
      detectedPhase,
      mode: currentMode,
      codeIntelligence: currentCodeIntel,
      prerequisites: currentPrereqs,
    });

    return {
      ok: true,
      action: "reset_to_auto",
      detectedPhase,
      mode: currentMode,
      codeIntelligence: currentCodeIntel,
      prerequisites: currentPrereqs,
      reminder: guidance.reminder,
    };
  }

  const doc = store.toGraphDocument();
  const currentPhaseOverride = store.getProjectSetting("lifecycle_phase_override");
  const currentPhase = currentPhaseOverride
    ? (currentPhaseOverride as LifecyclePhase)
    : detectCurrentPhase(doc);
  const currentMode: StrictnessMode =
    mode ?? (store.getProjectSetting("lifecycle_strictness_mode") as StrictnessMode | null) ?? "strict";

  if (currentPhase !== phase) {
    const gateResult = validatePhaseTransition(doc, currentPhase as Exclude<typeof phase, "auto">, phase);

    if (!gateResult.allowed && currentMode === "strict" && !force) {
      logger.warn("set_phase_core:gate_blocked", {
        from: currentPhase,
        to: phase,
        unmetConditions: gateResult.unmetConditions,
      });
      return {
        ok: false,
        kind: "phase_gate_blocked",
        error: `phase_gate_blocked: from ${currentPhase} to ${phase}. ${gateResult.reason}. Unmet: ${JSON.stringify(gateResult.unmetConditions)}. Hint: Use force:true to bypass, or complete the listed conditions`,
        details: {
          from: currentPhase,
          to: phase,
          reason: gateResult.reason,
          unmetConditions: gateResult.unmetConditions,
        },
      };
    }

    if (!gateResult.allowed && force) {
      logger.warn("set_phase_core:forced", {
        from: currentPhase,
        to: phase,
        unmetConditions: gateResult.unmetConditions,
      });
    }
  }

  if (currentPhase === "DESIGN" && phase === "PLAN" && !force) {
    const adrGateMode = store.getProjectSetting("lifecycle_strictness_mode") ?? currentMode;
    const adrResult = runAdrChallengeGate(store, adrGateMode as "strict" | "advisory" | "off");

    if (adrResult.blocked) {
      const failedNames = adrResult.failedDecisions
        .map((d) => `${d.title} (score: ${d.score})`)
        .join("; ");
      logger.warn("set_phase_core:adr_gate_blocked", { failed: adrResult.failedDecisions.length });
      return {
        ok: false,
        kind: "adr_challenge_gate_blocked",
        error: `adr_challenge_gate_blocked: ${adrResult.failedDecisions.length} decision(s) failed challenge: ${failedNames}. Hint: Use force:true to bypass, or improve the failing ADRs`,
        details: { failedDecisions: adrResult.failedDecisions },
      };
    }
  }

  let phaseSummaryIndexed = false;
  if (currentPhase !== phase) {
    try {
      const knowledgeStore = new KnowledgeStore(store.getDb());
      const summaryResult = generateAndIndexPhaseSummary(
        knowledgeStore,
        doc,
        currentPhase as LifecyclePhase,
        phase,
      );
      phaseSummaryIndexed = summaryResult.indexed;
    } catch (err) {
      logger.warn("set_phase_core:summary_failed", { error: String(err) });
    }
  }

  store.setProjectSetting("lifecycle_phase_override", phase);
  const guidance = getPhaseGuidance(phase);

  let cacheInvalidated = false;
  if (currentPhase !== phase) {
    try {
      invalidateAssemblerCache();
      cacheInvalidated = true;
      logger.info("set_phase_core:cache_invalidated", { from: currentPhase, to: phase });
    } catch (err) {
      logger.warn("set_phase_core:cache_invalidation_failed", { error: String(err) });
    }
  }

  let autopilotResult: Record<string, unknown> | undefined;
  if (autopilot !== undefined) {
    const bridgeResult = autopilotBridge.handlePhaseChange(phase, autopilot, sprintId);
    autopilotResult = {
      autopilotActive: bridgeResult.autopilotActive,
      action: bridgeResult.action,
      ...(bridgeResult.sessionId ? { sessionId: bridgeResult.sessionId } : {}),
      ...(bridgeResult.summary ? { summary: bridgeResult.summary } : {}),
    };
    if (autopilot && bridgeResult.action === "started" && store.eventBus) {
      autopilotBridge.subscribeToEventBus(store.getDb(), store.eventBus);
      logger.info("set_phase_core:autopilot:session-chain-subscribed");
    }
    logger.info("set_phase_core:autopilot", {
      action: bridgeResult.action,
      active: bridgeResult.autopilotActive,
    });
  }

  const currentCodeIntel = codeIntelligence ?? store.getProjectSetting("code_intelligence_mode") ?? "off";
  const currentPrereqs = prerequisites ?? store.getProjectSetting("tool_prerequisites_mode") ?? "advisory";

  logger.info("set_phase_core:ok", {
    action: "override",
    phase,
    mode: currentMode,
    codeIntelligence: currentCodeIntel,
    prerequisites: currentPrereqs,
    phaseSummaryIndexed,
  });

  return {
    ok: true,
    action: "override",
    phase,
    mode: currentMode,
    codeIntelligence: currentCodeIntel,
    prerequisites: currentPrereqs,
    reminder: guidance.reminder,
    phaseSummaryIndexed,
    ...(cacheInvalidated ? { cacheInvalidated } : {}),
    ...(autopilotResult ? { autopilot: autopilotResult } : {}),
    ...(caveman !== undefined ? { caveman } : {}),
  };
}
