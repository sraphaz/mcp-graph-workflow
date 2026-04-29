/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-2.T07f — REVIEW agent loader smoke tests.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadAgentFromContent } from "../core/agents/agent-loader.js";

const REV_DIR = join(process.cwd(), "src/agents/REVIEW");

describe("REVIEW agent authoring (E2.T07f)", () => {
  it("two .md files exist under src/agents/REVIEW/", () => {
    expect(existsSync(join(REV_DIR, "code-reviewer.md"))).toBe(true);
    expect(existsSync(join(REV_DIR, "harness-auditor.md"))).toBe(true);
  });

  for (const f of ["code-reviewer.md", "harness-auditor.md"]) {
    it(`${f} frontmatter passes Zod and loader`, () => {
      const content = readFileSync(join(REV_DIR, f), "utf-8");
      const stem = f.replace(/\.md$/, "");
      const agent = loadAgentFromContent(content, f, "REVIEW");
      expect(agent.name).toBe(stem);
      expect(agent.phase).toBe("REVIEW");
    });
  }
});
