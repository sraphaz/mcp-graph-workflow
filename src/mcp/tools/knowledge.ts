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
 * MCP Tool — knowledge
 * Consolidated knowledge management tool with action-based routing.
 * Replaces 5 separate tools: knowledge_stats, export_knowledge,
 * knowledge_feedback, knowledge_prune, reindex_knowledge + new batch_feedback.
 */

import { z } from "zod/v4";
import { readFileSync, writeFileSync } from "node:fs";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { generateBudgetReport } from "../../core/rag/token-budget-tracker.js";
import { getTokenSavingsReport } from "../../core/rag/token-savings.js";
import { DEFAULT_TOKEN_BUDGET } from "../../core/utils/constants.js";
import { exportKnowledge, importKnowledge, previewImport } from "../../core/knowledge/knowledge-packager.js";
import { KnowledgePackageSchema } from "../../schemas/knowledge-package.schema.js";
import { assertPathInsideProject } from "../../core/utils/fs.js";
import { applyFeedback } from "../../core/rag/knowledge-feedback.js";
import { pruneKnowledge } from "../../core/rag/knowledge-pruner.js";
import { findDuplicates, findContradictions } from "../../core/rag/knowledge-dedup.js";
import { DocsCacheStore } from "../../core/docs/docs-cache-store.js";
import { EmbeddingStore } from "../../core/rag/embedding-store.js";
import { indexMemories } from "../../core/rag/memory-indexer.js";
import { indexCachedDocs } from "../../core/rag/docs-indexer.js";
import { indexSkills } from "../../core/rag/skill-indexer.js";
import { indexJourneyMaps } from "../../core/rag/journey-indexer.js";
import { JourneyStore } from "../../core/journey/journey-store.js";
import { indexAllEmbeddings } from "../../core/rag/rag-pipeline.js";
import { decayStaleKnowledge } from "../../core/rag/knowledge-quality.js";
import { linkBySharedContext } from "../../core/rag/knowledge-linker.js";
import { runSynthesisCycle } from "../../core/rag/knowledge-synthesizer.js";
import { reindexAll as reindexEntities } from "../../core/rag/entity-indexer.js";
import { indexAllNodes } from "../../core/rag/node-indexer.js";
import { indexCodeAnalysis } from "../../core/rag/code-context-indexer.js";
import { invalidateRagCache } from "./context.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

/* ------------------------------------------------------------------ */
/*  Action handlers                                                    */
/* ------------------------------------------------------------------ */

function handleStats(store: SqliteStore, topK: number | undefined): ReturnType<typeof mcpText> {
  const db = store.getDb();
  const knowledgeStore = new KnowledgeStore(db);
  const k = topK ?? 5;

  // Count by source type
  const sourceCounts = db
    .prepare(
      "SELECT source_type, COUNT(*) as count FROM knowledge_documents GROUP BY source_type ORDER BY count DESC",
    )
    .all() as Array<{ source_type: string; count: number }>;

  // Quality distribution
  const qualityDist = db
    .prepare(
      `SELECT
        CASE
          WHEN quality_score >= 0.8 THEN 'high'
          WHEN quality_score >= 0.5 THEN 'medium'
          ELSE 'low'
        END as tier,
        COUNT(*) as count,
        ROUND(AVG(quality_score), 3) as avg_score
      FROM knowledge_documents
      GROUP BY tier`,
    )
    .all() as Array<{ tier: string; count: number; avg_score: number }>;

  // Top accessed docs
  const topAccessed = db
    .prepare(
      `SELECT id, title, source_type, usage_count, quality_score, last_accessed_at
       FROM knowledge_documents
       WHERE usage_count > 0
       ORDER BY usage_count DESC
       LIMIT ?`,
    )
    .all(k) as Array<{
      id: string;
      title: string;
      source_type: string;
      usage_count: number;
      quality_score: number;
      last_accessed_at: string | null;
    }>;

  // Staleness overview
  const stalenessInfo = db
    .prepare(
      `SELECT
        COUNT(CASE WHEN staleness_days = 0 THEN 1 END) as fresh,
        COUNT(CASE WHEN staleness_days BETWEEN 1 AND 30 THEN 1 END) as recent,
        COUNT(CASE WHEN staleness_days BETWEEN 31 AND 90 THEN 1 END) as aging,
        COUNT(CASE WHEN staleness_days > 90 THEN 1 END) as stale
      FROM knowledge_documents`,
    )
    .get() as { fresh: number; recent: number; aging: number; stale: number };

  // Relations count
  const relationsCount = db
    .prepare("SELECT COUNT(*) as count FROM knowledge_relations")
    .get() as { count: number } | undefined;

  const totalDocs = knowledgeStore.count();

  // Token budget report
  const budgetReport = generateBudgetReport(db, DEFAULT_TOKEN_BUDGET);

  // Token savings analytics
  const savingsReport = getTokenSavingsReport(db);

  const stats = {
    totalDocuments: totalDocs,
    sourceCounts: sourceCounts.map((r) => ({
      sourceType: r.source_type,
      count: r.count,
    })),
    qualityDistribution: qualityDist.map((r) => ({
      tier: r.tier,
      count: r.count,
      avgScore: r.avg_score,
    })),
    topAccessed: topAccessed.map((r) => ({
      id: r.id,
      title: r.title,
      sourceType: r.source_type,
      usageCount: r.usage_count,
      qualityScore: r.quality_score,
      lastAccessedAt: r.last_accessed_at,
    })),
    staleness: stalenessInfo,
    relationsCount: relationsCount?.count ?? 0,
    budget: budgetReport,
    tokenSavings: savingsReport,
  };

  logger.info("tool:knowledge:stats:ok", { totalDocs });
  return mcpText(stats);
}

