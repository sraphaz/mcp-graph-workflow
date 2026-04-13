import { describe, it, expect, beforeEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { EmbeddingStore } from "../core/rag/embedding-store.js";
import type { EmbeddingEntry } from "../core/rag/embedding-store.js";

describe("Embedding store — dual mode (tfidf + onnx)", () => {
  let store: SqliteStore;
  let embeddingStore: EmbeddingStore;

  const makeEntry = (id: string, text: string, dims: number = 384): EmbeddingEntry => ({
    id,
    source: "test",
    sourceId: `src-${id}`,
    text,
    embedding: Array.from({ length: dims }, (_, i) => i / dims),
  });

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    embeddingStore = new EmbeddingStore(store);
  });

  it("default embedding_type is tfidf", () => {
    embeddingStore.upsert(makeEntry("e1", "hello world"));
    const db = store.getDb();
    const row = db.prepare("SELECT embedding_type FROM embeddings WHERE id = ?").get("e1") as { embedding_type: string };
    expect(row.embedding_type).toBe("tfidf");
  });

  it("stores onnx type when specified", () => {
    embeddingStore.upsert(makeEntry("e2", "neural embedding"), "onnx");
    const db = store.getDb();
    const row = db.prepare("SELECT embedding_type FROM embeddings WHERE id = ?").get("e2") as { embedding_type: string };
    expect(row.embedding_type).toBe("onnx");
  });

  it("findSimilar with type=onnx returns only onnx", () => {
    embeddingStore.upsert(makeEntry("e1", "tfidf entry"), "tfidf");
    embeddingStore.upsert(makeEntry("e2", "onnx entry"), "onnx");

    const queryVec = Array.from({ length: 384 }, (_, i) => i / 384);
    const results = embeddingStore.findSimilar(queryVec, 10, "onnx");
    expect(results.every((r) => r.id === "e2")).toBe(true);
  });

  it("findSimilar with type=tfidf returns only tfidf", () => {
    embeddingStore.upsert(makeEntry("e1", "tfidf entry"), "tfidf");
    embeddingStore.upsert(makeEntry("e2", "onnx entry"), "onnx");

    const queryVec = Array.from({ length: 384 }, (_, i) => i / 384);
    const results = embeddingStore.findSimilar(queryVec, 10, "tfidf");
    expect(results.every((r) => r.id === "e1")).toBe(true);
  });

  it("findSimilar without type returns all", () => {
    embeddingStore.upsert(makeEntry("e1", "tfidf entry"), "tfidf");
    embeddingStore.upsert(makeEntry("e2", "onnx entry"), "onnx");

    const queryVec = Array.from({ length: 384 }, (_, i) => i / 384);
    const results = embeddingStore.findSimilar(queryVec, 10);
    expect(results).toHaveLength(2);
  });

  it("count with type filter", () => {
    embeddingStore.upsert(makeEntry("e1", "a"), "tfidf");
    embeddingStore.upsert(makeEntry("e2", "b"), "onnx");
    embeddingStore.upsert(makeEntry("e3", "c"), "onnx");

    expect(embeddingStore.count("tfidf")).toBe(1);
    expect(embeddingStore.count("onnx")).toBe(2);
    expect(embeddingStore.count()).toBe(3);
  });

  it("backward compat: preserves TF-IDF entries", () => {
    // Insert without explicit type (defaults to tfidf)
    embeddingStore.upsert(makeEntry("legacy1", "old entry"));
    embeddingStore.upsert(makeEntry("legacy2", "another old entry"));

    expect(embeddingStore.count("tfidf")).toBe(2);
    expect(embeddingStore.count("onnx")).toBe(0);
  });

  it("float32 precision for ONNX vectors", () => {
    const entry = makeEntry("fp32", "precision test");
    entry.embedding = Array.from({ length: 384 }, () => Math.random());
    embeddingStore.upsert(entry, "onnx");

    const queryVec = entry.embedding;
    const results = embeddingStore.findSimilar(queryVec, 1, "onnx");
    expect(results).toHaveLength(1);
    // Self-similarity should be very high
    expect(results[0].similarity).toBeGreaterThan(0.99);
  });
});
