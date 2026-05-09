/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 2.1 — Interface LocalBackendAdapter
 *
 * AC1: exported interface covers chat/embed/list/health
 * AC2: complete() is AsyncIterable (supports native streaming)
 * AC3: typed errors: BackendUnreachable | ModelLoadFailed | InferenceTimeout
 */

import { describe, it, expect } from "vitest";
import type {
  LocalBackendAdapter,
  Chunk,
  ModelInfo,
  HealthStatus,
  CompleteRequest,
  EmbeddingsRequest,
  BackendUnreachable,
  ModelLoadFailed,
  InferenceTimeout,
} from "../../core/model-hub/adapters/base.js";

// ---------------------------------------------------------------------------
// AC1: interface shape — verified via a conforming stub at compile time
// ---------------------------------------------------------------------------

describe("LocalBackendAdapter — AC1: interface covers chat/embed/list/health", () => {
  it("should be satisfiable by a conforming implementation", () => {
    const stub: LocalBackendAdapter = {
      async *complete(_req: CompleteRequest): AsyncIterable<Chunk> {
        yield { text: "hello", finishReason: null };
      },
      async embeddings(_req: EmbeddingsRequest): Promise<number[][]> {
        return [[0.1, 0.2]];
      },
      async listModels(): Promise<ModelInfo[]> {
        return [{ id: "m1", object: "model", created: 0, owned_by: "local" }];
      },
      async health(): Promise<HealthStatus> {
        return { status: "ok" };
      },
    };
    expect(stub).toBeDefined();
  });

  it("should expose all four method names on a stub", () => {
    const methodNames = ["complete", "embeddings", "listModels", "health"];
    const stub: LocalBackendAdapter = {
      async *complete(_req: CompleteRequest): AsyncIterable<Chunk> { yield { text: "", finishReason: null }; },
      async embeddings(_req: EmbeddingsRequest): Promise<number[][]> { return []; },
      async listModels(): Promise<ModelInfo[]> { return []; },
      async health(): Promise<HealthStatus> { return { status: "ok" }; },
    };
    for (const name of methodNames) {
      expect(stub).toHaveProperty(name);
    }
  });
});

// ---------------------------------------------------------------------------
// AC2: complete() is AsyncIterable
// ---------------------------------------------------------------------------

describe("LocalBackendAdapter — AC2: complete() is AsyncIterable", () => {
  it("should allow async iteration over complete() output", async () => {
    const stub: LocalBackendAdapter = {
      async *complete(_req: CompleteRequest): AsyncIterable<Chunk> {
        yield { text: "token1", finishReason: null };
        yield { text: "token2", finishReason: "stop" };
      },
      async embeddings(_req: EmbeddingsRequest): Promise<number[][]> { return []; },
      async listModels(): Promise<ModelInfo[]> { return []; },
      async health(): Promise<HealthStatus> { return { status: "ok" }; },
    };

    const chunks: Chunk[] = [];
    for await (const chunk of stub.complete({ model: "m", messages: [] })) {
      chunks.push(chunk);
    }
    expect(chunks).toHaveLength(2);
    expect(chunks[0].text).toBe("token1");
    expect(chunks[1].finishReason).toBe("stop");
  });
});

// ---------------------------------------------------------------------------
// AC3: typed errors
// ---------------------------------------------------------------------------

describe("LocalBackendAdapter — AC3: typed errors", () => {
  it("BackendUnreachable should carry endpoint and cause", () => {
    const err: BackendUnreachable = {
      kind: "BackendUnreachable",
      endpoint: "http://localhost:8000",
      cause: "ECONNREFUSED",
    };
    expect(err.kind).toBe("BackendUnreachable");
    expect(err.endpoint).toBeDefined();
  });

  it("ModelLoadFailed should carry model and reason", () => {
    const err: ModelLoadFailed = {
      kind: "ModelLoadFailed",
      model: "mistral-7b",
      reason: "OOM",
    };
    expect(err.kind).toBe("ModelLoadFailed");
    expect(err.model).toBeDefined();
  });

  it("InferenceTimeout should carry model and timeoutMs", () => {
    const err: InferenceTimeout = {
      kind: "InferenceTimeout",
      model: "mistral-7b",
      timeoutMs: 30000,
    };
    expect(err.kind).toBe("InferenceTimeout");
    expect(err.timeoutMs).toBeGreaterThan(0);
  });

  it("adapter can throw a typed error via Error subclass", async () => {
    const stub: LocalBackendAdapter = {
      complete(_req: CompleteRequest): AsyncIterable<Chunk> {
        const backendErr = Object.assign(new Error("backend unreachable"), {
          kind: "BackendUnreachable" as const,
          endpoint: "http://localhost:8000",
          cause: "ECONNREFUSED",
        } satisfies BackendUnreachable);
        return {
          [Symbol.asyncIterator]() {
            return {
              async next(): Promise<IteratorResult<Chunk>> { throw backendErr; },
            };
          },
        };
      },
      async embeddings(_req: EmbeddingsRequest): Promise<number[][]> { return []; },
      async listModels(): Promise<ModelInfo[]> { return []; },
      async health(): Promise<HealthStatus> { return { status: "unavailable", hint: "down" }; },
    };

    await expect(async () => {
      for await (const _ of stub.complete({ model: "m", messages: [] })) { /* drain */ }
    }).rejects.toThrow("backend unreachable");
  });
});
