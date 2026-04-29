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
 * EPIC 8.2 — manage_skill(action: "create") without data returns write-a-skill scaffold template.
 */
import { describe, it, expect } from "vitest";
import { buildSkillScaffold } from "../core/agents/agent-loader.js";

describe("manage_skill create scaffold", () => {
  it("should return a SKILL.md scaffold string", () => {
    const scaffold = buildSkillScaffold();
    expect(typeof scaffold).toBe("string");
  });

  it("should include YAML frontmatter block", () => {
    const scaffold = buildSkillScaffold();
    expect(scaffold).toContain("---");
    expect(scaffold).toContain("name:");
    expect(scaffold).toContain("description:");
    expect(scaffold).toContain("phase:");
  });

  it("should include standard skill sections", () => {
    const scaffold = buildSkillScaffold();
    expect(scaffold).toContain("When to Use");
    expect(scaffold).toContain("Steps");
  });

  it("should be customizable with a name override", () => {
    const scaffold = buildSkillScaffold("my-new-skill");
    expect(scaffold).toContain("my-new-skill");
  });
});
