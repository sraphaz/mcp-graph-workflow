/**
 * Unified Gate System — combines lifecycle enforcement and code intelligence enrichment
 * into a single tool wrapper. Replaces lifecycle-wrapper.ts + code-intelligence-wrapper.ts.
 *
 * v7.0 refactor: single wrap per tool, single read of store/doc/phase per call,
 * eliminates deadlock bugs (#001-#007) from double-wrapping.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../core/store/sqlite-store.js";
import type { GraphDocument } from "../core/graph/graph-types.js";
import {
  detectCurrentPhase,
  getPhaseGuidance,
  detectWarnings,
  checkToolGate,
  checkStatusGate,
  checkPrerequisiteGate,
  type LifecyclePhase,
  type LifecycleWarning,
  type StrictnessMode,
} from "../core/planner/lifecycle-phase.js";
import { ToolCallLog } from "../core/store/tool-call-log.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { ToolTokenStore } from "../core/store/tool-token-store.js";
import { estimateTokens } from "../core/context/token-estimator.js";
import { logger } from "../core/utils/logger.js";
import { GraphEventBus } from "../core/events/event-bus.js";
import { categorizeError, generateErrorHash } from "../core/skills/self-healing-listener.js";
import { recommendBuiltInSkills, type SkillRecommendation } from "../core/insights/skill-recommender.js";
import { computeNextAction, type NextAction } from "../core/planner/next-action.js";
import { CodeStore } from "../core/code/code-store.js";
import { analyzeImpact } from "../core/code/graph-traversal.js";
import type { CodeSymbol } from "../core/code/code-types.js";
import { READ_ONLY_TOOLS } from "./tool-classification.js";
import { runHarnessScanCached } from "../core/harness/harness-cache.js";
import { execSync } from "child_process";

// ── Re-exported types (backward compat for tests importing from old files) ──

export type { LifecyclePhase, LifecycleWarning, StrictnessMode };

export type CodeIntelligenceMode = "strict" | "advisory" | "off";

export interface PhaseKnowledgeSnippet {
  title: string;
  sourceType: string;
  snippet: string;
  phase?: string;
}

export interface LifecycleHarnessInfo {
  score: number;
  grade: string;
}

export interface LifecycleBlock {
  phase: LifecyclePhase;
  reminder: string;
  suggestedNext: string[];
  principles: string[];
  warnings: LifecycleWarning[];
  suggestedMcpAgents?: import("../core/planner/lifecycle-phase.js").McpAgentSuggestion[];
  suggestedSkills?: string[];
  recommendedSkills?: SkillRecommendation[];
  phaseKnowledge?: PhaseKnowledgeSnippet[];
  harness?: LifecycleHarnessInfo | null;
  harnessBaselineHint?: string;
  nextAction?: NextAction;
}

export interface LifecycleBlockOptions {
  toolName?: string;
  hasSnapshots?: boolean;
  phaseOverride?: LifecyclePhase | null;
  mode?: StrictnessMode;
  store?: SqliteStore;
}

export interface CodeIntelWarning {
  code: "index_empty" | "index_stale" | "enrichment_failed" | "no_relevant_symbols";
  message: string;
  severity: "error" | "warning" | "info";
}

export interface CodeIntelEnrichment {
  type: "implement" | "review" | "validate" | "generic";
  relevantSymbols: Array<{ name: string; file: string; kind: string }>;
  impactAnalysis?: {
    affectedCount: number;
    riskLevel: "low" | "medium" | "high";
    topAffected: Array<{ name: string; file: string; confidence: number }>;
  };
}

export interface IndexStatus {
  available: boolean;
  stale: boolean;
  lastIndexed: string | null;
  symbolCount: number;
}

export interface CodeIntelligenceBlock {
  mode: CodeIntelligenceMode;
  indexStatus: IndexStatus;
  enrichment?: CodeIntelEnrichment;
  warnings: CodeIntelWarning[];
}

// ── Constants ──────────────────────────────────────────────

const ENRICHED_PHASES = new Set<string>(["IMPLEMENT", "REVIEW", "VALIDATE"]);
const MAX_TOP_AFFECTED = 5;

// ── Stale warning dedup (per session) ─────────────────────

const _emittedStaleWarnings = new Set<string>();

/** Clear the session-level stale index warning dedup set. */
export function resetStaleWarningDedup(): void {
  _emittedStaleWarnings.clear();
}

