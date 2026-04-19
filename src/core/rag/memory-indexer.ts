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
 * Memory Indexer — reads workflow-graph/memories/*.md and stores them
 * as knowledge documents for unified search.
 */

import { readAllMemories } from "../memory/memory-reader.js";
import { KnowledgeStore } from "../store/knowledge-store.js";
import { chunkText } from "./chunk-text.js";
import { logger } from "../utils/logger.js";

export interface MemoryIndexResult {
  memoriesFound: number;
  documentsIndexed: number;
  skippedDuplicates: number;
}

/**
 * Index all memory files into the knowledge store.
 * Chunks large memories and deduplicates by content hash.
 */
export async function indexMemories(
  knowledgeStore: KnowledgeStore,
  basePath: string,
): Promise<MemoryIndexResult> {
  const memories = await readAllMemories(basePath);

  if (memories.length === 0) {
    logger.info("No memories found to index", { basePath });
    return { memoriesFound: 0, documentsIndexed: 0, skippedDuplicates: 0 };
  }

  let documentsIndexed = 0;
  let skippedDuplicates = 0;
  const countBefore = knowledgeStore.count("memory");

  for (const memory of memories) {
    const chunks = chunkText(memory.content);

    for (const chunk of chunks) {
      knowledgeStore.insert({
        sourceType: "memory",
        sourceId: `memory:${memory.name}`,
        title: chunks.length > 1
          ? `${memory.name} [${chunk.index + 1}/${chunks.length}]`
          : memory.name,
        content: chunk.content,
        chunkIndex: chunk.index,
        metadata: { sizeBytes: memory.sizeBytes, memoryName: memory.name },
      });

      // Check if this was a dedup hit (id already existed)
      if (knowledgeStore.count("memory") === countBefore + documentsIndexed) {
        skippedDuplicates++;
      } else {
        documentsIndexed++;
      }
    }
  }

  logger.info("Memories indexed", {
    memoriesFound: memories.length,
    documentsIndexed,
    skippedDuplicates,
  });

  return { memoriesFound: memories.length, documentsIndexed, skippedDuplicates };
}
