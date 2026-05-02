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
 * MCP Tool — translate
 * Consolidated translation tool with action-based routing.
 * Replaces 3 separate tools: translate_code, analyze_translation, translation_jobs + new batch_convert.
 */

import { z } from "zod/v4";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { TranslationStore } from "../../core/translation/translation-store.js";
import { TranslationOrchestrator } from "../../core/translation/translation-orchestrator.js";
import { ConstructRegistry } from "../../core/translation/ucr/construct-registry.js";
import { loadAndSeedRegistry } from "../../core/translation/ucr/construct-seed.js";
import { CodeStore } from "../../core/code/code-store.js";
import { logger } from "../../core/utils/logger.js";
import { assertPathInsideProject } from "../../core/utils/fs.js";
import { mcpText, mcpError } from "../response-helpers.js";

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  ".py": "python",
  ".ts": "typescript",
  ".js": "javascript",
  ".java": "java",
  ".go": "go",
  ".rs": "rust",
  ".cs": "csharp",
  ".rb": "ruby",
  ".php": "php",
  ".swift": "swift",
  ".kt": "kotlin",
  ".scala": "scala",
  ".lua": "lua",
  ".hs": "haskell",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".c": "c",
  ".dart": "dart",
  ".ex": "elixir",
  ".exs": "elixir",
};

function resolveCodeAndLanguage(
  code: string | undefined,
  filePath: string | undefined,
  sourceLanguage: string | undefined,
): { resolvedCode: string | undefined; resolvedSourceLanguage: string | undefined } {
  let resolvedCode = code;
  let resolvedSourceLanguage = sourceLanguage;

  if (filePath) {
    const resolvedPath = assertPathInsideProject(filePath);
    resolvedCode = readFileSync(resolvedPath, "utf-8");
    if (!resolvedSourceLanguage) {
      const ext = path.extname(resolvedPath).toLowerCase();
      resolvedSourceLanguage = EXTENSION_TO_LANGUAGE[ext];
    }
  }

  return { resolvedCode, resolvedSourceLanguage };
}

/** registerTranslate — auto-generated description placeholder. */
export function registerTranslate(server: McpServer, store: SqliteStore): void {
  let _cachedDb: unknown = null;
  let _orchestrator: TranslationOrchestrator | null = null;
  let _translationStore: TranslationStore | null = null;

  function getOrchestrator(): TranslationOrchestrator {
    const db = store.getDb();
    if (db !== _cachedDb) {
      _cachedDb = db;
      const registry = new ConstructRegistry(db);
      loadAndSeedRegistry(registry);
      _translationStore = new TranslationStore(db);
      const codeStore = new CodeStore(db);
      _orchestrator = new TranslationOrchestrator(registry, _translationStore, codeStore);
    }
    return _orchestrator as TranslationOrchestrator;
  }

  function getTranslationStore(): TranslationStore {
    const db = store.getDb();
    if (db !== _cachedDb) {
      getOrchestrator(); // ensures _translationStore is initialized
    }
    return _translationStore as TranslationStore;
  }

  server.tool(
    "translate",
    "Code translation: convert (translate code between languages), analyze (translation readiness), jobs (manage translation jobs), batch_convert (translate multiple files).",
    {
      action: z.enum(["convert", "analyze", "jobs", "batch_convert"]).describe("Translation action to perform"),

      // --- convert / analyze params ---
      code: z.string().optional().describe("Source code (alternative to filePath)"),
      filePath: z.string().optional().describe("Path to source file (alternative to code)"),
      sourceLanguage: z.string().optional().describe("Source language hint (auto-detected if omitted)"),
      targetLanguage: z.string().optional().describe("Target programming language"),
      scope: z.enum(["snippet", "function", "module"]).optional().default("snippet").describe("Translation scope (action=convert)"),
      generatedCode: z.string().optional().describe("AI-generated code to finalize (action=convert, omit for prepare phase)"),
      jobId: z.string().optional().describe("Existing job ID (action=convert finalize, or action=jobs get/delete)"),

      // --- jobs params ---
      jobAction: z.enum(["list", "get", "delete", "stats"]).optional().describe("Job sub-action (action=jobs)"),
      status: z.string().optional().describe("Filter by status (action=jobs, jobAction=list)"),

      // --- batch_convert params ---
      items: z.array(z.object({
        code: z.string().optional().describe("Source code"),
        filePath: z.string().optional().describe("Path to source file"),
        sourceLanguage: z.string().optional().describe("Source language hint"),
        targetLanguage: z.string().min(1).describe("Target language"),
        scope: z.enum(["snippet", "function", "module"]).optional().default("snippet").describe("Translation scope"),
      })).max(50).optional().describe("Array of translation items (action=batch_convert, max 50)"),
    },
    async (params) => {
      const { action } = params;
      logger.info("tool:translate", { action });

      try {
        switch (action) {
          case "convert":
            return await handleConvert(params, store, getOrchestrator);
          case "analyze":
            return await handleAnalyze(params, store, getOrchestrator);
          case "jobs":
            return await handleJobs(params, store, getTranslationStore);
          case "batch_convert":
            return await handleBatchConvert(params, store, getOrchestrator);
          default:
            return mcpError(`Unknown translate action: ${action}`);
        }
      } catch (err) {
        logger.error("tool:translate failed", { action, error: err instanceof Error ? err.message : String(err) });
        return mcpError(err instanceof Error ? err : String(err));
      }
    },
  );
}

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

