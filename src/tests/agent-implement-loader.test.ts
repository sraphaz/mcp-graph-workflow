/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-2.T07d — IMPLEMENT agent loader smoke tests.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadAgentFromContent } from "../core/agents/agent-loader.js";

const IMPL_DIR = join(process.cwd(), "src/agents/IMPLEMENT");

describe("IMPLEMENT agent authoring (E2.T07d)", () => {
  const expected = ["coder.md", "tester.md", "pair-driver.md"];

  it("three .md files exist under src/agents/IMPLEMENT/", () => {
    for (const f of expected) {
      expect(existsSync(join(IMPL_DIR, f))).toBe(true);
    }
  });

  for (const f of ["coder.md", "tester.md", "pair-driver.md"]) {
    it(`${f} frontmatter passes Zod and loader`, () => {
      const content = readFileSync(join(IMPL_DIR, f), "utf-8");
      const stem = f.replace(/\.md$/, "");
      const agent = loadAgentFromContent(content, f, "IMPLEMENT");
      expect(agent.name).toBe(stem);
      expect(agent.phase).toBe("IMPLEMENT");
      expect(agent.tools.length).toBeGreaterThan(0);
    });
  }
});