// ── Git hash cache ────────────────────────────────────────

let cachedGitHash: string | null = null;
let gitHashTimestamp = 0;
const GIT_HASH_TTL_MS = 30_000;

function getCurrentGitHash(basePath?: string): string | null {
  const now = Date.now();
  if (cachedGitHash !== null && now - gitHashTimestamp < GIT_HASH_TTL_MS) {
    return cachedGitHash;
  }
  try {
    cachedGitHash = execSync("git rev-parse HEAD", {
      cwd: basePath ?? process.cwd(),
      encoding: "utf-8",
      timeout: 2000,
    }).trim();
    gitHashTimestamp = now;
    return cachedGitHash;
  } catch {
    cachedGitHash = null;
    gitHashTimestamp = now;
    return null;
  }
}

// ── Lifecycle block builder ───────────────────────────────

/** Build the lifecycle metadata block from a graph document for appending to tool responses. */
export function buildLifecycleBlock(doc: GraphDocument, options?: LifecycleBlockOptions): LifecycleBlock {
  const phase = detectCurrentPhase(doc, {
    hasSnapshots: options?.hasSnapshots,
    phaseOverride: options?.phaseOverride,
  });
  const guidance = getPhaseGuidance(phase);
  const warnings = options?.toolName && !READ_ONLY_TOOLS.has(options.toolName)
    ? detectWarnings(doc, phase, options.toolName, options?.mode)
    : [];

  let phaseKnowledge: PhaseKnowledgeSnippet[] | undefined;
  if (options?.store) {
    try {
      const knowledgeStore = new KnowledgeStore(options.store.getDb());
      const phaseQuery = `phase ${phase} context`;
      const results = knowledgeStore.searchWithPhaseBoost(phaseQuery, phase, 3);
      if (results.length > 0) {
        phaseKnowledge = results.map((r) => ({
          title: r.title,
          sourceType: r.sourceType,
          snippet: r.content.length > 200 ? r.content.slice(0, 200) + "..." : r.content,
          phase: (r.metadata?.phase as string) ?? undefined,
        }));
      }
    } catch {
      logger.debug("unified-gate: phase knowledge search skipped");
    }
  }

  return {
    phase,
    reminder: guidance.reminder,
    suggestedNext: guidance.suggestedTools,
    principles: guidance.principles,
    warnings,
    ...(guidance.suggestedMcpAgents?.length ? { suggestedMcpAgents: guidance.suggestedMcpAgents } : {}),
    ...(guidance.suggestedSkills?.length ? { suggestedSkills: guidance.suggestedSkills } : {}),
    ...(phaseKnowledge?.length ? { phaseKnowledge } : {}),
    ...(() => {
      try {
        const recs = recommendBuiltInSkills(doc, phase).slice(0, 3);
        return recs.length > 0 ? { recommendedSkills: recs } : {};
      } catch {
        return {};
      }
    })(),
    ...(() => {
      try {
        const cached = runHarnessScanCached(process.cwd());
        if (cached) {
          return { harness: { score: cached.score, grade: cached.grade } };
        }
        // In ANALYZE phase without harness data, suggest establishing baseline
        if (phase === "ANALYZE") {
          return { harnessBaselineHint: "Run analyze(mode: 'harness_scan') to establish harness baseline for agent readiness tracking." };
        }
        return {};
      } catch {
        if (phase === "ANALYZE") {
          return { harnessBaselineHint: "Run analyze(mode: 'harness_scan') to establish harness baseline for agent readiness tracking." };
        }
        return {};
      }
    })(),
  };
}

/** Append a _lifecycle block to a JSON response string. */
export function appendLifecycleToResponse(responseJson: string, doc: GraphDocument): string {
  try {
    const parsed = JSON.parse(responseJson);
    parsed._lifecycle = buildLifecycleBlock(doc);
    return JSON.stringify(parsed, null, 2);
  } catch {
    const block = buildLifecycleBlock(doc);
    return responseJson + "\n\n---\n_lifecycle: " + JSON.stringify(block, null, 2);
  }
}

