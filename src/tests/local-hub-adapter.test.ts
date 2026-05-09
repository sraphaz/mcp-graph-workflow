/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 3.2 — Adapter local-hub em src/core/llm/adapters/local-hub.ts
 *
 * AC1: GIVEN adapter configurado WHEN generate() chamado THEN fetch é feito ao daemon URL
 * AC2: GIVEN rede offline WHEN generate() THEN lança erro com kind: "BackendUnreachable"
 * AC3: GIVEN chamada bem-sucedida WHEN estimateCostUsd() THEN retorna 0 (local = free)
 *      GIVEN chamada bem-sucedida WHEN usage THEN contém tokens reais (inputTokens > 0)
 */

import { describe, it, expect, vi } from "vitest";
import { LocalHubAdapter } from "../core/llm/adapters/local-hub.js";

const BASE_REQ = {
  model: "glm-4-flash",
  messages: [{ role: "user" as const, content: "hello" }],
};

const SUCCESS_BODY = JSON.stringify({
  choices: [{ message: { content: "world" } }],
  usage: { prompt_tokens: 10, completion_tokens: 5 },
});

// ---------------------------------------------------------------------------
// AC1: fetch is invoked against daemon URL
// ---------------------------------------------------------------------------

describe("LocalHubAdapter — AC1: fetch called on generate()", () => {
  it("calls fetch with the configured daemon baseUrl", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve(JSON.parse(SUCCESS_BODY)),
    } as unknown as Response);

    const adapter = new LocalHubAdapter({
      baseUrl: "http://localhost:8080/v1/chat/completions",
      fetchImpl,
    });

    await adapter.generate(BASE_REQ);

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url] = fetchImpl.mock.calls[0] as [string, ...unknown[]];
    expect(url).toBe("http://localhost:8080/v1/chat/completions");
  });
});

// ---------------------------------------------------------------------------
// AC2: network error → kind: "BackendUnreachable"
// ---------------------------------------------------------------------------

describe("LocalHubAdapter — AC2: BackendUnreachable on offline", () => {
  it("throws an error with kind BackendUnreachable when fetch rejects", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

    const adapter = new LocalHubAdapter({
      baseUrl: "http://localhost:8080/v1/chat/completions",
      fetchImpl,
      retry: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 },
    });

    let caught: unknown;
    try {
      await adapter.generate(BASE_REQ);
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeDefined();
    expect((caught as { kind?: string }).kind).toBe("BackendUnreachable");
  });

  it("BackendUnreachable includes endpoint info", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("ECONNREFUSED"));

    const adapter = new LocalHubAdapter({
      baseUrl: "http://localhost:9999/v1/chat/completions",
      fetchImpl,
      retry: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 },
    });

    let caught: unknown;
    try {
      await adapter.generate(BASE_REQ);
    } catch (e) {
      caught = e;
    }

    const err = caught as { kind?: string; endpoint?: string };
    expect(err.kind).toBe("BackendUnreachable");
    expect(err.endpoint).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC3: cost === 0 and real token counts
// ---------------------------------------------------------------------------

describe("LocalHubAdapter — AC3: cost=0 and real usage tokens", () => {
  it("estimateCostUsd returns 0 for local inference", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "hi" } }],
          usage: { prompt_tokens: 8, completion_tokens: 3 },
        }),
    } as unknown as Response);

    const adapter = new LocalHubAdapter({
      baseUrl: "http://localhost:8080/v1/chat/completions",
      fetchImpl,
    });

    const res = await adapter.generate(BASE_REQ);
    expect(adapter.estimateCostUsd(res.usage)).toBe(0);
  });

  it("usage contains real token counts from daemon response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "response text" } }],
          usage: { prompt_tokens: 20, completion_tokens: 12 },
        }),
    } as unknown as Response);

    const adapter = new LocalHubAdapter({
      baseUrl: "http://localhost:8080/v1/chat/completions",
      fetchImpl,
    });

    const res = await adapter.generate(BASE_REQ);
    expect(res.usage.inputTokens).toBe(20);
    expect(res.usage.outputTokens).toBe(12);
  });

  it("adapter name is 'local-hub'", () => {
    const adapter = new LocalHubAdapter({
      baseUrl: "http://localhost:8080/v1/chat/completions",
    });
    expect(adapter.name).toBe("local-hub");
  });
});
