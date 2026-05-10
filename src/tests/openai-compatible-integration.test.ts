/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * §EPIC-DETERMINISTIC-FIRST — Integration suite covering schema → loader →
 * adapter → health → registry pipeline end-to-end.
 *
 * PRD: docs/prd/glm-local-provider-config.md (Task 3.1)
 */

import { describe, it, expect, vi } from "vitest";
import { OpenAICompatibleProviderConfigSchema } from "../core/llm/adapters/openai-compatible-config.schema.js";
import { loadOpenAICompatibleProviders } from "../core/llm/adapters/openai-compatible-loader.js";
import { probeHealth } from "../core/llm/adapters/openai-compatible-health.js";
import {
  ProviderAdapterRegistry,
  registerOpenAICompatibleProvider,
} from "../core/llm/provider-adapter-registry.js";

describe("OpenAI-compatible pipeline integration", () => {
  it("config → loader → registry → resolveByModel: full happy path", () => {
    const hubConfig = {
      openaiCompatibleProviders: [
        {
          name: "glm-local",
          baseUrl: "http://localhost:8000/v1",
          models: ["glm-4-quant"],
        },
        {
          name: "qwen-mlx",
          baseUrl: "http://localhost:8001/v1",
          models: ["qwen-7b"],
        },
      ],
    };
    const providers = loadOpenAICompatibleProviders(hubConfig);
    expect(providers).toHaveLength(2);

    const registry = new ProviderAdapterRegistry();
    for (const cfg of providers) {
      registerOpenAICompatibleProvider(registry, cfg);
    }
    expect(registry.listProviders().sort()).toEqual(["glm-local", "qwen-mlx"]);

    const adapter = registry.resolveByModel("glm-4-quant@glm-local");
    expect(adapter).toBeDefined();
    expect(adapter?.providerId).toBe("glm-local");
  });

  it("config invalid + valid → loader skips bad, registry only sees good", () => {
    const warnSpy = vi.fn();
    const providers = loadOpenAICompatibleProviders(
      {
        openaiCompatibleProviders: [
          { name: "good", baseUrl: "http://localhost:8000/v1", models: ["m"] },
          { name: "bad", baseUrl: "not-a-url", models: ["x"] },
        ],
      },
      { warn: warnSpy },
    );
    expect(providers).toHaveLength(1);
    expect(providers[0].name).toBe("good");
    expect(warnSpy).toHaveBeenCalled();

    const registry = new ProviderAdapterRegistry();
    for (const cfg of providers) {
      registerOpenAICompatibleProvider(registry, cfg);
    }
    expect(registry.getProvider("bad")).toBeUndefined();
    expect(registry.getProvider("good")).toBeDefined();
  });

  it("config schema infer matches loader output type", () => {
    const raw = {
      name: "glm-local",
      baseUrl: "http://localhost:8000/v1",
      models: ["glm-4-quant"],
    };
    const direct = OpenAICompatibleProviderConfigSchema.parse(raw);
    const viaLoader = loadOpenAICompatibleProviders({ openaiCompatibleProviders: [raw] })[0];
    expect(direct.name).toBe(viaLoader.name);
    expect(direct.baseUrl).toBe(viaLoader.baseUrl);
    expect(direct.defaultTimeoutMs).toBe(viaLoader.defaultTimeoutMs);
  });

  it("registered adapter drives probeHealth correctly", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ data: [{ id: "glm-4-quant" }] }), { status: 200 }),
    ) as unknown as typeof fetch;
    const cfg = OpenAICompatibleProviderConfigSchema.parse({
      name: "glm-local",
      baseUrl: "http://localhost:8000/v1",
      models: ["glm-4-quant"],
    });
    const result = await probeHealth(cfg, { fetchImpl });
    expect(result.connected).toBe(true);
    expect(result.modelsAvailable).toEqual(["glm-4-quant"]);
  });

  it("end-to-end pipeline runs in < 100ms (no real network)", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ data: [{ id: "x" }] }), { status: 200 }),
    ) as unknown as typeof fetch;
    const start = performance.now();
    const providers = loadOpenAICompatibleProviders({
      openaiCompatibleProviders: [
        { name: "p1", baseUrl: "http://localhost:8000/v1", models: ["x"] },
      ],
    });
    const registry = new ProviderAdapterRegistry();
    for (const cfg of providers) {
      registerOpenAICompatibleProvider(registry, cfg, { fetchImpl });
      await probeHealth(cfg, { fetchImpl });
    }
    const ms = performance.now() - start;
    expect(ms).toBeLessThan(100);
  });
});
