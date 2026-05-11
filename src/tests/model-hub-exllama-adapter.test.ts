/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-gpu-backends — Task 2.1: ExllamaAdapter (TabbyAPI HTTP client)
 *
 * AC1: GIVEN TabbyAPI running WHEN health THEN ok
 * AC2: GIVEN listModels WHEN executed THEN returns only loaded models (/v1/models)
 * AC3: GIVEN no endpoint configured WHEN startup THEN adapter disabled silently
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ExllamaAdapter } from "../core/model-hub/adapters/exllama.js";

// ── AC3: no endpoint configured → not_configured ─────────────────────────

describe("ExllamaAdapter — no endpoint", () => {
  it("AC3: health returns not_configured when endpoint is empty", async () => {
    const adapter = new ExllamaAdapter({});
    const result = await adapter.health();
    expect(result.status).toBe("not_configured");
  });

  it("AC3: listModels returns empty array when not configured", async () => {
    const adapter = new ExllamaAdapter({});
    const models = await adapter.listModels();
    expect(models).toEqual([]);
  });

  it("AC3: no exception thrown when endpoint is absent", async () => {
    const adapter = new ExllamaAdapter();
    await expect(adapter.health()).resolves.not.toThrow();
  });
});

// ── AC1: health → ok (with mocked fetch) ─────────────────────────────────

describe("ExllamaAdapter — health check with mocked fetch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("AC1: health returns ok when /v1/models responds 200", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );
    const adapter = new ExllamaAdapter({ endpoint: "http://localhost:5000" });
    const result = await adapter.health();
    expect(result.status).toBe("ok");
  });

  it("AC1: health returns unavailable when server responds non-200", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("Internal Server Error", { status: 500 }),
    );
    const adapter = new ExllamaAdapter({ endpoint: "http://localhost:5000" });
    const result = await adapter.health();
    expect(result.status).toBe("unavailable");
  });

  it("AC1: health returns unavailable when fetch throws (server down)", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const adapter = new ExllamaAdapter({ endpoint: "http://localhost:5000" });
    const result = await adapter.health();
    expect(result.status).toBe("unavailable");
    expect(result.hint).toBeDefined();
  });
});

// ── AC2: listModels uses /v1/models (loaded only) ─────────────────────────

describe("ExllamaAdapter — listModels with mocked fetch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("AC2: listModels returns loaded models from /v1/models", async () => {
    const payload = {
      data: [
        { id: "Mistral-7B", object: "model", created: 1700000000, owned_by: "tabbyapi" },
      ],
    };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(payload), { status: 200 }),
    );
    const adapter = new ExllamaAdapter({ endpoint: "http://localhost:5000" });
    const models = await adapter.listModels();
    expect(models).toHaveLength(1);
    expect(models[0]!.id).toBe("Mistral-7B");
  });

  it("AC2: listModels calls /v1/models (not /v1/internal/model/list)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );
    const adapter = new ExllamaAdapter({ endpoint: "http://localhost:5000" });
    await adapter.listModels();
    const calledUrl = vi.mocked(fetch).mock.calls[0]?.[0];
    expect(String(calledUrl)).toContain("/v1/models");
    expect(String(calledUrl)).not.toContain("internal");
  });

  it("AC2: listModels returns empty array on fetch failure", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("timeout"));
    const adapter = new ExllamaAdapter({ endpoint: "http://localhost:5000" });
    const models = await adapter.listModels();
    expect(models).toEqual([]);
  });
});
