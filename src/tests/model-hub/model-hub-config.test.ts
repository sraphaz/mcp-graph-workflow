/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.1 — Schema model-hub.config.json + Zod
 *
 * AC1: valid config parses to typed ModelHubConfig
 * AC2: unknown backend → clear Zod error with path
 * AC3: duplicate model across backends → accepted (resolved by @backend suffix)
 */

import { describe, it, expect } from "vitest";
import { ModelHubConfigSchema } from "../../core/model-hub/config.js";

const VALID_CONFIG = {
  host: "127.0.0.1",
  port: 8080,
  backends: ["vllm", "exllama"],
  models: {
    "mistral-7b": "vllm",
    "codellama-13b": "exllama",
  },
  fallbackChain: ["vllm", "exllama"],
};

describe("ModelHubConfigSchema — AC1: valid config", () => {
  it("should parse a complete valid config", () => {
    const result = ModelHubConfigSchema.safeParse(VALID_CONFIG);
    expect(result.success).toBe(true);
  });

  it("should expose typed fields on success", () => {
    const result = ModelHubConfigSchema.safeParse(VALID_CONFIG);
    if (!result.success) throw new Error("parse failed");
    expect(result.data.host).toBe("127.0.0.1");
    expect(result.data.port).toBe(8080);
    expect(result.data.backends).toContain("vllm");
    expect(result.data.models["mistral-7b"]).toBe("vllm");
    expect(result.data.fallbackChain).toEqual(["vllm", "exllama"]);
  });

  it("should apply defaults for optional fields", () => {
    const minimal = { backends: ["vllm"], models: {}, fallbackChain: [] };
    const result = ModelHubConfigSchema.safeParse(minimal);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("parse failed");
    expect(result.data.host).toBe("127.0.0.1");
    expect(result.data.port).toBe(11434);
  });
});

describe("ModelHubConfigSchema — AC2: unknown backend → Zod error with path", () => {
  it("should reject an unknown backend in backends list", () => {
    const bad = { ...VALID_CONFIG, backends: ["vllm", "unknown-backend"] };
    const result = ModelHubConfigSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (result.success) throw new Error("should have failed");
    const paths = result.error.issues.map((i: { path: (string | number)[] }) => i.path.join("."));
    expect(paths.some((p: string) => p.includes("backends"))).toBe(true);
  });

  it("should reject an unknown backend in models mapping value", () => {
    const bad = {
      ...VALID_CONFIG,
      models: { "mistral-7b": "unknown-backend" },
    };
    const result = ModelHubConfigSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (result.success) throw new Error("should have failed");
    const paths = result.error.issues.map((i: { path: (string | number)[] }) => i.path.join("."));
    expect(paths.some((p: string) => p.includes("models"))).toBe(true);
  });

  it("should reject an unknown backend in fallbackChain", () => {
    const bad = { ...VALID_CONFIG, fallbackChain: ["vllm", "bad-backend"] };
    const result = ModelHubConfigSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (result.success) throw new Error("should have failed");
  });
});

describe("ModelHubConfigSchema — AC3: duplicate model across backends → accepted", () => {
  it("should accept the same model key mapped to different backends", () => {
    const config = {
      ...VALID_CONFIG,
      models: {
        "mistral-7b": "vllm",
        "mistral-7b@exllama": "exllama",
      },
    };
    const result = ModelHubConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it("should accept @backend suffix disambiguation pattern", () => {
    const config = {
      ...VALID_CONFIG,
      models: {
        "llama3@vllm": "vllm",
        "llama3@exllama": "exllama",
      },
    };
    const result = ModelHubConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("parse failed");
    expect(result.data.models["llama3@vllm"]).toBe("vllm");
    expect(result.data.models["llama3@exllama"]).toBe("exllama");
  });
});
