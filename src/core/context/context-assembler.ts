/**
 * Context Assembler — combines graph context + knowledge + memories + docs
 * with token accounting per section. Produces a structured, budgeted context
 * suitable for LLM consumption.
 */

import type { SqliteStore } from "../store/sqlite-store.js";
import { KnowledgeStore } from "../store/knowledge-store.js";
import { GraphSnapshotCache } from "../store/graph-snapshot-cache.js";
import { ResponseCache } from "../rag/response-cache.js";
import { buildTieredContext, type ContextTier } from "./tiered-context.js";
import { compressWithBm25 } from "./bm25-compressor.js";
import { compressBullets } from "./rule-compressor.js";
import { estimateTokens } from "./token-estimator.js";
import { findCommunityDocs } from "../rag/graph-rag-strategy.js";
import { runHarnessScanCached } from "../harness/harness-cache.js";
import { DEFAULT_TOKEN_BUDGET } from "../utils/constants.js";
import { logger } from "../utils/logger.js";
import type { LifecyclePhase } from "../planner/lifecycle-phase.js";

// Module-level cache for assembleContext results (detail path)
const assemblerCache = new ResponseCache({ ttlMs: 2 * 60 * 1000, maxSize: 50 });

/** Invalidate the assembler context cache. */
export function invalidateAssemblerCache(): void {
  assemblerCache.invalidateAll();
}

/** Get assembler cache stats. */
export function getAssemblerCacheStats(): { size: number; hits: number; misses: number; evictions: number } {
  return assemblerCache.getStats();
}

export interface CompressionStats {
  inputTokens: number;
  outputTokens: number;
  reductionPercent: number;
}

export interface AssembledContext {
  /** The query used to assemble context */
  query: string;
  /** Tier used for node context */
  tier: ContextTier;
  /** Bug #079: alias matching the tool param name 'detail' */
  detail: ContextTier;
  /** Assembled sections with token accounting */
  sections: ContextSection[];
  /** Token usage breakdown */
  tokenUsage: {
    budget: number;
    used: number;
    remaining: number;
    breakdown: Record<string, number>;
  };
  /** Compression stats — only present when compress:true */
  _compression?: CompressionStats;
}

export interface ContextSection {
  name: string;
  source: string;
  content: string;
  tokens: number;
}

export interface AssemblerOptions {
  /** Total token budget (default: 4000) */
  tokenBudget?: number;
  /** Context tier (default: "standard") */
  tier?: ContextTier;
  /** Node IDs to include (if empty, uses FTS search) */
  nodeIds?: string[];
  /** Max knowledge chunks to include (default: 5) */
  maxKnowledgeChunks?: number;
  /** Current lifecycle phase for phase-aware knowledge boosting */
  phase?: LifecyclePhase;
  /** Pre-assembled LSP symbol context string to include as a section */
  lspContext?: string;
  /** Enable rule-based compression on knowledge sections (default: false) */
  compress?: boolean;
}

/**
 * Assemble a multi-source context with token budgeting.
 */
