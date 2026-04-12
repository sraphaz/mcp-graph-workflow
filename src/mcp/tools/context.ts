/**
 * MCP Tool — context
 * Consolidated context tool with action-based routing.
 * Replaces 3 separate tools: context (compact), rag_context, context_compress
 * + new batch_compress action.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { buildTaskContext } from "../../core/context/compact-context.js";
import { SessionTracker } from "../../core/context/session-tracker.js";
import { applySessionDelta, applyRagSessionDelta } from "../../core/context/context-session.js";
import { ragBuildContext } from "../../core/context/rag-context.js";
import { assembleContext } from "../../core/context/context-assembler.js";
import { compressText } from "../../core/context/compress-text.js";
import { RagSemanticCacheLayer } from "../../core/rag/rag-semantic-cache-layer.js";
import { multiStrategySearch } from "../../core/rag/multi-strategy-retrieval.js";
import { recordUsage } from "../../core/rag/knowledge-quality.js";
import { understandQuery } from "../../core/rag/query-understanding.js";
import { postRetrievalPipeline } from "../../core/rag/post-retrieval.js";
import { buildCitedContext } from "../../core/rag/citation-mapper.js";
import { QueryCache } from "../../core/rag/query-cache.js";
import { ResponseCache } from "../../core/rag/response-cache.js";
import { RagTracer } from "../../core/rag/rag-trace.js";
import { detectCurrentPhase, type LifecyclePhase } from "../../core/planner/lifecycle-phase.js";
import { DEFAULT_TOKEN_BUDGET } from "../../core/utils/constants.js";
import { NodeNotFoundError } from "../../core/utils/errors.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError, normalizeNewlines } from "../response-helpers.js";

/* ------------------------------------------------------------------ */
/*  Module-level singletons (shared across calls)                      */
/* ------------------------------------------------------------------ */

/** Lazily instantiated SessionTracker (shared across calls). */
let sessionTracker: SessionTracker | null = null;

function getSessionTracker(store: SqliteStore): SessionTracker {
  if (!sessionTracker) {
    sessionTracker = new SessionTracker(store.getDb());
  }
  return sessionTracker;
}

/** Module-level semantic cache — shared across all rag calls. */
const semanticCache = new RagSemanticCacheLayer({ ttlMs: 10 * 60 * 1000, maxEntries: 100 });

/** Module-level query cache — shared across all rag calls (multi-strategy path). */
const ragCache = new QueryCache({ ttlMs: 5 * 60 * 1000, maxSize: 100 });

/** Module-level response cache — shared across detail and default paths. */
const contextCache = new ResponseCache({ ttlMs: 5 * 60 * 1000, maxSize: 50 });

/** Invalidate all RAG caches (e.g., after reindex_knowledge or node mutations). */
export function invalidateRagCache(): void {
  ragCache.invalidateAll();
  contextCache.invalidateAll();
  logger.debug("context:rag_cache_invalidated");
}

/* ------------------------------------------------------------------ */
/*  Action handlers                                                    */
/* ------------------------------------------------------------------ */

interface ContextParams {
  action: "compact" | "rag" | "compress" | "batch_compress";
  id?: string;
  sessionId?: string;
  query?: string;
  tokenBudget?: number;
  detail?: "summary" | "brief" | "standard" | "deep";
  strategy?: "fts" | "multi";
  text?: string;
  format?: "bullets" | "summary" | "steps" | "json";
  max_tokens?: number;
  texts?: Array<{ text: string; format: "bullets" | "summary" | "steps" | "json"; max_tokens?: number }>;
}

function handleCompact(
  store: SqliteStore,
  params: ContextParams,
): ReturnType<typeof mcpText> {
  const { id, sessionId } = params;

  if (!id) {
    return mcpError("action=compact requires 'id' param (node ID)");
  }

  logger.debug("tool:context:compact", { id, sessionId });
  const ctx = buildTaskContext(store, id);

  if (!ctx) {
    const err = new NodeNotFoundError(id);
    logger.warn("tool:context:compact:fail", { error: err.message });
    return mcpError(err);
  }

  // Bug #035: add 'node' alias for semantic clarity (backward-compatible)
  ctx.node = ctx.task;

  // Session delta tracking — opt-in via sessionId
  if (sessionId) {
    const tracker = getSessionTracker(store);
    const result = applySessionDelta(tracker, sessionId, ctx);
    logger.info("tool:context:compact:ok", { id, sessionId, savings: result._session_savings });
    return mcpText({ ...result.context, _session_savings: result._session_savings });
  }

  logger.info("tool:context:compact:ok", { id });
  return mcpText(ctx);
}

