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
 * Docs Indexer — mirrors docs_cache entries into the knowledge store.
 * Keeps backward compatibility with DocsCacheStore while enabling
 * unified search across all knowledge sources.
 */

import { DocsCacheStore } from "../docs/docs-cache-store.js";
import { KnowledgeStore } from "../store/knowledge-store.js";
import { chunkText } from "./chunk-text.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "rag", source: "docs-indexer.ts" });

export interface DocsIndexResult {
  docsFound: number;
  documentsIndexed: number;
  skippedDuplicates: number;
}

/**
 * Index all cached docs into the knowledge store.
 * Each cached doc is chunked and stored with source_type='docs'.
 */
export function indexCachedDocs(
  knowledgeStore: KnowledgeStore,
  docsCacheStore: DocsCacheStore,
): DocsIndexResult {
  const allDocs = docsCacheStore.listCached();

  if (allDocs.length === 0) {
    log.info("No cached docs to index");
    return { docsFound: 0, documentsIndexed: 0, skippedDuplicates: 0 };
  }

  let documentsIndexed = 0;
  let skippedDuplicates = 0;

  for (const doc of allDocs) {
    const sourceId = `docs:${doc.libId}`;
    const chunks = chunkText(doc.content);

    // Remove previous version to re-index fresh content
    knowledgeStore.deleteBySource("docs", sourceId);

    for (const chunk of chunks) {
      const countBefore = knowledgeStore.count("docs");

      knowledgeStore.insert({
        sourceType: "docs",
        sourceId,
        title: chunks.length > 1
          ? `${doc.libName} [${chunk.index + 1}/${chunks.length}]`
          : doc.libName,
        content: chunk.content,
        chunkIndex: chunk.index,
        metadata: {
          libId: doc.libId,
          libName: doc.libName,
          version: doc.version,
          fetchedAt: doc.fetchedAt,
        },
      });

      if (knowledgeStore.count("docs") > countBefore) {
        documentsIndexed++;
      } else {
        skippedDuplicates++;
      }
    }
  }

  log.info("Cached docs indexed", {
    docsFound: allDocs.length,
    documentsIndexed,
    skippedDuplicates,
  });

  return { docsFound: allDocs.length, documentsIndexed, skippedDuplicates };
}
