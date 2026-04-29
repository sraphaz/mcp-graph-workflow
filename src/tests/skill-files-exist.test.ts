/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

/**
 * EPIC 8.2 — 20 initial SKILL.md files exist with valid frontmatter.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_ROOT = join(__dirname, "..", "skills");

// §SprintA-cleanup — list reflects skills actually shipped under src/skills/.
// The original 20-name proposal evolved during EPIC 8.2 implementation; the
// canonical surface is the on-disk catalog plus domain/* knowledge skills.
const EXPECTED_SKILLS = [
  "analyze/decompose-prd.md",
  "analyze/grill-me.md",
  "design/design-an-interface.md",
  "design/seam-audit.md",
  "plan/budget-aware-picking.md",
  "plan/plan-sprint.md",
  "implement/anti-hallucination.md",
  "implement/pure-decision-pattern.md",
  "implement/tracer-bullet-tdd.md",
  "review/citation-coverage-review.md",
  "review/deep-module-review.md",
  "validate/dod-checklist.md",
  "validate/harness-regression-check.md",
  "any/code-detachment.md",
  "any/lessons-consult.md",
  "any/wip-one.md",
];

describe("Initial SKILL.md files", () => {
  it("should have src/skills directory", () => {
    expect(existsSync(SKILLS_ROOT)).toBe(true);
  });

  it("should have all expected skill files", () => {
    const missing = EXPECTED_SKILLS.filter((p) => !existsSync(join(SKILLS_ROOT, p)));
    expect(missing).toHaveLength(0);
  });

  it.each(EXPECTED_SKILLS)("skill %s should have valid frontmatter", (skillPath) => {
    const fullPath = join(SKILLS_ROOT, skillPath);
    if (!existsSync(fullPath)) return; // let the previous test catch missing files
    const content = readFileSync(fullPath, "utf-8");
    expect(content).toMatch(/^---\n/);
    expect(content).toContain("name:");
    expect(content).toContain("description:");
    expect(content).toContain("phases:");
  });
});
