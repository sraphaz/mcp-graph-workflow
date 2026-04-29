/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-2.T07c — PLAN agent loader smoke tests.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadAgentFromContent } from "../core/agents/agent-loader.js";

const PLAN_DIR = join(process.cwd(), "src/agents/PLAN");

describe("PLAN agent authoring (E2.T07c)", () => {
  it("two .md files exist under src/agents/PLAN/", () => {
    expect(existsSync(join(PLAN_DIR, "sprint-planner.md"))).toBe(true);
    expect(existsSync(join(PLAN_DIR, "dependency-mapper.md"))).toBe(true);
  });

  it("sprint-planner frontmatter passes Zod and loader", () => {
    const content = readFileSync(join(PLAN_DIR, "sprint-planner.md"), "utf-8");
    const agent = loadAgentFromContent(content, "sprint-planner.md", "PLAN");
    expect(agent.name).toBe("sprint-planner");
    expect(agent.phase).toBe("PLAN");
    expect(agent.tools).toContain("plan_sprint");
  });

  it("dependency-mapper frontmatter passes Zod and loader", () => {
    const content = readFileSync(join(PLAN_DIR, "dependency-mapper.md"), "utf-8");
    const agent = loadAgentFromContent(content, "dependency-mapper.md", "PLAN");
    expect(agent.name).toBe("dependency-mapper");
    expect(agent.phase).toBe("PLAN");
    expect(agent.tools).toContain("edge");
  });
});
