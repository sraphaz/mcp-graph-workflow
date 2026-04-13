/**
 * TDD tests for Hybrid RAG Scoring (BM25 + Semantic Embedding)
 * Feature: Add semantic search as 7th strategy in multi-strategy retrieval
 *
 * Literature basis: BEIR benchmarks show +15-21% recall with hybrid BM25+embedding
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteStore } from '../core/store/sqlite-store.js';
import { KnowledgeStore } from '../core/store/knowledge-store.js';
import { EmbeddingStore } from '../core/rag/embedding-store.js';
import { indexAllEmbeddings } from '../core/rag/rag-pipeline.js';
import { multiStrategySearch } from '../core/rag/multi-strategy-retrieval.js';
import { makeNode } from './helpers/factories.js';

describe('Hybrid RAG Scoring', () => {
  let store: SqliteStore;
  let embeddingStore: EmbeddingStore;

  beforeEach(async () => {
    store = SqliteStore.open(':memory:');
    store.initProject('Hybrid RAG Test');
    embeddingStore = new EmbeddingStore(store);

    // Seed nodes
    store.insertNode(makeNode({ id: 'n1', title: 'Implement JWT authentication', description: 'Add JWT token-based auth to the Express API with refresh tokens', status: 'done', priority: 1 }));
    store.insertNode(makeNode({ id: 'n2', title: 'Setup PostgreSQL database', description: 'Configure PostgreSQL connection pooling and migrations', status: 'done', priority: 2 }));
    store.insertNode(makeNode({ id: 'n3', title: 'Add OAuth2 login flow', description: 'Implement Google OAuth2 authentication with passport.js', status: 'backlog', priority: 3 }));
    store.insertNode(makeNode({ id: 'n4', title: 'Create Kanban board UI', description: 'React component for drag-and-drop Kanban board', status: 'backlog', priority: 3 }));

    // Seed knowledge docs for FTS
    const ks = new KnowledgeStore(store.getDb());
    ks.insert({ title: 'JWT Auth Implementation', content: 'JWT authentication uses RSA256 signing with token expiry and refresh rotation', sourceType: 'memory', sourceId: 'n1' });
    ks.insert({ title: 'Database Setup Guide', content: 'PostgreSQL configuration with connection pooling via pg-pool max 20 connections', sourceType: 'memory', sourceId: 'n2' });
    ks.insert({ title: 'OAuth2 Design', content: 'Google OAuth2 flow redirect to consent screen exchange code for tokens store in session', sourceType: 'memory', sourceId: 'n3' });
    ks.insert({ title: 'Kanban Board Design', content: 'React drag and drop Kanban board with swimlanes and WIP limits', sourceType: 'memory', sourceId: 'n4' });

    // Build embeddings
    await indexAllEmbeddings(store, embeddingStore);
  });

  afterEach(() => {
    store.close();
  });

  it('should return results when searching with semantic strategy', async () => {
    const results = await multiStrategySearch(store.getDb(), 'authentication login', {
      limit: 5,
      store,
      embeddingStore,
      strategies: ['fts', 'semantic'],
    });
    expect(results.length).toBeGreaterThan(0);
  });

  it('semantic strategy should boost auth-related docs for auth query', async () => {
    const results = await multiStrategySearch(store.getDb(), 'authentication JWT OAuth', {
      limit: 5,
      store,
      embeddingStore,
    });
    // Auth-related docs should appear in results
    const titles = results.map(r => r.title);
    const hasAuth = titles.some(t => t.includes('JWT') || t.includes('OAuth'));
    expect(hasAuth).toBe(true);
  });

  it('should include semantic in strategies list when matches found', async () => {
    const results = await multiStrategySearch(store.getDb(), 'authentication JWT', {
      limit: 5,
      store,
      embeddingStore,
      strategies: ['fts', 'semantic'],
    });
    const hasSemanticStrategy = results.some(r => r.strategies.includes('semantic'));
    expect(hasSemanticStrategy).toBe(true);
  });

  it('should work without embeddingStore (backward compat)', async () => {
    const results = await multiStrategySearch(store.getDb(), 'authentication', {
      limit: 5,
      store,
    });
    expect(results.length).toBeGreaterThan(0);
  });

  it('should not crash when embeddingStore has no embeddings', async () => {
    const freshStore = SqliteStore.open(':memory:');
    freshStore.initProject('Empty Test');
    const freshEmbedding = new EmbeddingStore(freshStore);

    const results = await multiStrategySearch(freshStore.getDb(), 'anything', {
      limit: 5,
      store: freshStore,
      embeddingStore: freshEmbedding,
    });
    expect(Array.isArray(results)).toBe(true);
    freshStore.close();
  });
});
