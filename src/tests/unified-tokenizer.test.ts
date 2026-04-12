/**
 * TDD Red: Unified tokenizer — single tokenize() with configurable options.
 * Replaces 3 inconsistent tokenizers: tokenizer.ts, bm25-compressor.ts, rag-pipeline.ts
 */
import { describe, it, expect } from "vitest";
import { tokenize, type TokenizeOptions } from "../core/search/tokenizer.js";

describe("Unified tokenizer", () => {
  // ── Default behavior (backward compat with existing tokenizer) ──

  it("default: lowercases and strips accents", () => {
    const tokens = tokenize("Implementação Rápida");
    expect(tokens).toContain("implementacao");
    expect(tokens).toContain("rapida");
  });

  it("default: removes PT and EN stopwords", () => {
    const tokens = tokenize("the quick brown fox para o lobo");
    expect(tokens).not.toContain("the");
    expect(tokens).not.toContain("para");
    expect(tokens).not.toContain("o");
    expect(tokens).toContain("quick");
    expect(tokens).toContain("brown");
    expect(tokens).toContain("lobo");
  });

  it("default: removes short tokens (< 2 chars)", () => {
    const tokens = tokenize("a b cd ef");
    expect(tokens).not.toContain("a");
    expect(tokens).toContain("cd");
    expect(tokens).toContain("ef");
  });

  it("default: handles empty input", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("   ")).toEqual([]);
  });

  // ── Options: stopwords off ──

  it("stopwords=false: keeps all words", () => {
    const tokens = tokenize("the quick para o lobo", { stopwords: false });
    expect(tokens).toContain("the");
    expect(tokens).toContain("para");
    expect(tokens).toContain("quick");
    expect(tokens).toContain("lobo");
  });

  // ── Options: accentStrip off ──

  it("accentStrip=false: preserves accented chars", () => {
    const tokens = tokenize("Implementação", { accentStrip: false });
    // Should lowercase but not strip accents
    expect(tokens).toContain("implementação");
  });

  // ── Options: stopwords off + accentStrip off (BM25 compat) ──

  it("stopwords=false + accentStrip=false: BM25 tokenizer behavior", () => {
    const tokens = tokenize("Rápida the fox", { stopwords: false, accentStrip: false });
    expect(tokens).toContain("rápida");
    expect(tokens).toContain("the");
    expect(tokens).toContain("fox");
  });

  // ── Options: stemming ──

  it("stemming=true: stems EN words", () => {
    const tokens = tokenize("configuring configurations configured", { stemming: true });
    // All three should stem to the same root
    const unique = new Set(tokens);
    expect(unique.size).toBe(1); // all stem to "configur" or similar
  });

  it("stemming=true: stems PT words", () => {
    const tokens = tokenize("implementação implementar implementando", { stemming: true });
    const unique = new Set(tokens);
    expect(unique.size).toBe(1); // all stem to same root
  });

  // ── Options: language for stopwords ──

  it("language=en: only removes EN stopwords", () => {
    const tokens = tokenize("the para quick lobo", { language: "en" });
    expect(tokens).not.toContain("the"); // EN stopword removed
    expect(tokens).toContain("para"); // PT stopword kept
    expect(tokens).toContain("quick");
    expect(tokens).toContain("lobo");
  });

  it("language=pt: only removes PT stopwords", () => {
    const tokens = tokenize("the para quick lobo", { language: "pt" });
    expect(tokens).toContain("the"); // EN stopword kept
    expect(tokens).not.toContain("para"); // PT stopword removed
    expect(tokens).toContain("quick");
    expect(tokens).toContain("lobo");
  });

  // ── Performance SLO ──

  it("SLO: tokenize 1K documents < 5ms", () => {
    const docs = Array.from({ length: 1000 }, (_, i) =>
      `Document ${i} about OAuth2 authentication and database migration patterns`,
    );
    const start = performance.now();
    for (const doc of docs) {
      tokenize(doc);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(5);
  });

  // ── Type export ──

  it("TokenizeOptions type is exported", () => {
    const opts: TokenizeOptions = { stemming: false, stopwords: true, accentStrip: true };
    expect(opts).toBeDefined();
  });
});
