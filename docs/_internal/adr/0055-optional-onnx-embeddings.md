# ADR-0055 — `onnxruntime-node` is an optional, user-installed dependency

- **Status:** Accepted (retro-documenting code already shipped, 2026-04-26)
- **Driver:** v12 cross-platform install hardening — confirm and codify the opt-in story so users on every platform get a friction-free `npm install mcp-graph` and neural embeddings remain available on demand.
- **Owner:** @diegonogueira
- **Supersedes/replaces:** the phantom citation `ADR-05` referenced from `src/core/rag/onnx-embeddings.ts:21` and `src/core/rag/embedding-generator.ts:21` (no file under `docs/_internal/adr/` for the phantom; ADR numbering reconciled to `0055`).
- **Related:** ADR-0056 (`EmbeddingProvider` interface).

## Context

The RAG pipeline can produce embeddings via two providers:

1. **Hash embeddings** — TF-IDF over character n-grams, deterministic, zero-deps, ~30% lower retrieval quality than neural for semantic queries.
2. **ONNX neural embeddings** — `all-MiniLM-L6-v2` (quantized, ~23MB) via `onnxruntime-node`. Higher quality, ~50–100MB resident memory per process, +1–3s cold-start tax on first load (Windows pays an extra Defender scan tax).

`onnxruntime-node` is a **native** package — its install fetches a per-OS, per-arch prebuilt `.node` binary. Three failure modes if shipped as a hard dependency:

- Prebuilt binary unavailable for the user's OS/arch (rarer arches: ARMv7, Alpine musl, etc.) → `npm install mcp-graph` fails entirely.
- Corporate proxies / offline installs that block the prebuilt CDN.
- Users who never need semantic RAG paying download cost + disk for a feature they don't use.

The team's cross-platform promise is **`npm install -g mcp-graph` works on macOS, Linux, and Windows with zero extra steps** for the default feature set. Neural embeddings are not in the default feature set.

## Decision

`onnxruntime-node` is **never** declared in `package.json` — not in `dependencies`, `devDependencies`, `optionalDependencies`, or `peerDependencies`. The user opts in explicitly via:

```bash
mcp-graph install-neural
```

This command (`src/cli/commands/install-neural.ts`, orchestrated by `src/core/install-neural/install-neural.ts`):

1. Runs `npm install onnxruntime-node` **without `--save`** — the runtime lands in `node_modules/` but does not propagate to the user's downstream `package.json`.
2. Downloads the `all-MiniLM-L6-v2` ONNX model + tokenizer from Hugging Face into `workflow-graph/models/all-MiniLM-L6-v2-quantized/`.
3. Verifies via `isOnnxAvailable()` (`src/core/rag/onnx-embeddings.ts:95`) that the runtime loads.

At runtime, `onnx-embeddings.ts` loads the runtime via `await import('onnxruntime-node')` inside a try/catch (`src/core/rag/onnx-embeddings.ts:99`). If the dynamic import throws (`ERR_MODULE_NOT_FOUND` or native bind failure), `getOnnxProvider()` returns `null` and the embedding-generator falls back to `HashEmbeddingProvider` (`src/core/rag/embedding-generator.ts:35`). The user sees a structured `logger.warn('onnx:unavailable', ...)` with a hint pointing at `mcp-graph install-neural`.

### TypeScript ergonomics

Type stubs in `src/types/onnxruntime-node.d.ts` keep the strict-mode build green even when `onnxruntime-node` is not installed. The dynamic-import call site uses the stubbed types at compile time and the real runtime at execution time.

### Guardrail

`src/tests/package-onnx-zero-deps.test.ts` asserts the invariant — moving `onnxruntime-node` into any deps block fails the test. Treat a failure of this test as a regression of the cross-platform contract, not a green-light to "just add it to optionalDependencies".

## Consequences

- ✅ `npm install mcp-graph` succeeds on every platform that has Node ≥ 18, regardless of `onnxruntime-node` prebuilt availability.
- ✅ Hash-only users pay zero install/runtime cost for neural.
- ✅ `mcp-graph install-neural` is a single, documented entry point — no scavenger hunt across READMEs.
- ⚠️ Users who want neural pay an explicit second install step. Acceptable: it's a one-time action, well-signposted by `doctor` and runtime warnings.
- ⚠️ The npm registry doesn't auto-discover `onnxruntime-node` from package metadata. We accept this — the gain in install reliability outweighs registry-level discovery.

## Verification

- `npm install mcp-graph` on a fresh Windows / Linux / macOS machine completes without fetching `onnxruntime-node`.
- `mcp-graph doctor` reports `onnx: unavailable, fallback: hash` without crashing.
- `mcp-graph install-neural` installs runtime + model, then `doctor` reports `onnx: ready`.
- `src/tests/package-onnx-zero-deps.test.ts` is green.
