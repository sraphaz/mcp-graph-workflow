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
import {
  applySection,
  generateClaudeMdSection,
  generateCodexAgentsMdSection,
  MARKER_START,
  MARKER_END,
} from "../core/config/ai-memory-generator.js";

describe("applySection — idempotent append/replace", () => {
  it("should append to empty content", () => {
    const section = generateClaudeMdSection("test");
    const result = applySection("", section);

    expect(result).toContain(MARKER_START);
    expect(result).toContain(MARKER_END);
  });

  it("should append to existing content without markers", () => {
    const existing = "# My Project\n\nSome content here.\n";
    const section = generateClaudeMdSection("test");
    const result = applySection(existing, section);

    expect(result).toContain("# My Project");
    expect(result).toContain(MARKER_START);
    expect(result.indexOf("# My Project")).toBeLessThan(result.indexOf(MARKER_START));
  });

  it("should replace existing section between markers (idempotent)", () => {
    const existing = `# My Project

${MARKER_START}
old content
${MARKER_END}

## Other section
`;
    const section = generateClaudeMdSection("updated");
    const result = applySection(existing, section);

    // Should have new content, not old
    expect(result).toContain("updated");
    expect(result).not.toContain("old content");
    // Should preserve surrounding content
    expect(result).toContain("# My Project");
    expect(result).toContain("## Other section");
    // Should have exactly one pair of markers
    expect(result.split(MARKER_START).length).toBe(2);
    expect(result.split(MARKER_END).length).toBe(2);
  });

  it("should be truly idempotent — applying twice yields same result", () => {
    const existing = "# My Project\n";
    const section = generateClaudeMdSection("test");

    const first = applySection(existing, section);
    const second = applySection(first, section);

    expect(first).toBe(second);
  });

  it("should generate Codex AGENTS.md instructions with Codex-specific guidance", () => {
    const section = generateCodexAgentsMdSection("test-project", "lean");

    expect(section).toContain(MARKER_START);
    expect(section).toContain(MARKER_END);
    expect(section).toContain("AGENTS.md");
    expect(section).toContain(".agents/skills");
    expect(section).toContain("$graph-implement");
    expect(section).toContain("Plan Mode");
    expect(section).toContain("apply_patch");
  });

  it("should apply Codex AGENTS.md section idempotently", () => {
    const section = generateCodexAgentsMdSection("test-project", "lean");

    const first = applySection("# Project\n", section);
    const second = applySection(first, section);

    expect(first).toBe(second);
    expect(first.split(MARKER_START).length).toBe(2);
    expect(first.split(MARKER_END).length).toBe(2);
  });
});
