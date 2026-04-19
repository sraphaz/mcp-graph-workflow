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

import { describe, it, expect } from "vitest";
import { parseSkillMarkdown } from "../core/skills/skill-loader.js";

describe("parseSkillMarkdown", () => {
  it("should parse SKILL.md with YAML frontmatter", () => {
    const content = `---
name: auth-validator
description: Validates authentication implementation
category: security
phases: [IMPLEMENT, VALIDATE]
toolchain: [search, context, analyze]
triggers:
  - event: "node:created"
    condition: "type=task"
---

# Auth Validator

This skill validates JWT authentication implementation by checking token handling, middleware setup, and error responses.

## Instructions

1. Search for auth-related code
2. Validate token handling patterns
3. Check error responses
`;

    const result = parseSkillMarkdown(content);

    expect(result.ok).toBe(true);
    expect(result.skill!.name).toBe("auth-validator");
    expect(result.skill!.description).toBe("Validates authentication implementation");
    expect(result.skill!.category).toBe("security");
    expect(result.skill!.phases).toEqual(["IMPLEMENT", "VALIDATE"]);
    expect(result.skill!.toolchain).toEqual(["search", "context", "analyze"]);
    expect(result.skill!.triggers).toHaveLength(1);
    expect(result.skill!.triggers![0].event).toBe("node:created");
    expect(result.skill!.instructions).toContain("Auth Validator");
  });

  it("should handle missing optional fields", () => {
    const content = `---
name: basic-skill
description: A basic skill
phases: [IMPLEMENT]
---

Basic instructions here.
`;

    const result = parseSkillMarkdown(content);

    expect(result.ok).toBe(true);
    expect(result.skill!.toolchain).toBeUndefined();
    expect(result.skill!.triggers).toBeUndefined();
    expect(result.skill!.contextTemplate).toBeUndefined();
  });

  it("should reject content without frontmatter", () => {
    const content = "# Just a regular markdown file\n\nNo frontmatter here.";

    const result = parseSkillMarkdown(content);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("frontmatter");
  });

  it("should reject invalid YAML", () => {
    const content = `---
name: broken
description: [invalid yaml
phases: IMPLEMENT
---

Body text.
`;

    const result = parseSkillMarkdown(content);

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("should reject missing required fields", () => {
    const content = `---
name: incomplete
---

Body text.
`;

    const result = parseSkillMarkdown(content);

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("should parse contextTemplate from frontmatter", () => {
    const content = `---
name: template-skill
description: Skill with context template
phases: [IMPLEMENT]
contextTemplate: "Focus on {{topic}} implementation"
---

Instructions for template skill.
`;

    const result = parseSkillMarkdown(content);

    expect(result.ok).toBe(true);
    expect(result.skill!.contextTemplate).toBe("Focus on {{topic}} implementation");
  });
});
