import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { detectCurrentPhase, getPhaseGuidance, validatePhaseTransition, type LifecyclePhase, type StrictnessMode } from "../../core/planner/lifecycle-phase.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { generateAndIndexPhaseSummary } from "../../core/rag/phase-summary.js";
import { runAdrChallengeGate } from "../../core/designer/adr-challenge-gate.js";
import { AutopilotBridge } from "../../core/autonomy/autopilot-bridge.js";
import { invalidateAssemblerCache } from "../../core/context/context-assembler.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

// Module-level singleton for autopilot bridge (persists across calls)
const autopilotBridge = new AutopilotBridge();

const VALID_PHASES = ["ANALYZE", "DESIGN", "PLAN", "IMPLEMENT", "VALIDATE", "REVIEW", "HANDOFF", "DEPLOY", "LISTENING", "auto"] as const;

export function registerSetPhase(server: McpServer, store: SqliteStore): void {
  server.tool(
    "set_phase",
    "Override lifecycle phase detection or reset to auto-detection. Use mode to switch between strict/advisory enforcement.",
    {
      phase: z.enum(VALID_PHASES).describe(
        "Lifecycle phase to force, or 'auto' to reset to automatic detection",
      ),
      force: z.boolean().optional().describe(
        "Force phase transition even if gate conditions are not met (strict mode only)",
      ),
      mode: z.enum(["strict", "advisory"]).optional().describe(
        "Set lifecycle enforcement mode: 'strict' blocks tools, 'advisory' only warns",
      ),
      codeIntelligence: z.enum(["strict", "advisory", "off"]).optional().describe(
        "Code Intelligence enforcement: 'strict' blocks mutating tools if index empty, 'advisory' warns, 'off' disables",
      ),
      prerequisites: z.enum(["strict", "advisory", "off"]).optional().describe(
        "Tool prerequisites enforcement: 'strict' blocks tools if mandatory prerequisites not called, 'advisory' warns, 'off' disables",
      ),
      teamTask: z.boolean().optional().describe(
        "Enable/disable multi-terminal teamTask mode — activates lock-based task claiming, agent registration, and ownership verification",
      ),
      autopilot: z.boolean().optional().describe(
        "Enable/disable autonomous sprint execution — activates confidence-gated autopilot with safety guardrails",
      ),
      sprintId: z.string().optional().describe(
        "Sprint identifier for autopilot session tracking",
      ),
    },
    async ({ phase, force, mode, codeIntelligence, prerequisites, teamTask, autopilot, sprintId }) => {
      logger.debug("tool:set_phase", { phase, force, mode, codeIntelligence, prerequisites, teamTask });

      // Persist strictness mode if provided
      if (mode) {
        store.setProjectSetting("lifecycle_strictness_mode", mode);
        logger.info("tool:set_phase:mode_changed", { mode });
      }

      // Persist Code Intelligence mode if provided
      if (codeIntelligence) {
        store.setProjectSetting("code_intelligence_mode", codeIntelligence);
        logger.info("tool:set_phase:code_intelligence_changed", { codeIntelligence });
      }

      // Persist Tool Prerequisites mode if provided
      if (prerequisites) {
        store.setProjectSetting("tool_prerequisites_mode", prerequisites);
        logger.info("tool:set_phase:prerequisites_changed", { prerequisites });
      }

      // Persist teamTask mode if provided
      if (teamTask !== undefined) {
        store.setProjectSetting("team_task_mode", teamTask ? "on" : "off");
        logger.info("tool:set_phase:team_task_changed", { teamTask });
      }

      if (phase === "auto") {
        store.setProjectSetting("lifecycle_phase_override", "");
        const doc = store.toGraphDocument();
        const detectedPhase = detectCurrentPhase(doc);
        const guidance = getPhaseGuidance(detectedPhase);
        const currentMode = mode ?? (store.getProjectSetting("lifecycle_strictness_mode") as StrictnessMode | null) ?? "strict";

        const currentCodeIntel = codeIntelligence ?? store.getProjectSetting("code_intelligence_mode") ?? "off";
        const currentPrereqs = prerequisites ?? store.getProjectSetting("tool_prerequisites_mode") ?? "advisory";
        logger.info("tool:set_phase:ok", { action: "auto", detectedPhase, mode: currentMode, codeIntelligence: currentCodeIntel, prerequisites: currentPrereqs });
        return mcpText({
          ok: true,
          action: "reset_to_auto",
          detectedPhase,
          mode: currentMode,
          codeIntelligence: currentCodeIntel,
          prerequisites: currentPrereqs,
          reminder: guidance.reminder,
        });
      }

      // Validate phase transition gate
      const doc = store.toGraphDocument();
      const currentPhaseOverride = store.getProjectSetting("lifecycle_phase_override");
      const currentPhase = currentPhaseOverride
        ? currentPhaseOverride as typeof VALID_PHASES[number]
        : detectCurrentPhase(doc);
      const currentMode: StrictnessMode = mode ?? (store.getProjectSetting("lifecycle_strictness_mode") as StrictnessMode | null) ?? "strict";

      if (currentPhase !== phase) {
        const gateResult = validatePhaseTransition(doc, currentPhase as Exclude<typeof phase, "auto">, phase);

        if (!gateResult.allowed && currentMode === "strict" && !force) {
          logger.warn("tool:set_phase:gate_blocked", { from: currentPhase, to: phase, unmetConditions: gateResult.unmetConditions });
          // Bug #086: English in MCP tool responses
          return mcpError(`phase_gate_blocked: from ${currentPhase} to ${phase}. ${gateResult.reason}. Unmet: ${JSON.stringify(gateResult.unmetConditions)}. Hint: Use force:true to bypass, or complete the listed conditions`);
        }

        if (!gateResult.allowed && force) {
          logger.warn("tool:set_phase:forced", { from: currentPhase, to: phase, unmetConditions: gateResult.unmetConditions });
        }
      }

      // ADR Challenge Gate for DESIGN→PLAN transition
      if (currentPhase === "DESIGN" && phase === "PLAN" && !force) {
        const adrGateMode = store.getProjectSetting("lifecycle_strictness_mode") ?? currentMode;
        const adrResult = runAdrChallengeGate(store, adrGateMode as "strict" | "advisory" | "off");

        if (adrResult.blocked) {
          const failedNames = adrResult.failedDecisions.map((d) => `${d.title} (score: ${d.score})`).join("; ");
          logger.warn("tool:set_phase:adr_gate_blocked", { failed: adrResult.failedDecisions.length });
          return mcpError(`adr_challenge_gate_blocked: ${adrResult.failedDecisions.length} decision(s) failed challenge: ${failedNames}. Hint: Use force:true to bypass, or improve the failing ADRs`);
        }
      }

      // Generate phase summary when transitioning between different phases
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
          logger.warn("tool:set_phase:summary_failed", { error: String(err) });
        }
      }

      store.setProjectSetting("lifecycle_phase_override", phase);
      const guidance = getPhaseGuidance(phase);

      // Invalidate assembler cache on actual phase transitions
      let cacheInvalidated = false;
      if (currentPhase !== phase) {
        try {
          invalidateAssemblerCache();
          cacheInvalidated = true;
          logger.info("tool:set_phase:cache_invalidated", { from: currentPhase, to: phase });
        } catch (err) {
          logger.warn("tool:set_phase:cache_invalidation_failed", { error: String(err) });
        }
      }

      // Handle autopilot bridge (M.A.P.A.: A — Anchor Flow with Gates)
      let autopilotResult: Record<string, unknown> | undefined;
      if (autopilot !== undefined) {
        const bridgeResult = autopilotBridge.handlePhaseChange(phase, autopilot, sprintId);
        autopilotResult = {
          autopilotActive: bridgeResult.autopilotActive,
          action: bridgeResult.action,
          ...(bridgeResult.sessionId ? { sessionId: bridgeResult.sessionId } : {}),
          ...(bridgeResult.summary ? { summary: bridgeResult.summary } : {}),
        };
        // Wire session chaining when autopilot starts: subscribe to context:pressure_warning
        if (autopilot && bridgeResult.action === "started" && store.eventBus) {
          autopilotBridge.subscribeToEventBus(store.getDb(), store.eventBus);
          logger.info("tool:set_phase:autopilot:session-chain-subscribed");
        }
        logger.info("tool:set_phase:autopilot", { action: bridgeResult.action, active: bridgeResult.autopilotActive });
      }

      const currentCodeIntel = codeIntelligence ?? store.getProjectSetting("code_intelligence_mode") ?? "off";
      const currentPrereqs = prerequisites ?? store.getProjectSetting("tool_prerequisites_mode") ?? "advisory";
      logger.info("tool:set_phase:ok", { action: "override", phase, mode: currentMode, codeIntelligence: currentCodeIntel, prerequisites: currentPrereqs, phaseSummaryIndexed });
      return mcpText({
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
      });
    },
  );
}
