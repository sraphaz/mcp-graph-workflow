/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.1 — Migrar callers antes de deletar (Epic: Excisão do stack LLM)
 *
 * Structural tests — verifies that ChatRunner callers have been migrated
 * or removed before Task 1.2 deletes chat-runner.ts.
 *
 * AC1: GIVEN grep executado WHEN auditoria pronta THEN cada call site classificado
 * AC2: GIVEN call sites migrados WHEN `npm run build && npm test` THEN tudo verde
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dirname, "../..");

function src(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf-8");
}

// ---------------------------------------------------------------------------
// AC1: call sites classified and migrated
// ---------------------------------------------------------------------------

describe("browser-harness caller migration — AC1: callers migrated", () => {
  it("API route browser-harness.ts does not import ChatRunner", () => {
    const source = src("src/api/routes/browser-harness.ts");
    expect(source).not.toMatch(/import.*ChatRunner.*chat-runner/);
  });

  it("API route browser-harness.ts has no chat: ChatRunner field", () => {
    const source = src("src/api/routes/browser-harness.ts");
    expect(source).not.toMatch(/chat:\s*ChatRunner/);
  });

  it("API route browser-harness.ts has no ChatRunner instantiation", () => {
    const source = src("src/api/routes/browser-harness.ts");
    expect(source).not.toMatch(/new ChatRunner/);
  });

  it("test file chat-runner.test.ts is deleted (delete-caller)", () => {
    const exists = existsSync(join(ROOT, "src/tests/chat-runner.test.ts"));
    expect(exists, "chat-runner.test.ts should be deleted (delete-caller)").toBe(false);
  });

  it("test file browser-harness-bus-integration.test.ts is deleted (delete-caller)", () => {
    const exists = existsSync(join(ROOT, "src/tests/browser-harness-bus-integration.test.ts"));
    expect(exists, "browser-harness-bus-integration.test.ts should be deleted (delete-caller)").toBe(false);
  });
});
