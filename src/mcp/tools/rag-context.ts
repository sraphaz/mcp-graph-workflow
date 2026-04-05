import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { ragBuildContext } from "../../core/context/rag-context.js";
import { assembleContext } from "../../core/context/context-assembler.js";
import { SessionTracker } from "../../core/context/session-tracker.js";
import { applyRagSessionDelta } from "../../core/context/context-session.js";
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
import { logger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";

/** Lazily instantiated SessionTracker (shared across calls). */
let sessionTracker: SessionTracker | null = null;

function getSessionTracker(store: SqliteStore): SessionTracker {
  if (!sessionTracker) {
    sessionTracker = new SessionTracker(store.getDb());
  }
  return sessionTracker;
}

/** Module-level semantic cache — shared across all rag_context calls (all paths). */
const semanticCache = new RagSemanticCacheLayer({ ttlMs: 10 * 60 * 1000, maxEntries: 100 });

/** Module-level query cache — shared across all rag_context calls (multi-strategy path). */
const ragCache = new QueryCache({ ttlMs: 5 * 60 * 1000, maxSize: 100 });

/** Module-level response cache — shared across detail and default paths. */
const contextCache = new ResponseCache({ ttlMs: 5 * 60 * 1000, maxSize: 50 });

/** Invalidate all RAG caches (e.g., after reindex_knowledge or node mutations). */
export function invalidateRagCache(): void {
  ragCache.invalidateAll();
  contextCache.invalidateAll();
  logger.debug("rag_context:cache_invalidated");
}

export function registerRagContext(server: McpServer, store: SqliteStore): void {
  server.tool(
    "rag_context",
    "Build a RAG context from a natural language query. Returns relevant nodes with expanded subgraph context, managed within a token budget. Supports detail levels: summary (~40-50 tok/node), standard (~150 tok/node), deep (~500+ tok/node with knowledge).",
    {
      query: z.string().describe("Natural language query to search for"),
      tokenBudget: z
        .number()
        .int()
        .min(500)
        .max(32000)
        .optional()
        .describe("Maximum token budget for the context (default: 4000)"),
      detail: z
        .enum(["summary", "brief", "standard", "deep"])
        .optional()
        .describe("Context detail level: summary (~40-50 tok/node), standard (~150 tok/node), deep (~500+ tok/node). Default: standard"),
      strategy: z
        .enum(["fts", "multi"])
        .optional()
        .describe("Search strategy: 'fts' (traditional BM25), 'multi' (multi-strategy with query understanding, post-retrieval, citations). Default: fts"),
      sessionId: z
        .string()
        .min(1)
        .optional()
        .describe("Session ID for delta tracking — omit for full response every time"),
    },
    async ({ query, tokenBudget, detail, strategy, sessionId }) => {
      logger.debug("tool:rag_context", { query, detail, sessionId });

      /** Wrap response with session delta if sessionId is present. */
      const wrapWithSession = (data: Record<string, unknown>) => {
        if (!sessionId) {
          return mcpText(data);
        }
        const tracker = getSessionTracker(store);
        const result = applyRagSessionDelta(tracker, sessionId, data);
        logger.info("tool:rag_context:session", { sessionId, savings: result._session_savings });
        return mcpText({ ...result.response, _session_savings: result._session_savings });
      };
      const budget = tokenBudget ?? DEFAULT_TOKEN_BUDGET;

      // Semantic cache — check before any pipeline execution
      const semanticHit = semanticCache.lookup(query);
      if (semanticHit) {
        logger.info("tool:rag_context:semantic_cache_hit", { query, type: semanticHit.type });
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
        logger.debug("tool:rag_context:phase_detection_skipped");
      }

      if (detail) {
        // Check context cache for detail path
        const detailCacheKey = `detail:${detail}:${query.trim().toLowerCase()}:${budget}`;
        const cachedDetail = contextCache.get(detailCacheKey);
        if (cachedDetail) {
          logger.debug("rag_context:detail_cache_hit", { query, detail });
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
        logger.info("tool:rag_context:ok", { query, detail, phase: currentPhase, strategy });
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
          logger.debug("rag_context:cache_hit", { query: effectiveQuery });
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
            recordUsage(store.getDb(), result.id, effectiveQuery, "retrieved", { tool: "rag_context", strategy: "multi" });
          }
        } catch {
          // Usage recording is best-effort
        }

        const trace = tracer.finalize();
        logger.info("tool:rag_context:ok", {
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
        logger.debug("rag_context:default_cache_hit", { query });
        return wrapWithSession(cachedDefault as unknown as Record<string, unknown>);
      }

      const ctx = ragBuildContext(store, query, budget, currentPhase);

      contextCache.set(defaultCacheKey, ctx);
      semanticCache.store(query, ctx);
      logger.info("tool:rag_context:ok", { query, tier: "standard", phase: currentPhase });
      return wrapWithSession(ctx as unknown as Record<string, unknown>);
    },
  );
}
