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
 * Decision Provenance — Auditable Citation Chain for Agent Decisions
 *
 * Links every agent decision to the RAG citations that informed it,
 * creating a full audit trail: task -> decision -> citations.
 *
 * Stored as knowledge documents with sourceType "ai_decision" and
 * structured metadata containing citations and ragTraceId.
 */

import type { KnowledgeStore } from "../store/knowledge-store.js";
import type { CitationRef } from "./citation-chain.js";
import { logger } from "../utils/logger.js";

// ── Types ───────────────────────────────────────────────

export interface DecisionProvenance {
  id: string;
  nodeId: string;
  rationale: string;
  citations: CitationRef[];
  ragTraceId?: string;
  timestamp: string;
}

export interface CreateProvenanceInput {
  nodeId: string;
  rationale: string;
  citations: CitationRef[];
  ragTraceId?: string;
  timestamp: string;
}

const SOURCE_ID_PREFIX = "decision_provenance";

export function createProvenance(
  store: KnowledgeStore,
  input: CreateProvenanceInput,
): string {
  const { nodeId, rationale, citations, ragTraceId, timestamp } = input;
  const sourceId = `${SOURCE_ID_PREFIX}:${nodeId}:${timestamp}`;
  const content = `# Decision Provenance: ${nodeId}\n\n${rationale}`;
  const doc = store.insert({
    sourceType: "ai_decision",
    sourceId,
    title: `Decision Provenance: ${nodeId}`,
    content,
    metadata: {
      nodeId,
      rationale,
      provenanceType: "decision_provenance",
      citations: JSON.parse(JSON.stringify(citations)),
      citationCount: citations.length,
      ...(ragTraceId ? { ragTraceId } : {}),
      timestamp,
    },
  });
  logger.info("decision-provenance:created", {
    docId: doc.id,
    nodeId,
    citationCount: citations.length,
    hasRagTrace: !!ragTraceId,
  });
  return doc.id;
}

export function queryProvenance(
  store: KnowledgeStore,
  nodeId: string,
): DecisionProvenance[] {
  const docs = store.list({ sourceType: "ai_decision", limit: 200 });
  return docs
    .filter((doc) => {
      const meta = doc.metadata as Record<string, unknown> | undefined;
      return meta?.provenanceType === "decision_provenance" && meta?.nodeId === nodeId;
    })
    .map((doc) => docToProvenance(doc.id, doc.metadata as Record<string, unknown>))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function getProvenanceChain(
  store: KnowledgeStore,
  nodeId: string,
): DecisionProvenance[] {
  return queryProvenance(store, nodeId);
}

function docToProvenance(docId: string, metadata: Record<string, unknown>): DecisionProvenance {
  const citations = Array.isArray(metadata.citations)
    ? (metadata.citations as CitationRef[])
    : [];
  return {
    id: docId,
    nodeId: String(metadata.nodeId ?? ""),
    rationale: String(metadata.rationale ?? ""),
    citations,
    ragTraceId: metadata.ragTraceId ? String(metadata.ragTraceId) : undefined,
    timestamp: String(metadata.timestamp ?? new Date().toISOString()),
  };
}
