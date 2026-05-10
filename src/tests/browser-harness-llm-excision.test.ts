/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.3 — Deletar arquivos LLM em browser-harness/
 *
 * AC1: GIVEN arquivos deletados WHEN npm run build THEN compila zero erro
 * AC2: GIVEN barrel index.ts WHEN inspecionado THEN não exporta nada deletado
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dirname, "../..");
const BH = join(ROOT, "src/core/browser-harness");

function src(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf-8");
}

// ---------------------------------------------------------------------------
// AC1: LLM source files deleted
// ---------------------------------------------------------------------------

describe("browser-harness LLM excision — AC1: source files deleted", () => {
  it("chat-runner.ts is deleted", () => {
    expect(existsSync(join(BH, "chat-runner.ts")), "chat-runner.ts should not exist").toBe(false);
  });

  it("llm-client.ts is deleted", () => {
    expect(existsSync(join(BH, "llm-client.ts")), "llm-client.ts should not exist").toBe(false);
  });

  it("llm-planner.ts is deleted", () => {
    expect(existsSync(join(BH, "llm-planner.ts")), "llm-planner.ts should not exist").toBe(false);
  });

  it("auth-store.ts is deleted", () => {
    expect(existsSync(join(BH, "auth-store.ts")), "auth-store.ts should not exist").toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC2: barrel index.ts does not re-export deleted modules
// ---------------------------------------------------------------------------

describe("browser-harness LLM excision — AC2: barrel clean", () => {
  it("barrel does not export from chat-runner", () => {
    const barrel = src("src/core/browser-harness/index.ts");
    expect(barrel).not.toMatch(/chat-runner/);
  });

  it("barrel does not export from llm-client", () => {
    const barrel = src("src/core/browser-harness/index.ts");
    expect(barrel).not.toMatch(/llm-client/);
  });

  it("barrel does not export from llm-planner", () => {
    const barrel = src("src/core/browser-harness/index.ts");
    expect(barrel).not.toMatch(/llm-planner/);
  });

  it("barrel does not export from auth-store", () => {
    const barrel = src("src/core/browser-harness/index.ts");
    expect(barrel).not.toMatch(/auth-store/);
  });
});
