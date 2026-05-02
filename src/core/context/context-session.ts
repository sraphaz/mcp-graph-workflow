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
 * Session-aware context filtering.
 * Applies delta tracking to context payloads, returning only unseen chunks.
 */

import type { TaskContext } from "./compact-context.js";
import type { SessionTracker } from "./session-tracker.js";
import { logger } from "../utils/logger.js";

export interface SessionSavings {
  skippedCount: number;
  tokensSaved: number;
}

export interface SessionContextResult {
  context: TaskContext;
  _session_savings: SessionSavings;
}

/**
 * Convert a TaskContext into serializable chunks for delta tracking.
 * Each major section becomes a separate chunk.
 */
function contextToChunks(ctx: TaskContext): string[] {
  const chunks: string[] = [];

  if (ctx.task) {
    chunks.push(JSON.stringify({ section: "task", data: ctx.task }));
  }
  if (ctx.parent) {
    chunks.push(JSON.stringify({ section: "parent", data: ctx.parent }));
  }
  if (ctx.children.length > 0) {
    chunks.push(JSON.stringify({ section: "children", data: ctx.children }));
  }
  if (ctx.blockers.length > 0) {
    chunks.push(JSON.stringify({ section: "blockers", data: ctx.blockers }));
  }
  if (ctx.dependsOn.length > 0) {
    chunks.push(JSON.stringify({ section: "dependsOn", data: ctx.dependsOn }));
  }
  if (ctx.acceptanceCriteria.length > 0) {
    chunks.push(JSON.stringify({ section: "acceptanceCriteria", data: ctx.acceptanceCriteria }));
  }
  if (ctx.sourceRef) {
    chunks.push(JSON.stringify({ section: "sourceRef", data: ctx.sourceRef }));
  }

  return chunks;
}

/**
 * Apply session delta to a TaskContext.
 * On first call, all chunks are new. On subsequent calls, only changed/new sections are returned.
 * Always tracks sent chunks after computing delta.
 */
export function applySessionDelta(
  tracker: SessionTracker,
  sessionId: string,
  ctx: TaskContext,
): SessionContextResult {
  const chunks = contextToChunks(ctx);

  // Get delta — which chunks are new vs already sent
  const delta = tracker.getDelta(sessionId, chunks);

  // Track the new chunks as sent
  if (delta.newChunks.length > 0) {
    tracker.trackSent(sessionId, delta.newChunks);
  }

  logger.debug("context-session:delta", {
    sessionId,
    totalChunks: chunks.length,
    newChunks: delta.newChunks.length,
    skipped: delta.skippedCount,
    tokensSaved: delta.tokensSaved,
  });

  return {
    context: ctx,
    _session_savings: {
      skippedCount: delta.skippedCount,
      tokensSaved: delta.tokensSaved,
    },
  };
}

export interface RagSessionResult {
  response: Record<string, unknown>;
  _session_savings: SessionSavings;
}

/**
 * Extract trackable chunks from a RAG response.
 * Handles both sections-based and results-based response shapes.
 */
function ragResponseToChunks(response: Record<string, unknown>): string[] {
  const chunks: string[] = [];

  // sections array (tiered/assembler path)
  if (Array.isArray(response.sections)) {
    for (const section of response.sections) {
      chunks.push(JSON.stringify(section));
    }
  }

  // results array (multi-strategy path)
  if (Array.isArray(response.results)) {
    for (const resultValue of response.results) {
      chunks.push(JSON.stringify(resultValue));
    }
  }

  return chunks;
}

/**
 * Apply session delta to a RAG context response.
 * Tracks sections/results as chunks. On subsequent calls, reports savings.
 */
export function applyRagSessionDelta(
  tracker: SessionTracker,
  sessionId: string,
  response: Record<string, unknown>,
): RagSessionResult {
  const chunks = ragResponseToChunks(response);

  if (chunks.length === 0) {
    return {
      response,
      _session_savings: { skippedCount: 0, tokensSaved: 0 },
    };
  }

  const delta = tracker.getDelta(sessionId, chunks);

  if (delta.newChunks.length > 0) {
    tracker.trackSent(sessionId, delta.newChunks);
  }

  logger.debug("rag-session:delta", {
    sessionId,
    totalChunks: chunks.length,
    newChunks: delta.newChunks.length,
    skipped: delta.skippedCount,
    tokensSaved: delta.tokensSaved,
  });

  return {
    response,
    _session_savings: {
      skippedCount: delta.skippedCount,
      tokensSaved: delta.tokensSaved,
    },
  };
}
