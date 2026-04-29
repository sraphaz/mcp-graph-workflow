/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-2.T07b — DESIGN agent loader smoke tests.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadAgentFromContent } from "../core/agents/agent-loader.js";

const DESIGN_DIR = join(process.cwd(), "src/agents/DESIGN");

describe("DESIGN agent authoring (E2.T07b)", () => {
  it("two .md files exist under src/agents/DESIGN/", () => {
    expect(existsSync(join(DESIGN_DIR, "architect.md"))).toBe(true);
    expect(existsSync(join(DESIGN_DIR, "adr-author.md"))).toBe(true);
  });

  it("architect frontmatter passes Zod and loader", () => {
    const content = readFileSync(join(DESIGN_DIR, "architect.md"), "utf-8");
    const agent = loadAgentFromContent(content, "architect.md", "DESIGN");
    expect(agent.name).toBe("architect");
    expect(agent.phase).toBe("DESIGN");
  });

  it("adr-author frontmatter passes Zod and loader", () => {
    const content = readFileSync(join(DESIGN_DIR, "adr-author.md"), "utf-8");
    const agent = loadAgentFromContent(content, "adr-author.md", "DESIGN");
    expect(agent.name).toBe("adr-author");
    expect(agent.phase).toBe("DESIGN");
  });
});