// ── Code Intelligence block builder ───────────────────────

/** Check whether the code intelligence index is available and stale relative to current git hash. */
export function detectStaleIndex(
  codeStore: CodeStore,
  projectId: string,
  currentGitHash?: string | null,
): IndexStatus {
  const meta = codeStore.getIndexMeta(projectId);
  if (!meta) {
    return { available: false, stale: false, lastIndexed: null, symbolCount: 0 };
  }
  const gitHash = currentGitHash !== undefined ? currentGitHash : getCurrentGitHash();
  const stale = !!meta.gitHash && !!gitHash && meta.gitHash !== gitHash;
  return { available: true, stale, lastIndexed: meta.lastIndexed, symbolCount: meta.symbolCount };
}

/** Extract symbol name hints from tool arguments for code intelligence enrichment. */
export function extractRelevantHints(toolName: string, args: unknown[]): string[] {
  const toolArgs = args[0] as Record<string, unknown> | undefined;
  if (!toolArgs) return [];
  const hints: string[] = [];
  if (typeof toolArgs.nodeId === "string") hints.push(toolArgs.nodeId);
  if (typeof toolArgs.title === "string") {
    hints.push(...toolArgs.title.split(/\s+/).filter(w => /^[a-zA-Z_]\w*$/.test(w) && w.length > 3));
  }
  if (typeof toolArgs.file === "string") hints.push(toolArgs.file);
  if (typeof toolArgs.description === "string") {
    const backtickMatches = toolArgs.description.match(/`([^`]+)`/g);
    if (backtickMatches) hints.push(...backtickMatches.map(m => m.replace(/`/g, "")));
  }
  return [...new Set(hints)];
}

function phaseToEnrichmentType(phase: string): "implement" | "review" | "validate" | "generic" {
  switch (phase) {
    case "IMPLEMENT": return "implement";
    case "REVIEW": return "review";
    case "VALIDATE": return "validate";
    default: return "generic";
  }
}

function buildPhaseEnrichment(
  codeStore: CodeStore,
  projectId: string,
  phase: string,
  toolName: string,
  args: unknown[],
  warnings: CodeIntelWarning[],
): CodeIntelEnrichment | undefined {
  if (!ENRICHED_PHASES.has(phase)) {
    return { type: "generic", relevantSymbols: [] };
  }
  const hints = extractRelevantHints(toolName, args);
  const relevantSymbols: CodeSymbol[] = [];
  for (const hint of hints) {
    relevantSymbols.push(...codeStore.findSymbolsByName(hint, projectId));
  }
  if (relevantSymbols.length === 0 && hints.length > 0) {
    warnings.push({ code: "no_relevant_symbols", message: `No symbols found matching hints: ${hints.join(", ")}`, severity: "info" });
  }
  const symbolSummary = relevantSymbols.map(s => ({ name: s.name, file: s.file, kind: s.kind }));
  const type = phaseToEnrichmentType(phase);
  let impactAnalysis: CodeIntelEnrichment["impactAnalysis"];
  if (relevantSymbols.length > 0) {
    const primarySymbol = relevantSymbols[0];
    const direction = type === "validate" ? "downstream" : "upstream";
    const maxDepth = type === "review" ? 3 : 2;
    const impact = analyzeImpact(codeStore, primarySymbol.name, projectId, direction, maxDepth);
    impactAnalysis = {
      affectedCount: impact.affectedSymbols.length,
      riskLevel: impact.riskLevel,
      topAffected: impact.affectedSymbols.slice(0, MAX_TOP_AFFECTED).map(a => ({ name: a.name, file: a.file, confidence: a.confidence })),
    };
  }
  return { type, relevantSymbols: symbolSummary, impactAnalysis };
}