async function handleRag(
  store: SqliteStore,
  params: ContextParams,
): Promise<ReturnType<typeof mcpText>> {
  const { query, tokenBudget, detail, strategy, sessionId } = params;

  if (!query) {
    return mcpError("action=rag requires 'query' param");
  }

  logger.debug("tool:context:rag", { query, detail, sessionId });

  /** Wrap response with session delta if sessionId is present. */
  const wrapWithSession = (data: Record<string, unknown>): ReturnType<typeof mcpText> => {
    if (!sessionId) {
      return mcpText(data);
    }
    const tracker = getSessionTracker(store);
    const result = applyRagSessionDelta(tracker, sessionId, data);
    logger.info("tool:context:rag:session", { sessionId, savings: result._session_savings });
    return mcpText({ ...result.response, _session_savings: result._session_savings });
  };
  const budget = tokenBudget ?? DEFAULT_TOKEN_BUDGET;

  // Semantic cache — check before any pipeline execution
  const semanticHit = semanticCache.lookup(query);
  if (semanticHit) {
    logger.info("tool:context:rag:semantic_cache_hit", { query, type: semanticHit.type });
    return wrapWithSession({
      ...(semanticHit.result as Record<string, unknown>),
      _cache_hit: true,
      _cache_type: semanticHit.type,
    });
  }

  // Detect current lifecycle phase for phase-aware knowledge boosting
  let currentPhase: LifecyclePhase | undefined;
  try {
    const doc = store.toGraphDocument();
    const phaseOverride = store.getProjectSetting("lifecycle_phase_override");
    currentPhase = detectCurrentPhase(doc, {
      phaseOverride: phaseOverride ? phaseOverride as LifecyclePhase : null,
    });
  } catch {
    // Phase detection may fail if no project loaded — proceed without phase
    logger.debug("tool:context:rag:phase_detection_skipped");
  }

  if (detail) {
    // Check context cache for detail path
    const detailCacheKey = `detail:${detail}:${query.trim().toLowerCase()}:${budget}`;
    const cachedDetail = contextCache.get(detailCacheKey);
    if (cachedDetail) {
      logger.debug("context:rag:detail_cache_hit", { query, detail });
      return wrapWithSession(cachedDetail as unknown as Record<string, unknown>);
    }

    // Use tiered context assembler with phase awareness
    const ctx = assembleContext(store, query, {
      tokenBudget: budget,
      tier: detail,
      phase: currentPhase,
    });

    contextCache.set(detailCacheKey, ctx);
    semanticCache.store(query, ctx);
    logger.info("tool:context:rag:ok", { query, detail, phase: currentPhase, strategy });
    return wrapWithSession(ctx as unknown as Record<string, unknown>);
  }

  // Multi-strategy search mode — full pipeline
  if (strategy === "multi") {
    const tracer = new RagTracer(query);

    // Stage 1: Query Understanding
    tracer.startStage("query_understanding");
    const understanding = understandQuery(query);
    const effectiveQuery = understanding.rewrittenQuery || query;
    tracer.endStage("query_understanding", {
      inputCount: 1,
      outputCount: 1,
      details: {
        intent: understanding.intent,
        entities: understanding.entities.length,
        sourceFilters: understanding.sourceTypeFilter,
        expandedTerms: understanding.expandedTerms.length,
      },
    });

    // Stage 2: Cache check
    const cached = ragCache.get(effectiveQuery);
    if (cached) {
      logger.debug("context:rag:cache_hit", { query: effectiveQuery });
      const cachedCited = buildCitedContext(cached);
      tracer.startStage("citation");
      tracer.endStage("citation", { inputCount: cached.length, outputCount: cachedCited.citations.length });
      const trace = tracer.finalize();

      return wrapWithSession({
        query,
        strategy: "multi",
        fromCache: true,
        intent: understanding.intent,
        citedContext: cachedCited.assembledText,
        citations: cachedCited.citations,
        sourceBreakdown: cachedCited.sourceBreakdown,
        results: cached.map((r) => ({
          id: r.id,
          sourceType: r.sourceType,
          title: r.title,
          content: r.content.length > 500 ? r.content.slice(0, 500) + "..." : r.content,
          score: r.score,
          qualityScore: r.qualityScore,
          strategies: r.strategies,
        })),
        tokenUsage: {
          budget,
          used: Math.ceil(cached.reduce((sum, r) => sum + r.content.length / 4, 0)),
          remaining: budget,
        },
        trace: { traceId: trace.traceId, totalLatencyMs: trace.totalLatencyMs, stages: trace.stages.length },
      });
    }

    // Stage 3: Retrieval (request more results to give post-retrieval room to dedup/rerank)
    tracer.startStage("retrieval");
    const rawResults = multiStrategySearch(store.getDb(), effectiveQuery, {
      limit: 20,
      phase: currentPhase,
    });
    tracer.endStage("retrieval", { inputCount: 1, outputCount: rawResults.length });

    // Stage 4: Post-retrieval (dedup, rerank, stitch)
    tracer.startStage("post_retrieval");
    const postProcessed = postRetrievalPipeline({
      query: effectiveQuery,
      results: rawResults,
      maxResults: 10,
    });
    const multiResults = postProcessed.results;
    tracer.endStage("post_retrieval", {
      inputCount: rawResults.length,
      outputCount: multiResults.length,
      details: {
        deduplicated: postProcessed.deduplicated,
        stitchedChunks: postProcessed.stitchedChunks,
      },
    });

    // Cache the post-processed results
    ragCache.set(effectiveQuery, multiResults);

    // Stage 5: Citation mapping
    tracer.startStage("citation");
    const cited = buildCitedContext(multiResults);
    tracer.endStage("citation", {
      inputCount: multiResults.length,
      outputCount: cited.citations.length,
    });

    // Record source contributions in trace
    for (const [sourceType, count] of Object.entries(cited.sourceBreakdown)) {
      tracer.recordSourceContribution(sourceType, count);
    }
    tracer.setCitationCount(cited.citations.length);
    tracer.setTokensUsed(Math.ceil(multiResults.reduce((sum, r) => sum + r.content.length / 4, 0)));

    // Record usage for retrieved docs (best-effort)
    try {
      for (const result of multiResults.slice(0, 5)) {
        recordUsage(store.getDb(), result.id, effectiveQuery, "retrieved", { tool: "context", action: "rag", strategy: "multi" });
      }
    } catch {
      // Usage recording is best-effort
    }

    const trace = tracer.finalize();
    logger.info("tool:context:rag:ok", {
      query,
      strategy: "multi",
      phase: currentPhase,
      intent: understanding.intent,
      rawResults: rawResults.length,
      postProcessed: multiResults.length,
      citations: cited.citations.length,
      totalLatencyMs: trace.totalLatencyMs,
    });

    const multiResponse = {
      query,
      strategy: "multi",
      intent: understanding.intent,
      citedContext: cited.assembledText,
      citations: cited.citations,
      sourceBreakdown: cited.sourceBreakdown,
      results: multiResults.map((r) => ({
        id: r.id,
        sourceType: r.sourceType,
        title: r.title,
        content: r.content.length > 500 ? r.content.slice(0, 500) + "..." : r.content,
        score: r.score,
        qualityScore: r.qualityScore,
        strategies: r.strategies,
      })),
      tokenUsage: {
        budget,
        used: trace.totalTokensUsed,
        remaining: budget - trace.totalTokensUsed,
      },
      trace: {
        traceId: trace.traceId,
        totalLatencyMs: trace.totalLatencyMs,
        stages: trace.stages.map((s) => ({
          stage: s.stage,
          latencyMs: s.latencyMs,
          inputCount: s.inputCount,
          outputCount: s.outputCount,
        })),
      },
    };
    semanticCache.store(query, multiResponse);
    return wrapWithSession(multiResponse);
  }

  // Default: use existing RAG context builder with phase awareness
  const defaultCacheKey = `default:${query.trim().toLowerCase()}:${budget}`;
  const cachedDefault = contextCache.get(defaultCacheKey);
  if (cachedDefault) {
    logger.debug("context:rag:default_cache_hit", { query });
    return wrapWithSession(cachedDefault as unknown as Record<string, unknown>);
  }

  const ctx = ragBuildContext(store, query, budget, currentPhase);

  contextCache.set(defaultCacheKey, ctx);
  semanticCache.store(query, ctx);
  logger.info("tool:context:rag:ok", { query, tier: "standard", phase: currentPhase });
  return wrapWithSession(ctx as unknown as Record<string, unknown>);
}

