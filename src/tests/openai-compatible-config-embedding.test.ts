/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.3 — Schema config aceita lista separada de embedding models
 *
 * AC1: GIVEN config sem embeddingModels WHEN parseado THEN aceita com default []
 * AC2: GIVEN config com embeddingModels=["bge-small-en-v1.5"] WHEN parseado THEN aceita
 * AC3: GIVEN config com embeddingModels=[""] (string vazia) WHEN parseado THEN erro Zod
 */

import { describe, it, expect } from "vitest";
import { OpenAICompatibleProviderConfigSchema } from "../core/llm/adapters/openai-compatible-config.schema.js";

const BASE = {
  name: "test-provider",
  baseUrl: "http://localhost:8000/v1",
  models: ["model-a"],
};

describe("OpenAICompatibleProviderConfigSchema — embeddingModels", () => {
  it("AC1: accepts config without embeddingModels, defaults to []", () => {
    const result = OpenAICompatibleProviderConfigSchema.safeParse(BASE);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.embeddingModels).toEqual([]);
  });

  it("AC2: accepts valid embeddingModels list", () => {
    const result = OpenAICompatibleProviderConfigSchema.safeParse({
      ...BASE,
      embeddingModels: ["bge-small-en-v1.5"],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.embeddingModels).toEqual(["bge-small-en-v1.5"]);
  });

  it("AC3: rejects embeddingModels with empty string entries", () => {
    const result = OpenAICompatibleProviderConfigSchema.safeParse({
      ...BASE,
      embeddingModels: [""],
    });
    expect(result.success).toBe(false);
  });
});