async function handleExport(
  store: SqliteStore,
  exportAction: "export" | "import" | "preview" | undefined,
  filePath: string | undefined,
  sources: string[] | undefined,
  minQuality: number | undefined,
  includeMemories: boolean | undefined,
  includeTranslationMemory: boolean | undefined,
): Promise<ReturnType<typeof mcpText>> {
  const db = store.getDb();
  const basePath = process.cwd();
  const targetPath = filePath ?? "./knowledge-export.json";
  const subAction = exportAction ?? "export";

  if (subAction === "export") {
    const result = await exportKnowledge(db, basePath, {
      sources,
      minQuality: minQuality ?? 0,
      includeMemories: includeMemories ?? true,
      includeTranslationMemory: includeTranslationMemory ?? true,
      includeRelations: true,
    });

    const absolutePath = assertPathInsideProject(targetPath);
    writeFileSync(absolutePath, JSON.stringify(result.package, null, 2), "utf-8");

    logger.info("tool:knowledge:export:ok", { path: absolutePath, ...result.stats });
    return mcpText({
      ok: true,
      action: "export",
      filePath: absolutePath,
      stats: result.stats,
    });
  }

  if (subAction === "import") {
    const absolutePath = assertPathInsideProject(targetPath);
    const raw = readFileSync(absolutePath, "utf-8");
    let json: unknown;
    try { json = JSON.parse(raw); } catch (err) {
      return mcpError(`Invalid JSON in knowledge package: ${err instanceof Error ? err.message : String(err)}`);
    }

    const parsed = KnowledgePackageSchema.safeParse(json);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      return mcpError(`Invalid knowledge package: ${errorMsg}`);
    }

    const result = await importKnowledge(db, basePath, parsed.data);

    logger.info("tool:knowledge:export:import:ok", {
      documentsImported: result.documentsImported,
      documentsSkipped: result.documentsSkipped,
      memoriesImported: result.memoriesImported,
    });
    return mcpText({
      ok: true,
      action: "import",
      filePath: absolutePath,
      result,
    });
  }

  if (subAction === "preview") {
    const absolutePath = assertPathInsideProject(targetPath);
    const raw = readFileSync(absolutePath, "utf-8");
    let json: unknown;
    try { json = JSON.parse(raw); } catch (err) {
      return mcpError(`Invalid JSON in knowledge package: ${err instanceof Error ? err.message : String(err)}`);
    }

    const parsed = KnowledgePackageSchema.safeParse(json);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      return mcpError(`Invalid knowledge package: ${errorMsg}`);
    }

    const preview = await previewImport(db, basePath, parsed.data);

    logger.info("tool:knowledge:export:preview:ok", {
      newDocuments: preview.newDocuments,
      existingDocuments: preview.existingDocuments,
    });
    return mcpText({
      ok: true,
      action: "preview",
      filePath: absolutePath,
      preview,
    });
  }

  return mcpError(`Unknown export sub-action: ${subAction}`);
}