/** Build the code intelligence enrichment block with index status and phase-aware impact analysis. */
export function buildCodeIntelBlock(
  codeStore: CodeStore,
  projectId: string,
  phase: string,
  mode: CodeIntelligenceMode,
  toolName: string,
  args: unknown[],
  currentGitHash?: string | null,
): CodeIntelligenceBlock {
  if (mode === "off") {
    return { mode: "off", indexStatus: { available: false, stale: false, lastIndexed: null, symbolCount: 0 }, warnings: [] };
  }
  const indexStatus = detectStaleIndex(codeStore, projectId, currentGitHash);
  const warnings: CodeIntelWarning[] = [];
  const isReadOnly = READ_ONLY_TOOLS.has(toolName);
  if (!indexStatus.available) {
    warnings.push({ code: "index_empty", message: "Code Intelligence index is empty. Run knowledge(action:reindex) or code_intelligence to build it.", severity: mode === "strict" && !isReadOnly ? "error" : "warning" });
    return { mode, indexStatus, warnings };
  }
  if (indexStatus.stale) {
    const dedupKey = `index_stale:${projectId}`;
    if (!_emittedStaleWarnings.has(dedupKey)) {
      _emittedStaleWarnings.add(dedupKey);
      warnings.push({ code: "index_stale", message: "Code Intelligence index is stale (git hash mismatch). Consider running knowledge(action:reindex).", severity: "warning" });
    }
  }
  const enrichment = buildPhaseEnrichment(codeStore, projectId, phase, toolName, args, warnings);
  return { mode, indexStatus, enrichment, warnings };
}

/** Build an error response when a tool is blocked by the code intelligence gate. */
export function buildBlockedResponseCodeIntel(toolName: string, warnings: CodeIntelWarning[]): ToolCallResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: "code_intelligence_gate_blocked", tool: toolName, warnings, hint: "Run knowledge(action:reindex) to build the code index, or use set_phase({codeIntelligence:'advisory'}) to switch to advisory mode." }, null, 2) }],
    isError: true,
  };
}

// ── Internal helpers ──────────────────────────────────────

interface RegisteredTool {
  handler: (...args: unknown[]) => Promise<unknown>;
  enabled: boolean;
  [key: string]: unknown;
}

interface ToolCallResult {
  content?: Array<{ type: string; text?: string; [key: string]: unknown }>;
  isError?: boolean;
  [key: string]: unknown;
}

function buildBlockedResponse(toolName: string, phase: LifecyclePhase, warnings: LifecycleWarning[]): ToolCallResult {
  const errorWarnings = warnings.filter((w) => w.severity === "error");
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: "lifecycle_gate_blocked", phase, tool: toolName, reason: errorWarnings.map((w) => w.message).join("; "), warnings: errorWarnings, hint: "Use set_phase com force:true para bypass, ou mude para mode:'advisory' com set_phase({phase:'auto', mode:'advisory'})" }, null, 2) }],
    isError: true,
  };
}

function extractStatusArgs(toolName: string, args: unknown[]): { nodeId?: string; newStatus?: string } {
  if (toolName !== "update_status") return {};
  const toolArgs = args[0] as Record<string, unknown> | undefined;
  if (!toolArgs) return {};
  return { nodeId: toolArgs.nodeId as string | undefined, newStatus: toolArgs.status as string | undefined };
}

function extractNodeId(args: unknown[]): string | undefined {
  const toolArgs = args[0] as Record<string, unknown> | undefined;
  if (!toolArgs) return undefined;
  return (toolArgs.nodeId ?? toolArgs.id) as string | undefined;
}

function extractRelevantArgs(toolName: string, toolArgs: Record<string, unknown>): string | undefined {
  if (toolName === "analyze" && toolArgs.mode) return JSON.stringify({ mode: toolArgs.mode });
  if (toolName === "validate" && toolArgs.action) return JSON.stringify({ action: toolArgs.action });
  if (toolName === "update_status" && toolArgs.status) return JSON.stringify({ status: toolArgs.status });
  if (toolName === "set_phase" && toolArgs.phase) return JSON.stringify({ phase: toolArgs.phase });
  return undefined;
}

// ── Shared context for a single tool call ─────────────────

interface GateContext {
  doc: GraphDocument;
  phase: LifecyclePhase;
  lifecycleMode: StrictnessMode;
  codeIntelMode: CodeIntelligenceMode;
  phaseOverride: LifecyclePhase | null;
  hasSnapshots: boolean;
}

