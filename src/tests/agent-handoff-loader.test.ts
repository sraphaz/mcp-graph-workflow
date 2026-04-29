/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-2.T07g — HANDOFF agent loader smoke tests.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadAgentFromContent } from "../core/agents/agent-loader.js";

const HND_DIR = join(process.cwd(), "src/agents/HANDOFF");

describe("HANDOFF agent authoring (E2.T07g)", () => {
  it("two .md files exist under src/agents/HANDOFF/", () => {
    expect(existsSync(join(HND_DIR, "documenter.md"))).toBe(true);
    expect(existsSync(join(HND_DIR, "release-notes-writer.md"))).toBe(true);
  });

  for (const f of ["documenter.md", "release-notes-writer.md"]) {
    it(`${f} frontmatter passes Zod and loader`, () => {
      const content = readFileSync(join(HND_DIR, f), "utf-8");
      const stem = f.replace(/\.md$/, "");
      const agent = loadAgentFromContent(content, f, "HANDOFF");
      expect(agent.name).toBe(stem);
      expect(agent.phase).toBe("HANDOFF");
    });
  }
});
