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
import { recordToolCallTelemetry, classifyError } from "./unified-gate-telemetry.js";
import { resolveDeprecation, buildRemovedResponse, attachDeprecationNotice } from "./deprecated-tools.js";
import { resolveModeDeprecation, extractModeFromArgs } from "./deprecated-modes.js";
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
import { sanitizeToolArgs, detectExfiltration } from "../core/security/input-sanitizer.js";
import { ToolResultStore } from "../core/store/tool-result-store.js";
import { createHash } from "node:crypto";
import { ConcurrentSemaphore, MAX_CONCURRENT_HEAVY, QUEUE_TIMEOUT_MS } from "../core/utils/concurrent-semaphore.js";
import { getSharedHookBus } from "../core/hooks/shared-hook-bus.js";

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
      const results = knowledgeStore.searchWithPhaseBoost(phaseQuery, phase, 1);
      if (results.length > 0) {
        phaseKnowledge = results.map((r) => ({
          title: r.title,
          sourceType: r.sourceType,
          snippet: r.content.length > 100 ? r.content.slice(0, 100) + "..." : r.content,
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
    return JSON.stringify(parsed);
  } catch {
    const block = buildLifecycleBlock(doc);
    return responseJson + "\n\n---\n_lifecycle: " + JSON.stringify(block);
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
    content: [{ type: "text", text: JSON.stringify({ error: "code_intelligence_gate_blocked", tool: toolName, warnings, hint: "Run knowledge(action:reindex) to build the code index, or use set_phase({codeIntelligence:'advisory'}) to switch to advisory mode." }) }],
    isError: true,
  };
}

// ── Deprecation gate ──────────────────────────────────────

/**
 * Deprecation lifecycle stage for an MCP tool.
 * - `advisory`: tool runs normally, a warn log is emitted (silent to clients).
 * - `warning`: tool runs normally, response gets an extra `_deprecation_notice` content item.
 * - `removed`: tool is blocked, a structured `tool_removed` error is returned.
 *   Re-enabled in advisory mode when `MCP_GRAPH_LEGACY_TOOLS=on`.
 */
export type DeprecationStage = "advisory" | "warning" | "removed";

export interface DeprecationEntry {
  stage: DeprecationStage;
  replacement?: string;
  migrationDoc?: string;
  reason?: string;
  since?: string;
}

export interface DeprecationNotice {
  tool: string;
  stage: DeprecationStage;
  replacement?: string;
  migrationDoc?: string;
  reason?: string;
  since?: string;
}

/**
 * Registry of deprecated tools — populated by deprecation cycle (Onda 5).
 * Mutable to allow tests and future migrations to register entries.
 */
export const DEPRECATED_TOOLS: Record<string, DeprecationEntry> = {
  // Wave D2 (v11 Maestro Surface) — set_phase migrates to `mg set-phase` CLI.
  // Advisory stage: tool runs normally, only a server-side warn log fires.
  set_phase: {
    stage: "advisory",
    replacement: "mg set-phase",
    since: "v11.x",
    migrationDoc: "docs/_internal/migration/v11-maestro-surface.md#set_phase",
    reason: "set_phase is moving to the `mg set-phase` CLI command. The MCP tool stays available during the deprecation window and graduates to `warning` then `removed` across two minor releases.",
  },
};

/** Look up a tool's deprecation entry, if any. */
export function getDeprecationEntry(toolName: string): DeprecationEntry | undefined {
  return DEPRECATED_TOOLS[toolName];
}

/** Returns true when MCP_GRAPH_LEGACY_TOOLS=on (escape hatch for removed tools). */
export function isLegacyToolsModeEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.MCP_GRAPH_LEGACY_TOOLS === "on";
}

/**
 * Resolve the effective deprecation stage. `removed` is downgraded to `advisory`
 * when MCP_GRAPH_LEGACY_TOOLS=on so users can opt back in temporarily.
 */
export function resolveEffectiveStage(
  entry: DeprecationEntry,
  env: NodeJS.ProcessEnv = process.env,
): DeprecationStage {
  if (entry.stage === "removed" && isLegacyToolsModeEnabled(env)) return "advisory";
  return entry.stage;
}

/** Build the `_deprecation_notice` payload appended to responses for `warning` stage. */
export function buildDeprecationNotice(toolName: string, entry: DeprecationEntry): DeprecationNotice {
  return {
    tool: toolName,
    stage: entry.stage,
    ...(entry.replacement ? { replacement: entry.replacement } : {}),
    ...(entry.migrationDoc ? { migrationDoc: entry.migrationDoc } : {}),
    ...(entry.reason ? { reason: entry.reason } : {}),
    ...(entry.since ? { since: entry.since } : {}),
  };
}

/** Build the structured error returned when a `removed` tool is invoked. */
export function buildRemovedToolError(toolName: string, entry: DeprecationEntry): ToolCallResult {
  const hint = entry.replacement
    ? `Use ${entry.replacement} instead. Set MCP_GRAPH_LEGACY_TOOLS=on to re-enable temporarily in advisory mode.`
    : "Set MCP_GRAPH_LEGACY_TOOLS=on to re-enable temporarily in advisory mode.";
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        error: "tool_removed",
        tool: toolName,
        replacement: entry.replacement ?? null,
        migrationDoc: entry.migrationDoc ?? null,
        reason: entry.reason ?? `Tool ${toolName} has been removed.`,
        since: entry.since ?? null,
        hint,
      }),
    }],
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
    content: [{ type: "text" as const, text: JSON.stringify({ error: "lifecycle_gate_blocked", phase, tool: toolName, reason: errorWarnings.map((w) => w.message).join("; "), warnings: errorWarnings, hint: "Use set_phase com force:true para bypass, ou mude para mode:'advisory' com set_phase({phase:'auto', mode:'advisory'})" }) }],
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