function loadGateContext(store: SqliteStore): GateContext | null {
  try {
    const doc = store.toGraphDocument();
    const phaseOverrideValue = store.getProjectSetting("lifecycle_phase_override");
    const snapshots = store.listSnapshots();
    const modeValue = store.getProjectSetting("lifecycle_strictness_mode");
    const lifecycleMode: StrictnessMode = (modeValue === "strict" || modeValue === "advisory") ? modeValue : "strict";
    const codeIntelValue = store.getProjectSetting("code_intelligence_mode");
    const codeIntelMode: CodeIntelligenceMode = (codeIntelValue === "strict" || codeIntelValue === "advisory" || codeIntelValue === "off") ? codeIntelValue : "off";
    const phaseOverride = phaseOverrideValue ? phaseOverrideValue as LifecyclePhase : null;

    const phase = detectCurrentPhase(doc, {
      hasSnapshots: snapshots.length > 0,
      phaseOverride,
    });

    return { doc, phase, lifecycleMode, codeIntelMode, phaseOverride, hasSnapshots: snapshots.length > 0 };
  } catch {
    return null;
  }
}

// ── checkGates — standalone gate check ───────────────────

export interface GateResult {
  allowed: boolean;
  lifecycleBlock?: LifecycleBlock;
  codeIntelBlock?: CodeIntelligenceBlock;
  warnings: Array<LifecycleWarning | CodeIntelWarning>;
}

/**
 * Check all gates (lifecycle + code intelligence) for a tool call.
 * Single read of store.toGraphDocument and detectCurrentPhase.
 * Returns structured result with allowed, lifecycleBlock, codeIntelBlock, warnings.
 */
export function checkGates(
  store: SqliteStore,
  toolName: string,
  args: unknown[],
  currentGitHash?: string | null,
): GateResult {
  const ctx = loadGateContext(store);
  if (!ctx) {
    return { allowed: true, warnings: [] };
  }

  const allWarnings: Array<LifecycleWarning | CodeIntelWarning> = [];

  // ── Lifecycle gate ──
  const gateWarnings: LifecycleWarning[] = [];

  if (!READ_ONLY_TOOLS.has(toolName)) {
    gateWarnings.push(...checkToolGate(ctx.doc, ctx.phase, toolName, ctx.lifecycleMode));
  }

  const statusArgs = extractStatusArgs(toolName, args);
  if (statusArgs.nodeId && statusArgs.newStatus) {
    const statusResult = checkStatusGate(ctx.doc, ctx.phase, statusArgs.nodeId, statusArgs.newStatus, ctx.lifecycleMode);
    gateWarnings.push(...statusResult.warnings);
  }

  const prereqModeValue = store.getProjectSetting("tool_prerequisites_mode");
  const prereqEnabled = prereqModeValue !== "off";
  const prereqMode: StrictnessMode = prereqModeValue === "strict" ? "strict" : "advisory";

  if (prereqEnabled) {
    const toolArgs = (args[0] as Record<string, unknown>) ?? {};
    const nodeId = extractNodeId(args);
    const project = store.getProject();
    if (project) {
      const toolCallLog = new ToolCallLog(store.getDb());
      gateWarnings.push(...checkPrerequisiteGate(
        ctx.phase, toolName, toolArgs, nodeId,
        (nId, t, tArgs) => toolCallLog.hasBeenCalled(project.id, nId, t, tArgs),
        prereqMode,
      ));
    }
  }

  allWarnings.push(...gateWarnings);

  const lifecycleBlock = buildLifecycleBlock(ctx.doc, {
    toolName,
    hasSnapshots: ctx.hasSnapshots,
    phaseOverride: ctx.phaseOverride,
    mode: ctx.lifecycleMode,
    store,
  });

  const allowed = !gateWarnings.some((w) => w.severity === "error");

  // ── Code Intelligence gate ──
  let codeIntelBlock: CodeIntelligenceBlock | undefined;
  if (ctx.codeIntelMode !== "off") {
    try {
      const project = store.getProject();
      if (project) {
        const codeStore = new CodeStore(store.getDb());
        const block = buildCodeIntelBlock(codeStore, project.id, ctx.phase, ctx.codeIntelMode, toolName, args, currentGitHash);
        codeIntelBlock = block;
        allWarnings.push(...block.warnings);
      }
    } catch {
      logger.debug("checkGates: code intelligence check skipped", { tool: toolName });
    }
  }

  return { allowed, lifecycleBlock, codeIntelBlock, warnings: allWarnings };
}

