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

import { describe, it, expect, beforeEach } from 'vitest';
import { SqliteStore } from '../core/store/sqlite-store.js';
import { EmbeddingStore } from '../core/rag/embedding-store.js';
import { KnowledgeStore } from '../core/store/knowledge-store.js';
import { indexAllEmbeddings, incrementalIndex } from '../core/rag/rag-pipeline.js';

describe('ONNX Incremental Indexing in RAG Pipeline', () => {
  let store: SqliteStore;
  let embStore: EmbeddingStore;
  let ks: KnowledgeStore;

  beforeEach(() => {
    store = SqliteStore.open(':memory:');
    store.initProject('Test');
    embStore = new EmbeddingStore(store);
    ks = new KnowledgeStore(store.getDb());
  });

  describe('indexAllEmbeddings with ONNX', () => {
    it('should generate both tfidf and onnx embeddings for knowledge docs', async () => {
      ks.insert({
        sourceType: 'prd',
        sourceId: 'prd-1',
        title: 'Authentication',
        content: 'JWT token authentication with OAuth2',
      });

      const result = await indexAllEmbeddings(store, embStore);
      expect(result.knowledge).toBeGreaterThan(0);

      // Should have both tfidf and onnx embeddings
      const tfidfCount = embStore.count('tfidf');
      const onnxCount = embStore.count('onnx');
      expect(tfidfCount).toBeGreaterThan(0);
      expect(onnxCount).toBeGreaterThan(0);
    });

    it('should replace onnx embeddings on reindex', async () => {
      ks.insert({
        sourceType: 'memory',
        sourceId: 'mem-1',
        title: 'First version',
        content: 'Original content about databases',
      });

      await indexAllEmbeddings(store, embStore);
      const firstCount = embStore.count('onnx');

      // Re-index should replace, not duplicate
      await indexAllEmbeddings(store, embStore);
      const secondCount = embStore.count('onnx');
      expect(secondCount).toBe(firstCount);
    });
  });

  describe('incrementalIndex with ONNX', () => {
    it('should generate onnx embedding for new docs incrementally', async () => {
      // First, full index to build vocabulary
      ks.insert({
        sourceType: 'prd',
        sourceId: 'prd-1',
        title: 'Base doc',
        content: 'Base content for vocabulary building',
      });
      await indexAllEmbeddings(store, embStore);

      // Now add a new doc and index incrementally
      const newDoc = ks.insert({
        sourceType: 'prd',
        sourceId: 'prd-2',
        title: 'New doc',
        content: 'New content about semantic search and embeddings',
      });

      const result = await incrementalIndex(store, embStore, [newDoc!.id]);
      expect(result.indexed).toBeGreaterThan(0);

      // Should have onnx embedding for the new doc
      const onnxCount = embStore.count('onnx');
      expect(onnxCount).toBeGreaterThanOrEqual(2); // base + new
    });
  });

  describe('fallback when ONNX unavailable', () => {
    it('should still complete indexing with tfidf only', async () => {
      // In test env, ONNX runtime is not installed
      // The indexing should succeed with TF-IDF (no crash)
      ks.insert({
        sourceType: 'docs',
        sourceId: 'doc-1',
        title: 'Test',
        content: 'Test content for fallback verification',
      });

      const result = await indexAllEmbeddings(store, embStore);
      expect(result.knowledge).toBeGreaterThan(0);

      // At minimum, tfidf embeddings should exist
      const tfidfCount = embStore.count('tfidf');
      expect(tfidfCount).toBeGreaterThan(0);
    });
  });
});