function handleCompress(params: ContextParams): ReturnType<typeof mcpText> {
  const { text, format, max_tokens } = params;

  if (!text) {
    return mcpError("action=compress requires 'text' param");
  }
  if (!format) {
    return mcpError("action=compress requires 'format' param");
  }

  const normalizedText = normalizeNewlines(text) ?? text;
  const maxTokens = max_tokens ?? 2000;

  logger.debug("tool:context:compress", { format, maxTokens, inputLength: text.length });

  const result = compressText(normalizedText, format, maxTokens);

  logger.info("tool:context:compress:ok", {
    format,
    inputTokens: result.stats.input_tokens,
    outputTokens: result.stats.output_tokens,
    reduction: result.stats.reduction_percent,
  });

  return mcpText({
    compressed: result.compressed,
    stats: result.stats,
  });
}

function handleBatchCompress(params: ContextParams): ReturnType<typeof mcpText> {
  const { texts } = params;

  if (!texts || texts.length === 0) {
    return mcpError("action=batch_compress requires 'texts' array with at least 1 item");
  }

  if (texts.length > 50) {
    return mcpError("action=batch_compress allows max 50 items");
  }

  logger.debug("tool:context:batch_compress", { count: texts.length });

  const results = texts.map((item, index) => {
    const normalizedText = normalizeNewlines(item.text) ?? item.text;
    const maxTokens = item.max_tokens ?? 2000;

    const result = compressText(normalizedText, item.format, maxTokens);

    return {
      index,
      compressed: result.compressed,
      stats: result.stats,
    };
  });

  const totalInputTokens = results.reduce((sum, r) => sum + r.stats.input_tokens, 0);
  const totalOutputTokens = results.reduce((sum, r) => sum + r.stats.output_tokens, 0);

  logger.info("tool:context:batch_compress:ok", {
    count: texts.length,
    totalInputTokens,
    totalOutputTokens,
    avgReduction: totalInputTokens > 0
      ? `${Math.round((1 - totalOutputTokens / totalInputTokens) * 100)}%`
      : "0%",
  });

  return mcpText({
    results,
    summary: {
      count: results.length,
      totalInputTokens,
      totalOutputTokens,
      avgReductionPercent: totalInputTokens > 0
        ? Math.round((1 - totalOutputTokens / totalInputTokens) * 100)
        : 0,
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Tool registration                                                  */
/* ------------------------------------------------------------------ */

export function registerContext(server: McpServer, store: SqliteStore): void {
  server.tool(
    "context",
    "Context hub: compact task context (action=compact, default), RAG search with multi-strategy + caching (action=rag), text compression (action=compress), batch compression (action=batch_compress)",
    {
      action: z.enum(["compact", "rag", "compress", "batch_compress"]).default("compact")
        .describe("Action: compact (task context by ID, default), rag (RAG search by query), compress (text compression), batch_compress (compress multiple texts)"),

      // --- compact params ---
      id: z.string().min(1).optional()
        .describe("Node ID to build context for (action=compact)"),

      // --- shared param: compact + rag ---
      sessionId: z.string().min(1).optional()
        .describe("Session ID for delta tracking — omit for full response every time (action=compact, rag)"),

      // --- rag params ---
      query: z.string().optional()
        .describe("Natural language query to search for (action=rag)"),
      tokenBudget: z.number().int().min(500).max(32000).optional()
        .describe("Maximum token budget for RAG context (default: 4000) (action=rag)"),
      detail: z.enum(["summary", "brief", "standard", "deep"]).optional()
        .describe("Context detail level: summary (~40-50 tok/node), brief (~80), standard (~150), deep (~500+) (action=rag)"),
      strategy: z.enum(["fts", "multi"]).optional()
        .describe("Search strategy: fts (BM25), multi (query understanding + post-retrieval + citations) (action=rag)"),

      // --- compress params ---
      text: z.string().min(1).optional()
        .describe("Text to compress (action=compress)"),
      format: z.enum(["bullets", "summary", "steps", "json"]).optional()
        .describe("Compression format: bullets, summary, steps, json (action=compress)"),
      max_tokens: z.number().int().min(50).max(32000).optional()
        .describe("Maximum tokens for compressed output (default: 2000) (action=compress)"),

      // --- batch_compress params ---
      texts: z.array(z.object({
        text: z.string().min(1).describe("Text to compress"),
        format: z.enum(["bullets", "summary", "steps", "json"]).describe("Compression format"),
        max_tokens: z.number().int().min(50).max(32000).optional().describe("Max tokens (default: 2000)"),
      })).max(50).optional()
        .describe("Array of texts to compress (action=batch_compress, max 50)"),
    },
    async (params) => {
      const resolvedAction = params.action ?? "compact";
      logger.info("tool:context", { action: resolvedAction });

      try {
        switch (resolvedAction) {
          case "compact":
            return handleCompact(store, params);
          case "rag":
            return await handleRag(store, params);
          case "compress":
            return handleCompress(params);
          case "batch_compress":
            return handleBatchCompress(params);
          default:
            return mcpError(`Unknown context action: ${resolvedAction}`);
        }
      } catch (err) {
        logger.error("tool:context failed", { action: resolvedAction, error: err instanceof Error ? err.message : String(err) });
        return mcpError(err instanceof Error ? err : String(err));
      }
    },
  );
}
