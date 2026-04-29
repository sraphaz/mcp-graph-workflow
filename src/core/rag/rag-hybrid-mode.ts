/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { McpGraphError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export type RagMode = "lexical" | "semantic" | "hybrid";

const VALID_MODES: ReadonlySet<string> = new Set(["lexical", "semantic", "hybrid"]);

// §EPIC-17.T05 — MCP_GRAPH_EMBEDDINGS alias accepts user-friendly names that
// map to RagMode values. RAG_HYBRID_MODE remains the canonical env var; the
// alias is provided so the PRD-9-concepts contract is honored verbatim.
const EMBEDDINGS_ALIAS: Record<string, RagMode> = {
  tfidf: "lexical",
  onnx: "hybrid",
  lexical: "lexical",
  semantic: "semantic",
  hybrid: "hybrid",
};

/**
 * Parse the RAG_HYBRID_MODE (canonical) or MCP_GRAPH_EMBEDDINGS (alias) env var.
 * - Default: "lexical" (preserves existing BM25 behavior — graceful fallback)
 * - "hybrid": BM25 + cosine + MMR via hybrid-search.ts
 * - "semantic": cosine-only (requires ONNX)
 * - MCP_GRAPH_EMBEDDINGS=tfidf → lexical; MCP_GRAPH_EMBEDDINGS=onnx → hybrid
 * RAG_HYBRID_MODE takes precedence when both are set.
 * Throws if the value is present but not one of the valid modes.
 */
export function parseRagHybridMode(env: Record<string, string | undefined> = process.env as Record<string, string | undefined>): RagMode {
  const canonical = env["RAG_HYBRID_MODE"];

  if (canonical !== undefined && canonical !== null) {
    if (!VALID_MODES.has(canonical)) {
      throw new McpGraphError(
        `Invalid RAG_HYBRID_MODE "${canonical}". Valid values: ${[...VALID_MODES].join(", ")}`,
      );
    }
    logger.debug("rag:mode", { mode: canonical, source: "RAG_HYBRID_MODE" });
    return canonical as RagMode;
  }

  const alias = env["MCP_GRAPH_EMBEDDINGS"];
  if (alias !== undefined && alias !== null) {
    const mapped = EMBEDDINGS_ALIAS[alias];
    if (mapped === undefined) {
      throw new McpGraphError(
        `Invalid MCP_GRAPH_EMBEDDINGS "${alias}". Valid: ${Object.keys(EMBEDDINGS_ALIAS).join(", ")}`,
      );
    }
    logger.debug("rag:mode", { mode: mapped, source: "MCP_GRAPH_EMBEDDINGS", raw: alias });
    return mapped;
  }

  return "lexical";
}

/** Returns true if the current mode requires semantic embeddings. */
export function requiresEmbeddings(mode: RagMode): boolean {
  return mode === "hybrid" || mode === "semantic";
}
