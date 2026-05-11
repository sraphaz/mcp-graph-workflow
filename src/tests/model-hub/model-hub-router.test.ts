/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.2 — HTTP server OpenAI-compat router
 *
 * AC1: POST /v1/chat/completions → response OpenAI-shape
 * AC2: stream:true → SSE data: {...}\n\n + data: [DONE]
 * AC3: model inexistente → 404 {error:{code:"model_not_found",...}}
 * AC4: GET /v1/models → lista modelos por backend
 */

import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import type { LocalBackendAdapter, Chunk, ModelInfo, HealthStatus, CompleteRequest, EmbeddingsRequest } from "../../core/model-hub/adapters/base.js";
import { createModelHubRouter } from "../../core/model-hub/router.js";

// ---------------------------------------------------------------------------
// Stub adapter
// ---------------------------------------------------------------------------

function makeStubAdapter(chunks: Chunk[] = [{ text: "hello", finishReason: "stop" }]): LocalBackendAdapter {
  return {
    complete(_req: CompleteRequest): AsyncIterable<Chunk> {
      return (async function* () {
        for (const c of chunks) yield c;
      })();
    },
    async embeddings(_req: EmbeddingsRequest): Promise<number[][]> {
      return [[0.1, 0.2, 0.3]];
    },
    async listModels(): Promise<ModelInfo[]> {
      return [{ id: "mistral-7b", object: "model", created: 1700000000, owned_by: "local" }];
    },
    async health(): Promise<HealthStatus> {
      return { status: "ok" };
    },
  };
}

function makeApp(adapters: Record<string, LocalBackendAdapter>, models: Record<string, string> = { "mistral-7b": "vllm" }) {
  const app = express();
  app.use(express.json());
  app.use("/", createModelHubRouter({ adapters, models }));
  return app;
}

// ---------------------------------------------------------------------------
// AC1: POST /v1/chat/completions → OpenAI response shape
// ---------------------------------------------------------------------------

describe("POST /v1/chat/completions — AC1: OpenAI response shape", () => {
  it("should return 200 with OpenAI-compatible body", async () => {
    const app = makeApp({ vllm: makeStubAdapter() });
    const res = await request(app)
      .post("/v1/chat/completions")
      .send({ model: "mistral-7b", messages: [{ role: "user", content: "hi" }] });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id");
    expect(res.body.object).toBe("chat.completion");
    expect(res.body.choices).toBeInstanceOf(Array);
    expect(res.body.choices[0].message.content).toBe("hello");
    expect(res.body.choices[0].finish_reason).toBe("stop");
  });

  it("should include model field in response", async () => {
    const app = makeApp({ vllm: makeStubAdapter() });
    const res = await request(app)
      .post("/v1/chat/completions")
      .send({ model: "mistral-7b", messages: [{ role: "user", content: "hi" }] });
    expect(res.body.model).toBe("mistral-7b");
  });
});

// ---------------------------------------------------------------------------
// AC2: stream:true → SSE
// ---------------------------------------------------------------------------

describe("POST /v1/chat/completions — AC2: SSE streaming", () => {
  it("should return text/event-stream content-type when stream:true", async () => {
    const app = makeApp({ vllm: makeStubAdapter() });
    const res = await request(app)
      .post("/v1/chat/completions")
      .send({ model: "mistral-7b", messages: [{ role: "user", content: "hi" }], stream: true });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/event-stream/);
  });

  it("should include data: [DONE] at end of stream", async () => {
    const app = makeApp({ vllm: makeStubAdapter() });
    const res = await request(app)
      .post("/v1/chat/completions")
      .send({ model: "mistral-7b", messages: [{ role: "user", content: "hi" }], stream: true });
    expect(res.text).toContain("data: [DONE]");
  });

  it("should include data: JSON lines before [DONE]", async () => {
    const app = makeApp({ vllm: makeStubAdapter() });
    const res = await request(app)
      .post("/v1/chat/completions")
      .send({ model: "mistral-7b", messages: [{ role: "user", content: "hi" }], stream: true });
    const lines = res.text.split("\n").filter((l) => l.startsWith("data: ") && l !== "data: [DONE]");
    expect(lines.length).toBeGreaterThan(0);
    const parsed = JSON.parse(lines[0].replace("data: ", "")) as { choices: unknown[] };
    expect(parsed.choices).toBeInstanceOf(Array);
  });
});

// ---------------------------------------------------------------------------
// AC3: unknown model → 404
// ---------------------------------------------------------------------------

describe("POST /v1/chat/completions — AC3: unknown model", () => {
  it("should return 404 for unknown model", async () => {
    const app = makeApp({ vllm: makeStubAdapter() });
    const res = await request(app)
      .post("/v1/chat/completions")
      .send({ model: "nonexistent-model", messages: [] });
    expect(res.status).toBe(404);
  });

  it("should include error.code model_not_found", async () => {
    const app = makeApp({ vllm: makeStubAdapter() });
    const res = await request(app)
      .post("/v1/chat/completions")
      .send({ model: "nonexistent-model", messages: [] });
    expect(res.body.error.code).toBe("model_not_found");
    expect(res.body.error).toHaveProperty("message");
  });
});

// ---------------------------------------------------------------------------
// AC4: GET /v1/models → list by backend
// ---------------------------------------------------------------------------

describe("GET /v1/models — AC4: list models", () => {
  it("should return 200 with OpenAI models list shape", async () => {
    const app = makeApp({ vllm: makeStubAdapter() });
    const res = await request(app).get("/v1/models");
    expect(res.status).toBe(200);
    expect(res.body.object).toBe("list");
    expect(res.body.data).toBeInstanceOf(Array);
  });

  it("should include models from registered adapters", async () => {
    const app = makeApp({ vllm: makeStubAdapter() });
    const res = await request(app).get("/v1/models");
    const ids = (res.body.data as ModelInfo[]).map((m) => m.id);
    expect(ids).toContain("mistral-7b");
  });

  it("should return healthz 200", async () => {
    const app = makeApp({ vllm: makeStubAdapter() });
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