// ── Main wrapper ──────────────────────────────────────────

/**
 * Wrap all registered MCP tool handlers with unified lifecycle + code intelligence gates.
 * Single wrapper per tool. Single read of store/doc/phase per tool call.
 */
export function wrapToolsWithGates(server: McpServer, store: SqliteStore, eventBus?: GraphEventBus): void {
  const registeredTools = (server as unknown as { _registeredTools: Record<string, RegisteredTool> })._registeredTools;

  if (!registeredTools) {
    logger.warn("unified-gate: could not access _registeredTools, skipping wrapping");
    return;
  }

  for (const [name, tool] of Object.entries(registeredTools)) {
    const originalHandler = tool.handler;

    tool.handler = async (...args: unknown[]): Promise<unknown> => {
      // ── Single context load ──
      const ctx = loadGateContext(store);

      // ══ PRE-EXECUTION: Lifecycle gate ══
      if (ctx) {
        const gateWarnings: LifecycleWarning[] = [];

        // Tool gate
        gateWarnings.push(...checkToolGate(ctx.doc, ctx.phase, name, ctx.lifecycleMode));

        // Status gate
        const statusArgs = extractStatusArgs(name, args);
        if (statusArgs.nodeId && statusArgs.newStatus) {
          const statusResult = checkStatusGate(ctx.doc, ctx.phase, statusArgs.nodeId, statusArgs.newStatus, ctx.lifecycleMode);
          gateWarnings.push(...statusResult.warnings);
        }

        // Prerequisite gate
        const prereqModeValue = store.getProjectSetting("tool_prerequisites_mode");
        const prereqEnabled = prereqModeValue !== "off";
        const prereqMode: StrictnessMode = prereqModeValue === "strict" ? "strict" : "advisory";

        if (prereqEnabled) {
          const toolArgs = (args[0] as Record<string, unknown>) ?? {};
          const nodeId = extractNodeId(args);
          const project = store.getProject();
          if (project) {
            const toolCallLog = new ToolCallLog(store.getDb());
            gateWarnings.push(...checkPrerequisiteGate(
              ctx.phase, name, toolArgs, nodeId,
              (nId, t, tArgs) => toolCallLog.hasBeenCalled(project.id, nId, t, tArgs),
              prereqMode,
            ));
          }
        }

        // Block if any error-severity warning
        if (gateWarnings.some((w) => w.severity === "error")) {
          logger.warn("unified-gate: tool blocked by lifecycle gate", { tool: name, phase: ctx.phase });
          return buildBlockedResponse(name, ctx.phase, gateWarnings);
        }
      }

      // ══ EXECUTE original handler ══
      const result = await originalHandler(...args) as ToolCallResult;

      // ══ POST-EXECUTION ══
      // Re-load context (handler may have changed state, e.g. set_phase)
      const postCtx = loadGateContext(store);

      // ── Token tracking ──
      try {
        const project = store.getProject();
        if (project) {
          const inputText = JSON.stringify(args);
          const outputText = result?.content?.map((c: { text?: string }) => c.text ?? "").join("") ?? "";
          const toolTokenStore = new ToolTokenStore(store.getDb());
          toolTokenStore.record(project.id, name, estimateTokens(inputText), estimateTokens(outputText));
        }
      } catch {
        logger.debug("unified-gate: token tracking skipped", { tool: name });
      }

      // ── Tool call recording ──
      if (!result?.isError) {
        try {
          const project = store.getProject();
          if (project) {
            const toolCallLog = new ToolCallLog(store.getDb());
            const toolArgs = (args[0] as Record<string, unknown>) ?? {};
            const nodeId = extractNodeId(args);
            toolCallLog.record(project.id, nodeId ?? null, name, extractRelevantArgs(name, toolArgs) ?? undefined);
          }
        } catch {
          logger.debug("unified-gate: tool call recording skipped", { tool: name });
        }
      }

      // ── Error detection for self-healing ──
      if (eventBus && result?.isError) {
        try {
          const errorText = result.content?.map((c: { text?: string }) => c.text ?? "").join("") ?? "";
          const errorCategory = categorizeError(errorText);
          const errorHash = generateErrorHash(errorCategory, errorText);
          eventBus.emitTyped("error:detected", { toolName: name, errorMessage: errorText.slice(0, 500), errorCategory, errorHash });
        } catch {
          logger.debug("unified-gate: error detection skipped", { tool: name });
        }
      }

      // ── Append _lifecycle block ──
      if (postCtx && result && Array.isArray(result.content)) {
        try {
          const lifecycleBlock = buildLifecycleBlock(postCtx.doc, {
            toolName: name,
            hasSnapshots: postCtx.hasSnapshots,
            phaseOverride: postCtx.phaseOverride,
            mode: postCtx.lifecycleMode,
            store,
          });

          // Compute nextAction
          try {
            const toolResultText = result.content
              ?.filter((c: { type?: string }) => c.type === "text")
              ?.map((c: { text?: string }) => c.text ?? "").join("") ?? "";
            const parsedResult = toolResultText ? JSON.parse(toolResultText) : {};
            const toolArgs = (Array.isArray(args) ? args[0] as Record<string, unknown> : args) ?? {};
            const nextAction = computeNextAction(name, toolArgs, lifecycleBlock.phase, parsedResult);
            if (nextAction) lifecycleBlock.nextAction = nextAction;
          } catch {
            logger.debug("unified-gate: nextAction computation skipped", { tool: name });
          }

          result.content.push({ type: "text", text: JSON.stringify({ _lifecycle: lifecycleBlock }, null, 2) });
        } catch {
          logger.debug("unified-gate: lifecycle block skipped", { tool: name });
        }
      }

      // ── Append _code_intelligence block ──
      if (postCtx && postCtx.codeIntelMode !== "off" && result && Array.isArray(result.content)) {
        try {
          const project = store.getProject();
          if (project) {
            const codeStore = new CodeStore(store.getDb());
            // Auto-downgrade strict→advisory when index is empty
            let effectiveMode = postCtx.codeIntelMode;
            if (effectiveMode === "strict") {
              const indexStatus = detectStaleIndex(codeStore, project.id);
              if (!indexStatus.available && !READ_ONLY_TOOLS.has(name)) {
                effectiveMode = "advisory";
              }
            }
            const enrichmentMode = name === "set_phase" ? loadCodeIntelMode(store) : effectiveMode;
            const block = buildCodeIntelBlock(codeStore, project.id, postCtx.phase, enrichmentMode, name, args);
            result.content.push({ type: "text", text: JSON.stringify({ _code_intelligence: block }, null, 2) });
          }
        } catch {
          logger.debug("unified-gate: code intelligence block skipped", { tool: name });
        }
      }

      return result;
    };
  }

  logger.debug("unified-gate: wrapped all tools", { count: Object.keys(registeredTools).length });
}

function loadCodeIntelMode(store: SqliteStore): CodeIntelligenceMode {
  try {
    const modeValue = store.getProjectSetting("code_intelligence_mode");
    if (modeValue === "strict" || modeValue === "advisory" || modeValue === "off") return modeValue;
  } catch {
    // No project loaded
  }
  return "off";
}

// ── Backward compatibility re-exports ─────────────────────

/** @deprecated Use wrapToolsWithGates instead */
export const wrapToolsWithLifecycle = wrapToolsWithGates;

/** @deprecated Use wrapToolsWithGates instead */
export function wrapToolsWithCodeIntelligence(_server: McpServer, _store: SqliteStore): void {
  // No-op — unified gate handles both. This exists for backward compat if anything imports it.
  logger.debug("wrapToolsWithCodeIntelligence: no-op (handled by unified gate)");
}