export function assembleContext(
  store: SqliteStore,
  query: string,
  options?: AssemblerOptions,
): AssembledContext {
  const tokenBudget = options?.tokenBudget ?? DEFAULT_TOKEN_BUDGET;
  const tier = options?.tier ?? "standard";
  const maxKnowledgeChunks = options?.maxKnowledgeChunks ?? 5;

  // Check cache first
  const compress = options?.compress ?? false;
  const cacheKey = `detail:${query.trim().toLowerCase()}:${tier}:${tokenBudget}:compress=${compress}`;
  const cached = assemblerCache.get(cacheKey) as AssembledContext | undefined;
  if (cached) {
    logger.debug("assembler:context cache hit", { query: query.slice(0, 60) });
    return cached;
  }

  const sections: ContextSection[] = [];
  const breakdown: Record<string, number> = {};
  let tokensUsed = 0;

  // Budget allocation: 60% graph, 30% knowledge, 10% header
  const graphBudget = Math.floor(tokenBudget * 0.6);
  const knowledgeBudget = Math.floor(tokenBudget * 0.3);

  // Section 1: Graph context for specified or searched nodes
  const nodeIds = options?.nodeIds ?? findRelevantNodeIds(store, query);

  for (const nodeId of nodeIds) {
    if (tokensUsed >= graphBudget) break;

    const ctx = buildTieredContext(store, nodeId, tier);
    if (!ctx) continue;

    if (tokensUsed + ctx.estimatedTokens > graphBudget && sections.length > 0) break;

    const content = JSON.stringify(ctx, null, 0);
    const tokens = estimateTokens(content);

    sections.push({
      name: `node:${ctx.summary.title}`,
      source: "graph",
      content,
      tokens,
    });

    tokensUsed += tokens;
  }

  breakdown.graph = tokensUsed;

  // Section 2: Knowledge context (BM25-compressed, phase-aware)
  const knowledgeTokensBefore = tokensUsed;
  const phase = options?.phase;

  try {
    const knowledgeStore = new KnowledgeStore(store.getDb());

    // Primary search with original query
    const kResults = phase
      ? knowledgeStore.searchWithPhaseBoost(query, phase, maxKnowledgeChunks * 2)
      : knowledgeStore.search(query, maxKnowledgeChunks * 2);

    // Harness-aware: supplementary search for weak dimensions (non-blocking, additive only)
    try {
      const harness = runHarnessScanCached(process.cwd());
      if (harness && harness.score < 70 && kResults.length < maxKnowledgeChunks) {
        const breakdown = harness.breakdown as Record<string, { score: number }>;
        const boostTerms: Record<string, string> = {
          tests: "testing coverage",
          types: "typescript types",
          errorHandling: "error handling",
          contextDensity: "jsdoc documentation",
        };
        const weak = Object.entries(breakdown)
          .filter(([, v]) => v.score < 50)
          .map(([k]) => boostTerms[k])
          .filter(Boolean);
        if (weak.length > 0) {
          const existingIds = new Set(kResults.map((r) => r.id));
          const supplementary = knowledgeStore.search(weak.join(" "), 3);
          for (const doc of supplementary) {
            if (!existingIds.has(doc.id) && kResults.length < maxKnowledgeChunks * 2) {
              kResults.push(doc);
            }
          }
        }
      }
    } catch {
      // non-blocking
    }

    if (kResults.length > 0) {
      const chunks = kResults.map((r) => `[${r.sourceType}] ${r.title}: ${r.content}`);
      const compressed = compressWithBm25(chunks, query, knowledgeBudget);

      for (const chunk of compressed) {
        if (tokensUsed + chunk.tokens > tokenBudget && sections.length > 0) break;

        sections.push({
          name: `knowledge:${chunk.content.slice(0, 40)}...`,
          source: "knowledge",
          content: chunk.content,
          tokens: chunk.tokens,
        });

        tokensUsed += chunk.tokens;
      }
    }
  } catch {
    logger.debug("Knowledge search unavailable during assembly");
  }

  breakdown.knowledge = tokensUsed - knowledgeTokensBefore;

  // Section 3: Graph-aware community context (from Graph RAG community detection)
  const communityTokensBefore = tokensUsed;
  if (tokensUsed < tokenBudget) {
    try {
      const communityDocIds = findCommunityDocs(store.getDb(), store, query);
      if (communityDocIds.length > 0) {
        const knowledgeStore2 = new KnowledgeStore(store.getDb());
        const communityBudget = Math.floor(tokenBudget * 0.1);
        let communityTokensUsed = 0;

        for (const docId of communityDocIds.slice(0, 3)) {
          if (communityTokensUsed >= communityBudget) break;

          const doc = knowledgeStore2.getById(docId);
          if (!doc) continue;

          // Skip docs already added in knowledge section
          if (sections.some((s) => s.content.includes(doc.title))) continue;

          // Apply dynamic phase boost if phase is set
          const content = `[${doc.sourceType}] ${doc.title}: ${doc.content.slice(0, 300)}`;
          const tokens = estimateTokens(content);

          if (tokensUsed + tokens > tokenBudget) break;

          sections.push({
            name: `community:${doc.title.slice(0, 30)}`,
            source: "graph_community",
            content,
            tokens,
          });

          tokensUsed += tokens;
          communityTokensUsed += tokens;
        }
      }
    } catch {
      logger.debug("Graph community context unavailable during assembly");
    }
  }
  breakdown.graph_community = tokensUsed - communityTokensBefore;

  // Section 4: LSP symbol context (if available)
  const lspTokensBefore = tokensUsed;
  if (options?.lspContext) {
    const lspTokens = estimateTokens(options.lspContext);
    if (tokensUsed + lspTokens <= tokenBudget || sections.length === 0) {
      sections.push({
        name: "lsp_symbols",
        source: "lsp",
        content: options.lspContext,
        tokens: lspTokens,
      });
      tokensUsed += lspTokens;
    }
  }
  breakdown.lsp = tokensUsed - lspTokensBefore;

  logger.debug("context:breakdown", {
    graphTokens: breakdown.graph,
    knowledgeTokens: breakdown.knowledge,
    sections: sections.map((s) => `${s.name}:${s.tokens}`).join(", "),
  });

  // Hard limit: drop last sections until within budget
  while (tokensUsed > tokenBudget && sections.length > 1) {
    const removed = sections.pop();
    if (removed) tokensUsed -= removed.tokens;
    logger.debug("context:budget-truncated", { removed: removed?.name, tokensUsed, tokenBudget });
  }
  if (tokensUsed > tokenBudget) {
    logger.warn("context:budget-exceeded", { tokensUsed, tokenBudget, overage: tokensUsed - tokenBudget });
  }

  const truncatedSections = nodeIds.length - sections.filter((s) => s.source === "graph").length;
  if (truncatedSections > 0) {
    logger.warn("context:sections-truncated", { truncatedSections, reason: "token budget" });
  }

  logger.info("Context assembled", {
    query: query.slice(0, 50),
    tier,
    sections: sections.length,
    tokensUsed,
    budget: tokenBudget,
  });

  // Apply rule-based compression to knowledge sections if requested
  let compressionStats: CompressionStats | undefined;
  if (options?.compress) {
    const knowledgeSections = sections.filter((s) => s.source === "knowledge");
    const inputTokens = knowledgeSections.reduce((sum, s) => sum + s.tokens, 0);

    for (const section of knowledgeSections) {
      const compressed = compressBullets(section.content, section.tokens);
      if (compressed.length < section.content.length && compressed.length > 0) {
        const oldTokens = section.tokens;
        section.content = compressed;
        section.tokens = estimateTokens(compressed);
        tokensUsed -= (oldTokens - section.tokens);
      }
    }

    const outputTokens = knowledgeSections.reduce((sum, s) => sum + s.tokens, 0);
    const reduction = inputTokens > 0 ? Math.round((1 - outputTokens / inputTokens) * 100) : 0;

    compressionStats = { inputTokens, outputTokens, reductionPercent: reduction };
    logger.debug("context:compression", { inputTokens, outputTokens, reductionPercent: reduction });
  }

  const result: AssembledContext = {
    query,
    tier,
    detail: tier,
    sections,
    tokenUsage: {
      budget: tokenBudget,
      used: tokensUsed,
      remaining: Math.max(0, tokenBudget - tokensUsed),
      breakdown,
    },
    ...(compressionStats ? { _compression: compressionStats } : {}),
  };

  // Cache result
  assemblerCache.set(cacheKey, result);

  return result;
}

/**
 * Find relevant node IDs via FTS search with substring fallback.
 */
function findRelevantNodeIds(store: SqliteStore, query: string): string[] {
  try {
    const results = store.searchNodes(query, 5);
    if (results.length > 0) return results.map((r) => r.id);
  } catch {
    logger.debug("FTS search failed in context assembler, falling back to substring");
  }

  // Fallback: simple substring match on title/description
  try {
    const snapshotCache = new GraphSnapshotCache(store);
    const allNodes = snapshotCache.getCachedSnapshot().nodes;
    const lowerQuery = query.toLowerCase();
    const words = lowerQuery.split(/\s+/).filter((w) => w.length > 2);
    if (words.length === 0) return [];
    return allNodes
      .filter((n) =>
        words.some((w) =>
          n.title.toLowerCase().includes(w) ||
          (n.description ?? "").toLowerCase().includes(w),
        ),
      )
      .slice(0, 10)
      .map((n) => n.id);
  } catch {
    logger.debug("Substring fallback also failed in context assembler");
    return [];
  }
}
