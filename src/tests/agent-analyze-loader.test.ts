/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-2.T07a — ANALYZE agent loader smoke tests.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadAgentFromContent } from "../core/agents/agent-loader.js";

const ANALYZE_DIR = join(process.cwd(), "src/agents/ANALYZE");

describe("ANALYZE agent authoring (E2.T07a)", () => {
  it("two .md files exist under src/agents/ANALYZE/", () => {
    expect(existsSync(join(ANALYZE_DIR, "prd-analyst.md"))).toBe(true);
    expect(existsSync(join(ANALYZE_DIR, "requirement-decomposer.md"))).toBe(true);
  });

  it("prd-analyst frontmatter passes Zod and loader", () => {
    const content = readFileSync(join(ANALYZE_DIR, "prd-analyst.md"), "utf-8");
    const agent = loadAgentFromContent(content, "prd-analyst.md", "ANALYZE");
    expect(agent.name).toBe("prd-analyst");
    expect(agent.phase).toBe("ANALYZE");
    expect(agent.tools.length).toBeGreaterThan(0);
    expect(agent.systemPrompt.length).toBeGreaterThan(50);
  });

  it("requirement-decomposer frontmatter passes Zod and loader", () => {
    const content = readFileSync(join(ANALYZE_DIR, "requirement-decomposer.md"), "utf-8");
    const agent = loadAgentFromContent(content, "requirement-decomposer.md", "ANALYZE");
    expect(agent.name).toBe("requirement-decomposer");
    expect(agent.phase).toBe("ANALYZE");
    expect(agent.tools).toContain("validate");
  });
});