export interface GateContext {
  doc: GraphDocument;
  phase: LifecyclePhase;
  lifecycleMode: StrictnessMode;
  codeIntelMode: CodeIntelligenceMode;
  phaseOverride: LifecyclePhase | null;
  hasSnapshots: boolean;
}

/** loadGateContext — auto-generated description placeholder. */
export function loadGateContext(store: SqliteStore): GateContext | null {
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

export interface CheckGatesOptions {
  /**
   * When true (default), READ_ONLY_TOOLS skip the tool-phase gate. When false,
   * every tool — including read-only — runs through `checkToolGate`. The wrapper
   * (`wrapToolsWithGates`) uses `false` to preserve historical behavior; new
   * callers (e.g. PreToolUse hook handler) should leave the default.
   */
  applyReadOnlySkip?: boolean;
  /**
   * When true, skip the code-intelligence block computation. The wrapper sets this
   * because it builds the code-intel block separately in its post-execution path;
   * running it twice wastes work and may double-fire stale-warning dedup.
   */
  skipCodeIntel?: boolean;
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
  options: CheckGatesOptions = {},
): GateResult {
  const applyReadOnlySkip = options.applyReadOnlySkip ?? true;
  const ctx = loadGateContext(store);
  if (!ctx) {
    return { allowed: true, warnings: [] };
  }

  const allWarnings: Array<LifecycleWarning | CodeIntelWarning> = [];

  // ── Lifecycle gate ──
  const gateWarnings: LifecycleWarning[] = [];

  if (!applyReadOnlySkip || !READ_ONLY_TOOLS.has(toolName)) {
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
  if (!options.skipCodeIntel && ctx.codeIntelMode !== "off") {
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

// Shared semaphore — one instance per daemon process, limiting concurrent
// heavy tool executions to prevent GC thrashing and heap exhaustion.
const heavySemaphore = new ConcurrentSemaphore(MAX_CONCURRENT_HEAVY, QUEUE_TIMEOUT_MS);

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
      // ══ PRE-EXECUTION: Deprecation gate (HEAD local API) ══
      // Runs before lifecycle/code-intel: removed tools must short-circuit even
      // when other gates would have approved them.
      const deprecationEntry = getDeprecationEntry(name);
      let effectiveDeprecationStage: DeprecationStage | undefined;
      if (deprecationEntry) {
        effectiveDeprecationStage = resolveEffectiveStage(deprecationEntry);
        if (effectiveDeprecationStage === "removed") {
          logger.warn("unified-gate: deprecated tool blocked (removed)", {
            tool: name,
            replacement: deprecationEntry.replacement,
          });
          return buildRemovedToolError(name, deprecationEntry);
        }
        if (effectiveDeprecationStage === "advisory") {
          logger.warn("unified-gate: deprecated tool called (advisory)", {
            tool: name,
            originalStage: deprecationEntry.stage,
            replacement: deprecationEntry.replacement,
          });
        }
      }

      // ══ V11 Maestro Phase 5.1 — Deprecation gate (deprecated-tools.ts API) ══
      // "removed" tools intercepted here; "advisory" silently logs; "warning"
      // attaches a _deprecation_notice to the response after execution.
      const deprecation = resolveDeprecation(name);
      if (deprecation?.stage === "removed") {
        logger.warn("deprecated-tool:removed:invoked", { tool: name, sinceVersion: deprecation.sinceVersion });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(buildRemovedResponse(name, deprecation), null, 2) }],
        };
      }

      // ── V11 Maestro mode-deprecation — same semantics, keyed by (tool, mode) ──
      const argMode = extractModeFromArgs(args);
      const modeDeprecation = argMode ? resolveModeDeprecation(name, argMode) : null;
      if (modeDeprecation?.stage === "removed") {
        logger.warn("deprecated-mode:removed:invoked", {
          tool: name,
          mode: argMode,
          sinceVersion: modeDeprecation.sinceVersion,
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(buildRemovedResponse(`${name}({mode:'${argMode}'})`, modeDeprecation), null, 2) }],
        };
      }

      // ── Single context load ──
      const ctx = loadGateContext(store);

      // ══ PRE-EXECUTION: Lifecycle gate ══
      // Delegate to checkGates() with applyReadOnlySkip=false to preserve the
      // wrapper's historical "always run tool gate" behavior. The hook-driven
      // path (B2) will use the default (skip=true).
      //
      // Feature flag MCP_GRAPH_GATES_IN_HOOKS=on (Wave C2) short-circuits the
      // wrapper-side gate so the PreToolUse hook is the sole pre-execution
      // enforcement layer. The deprecation gate above is intentionally NOT
      // guarded — `removed` tools must stay blocked in either mode.
      if (ctx && process.env.MCP_GRAPH_GATES_IN_HOOKS !== "on") {
        const gateResult = checkGates(store, name, args, undefined, {
          applyReadOnlySkip: false,
          skipCodeIntel: true,
        });
        const lifecycleWarnings = gateResult.warnings.filter(
          (w): w is LifecycleWarning => "severity" in w && (w.severity === "error" || w.severity === "warning" || w.severity === "info"),
        );
        if (lifecycleWarnings.some((w) => w.severity === "error")) {
          logger.warn("unified-gate: tool blocked by lifecycle gate", { tool: name, phase: ctx.phase });
          return buildBlockedResponse(name, ctx.phase, lifecycleWarnings);
        }
      }

      // ══ PRE-EXECUTION: Input sanitization (detection-only) ══
      if (eventBus) {
        try {
          const toolArgs = (args[0] as Record<string, unknown>) ?? {};
          const sanitizationResult = sanitizeToolArgs(toolArgs);
          if (sanitizationResult.injectionDetected) {
            const inputHash = createHash("sha256").update(JSON.stringify(toolArgs)).digest("hex").slice(0, 16);
            eventBus.emitTyped("security:injection_detected", {
              toolName: name,
              inputHash,
              invisibleCharsRemoved: sanitizationResult.invisibleCharsRemoved,
            });
            logger.warn("security:injection_detected", { tool: name, inputHash });
          }
        } catch {
          logger.debug("unified-gate: input sanitization skipped", { tool: name });
        }
      }

      // ══ PRE-EXECUTION: Concurrency semaphore gate ══
      // Heavy tools (context, analyze, search, export, …) are limited to
      // MAX_CONCURRENT_HEAVY simultaneous executions. Requests beyond the
      // queue capacity are rejected synchronously with CONCURRENCY_LIMIT.
      // Light tools bypass entirely (checkForTool returns null).
      const concurrencyError = heavySemaphore.checkForTool(name);
      if (concurrencyError) {
        logger.warn("unified-gate: concurrency limit exceeded", {
          tool: name,
          active: heavySemaphore.active,
          queued: heavySemaphore.queued,
          maxConcurrent: MAX_CONCURRENT_HEAVY,
        });
        return concurrencyError;
      }

      // ══ EXECUTE original handler (with timing + error capture for telemetry — V11 Maestro Phase 1) ══
      const startedAt = Date.now();
      const inputText = JSON.stringify(args);
      let resultValue: ToolCallResult;
      let toolError: string | undefined;
      const releaseSlot = await heavySemaphore.acquire(name).catch(() => null);
      // Sprint 1 (S1.2): tool:pre-call hook — skip read-only tools to avoid noise.
      const emitToolHooks = !READ_ONLY_TOOLS.has(name);
      if (emitToolHooks) {
        void getSharedHookBus().emit({
          channel: "tool:pre-call",
          timestamp: new Date(startedAt).toISOString(),
          payload: { toolName: name, args: (args[0] as Record<string, unknown>) ?? {} },
        });
      }
      try {
        resultValue = await originalHandler(...args) as ToolCallResult;
      } catch (err) {
        const durationMs = Date.now() - startedAt;
        const errorKind = classifyError(err);
        // Telemetry on failure path — fail-silent inside, never throws
        recordToolCallTelemetry(store, name, estimateTokens(inputText), 0, false, durationMs, errorKind);
        toolError = err instanceof Error ? err.message : String(err);
        if (emitToolHooks) {
          void getSharedHookBus().emit({
            channel: "tool:post-call",
            timestamp: new Date().toISOString(),
            payload: { toolName: name, durationMs, error: toolError },
          });
        }
        // Re-throw the ORIGINAL error unchanged
        throw err;
      } finally {
        releaseSlot?.();
      }
      const durationMs = Date.now() - startedAt;
      if (emitToolHooks) {
        void getSharedHookBus().emit({
          channel: "tool:post-call",
          timestamp: new Date().toISOString(),
          payload: { toolName: name, durationMs },
        });
      }

      // ══ V11 Maestro Phase 5.1 — Attach _deprecation_notice (warning stage) ══
      // Tool-level takes precedence; mode-level is the fallback when tool itself is healthy.
      const noticeEntry = (deprecation?.stage === "warning")
        ? { name, entry: deprecation }
        : (modeDeprecation?.stage === "warning" && argMode)
          ? { name: `${name}({mode:'${argMode}'})`, entry: modeDeprecation }
          : null;

      if (noticeEntry && resultValue?.content?.[0]?.type === "text") {
        try {
          const text = resultValue.content[0].text ?? "";
          const parsed = JSON.parse(text);
          if (parsed && typeof parsed === "object") {
            const annotated = attachDeprecationNotice(parsed as Record<string, unknown>, noticeEntry.name, noticeEntry.entry);
            resultValue = {
              ...resultValue,
              content: [{ type: "text" as const, text: JSON.stringify(annotated, null, 2) }],
            };
          }
        } catch {
          // Response wasn't JSON — leave it untouched. Notice still appears in logs.
          logger.debug("deprecated:warning:notice-skip", { tool: noticeEntry.name, reason: "non-json-response" });
        }
      }

      // ══ POST-EXECUTION ══
      // Re-load context (handler may have changed state, e.g. set_phase)
      const postCtx = loadGateContext(store);

      // ── Token tracking + telemetry (V11 Maestro Phase 1) ──
      // recordCall writes input_tokens, output_tokens AND success/duration_ms/error_kind in one row.
      // Replaces legacy ToolTokenStore.record() — same table, same cost-tracker compatibility.
      const outputText = resultValue?.content?.map((c: { text?: string }) => c.text ?? "").join("") ?? "";
      const succeeded = !resultValue?.isError;
      recordToolCallTelemetry(
        store,
        name,
        estimateTokens(inputText),
        estimateTokens(outputText),
        succeeded,
        durationMs,
        succeeded ? undefined : "tool_returned_error",
      );

      // ── Tool result persistence ──
      if (!resultValue?.isError) {
        try {
          const project = store.getProject();
          if (project) {
            const toolResultStore = new ToolResultStore(store.getDb());
            const toolArgs = (args[0] as Record<string, unknown>) ?? {};
            toolResultStore.record(project.id, null, name, toolArgs, resultValue);
            if (eventBus) {
              eventBus.emitTyped("tool:result_persisted", { toolName: name, projectId: project.id });
            }
          }
        } catch {
          logger.debug("unified-gate: tool result persistence skipped", { tool: name });
        }
      }

      // ── Tool call recording ──
      if (!resultValue?.isError) {
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

      // ── POST-EXECUTION: Exfiltration detection (detection-only) ──
      if (eventBus && resultValue && !resultValue.isError) {
        try {
          const outputText = resultValue.content?.map((c: { text?: string }) => c.text ?? "").join("") ?? "";
          if (outputText.length > 0) {
            const exfilReport = detectExfiltration(outputText);
            if (exfilReport.detected) {
              const outputHash = createHash("sha256").update(outputText.slice(0, 1000)).digest("hex").slice(0, 16);
              eventBus.emitTyped("security:exfiltration_detected", {
                toolName: name,
                outputHash,
                suspiciousUrls: exfilReport.suspiciousUrls.length,
                base64Blocks: exfilReport.base64Blocks.length,
                suspiciousCommands: exfilReport.suspiciousCommands.length,
              });
              logger.warn("security:exfiltration_detected", { tool: name, outputHash });
            }
          }
        } catch {
          logger.debug("unified-gate: exfiltration detection skipped", { tool: name });
        }
      }

      // ── Error detection for self-healing ──
      if (eventBus && resultValue?.isError) {
        try {
          const errorText = resultValue.content?.map((c: { text?: string }) => c.text ?? "").join("") ?? "";
          const errorCategory = categorizeError(errorText);
          const errorHash = generateErrorHash(errorCategory, errorText);
          eventBus.emitTyped("error:detected", { toolName: name, errorMessage: errorText.slice(0, 500), errorCategory, errorHash });
        } catch {
          logger.debug("unified-gate: error detection skipped", { tool: name });
        }
      }

      // ── Append _lifecycle block (skip for read-only tools to save tokens) ──
      if (postCtx && resultValue && Array.isArray(resultValue.content) && !READ_ONLY_TOOLS.has(name)) {
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
            const toolResultText = resultValue.content
              ?.filter((c: { type?: string }) => c.type === "text")
              ?.map((c: { text?: string }) => c.text ?? "").join("") ?? "";
            const parsedResult = toolResultText ? JSON.parse(toolResultText) : {};
            const toolArgs = (Array.isArray(args) ? args[0] as Record<string, unknown> : args) ?? {};
            const nextAction = computeNextAction(name, toolArgs, lifecycleBlock.phase, parsedResult);
            if (nextAction) lifecycleBlock.nextAction = nextAction;
          } catch {
            logger.debug("unified-gate: nextAction computation skipped", { tool: name });
          }

          resultValue.content.push({ type: "text", text: JSON.stringify({ _lifecycle: lifecycleBlock }) });
        } catch {
          logger.debug("unified-gate: lifecycle block skipped", { tool: name });
        }
      }

      // ── Append _deprecation_notice for `warning` stage ──
      if (effectiveDeprecationStage === "warning" && deprecationEntry && resultValue && Array.isArray(resultValue.content) && !resultValue.isError) {
        try {
          const notice = buildDeprecationNotice(name, deprecationEntry);
          resultValue.content.push({ type: "text", text: JSON.stringify({ _deprecation_notice: notice }) });
          logger.warn("unified-gate: deprecated tool called (warning)", {
            tool: name,
            replacement: deprecationEntry.replacement,
          });
        } catch {
          logger.debug("unified-gate: deprecation notice skipped", { tool: name });
        }
      }

      // ── Append _code_intelligence block (skip for read-only tools to save tokens) ──
      if (postCtx && postCtx.codeIntelMode !== "off" && resultValue && Array.isArray(resultValue.content) && !READ_ONLY_TOOLS.has(name)) {
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
            resultValue.content.push({ type: "text", text: JSON.stringify({ _code_intelligence: block }) });
          }
        } catch {
          logger.debug("unified-gate: code intelligence block skipped", { tool: name });
        }
      }

      return resultValue;
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
