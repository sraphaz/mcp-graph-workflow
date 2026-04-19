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
 * Constitution Indexer — indexes constitution principles into the knowledge store.
 * Each principle becomes a separate knowledge document with sourceType "constitution".
 */

import type { KnowledgeStore } from "../store/knowledge-store.js";
import { logger } from "../utils/logger.js";

export interface ConstitutionPrincipleInput {
  id: string;
  title: string;
  description: string;
  category: string;
  weight: number;
  enforceable: boolean;
}

export interface ConstitutionIndexInput {
  nodeId: string;
  constitutionVersion: string;
  principles: ConstitutionPrincipleInput[];
}

export interface ConstitutionIndexResult {
  documentsIndexed: number;
}

/**
 * Index constitution principles into the knowledge store.
 * Deletes previous documents for this constitution node before inserting,
 * ensuring no duplicates on reindex.
 */
export function indexConstitution(
  store: KnowledgeStore,
  input: ConstitutionIndexInput,
): ConstitutionIndexResult {
  const sourcePrefix = `constitution:${input.nodeId}`;

  // Delete previous documents for this constitution
  store.deleteBySource("constitution", sourcePrefix);

  let indexed = 0;

  for (const principle of input.principles) {
    const sourceId = `${sourcePrefix}:${principle.id}`;
    const content = [
      `# Constitution Principle: ${principle.title}`,
      "",
      principle.description,
      "",
      `Category: ${principle.category}`,
      `Weight: ${principle.weight}`,
      `Enforceable: ${principle.enforceable}`,
    ].join("\n");

    store.insert({
      sourceType: "constitution",
      sourceId,
      title: `Constitution: ${principle.title}`,
      content,
      metadata: {
        nodeId: input.nodeId,
        principleId: principle.id,
        category: principle.category,
        weight: principle.weight,
        enforceable: principle.enforceable,
        constitutionVersion: input.constitutionVersion,
        indexedAt: new Date().toISOString(),
      },
    });

    indexed++;
  }

  logger.info("Constitution indexed", {
    nodeId: input.nodeId,
    version: input.constitutionVersion,
    principlesIndexed: indexed,
  });

  return { documentsIndexed: indexed };
}