type TranslateParams = {
  code?: string;
  filePath?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  scope?: "snippet" | "function" | "module";
  generatedCode?: string;
  jobId?: string;
  jobAction?: "list" | "get" | "delete" | "stats";
  status?: string;
  items?: Array<{
    code?: string;
    filePath?: string;
    sourceLanguage?: string;
    targetLanguage: string;
    scope?: "snippet" | "function" | "module";
  }>;
};

async function handleConvert(
  params: TranslateParams,
  store: SqliteStore,
  getOrchestrator: () => TranslationOrchestrator,
): Promise<ReturnType<typeof mcpText>> {
  const { code, filePath, sourceLanguage, targetLanguage, scope, generatedCode, jobId } = params;

  logger.info("tool:translate:convert", { filePath, targetLanguage, scope, hasGeneratedCode: !!generatedCode, jobId });

  const orchestrator = getOrchestrator();

  // Finalize mode: submit generated code for an existing job
  if (jobId && generatedCode) {
    const resultValue = orchestrator.finalizeTranslation(jobId, generatedCode);
    return mcpText({
      ok: true,
      phase: "finalized",
      jobId,
      confidence: resultValue.evidence?.confidenceScore,
      risks: resultValue.evidence?.risks,
      humanReviewPoints: resultValue.evidence?.humanReviewPoints,
      translatedConstructs: resultValue.evidence?.translatedConstructs,
    });
  }

  const { resolvedCode, resolvedSourceLanguage } = resolveCodeAndLanguage(code, filePath, sourceLanguage);

  if (!resolvedCode) {
    return mcpError("Either code or filePath is required");
  }

  if (!targetLanguage) {
    return mcpError("targetLanguage is required for convert action");
  }

  const projectId = store.getProject()?.id;
  if (!projectId) {
    return mcpError("No active project. Use init or activate a project first.");
  }

  const prepareResult = await orchestrator.prepareTranslation({
    projectId,
    sourceCode: resolvedCode,
    sourceLanguage: resolvedSourceLanguage,
    targetLanguage,
    scope: scope ?? "snippet",
  });

  return mcpText({
    ok: true,
    phase: "prepared",
    jobId: prepareResult.jobId,
    analysis: prepareResult.analysis,
    prompt: prepareResult.prompt,
    hint: "Use the prompt above to generate code with AI, then call translate again with action=convert, jobId, and generatedCode to finalize.",
  });
}

async function handleAnalyze(
  params: TranslateParams,
  store: SqliteStore,
  getOrchestrator: () => TranslationOrchestrator,
): Promise<ReturnType<typeof mcpText>> {
  const { code, filePath, sourceLanguage, targetLanguage } = params;

  logger.info("tool:translate:analyze", { filePath, sourceLanguage, targetLanguage });

  const { resolvedCode, resolvedSourceLanguage } = resolveCodeAndLanguage(code, filePath, sourceLanguage);

  if (!resolvedCode) {
    return mcpError("Either code or filePath is required");
  }

  const projectId = store.getProject()?.id;
  const analysis = getOrchestrator().analyzeSource(
    resolvedCode,
    { languageHint: resolvedSourceLanguage, targetLanguage },
    filePath ?? undefined,
    projectId ?? undefined,
  );

  return mcpText({
    ok: true,
    detectedLanguage: analysis.detectedLanguage,
    detectedConfidence: analysis.detectedConfidence,
    constructs: analysis.constructs,
    complexityScore: analysis.complexityScore,
    estimatedTranslatability: analysis.estimatedTranslatability,
    ambiguousConstructs: analysis.ambiguousConstructs,
    totalConstructs: analysis.totalConstructs,
  });
}

