/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { loadAgentFromContent, AgentLoadError } from "../core/agents/agent-loader.js";

const validFrontmatter = `---
name: prd-analyst
description: Analyzes PRD documents and extracts requirements.
tools:
  - import_prd
  - analyze
model: claude-haiku-4-5
systemPrompt: You are a PRD analyst specialized in extracting requirements.
phase: ANALYZE
---

# PRD Analyst

This agent analyzes PRD documents.
`;

describe("loadAgentFromContent — valid input", () => {
  it("parses valid frontmatter and returns AgentDefinition", () => {
    const result = loadAgentFromContent(validFrontmatter, "prd-analyst.md", "ANALYZE");
    expect(result.name).toBe("prd-analyst");
    expect(result.phase).toBe("ANALYZE");
    expect(result.tools).toContain("import_prd");
  });

  it("model is optional — parses agent without model field", () => {
    const noModel = validFrontmatter.replace(/model: claude-haiku-4-5\n/, "");
    const result = loadAgentFromContent(noModel, "prd-analyst.md", "ANALYZE");
    expect(result.model).toBeUndefined();
  });
});

describe("loadAgentFromContent — filename guard", () => {
  it("throws AgentLoadError when filename stem != frontmatter.name", () => {
    expect(() =>
      loadAgentFromContent(validFrontmatter, "wrong-name.md", "ANALYZE"),
    ).toThrow(AgentLoadError);
  });

  it("error message mentions the mismatch", () => {
    let caught: unknown;
    try {
      loadAgentFromContent(validFrontmatter, "wrong-name.md", "ANALYZE");
    } catch (err) {
      caught = err;
    }
    expect((caught as AgentLoadError).message).toMatch(/wrong-name|prd-analyst/i);
  });
});

describe("loadAgentFromContent — phase dir guard", () => {
  it("throws AgentLoadError when phaseDir != frontmatter.phase", () => {
    expect(() =>
      loadAgentFromContent(validFrontmatter, "prd-analyst.md", "DESIGN"),
    ).toThrow(AgentLoadError);
  });

  it("error message mentions the phase conflict", () => {
    let caught: unknown;
    try {
      loadAgentFromContent(validFrontmatter, "prd-analyst.md", "DESIGN");
    } catch (err) {
      caught = err;
    }
    expect((caught as AgentLoadError).message).toMatch(/ANALYZE|DESIGN/i);
  });
});

describe("loadAgentFromContent — invalid frontmatter", () => {
  it("throws AgentLoadError on missing required field (systemPrompt)", () => {
    const broken = validFrontmatter.replace(/systemPrompt:.*\n/, "");
    expect(() =>
      loadAgentFromContent(broken, "prd-analyst.md", "ANALYZE"),
    ).toThrow(AgentLoadError);
  });

  it("throws AgentLoadError on unknown phase in frontmatter", () => {
    const badPhase = validFrontmatter.replace(/phase: ANALYZE/, "phase: BUILD");
    expect(() =>
      loadAgentFromContent(badPhase, "prd-analyst.md", "ANALYZE"),
    ).toThrow(AgentLoadError);
  });

  it("throws AgentLoadError when content has no frontmatter delimiters", () => {
    expect(() =>
      loadAgentFromContent("# Just markdown\nNo frontmatter here.", "prd-analyst.md", "ANALYZE"),
    ).toThrow(AgentLoadError);
  });
});
