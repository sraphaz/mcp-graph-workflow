/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-2.T07e — VALIDATE agent loader smoke tests.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadAgentFromContent } from "../core/agents/agent-loader.js";

const VAL_DIR = join(process.cwd(), "src/agents/VALIDATE");

describe("VALIDATE agent authoring (E2.T07e)", () => {
  it("two .md files exist under src/agents/VALIDATE/", () => {
    expect(existsSync(join(VAL_DIR, "qa-validator.md"))).toBe(true);
    expect(existsSync(join(VAL_DIR, "ac-checker.md"))).toBe(true);
  });

  for (const f of ["qa-validator.md", "ac-checker.md"]) {
    it(`${f} frontmatter passes Zod and loader`, () => {
      const content = readFileSync(join(VAL_DIR, f), "utf-8");
      const stem = f.replace(/\.md$/, "");
      const agent = loadAgentFromContent(content, f, "VALIDATE");
      expect(agent.name).toBe(stem);
      expect(agent.phase).toBe("VALIDATE");
    });
  }
});
