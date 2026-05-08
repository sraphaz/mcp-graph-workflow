/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.1 — HTTP client mínimo: vLLM adapter
 *
 * AC1: health() w/ running endpoint → { status: 'ok', version }
 * AC2: endpoint not configured → { status: 'not_configured' }
 * AC3: ECONNREFUSED → { status: 'unavailable', hint }
 * AC4: streaming cancel propagates AbortController to fetch
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { VllmAdapter } from "../../core/model-hub/adapters/vllm.js";

// ---------------------------------------------------------------------------
// fetch mock helpers
// ---------------------------------------------------------------------------

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const spy = vi.fn().mockImplementation(handler);
  vi.stubGlobal("fetch", spy);
  return spy;
}

function jsonResponse(body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function networkError(): never {
  throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } });
}

// ---------------------------------------------------------------------------
// AC2: not configured
// ---------------------------------------------------------------------------

describe("VllmAdapter — AC2: not configured", () => {
  it("should mark not_configured when no endpoint provided", async () => {
    const adapter = new VllmAdapter({ endpoint: "" });
    const result = await adapter.health();
    expect(result.status).toBe("not_configured");
  });

  it("should mark not_configured when endpoint is undefined", async () => {
    const adapter = new VllmAdapter({});
    const result = await adapter.health();
    expect(result.status).toBe("not_configured");
  });
});

// ---------------------------------------------------------------------------
// AC1: running endpoint → ok + version
// ---------------------------------------------------------------------------

describe("VllmAdapter — AC1: health ok", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("should return ok when endpoint responds 200", async () => {
    mockFetch(() => jsonResponse({ object: "list" }));
    const adapter = new VllmAdapter({ endpoint: "http://localhost:8000" });
    const result = await adapter.health();
    expect(result.status).toBe("ok");
  });

  it("should parse X-vLLM-Version header into version field", async () => {
    mockFetch(() => jsonResponse({ object: "list" }, { "x-vllm-version": "0.4.2" }));
    const adapter = new VllmAdapter({ endpoint: "http://localhost:8000" });
    const result = await adapter.health();
    expect(result.status).toBe("ok");
    expect(result.version).toBe("0.4.2");
  });

  it("should return ok with undefined version when header absent", async () => {
    mockFetch(() => jsonResponse({ object: "list" }));
    const adapter = new VllmAdapter({ endpoint: "http://localhost:8000" });
    const result = await adapter.health();
    expect(result.status).toBe("ok");
    expect(result.version).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AC3: ECONNREFUSED → unavailable + hint
// ---------------------------------------------------------------------------

describe("VllmAdapter — AC3: ECONNREFUSED", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("should return unavailable on network error", async () => {
    mockFetch(() => networkError());
    const adapter = new VllmAdapter({ endpoint: "http://localhost:8000" });
    const result = await adapter.health();
    expect(result.status).toBe("unavailable");
  });

  it("should include a hint to configure the endpoint on network error", async () => {
    mockFetch(() => networkError());
    const adapter = new VllmAdapter({ endpoint: "http://localhost:8000" });
    const result = await adapter.health();
    expect(result.hint).toMatch(/endpoint|configure/i);
  });

  it("should return unavailable on non-200 response", async () => {
    mockFetch(() => new Response("Service Unavailable", { status: 503 }));
    const adapter = new VllmAdapter({ endpoint: "http://localhost:8000" });
    const result = await adapter.health();
    expect(result.status).toBe("unavailable");
  });
});

// ---------------------------------------------------------------------------
// AC4: streaming cancel → AbortController propagated
// ---------------------------------------------------------------------------

describe("VllmAdapter — AC4: streaming cancel", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("should pass AbortSignal to fetch when streaming", async () => {
    const fetchSpy = mockFetch((_url, init) => {
      expect(init?.signal).toBeDefined();
      // Simulate immediate abort
      if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return new Response(new ReadableStream(), { status: 200 });
    });

    const controller = new AbortController();
    const adapter = new VllmAdapter({ endpoint: "http://localhost:8000" });

    // Start stream then immediately abort
    const gen = adapter.stream(
      { model: "mistral", messages: [{ role: "user", content: "hi" }] },
      controller.signal,
    );
    controller.abort();
    // drain generator — expect it to complete (aborted or empty)
    await (async () => { for await (const _ of gen) { /* noop */ } })().catch(() => {});

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/v1/chat/completions"),
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});
