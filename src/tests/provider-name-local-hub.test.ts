/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 3.1 — Adicionar "local-hub" ao ProviderNameSchema
 *
 * AC1: GIVEN enum atualizado WHEN typecheck THEN zero erro
 * AC2: GIVEN testes que listam providers WHEN rodam THEN incluem local-hub
 */

import { describe, it, expect } from "vitest";
import { ProviderNameSchema } from "../core/llm/types.js";

describe("ProviderNameSchema — local-hub", () => {
  it("AC2: accepts local-hub as a valid provider name", () => {
    const result = ProviderNameSchema.safeParse("local-hub");
    expect(result.success).toBe(true);
  });

  it("AC2: local-hub appears in the enum values list", () => {
    expect(ProviderNameSchema.options).toContain("local-hub");
  });
});
