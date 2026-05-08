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
 * Capture Indexer — indexes web capture results into the knowledge store.
 * Called after captureWebPage() to persist extracted content for search.
 */

import type { CaptureResult } from "../capture/web-capture.js";
import { KnowledgeStore } from "../store/knowledge-store.js";
import { chunkText } from "./chunk-text.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "rag", source: "capture-indexer.ts" });

export interface CaptureIndexResult {
  documentsIndexed: number;
  url: string;
}

/**
 * Index a web capture result into the knowledge store.
 * Chunks the extracted text and stores with source_type='web_capture'.
 */
export function indexCapture(
  knowledgeStore: KnowledgeStore,
  capture: CaptureResult,
): CaptureIndexResult {
  const chunks = chunkText(capture.text);

  if (chunks.length === 0) {
    log.info("No content to index from capture", { url: capture.url });
    return { documentsIndexed: 0, url: capture.url };
  }

  const sourceId = `capture:${capture.url}`;

  // Remove previous capture of this URL to avoid stale data
  knowledgeStore.deleteBySource("web_capture", sourceId);

  const docs = knowledgeStore.insertChunks(
    chunks.map((chunk) => ({
      sourceType: "web_capture" as const,
      sourceId,
      title: chunks.length > 1
        ? `Web: ${capture.url} [${chunk.index + 1}/${chunks.length}]`
        : `Web: ${capture.url}`,
      content: chunk.content,
      chunkIndex: chunk.index,
      metadata: {
        url: capture.url,
        capturedAt: capture.capturedAt,
        wordCount: capture.wordCount,
      },
    })),
  );

  log.info("Web capture indexed", { url: capture.url, chunks: docs.length });

  return { documentsIndexed: docs.length, url: capture.url };
}
