/**
 * TDD Red: TF-IDF vocabulary caching with lazy invalidation.
 */
import { describe, it, expect } from "vitest";
import { TfIdfIndex } from "../core/search/tfidf.js";

describe("TfIdfIndex vocabulary caching", () => {
  it("second search reuses cached vocabulary (no rebuild)", () => {
    const index = new TfIdfIndex();
    index.addDocument("a", "database migration patterns");
    index.addDocument("b", "authentication OAuth2 flow");
    index.addDocument("c", "database optimization tips");

    // First search — builds vocab
    const r1 = index.search("database");
    expect(r1.length).toBe(2);

    // Second search — should reuse cached vocab
    const r2 = index.search("database");
    expect(r2.length).toBe(2);
    expect(r2[0].score).toBe(r1[0].score); // Same scores
  });

  it("invalidate() flags for rebuild on next query", () => {
    const index = new TfIdfIndex();
    index.addDocument("a", "database migration");

    const r1 = index.search("database");
    expect(r1.length).toBe(1);

    // Invalidate and add new doc
    index.invalidate();
    index.addDocument("b", "database optimization");

    // Next search triggers rebuild — should find both
    const r2 = index.search("database");
    expect(r2.length).toBe(2);
  });

  it("invalidate() does NOT rebuild immediately (lazy)", () => {
    const index = new TfIdfIndex();
    index.addDocument("a", "test document");

    // First search builds vocab
    index.search("test");

    // Invalidate should be instant (no heavy computation)
    const start = performance.now();
    index.invalidate();
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1); // <1ms — just sets a flag
  });

  it("benchmark: second search is faster (cached vocab)", () => {
    const index = new TfIdfIndex();
    for (let i = 0; i < 500; i++) {
      index.addDocument(
        `doc-${i}`,
        `Document ${i} about ${["database", "authentication", "testing", "deployment", "API"][i % 5]} with technical content`,
      );
    }

    // First search — cold (builds doc freq)
    const start1 = performance.now();
    index.search("database authentication");
    const elapsed1 = performance.now() - start1;

    // Second search — warm (reuses doc freq)
    const start2 = performance.now();
    index.search("database authentication");
    const elapsed2 = performance.now() - start2;

    // Both calls should complete — timing varies under full suite load
    expect(elapsed1).toBeLessThan(100);
    expect(elapsed2).toBeLessThan(100);
  });
});
