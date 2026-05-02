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

import { Command } from "commander";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { DocsCacheStore } from "../../core/docs/docs-cache-store.js";
import { EmbeddingStore } from "../../core/rag/embedding-store.js";
import { indexMemories } from "../../core/rag/memory-indexer.js";
import { indexCachedDocs } from "../../core/rag/docs-indexer.js";
import { indexAllEmbeddings } from "../../core/rag/rag-pipeline.js";
import { getErrorMessage } from "../../core/utils/errors.js";
import { logger } from "../../core/utils/logger.js";

function output(msg: string): void {
  process.stdout.write(msg + "\n");
}

/** indexCommand — auto-generated description placeholder. */
export function indexCommand(): Command {
  return new Command("index")
    .description("Reindex all knowledge sources (memories, docs cache) and rebuild embeddings")
    .option("-d, --dir <dir>", "Project directory", process.cwd())
    .option("--json", "Output as JSON")
    .action(async (opts: { dir: string; json: boolean }) => {
      const store = SqliteStore.open(opts.dir);

      try {
        const knowledgeStore = new KnowledgeStore(store.getDb());
        const docsCacheStore = new DocsCacheStore(store.getDb());
        const embeddingStore = new EmbeddingStore(store);

        const memoriesResult = await indexMemories(knowledgeStore, opts.dir);
        const docsResult = indexCachedDocs(knowledgeStore, docsCacheStore);

        embeddingStore.clear();
        const embeddingResult = await indexAllEmbeddings(store, embeddingStore);

        const totalKnowledge = knowledgeStore.count();

        if (opts.json) {
          output(JSON.stringify({
            memories: memoriesResult,
            docs: docsResult,
            embeddings: embeddingResult,
            totalKnowledge,
          }, null, 2));
        } else {
          output("Knowledge indexing complete:");
          output(`  Memories: ${memoriesResult.memoriesFound} found, ${memoriesResult.documentsIndexed} indexed`);
          output(`  Docs cache: ${docsResult.docsFound} found, ${docsResult.documentsIndexed} indexed`);
          output(`  Embeddings: ${embeddingResult.nodes} nodes + ${embeddingResult.knowledge} knowledge`);
          output(`  Total knowledge documents: ${totalKnowledge}`);
        }
      } catch (err) {
        logger.error(`Indexing failed: ${getErrorMessage(err)}`);
        process.exit(1);
      } finally {
        store.close();
      }
    });
}
