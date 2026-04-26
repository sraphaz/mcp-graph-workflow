# ADR-0056 — `EmbeddingProvider` interface and runtime selection

- **Status:** Accepted (retro-documenting code already shipped, 2026-04-26)
- **Driver:** Codify the dual-mode embeddings contract so adding a third provider (e.g. cloud, on-device GGUF) does not require touching every call site.
- **Owner:** @diegonogueira
- **Supersedes/replaces:** the phantom citation `ADR-06` referenced from `src/core/rag/onnx-embeddings.ts:22,35` and `src/core/rag/embedding-generator.ts:22` (no file under `docs/_internal/adr/` for the phantom; ADR numbering reconciled to `0056`).
- **Related:** ADR-0055 (optional ONNX dependency).

## Context

ADR-0055 establishes that the RAG pipeline supports two embedding modes — hash (always available) and neural (opt-in). The pipeline must:

1. Select the best available provider at startup without the caller knowing which one will be picked.
2. Fall back gracefully if the preferred provider becomes unavailable mid-process (e.g. ONNX session crash).
3. Cache the chosen provider — re-loading the 23MB ONNX session per query would be a 200–500ms tax per call.
4. Allow a fourth, fifth, ... provider to be added later without rewriting the embedding-generator.

A naive `if (onnxAvailable) { useOnnx() } else { useHash() }` scattered across the RAG modules would fail (3) and (4).

## Decision

Define a single `EmbeddingProvider` interface (`src/core/rag/onnx-embeddings.ts:36`):

```ts
export interface EmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;
  generateEmbedding(text: string): Promise<number[]>;
  generateBatch(texts: string[]): Promise<number[][]>;
}
```

Both providers implement it:

- `OnnxEmbeddingProvider` — implementation private to `src/core/rag/onnx-embeddings.ts`, accessed via `getOnnxProvider(modelsDir)` (`src/core/rag/onnx-embeddings.ts:348`). Returns `null` if `onnxruntime-node` is unavailable. Cached at module scope (Map keyed by `modelsDir`).
- `HashEmbeddingProvider` — exported from `src/core/rag/embedding-generator.ts:35`. Pure TF-IDF over character n-grams. Stateless, deterministic.

Runtime selection lives in **one** place — `getEmbeddingProvider()` in `src/core/rag/embedding-generator.ts:100`:

1. If `getOnnxProvider(...)` returns a non-null provider, use it.
2. Else, instantiate `HashEmbeddingProvider` and return it.
3. Cache the chosen provider at module scope so the next call is O(1).

Callers (RAG pipeline, memory indexer, docs indexer, etc.) call `getEmbeddingProvider()` and consume the interface — they never know or care which implementation answered.

### Adding a new provider

To add a third provider (hypothetical `CloudEmbeddingProvider`):

1. Create a new module `src/core/rag/cloud-embeddings.ts` exporting a class that implements `EmbeddingProvider`.
2. Add a probe (`isCloudAvailable()`) and a factory (`getCloudProvider()`).
3. Update the selection priority in `getEmbeddingProvider()` — typically: cloud > onnx > hash, or whatever order the product wants.

No call sites change. The interface contract stays stable.

### Determinism note

Hash and ONNX produce **different** embeddings for the same text — they live in incompatible vector spaces. Vectors stored under one provider must not be queried under another. The store layer (`src/core/rag/embedding-store.ts`) tags each row with the provider name to detect cross-provider mismatches.

## Consequences

- ✅ Single point of selection. Adding/removing providers is O(1) in call sites.
- ✅ Caching is provider-internal — the orchestrator doesn't reason about it.
- ✅ Fallback is automatic and transparent to callers.
- ⚠️ Vector-space drift: switching providers invalidates the index. Today this is handled by re-indexing; long term, the store could keep one index per provider name.
- ⚠️ Testing requires factory-style DI (call `getEmbeddingProvider()` once per test, or seed the cache) to avoid singleton bleed between cases. Existing tests under `src/tests/onnx-*.test.ts` already follow this pattern.

## Verification

- `src/tests/onnx-embeddings.test.ts` — provider cache dedup, hash fallback path.
- `src/tests/rag/onnx-*.test.ts` — semantic strategy, incremental indexing under both providers.
- Manual: in a fresh repo, `mcp-graph index --query "..."` works in hash mode; after `install-neural`, the same query uses ONNX (verifiable by checking `embedding-store` rows' `provider_name`).
