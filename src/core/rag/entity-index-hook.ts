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
 * Entity Index Hook — safe wrapper for entity indexing in MCP tools.
 *
 * Call after KnowledgeStore.insert() or insertChunks() to extract
 * entities into the Knowledge Graph. Never throws — logs and returns
 * silently on failure to avoid disrupting the main operation.
 */

import type Database from "better-sqlite3";
import { indexDocument } from "./entity-indexer.js";
import { EntityStore } from "./entity-store.js";
import { logger } from "../utils/logger.js";

/**
 * Index entities from a single knowledge document into the KG.
 * Safe: never throws. Logs warning on failure.
 */
export function indexEntitiesForDoc(db: Database.Database, docId: string): void {
  try {
    const store = new EntityStore(db);
    if (!store.hasKgTables()) return;
    indexDocument(db, docId);
  } catch (err) {
    logger.warn("entity-index-hook:doc-failed", { docId, error: String(err) });
  }
}

/**
 * Index entities from multiple knowledge documents into the KG.
 * Safe: never throws. Logs warning on individual failures.
 */
export function indexEntitiesForDocs(db: Database.Database, docIds: string[]): void {
  try {
    const store = new EntityStore(db);
    if (!store.hasKgTables()) return;

    for (const docId of docIds) {
      try {
        indexDocument(db, docId);
      } catch (err) {
        logger.warn("entity-index-hook:doc-failed", { docId, error: String(err) });
      }
    }
  } catch (err) {
    logger.warn("entity-index-hook:batch-failed", { count: docIds.length, error: String(err) });
  }
}

/**
 * Index entities from all knowledge documents matching a source type.
 * Useful after bulk indexing operations.
 * Safe: never throws.
 */
export function indexEntitiesForSource(db: Database.Database, sourceType: string): void {
  try {
    const store = new EntityStore(db);
    if (!store.hasKgTables()) return;

    const docs = db
      .prepare("SELECT id FROM knowledge_documents WHERE source_type = ?")
      .all(sourceType) as Array<{ id: string }>;

    for (const doc of docs) {
      try {
        indexDocument(db, doc.id);
      } catch (err) {
        logger.warn("entity-index-hook:doc-failed", { docId: doc.id, error: String(err) });
      }
    }

    logger.debug("entity-index-hook:source-complete", { sourceType, count: docs.length });
  } catch (err) {
    logger.warn("entity-index-hook:source-failed", { sourceType, error: String(err) });
  }
}