function handleFeedback(
  store: SqliteStore,
  docId: string | undefined,
  feedbackType: "helpful" | "unhelpful" | "outdated" | undefined,
  query: string | undefined,
  feedbackContext: string | undefined,
): ReturnType<typeof mcpText> {
  if (!docId) return mcpError("docId is required for feedback action");
  if (!feedbackType) return mcpError("feedbackType is required for feedback action");

  const contextObj = feedbackContext ? { note: feedbackContext } : undefined;
  // Bug #084: pass empty string instead of undefined when no query provided
  applyFeedback(store.getDb(), docId, query || "", feedbackType, contextObj);

  logger.info("tool:knowledge:feedback:ok", { docId, feedbackType });
  return mcpText({
    ok: true,
    docId,
    feedbackType,
    message: `Feedback '${feedbackType}' applied to document ${docId}`,
  });
}

function handleBatchFeedback(
  store: SqliteStore,
  feedbackItems: Array<{
    docId: string;
    feedbackType: "helpful" | "unhelpful" | "outdated";
    query?: string | undefined;
    context?: string | undefined;
  }> | undefined,
): ReturnType<typeof mcpText> {
  if (!feedbackItems || feedbackItems.length === 0) {
    return mcpError("feedbackItems array is required for batch_feedback action");
  }

  const db = store.getDb();
  const results: Array<{ docId: string; feedbackType: string; ok: boolean; error?: string }> = [];

  for (const item of feedbackItems) {
    try {
      const contextObj = item.context ? { note: item.context } : undefined;
      applyFeedback(db, item.docId, item.query || "", item.feedbackType, contextObj);
      results.push({ docId: item.docId, feedbackType: item.feedbackType, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ docId: item.docId, feedbackType: item.feedbackType, ok: false, error: message });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  logger.info("tool:knowledge:batch_feedback:ok", { succeeded, failed, total: feedbackItems.length });
  return mcpText({ ok: true, succeeded, failed, total: feedbackItems.length, results });
}

function handlePrune(
  store: SqliteStore,
  strategy: "age" | "quality" | "dedup" | "budget" | undefined,
  maxAgeDays: number | undefined,
  minQuality: number | undefined,
  maxDocs: number | undefined,
  dryRun: boolean | undefined,
): ReturnType<typeof mcpText> {
  if (!strategy) return mcpError("strategy is required for prune action");

  const db = store.getDb();
  const isDryRun = dryRun ?? true;

  if (strategy === "budget") {
    const ks = new KnowledgeStore(db);
    const budgetLimit = maxDocs ?? 100;
    const result = ks.autoprune(budgetLimit, isDryRun);
    logger.info("tool:knowledge:prune:budget", { pruned: result.removed, budget: budgetLimit, dryRun: isDryRun });
    return mcpText({ strategy: "budget", pruned: result.removed, prunedIds: result.removedIds, dryRun: isDryRun, budget: budgetLimit, remaining: ks.count() });
  }

  if (strategy === "dedup") {
    const duplicates = findDuplicates(db);
    const contradictions = findContradictions(db);

    // Dedup now deletes older docs in each pair (unless dryRun)
    const result = pruneKnowledge(db, { strategy: "dedup", dryRun: isDryRun });

    logger.info("tool:knowledge:prune:dedup", {
      duplicates: duplicates.length,
      contradictions: contradictions.length,
      deleted: result.pruned,
      dryRun: isDryRun,
    });

    return mcpText({
      strategy: "dedup",
      pruned: result.pruned,
      prunedIds: result.prunedIds,
      dryRun: isDryRun,
      duplicates: isDryRun ? duplicates : undefined,
      contradictions,
      summary: {
        duplicatePairs: duplicates.length,
        contradictionPairs: contradictions.length,
        deleted: result.pruned,
      },
    });
  }

  const result = pruneKnowledge(db, {
    strategy,
    maxAgeDays,
    minQuality,
    dryRun: isDryRun,
  });

  logger.info("tool:knowledge:prune:ok", {
    strategy,
    pruned: result.pruned,
    dryRun: isDryRun,
  });

  return mcpText(result);
}

async function handleReindex(
  store: SqliteStore,
  basePath: string | undefined,
  reindexSources: Array<"memory" | "serena" | "docs" | "skills" | "journey" | "embeddings" | "quality" | "relations" | "synthesis" | "entities" | "graph" | "code" | "community"> | undefined,
): Promise<ReturnType<typeof mcpText>> {
  invalidateRagCache();
  const projectPath = basePath ?? process.cwd();
  const allSources = !reindexSources || reindexSources.length === 0;
  const knowledgeStore = new KnowledgeStore(store.getDb());

  const results: Record<string, unknown> = {};

  if (allSources || reindexSources?.includes("memory") || reindexSources?.includes("serena")) {
    results.memories = await indexMemories(knowledgeStore, projectPath);
  }

  if (allSources || reindexSources?.includes("docs")) {
    const docsCacheStore = new DocsCacheStore(store.getDb());
    results.docs = indexCachedDocs(knowledgeStore, docsCacheStore);
  }

  if (allSources || reindexSources?.includes("skills")) {
    results.skills = await indexSkills(knowledgeStore, projectPath);
  }

  if (allSources || reindexSources?.includes("journey")) {
    const project = store.getProject();
    if (project) {
      const journeyStore = new JourneyStore(store.getDb(), project.id);
      results.journey = indexJourneyMaps(knowledgeStore, journeyStore);
    }
  }

  if (allSources || reindexSources?.includes("embeddings")) {
    const embeddingStore = new EmbeddingStore(store);
    embeddingStore.clear();
    results.embeddings = await indexAllEmbeddings(store, embeddingStore);
  }

  if (allSources || reindexSources?.includes("quality")) {
    results.quality = decayStaleKnowledge(store.getDb());
  }

  if (allSources || reindexSources?.includes("relations")) {
    results.relations = linkBySharedContext(store.getDb());
  }

  if (reindexSources?.includes("synthesis")) {
    results.synthesis = runSynthesisCycle(store.getDb());
  }

  if (allSources || reindexSources?.includes("graph")) {
    try {
      const activeProject = store.getActiveProject();
      results.graph = indexAllNodes(store.getDb(), activeProject?.id);
    } catch (err) {
      logger.warn("node-indexer:reindex-failed", { error: String(err) });
      results.graph = { error: "Graph node reindex failed" };
    }
  }

  if (allSources || reindexSources?.includes("code")) {
    try {
      const symbols = store.getDb()
        .prepare("SELECT name, kind, file, exported, language, docstring FROM code_symbols LIMIT 10000")
        .all() as Array<{ name: string; kind: string; file: string; exported: number; language: string | null; docstring: string | null }>;
      if (symbols.length > 0) {
        results.code = indexCodeAnalysis(
          new KnowledgeStore(store.getDb()),
          {
            symbols: symbols.map((s) => ({
              name: s.name,
              kind: s.kind,
              file: s.file,
              exported: s.exported === 1,
              language: s.language ?? undefined,
              docstring: s.docstring ?? undefined,
            })),
            flows: [],
          },
        );
      } else {
        results.code = { documentsIndexed: 0, note: "No code symbols found. Run code indexer first." };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.warn("code-indexer:reindex-failed", { error: errorMsg });
      results.code = { error: `Code symbol reindex failed: ${errorMsg}` };
    }
  }

  if (allSources || reindexSources?.includes("entities")) {
    try {
      results.entities = reindexEntities(store.getDb());
    } catch (err) {
      logger.warn("entity-indexer:reindex-failed", { error: String(err) });
      results.entities = { error: "Entity reindex failed" };
    }
  }

  if (allSources || reindexSources?.includes("community")) {
    try {
      const { rebuildCommunities } = await import("../../core/rag/community-summarizer.js");
      const summaries = rebuildCommunities(store);
      results.community = { communitiesRebuilt: summaries.length };
    } catch (err) {
      logger.warn("community-summarizer:reindex-failed", { error: String(err) });
      results.community = { error: "Community rebuild failed" };
    }
  }

  results.totalKnowledge = knowledgeStore.count();

  logger.info("tool:knowledge:reindex:ok", { totalKnowledge: results.totalKnowledge });
  return mcpText(results);
}

/* ------------------------------------------------------------------ */
/*  Registration                                                       */
/* ------------------------------------------------------------------ */

export function registerKnowledge(server: McpServer, store: SqliteStore): void {
  server.tool(
    "knowledge",
    "Knowledge management: stats, export/import, feedback, prune, reindex. Actions: stats (get statistics), export (export/import/preview packages), feedback (rate a document), batch_feedback (rate multiple documents), prune (remove stale/low-quality/duplicates), reindex (rebuild knowledge index).",
    {
      action: z.enum(["stats", "export", "feedback", "batch_feedback", "prune", "reindex"]).describe("Knowledge action to perform"),

      // --- stats params ---
      topK: z.number().int().min(1).max(50).optional().describe("Number of top accessed docs to return (default: 5, action=stats)"),

      // --- export params ---
      exportAction: z.enum(["export", "import", "preview"]).optional().describe("Export sub-action (action=export, default: export)"),
      filePath: z.string().optional().describe("Path for export output or import input (default: ./knowledge-export.json)"),
      sources: z.array(z.string()).optional().describe("Filter by source types (e.g. ['docs', 'memory'])"),
      minQuality: z.number().min(0).max(1).optional().describe("Minimum quality score filter (0-1, action=export or action=prune)"),
      includeMemories: z.boolean().optional().describe("Include project memories (default: true, action=export)"),
      includeTranslationMemory: z.boolean().optional().describe("Include translation memory entries (default: true, action=export)"),

      // --- feedback params ---
      docId: z.string().optional().describe("Knowledge document ID (action=feedback)"),
      feedbackType: z.enum(["helpful", "unhelpful", "outdated"]).optional().describe("Feedback type (action=feedback)"),
      query: z.string().optional().describe("The query that surfaced this document (action=feedback)"),
      feedbackContext: z.string().optional().describe("Additional context about why this feedback is given (action=feedback)"),

      // --- batch_feedback params ---
      feedbackItems: z.array(z.object({
        docId: z.string().min(1).describe("Knowledge document ID"),
        feedbackType: z.enum(["helpful", "unhelpful", "outdated"]).describe("Feedback type"),
        query: z.string().optional().describe("The query that surfaced this document"),
        context: z.string().optional().describe("Additional context"),
      })).max(50).optional().describe("Array of feedback items for batch_feedback (max 50)"),

      // --- prune params ---
      strategy: z.enum(["age", "quality", "dedup", "budget"]).optional().describe("Pruning strategy (action=prune)"),
      maxAgeDays: z.number().int().min(1).optional().describe("Max age in days for 'age' strategy (default: 90, action=prune)"),
      maxDocs: z.number().int().min(10).optional().describe("Max documents to keep for 'budget' strategy (default: 100, action=prune)"),
      dryRun: z.boolean().optional().describe("Preview without deleting (default: true, action=prune)"),

      // --- reindex params ---
      basePath: z.string().optional().describe("Project base path for finding memories (default: cwd, action=reindex)"),
      reindexSources: z.array(z.enum([
        "memory", "serena", "docs", "skills", "journey", "embeddings",
        "quality", "relations", "synthesis", "entities", "graph", "code", "community",
      ])).optional().describe("Which sources to reindex (default: all, action=reindex)"),
    },
    async (params) => {
      const { action } = params;
      logger.info("tool:knowledge", { action });

      try {
        switch (action) {
          case "stats":
            return handleStats(store, params.topK);

          case "export":
            return await handleExport(
              store,
              params.exportAction,
              params.filePath,
              params.sources,
              params.minQuality,
              params.includeMemories,
              params.includeTranslationMemory,
            );

          case "feedback":
            return handleFeedback(
              store,
              params.docId,
              params.feedbackType,
              params.query,
              params.feedbackContext,
            );

          case "batch_feedback":
            return handleBatchFeedback(store, params.feedbackItems);

          case "prune":
            return handlePrune(
              store,
              params.strategy,
              params.maxAgeDays,
              params.minQuality,
              params.maxDocs,
              params.dryRun,
            );

          case "reindex":
            return await handleReindex(store, params.basePath, params.reindexSources);

          default:
            return mcpError(`Unknown knowledge action: ${action}`);
        }
      } catch (err) {
        logger.error("tool:knowledge failed", { action, error: err instanceof Error ? err.message : String(err) });
        return mcpError(err instanceof Error ? err : String(err));
      }
    },
  );
}
