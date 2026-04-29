/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");

describe("docs/guides/llm-gateway.md", () => {
  const path = resolve(REPO_ROOT, "docs/guides/llm-gateway.md");
  const content = readFileSync(path, "utf8");

  it("contains a Overview section", () => {
    expect(content).toMatch(/##\s+Overview/);
  });

  it("documents the MCP tool `llm`", () => {
    expect(content).toMatch(/MCP tool `llm`/);
  });

  it("documents Default models", () => {
    expect(content).toMatch(/##\s+Default models/);
    expect(content).toContain("anthropic/claude-haiku-4-5");
    expect(content).toContain("openai/gpt-4o-mini");
  });

  it("documents Budget caps with $1.00/cell default", () => {
    expect(content).toMatch(/##\s+Budget caps/);
    expect(content).toContain("1.00");
    expect(content).toContain("cap_usd_per_cell");
  });

  it("documents the Roadmap pointing at Fase E", () => {
    expect(content).toMatch(/Roadmap.*Fase E|Fase E.*HTTP/i);
  });

  it("documents migration v66 ledger schema", () => {
    expect(content).toContain("v66");
    expect(content).toContain("llm_call_ledger");
  });
});

describe("docs/guides/USER-GUIDE.md", () => {
  const path = resolve(REPO_ROOT, "docs/guides/USER-GUIDE.md");
  const content = readFileSync(path, "utf8");

  it("contains an LLM Gateway section linking to llm-gateway.md", () => {
    expect(content).toMatch(/##\s+LLM Gateway/);
    expect(content).toContain("llm-gateway.md");
  });
});
