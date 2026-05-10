/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.2 — Deletar src/core/proxy/, src/core/browser-pilot/, tools/copilot-bridge*
 * (Epic: Excisão do stack LLM)
 *
 * AC1: GIVEN diretórios deletados WHEN npm install THEN não tenta resolver workspaces removidos
 * AC2: GIVEN MCP server inicia WHEN lista tools THEN browser_pilot_run ausente
 * AC3: GIVEN npm run build && typecheck && test THEN zero erro
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dirname, "../..");

function src(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf-8");
}

// ---------------------------------------------------------------------------
// AC1: directories and copilot-bridge workspaces removed
// ---------------------------------------------------------------------------

describe("llm-stack excision — AC1: directories deleted", () => {
  it("src/core/proxy/ directory is deleted", () => {
    expect(existsSync(join(ROOT, "src/core/proxy")), "src/core/proxy/ should not exist").toBe(false);
  });

  it("src/core/browser-pilot/ directory is deleted", () => {
    expect(existsSync(join(ROOT, "src/core/browser-pilot")), "src/core/browser-pilot/ should not exist").toBe(false);
  });

  it("tools/copilot-bridge/ directory is deleted", () => {
    expect(existsSync(join(ROOT, "tools/copilot-bridge")), "tools/copilot-bridge/ should not exist").toBe(false);
  });

  it("tools/copilot-bridge-cli/ directory is deleted", () => {
    expect(existsSync(join(ROOT, "tools/copilot-bridge-cli")), "tools/copilot-bridge-cli/ should not exist").toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC2: browser_pilot_run removed from MCP registration
// ---------------------------------------------------------------------------

describe("llm-stack excision — AC2: browser_pilot_run removed from MCP", () => {
  it("mcp/tools/index.ts does not register browser_pilot_run", () => {
    const source = src("src/mcp/tools/index.ts");
    expect(source).not.toMatch(/browser_pilot_run/);
  });

  it("mcp/tools/browser-pilot.ts is deleted", () => {
    expect(existsSync(join(ROOT, "src/mcp/tools/browser-pilot.ts")), "browser-pilot.ts should be deleted").toBe(false);
  });
});