async function handleJobs(
  params: TranslateParams,
  store: SqliteStore,
  getTranslationStore: () => TranslationStore,
): Promise<ReturnType<typeof mcpText>> {
  const { jobAction, jobId, status } = params;

  if (!jobAction) {
    return mcpError("jobAction is required when action=jobs (list, get, delete, stats)");
  }

  logger.info("tool:translate:jobs", { jobAction, jobId, status });

  const translationStore = getTranslationStore();
  const projectId = store.getProject()?.id;
  if (!projectId) {
    return mcpError("No active project. Use init or activate a project first.");
  }

  switch (jobAction) {
    case "list": {
      let jobs = translationStore.listJobs(projectId);
      if (status) {
        jobs = jobs.filter((j) => j.status === status);
      }
      return mcpText({
        ok: true,
        jobs: jobs.map((j) => ({
          id: j.id,
          sourceLanguage: j.sourceLanguage,
          targetLanguage: j.targetLanguage,
          status: j.status,
          scope: j.scope,
          confidenceScore: j.confidenceScore ?? null,
          createdAt: j.createdAt,
        })),
      });
    }

    case "get": {
      if (!jobId) {
        return mcpError("jobId is required for jobs get");
      }
      const job = translationStore.getJob(jobId);
      if (!job) {
        return mcpError(`Job not found: ${jobId}`);
      }
      return mcpText({ ok: true, job });
    }

    case "delete": {
      if (!jobId) {
        return mcpError("jobId is required for jobs delete");
      }
      const deleted = translationStore.deleteJob(jobId);
      if (!deleted) {
        return mcpError(`Job not found: ${jobId}`);
      }
      return mcpText({ ok: true, deleted: true });
    }

    case "stats": {
      const jobs = translationStore.listJobs(projectId);
      const totalJobs = jobs.length;
      const done = jobs.filter((j) => j.status === "done").length;
      const failed = jobs.filter((j) => j.status === "failed").length;
      const pending = jobs.filter((j) => j.status === "pending").length;

      const jobsWithConfidence = jobs.filter((j) => j.confidenceScore != null);
      const avgConfidence = jobsWithConfidence.length > 0
        ? jobsWithConfidence.reduce((sum, j) => sum + (j.confidenceScore ?? 0), 0) / jobsWithConfidence.length
        : 0;

      return mcpText({
        ok: true,
        totalJobs,
        done,
        failed,
        pending,
        avgConfidence: Math.round(avgConfidence * 1000) / 1000,
      });
    }

    default:
      return mcpError(`Unknown jobAction: ${jobAction as string}`);
  }
}

async function handleBatchConvert(
  params: TranslateParams,
  store: SqliteStore,
  getOrchestrator: () => TranslationOrchestrator,
): Promise<ReturnType<typeof mcpText>> {
  const { items } = params;

  if (!items || items.length === 0) {
    return mcpError("items array is required for batch_convert (max 50)");
  }

  logger.info("tool:translate:batch_convert", { count: items.length });

  const projectId = store.getProject()?.id;
  if (!projectId) {
    return mcpError("No active project. Use init or activate a project first.");
  }

  const orchestrator = getOrchestrator();
  const results: Array<{
    index: number;
    ok: boolean;
    jobId?: string;
    error?: string;
  }> = [];

  for (let i = 0; i < items.length; i++) {
    const itemValue = items[i];
    try {
      const { resolvedCode, resolvedSourceLanguage } = resolveCodeAndLanguage(
        itemValue.code,
        itemValue.filePath,
        itemValue.sourceLanguage,
      );

      if (!resolvedCode) {
        results.push({ index: i, ok: false, error: "Either code or filePath is required" });
        continue;
      }

      const prepareResult = await orchestrator.prepareTranslation({
        projectId,
        sourceCode: resolvedCode,
        sourceLanguage: resolvedSourceLanguage,
        targetLanguage: itemValue.targetLanguage,
        scope: itemValue.scope ?? "snippet",
      });

      results.push({ index: i, ok: true, jobId: prepareResult.jobId });
    } catch (err) {
      results.push({ index: i, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  return mcpText({
    ok: true,
    total: items.length,
    succeeded,
    failed,
    results,
    hint: "Each succeeded item has a jobId. Call translate with action=convert, jobId, and generatedCode to finalize each.",
  });
}
