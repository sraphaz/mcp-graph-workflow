/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-2.T07h — Coordinators agent loader smoke tests.
 *
 * Coordinators live under IMPLEMENT/ (the phase where they dispatch
 * worker agents). The file location matches the phase value.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadAgentFromContent } from "../core/agents/agent-loader.js";

const IMPL_DIR = join(process.cwd(), "src/agents/IMPLEMENT");

describe("Coordinators agent authoring (E2.T07h)", () => {
  it("two coordinator .md files exist under src/agents/IMPLEMENT/", () => {
    expect(existsSync(join(IMPL_DIR, "hierarchical-coordinator.md"))).toBe(true);
    expect(existsSync(join(IMPL_DIR, "mesh-coordinator.md"))).toBe(true);
  });

  for (const f of ["hierarchical-coordinator.md", "mesh-coordinator.md"]) {
    it(`${f} frontmatter passes Zod and loader`, () => {
      const content = readFileSync(join(IMPL_DIR, f), "utf-8");
      const stem = f.replace(/\.md$/, "");
      const agent = loadAgentFromContent(content, f, "IMPLEMENT");
      expect(agent.name).toBe(stem);
      expect(agent.phase).toBe("IMPLEMENT");
      expect(agent.tools).toContain("delegate");
    });
  }
});
