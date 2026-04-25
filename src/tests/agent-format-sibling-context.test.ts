/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 2.3: Agent format templates emit siblingContext (v11 Context-Pollination)
 * ADR-0047: templates expose siblingContext when non-empty, silent when empty.
 */

import { describe, it, expect } from "vitest";
import {
  generateAgentInstructions,
  type AgentContext,
} from "../core/agents/agent-format-generator.js";

const SAMPLE_SIBLING_CONTEXT = `### Subtask t1: Setup module

**interface** — src/foo.ts
\`\`\`ts
export const x = 1;
\`\`\``;

function baseContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    phase: "IMPLEMENT",
    ...overrides,
  };
}

describe("AC1 — Templates expose siblingContext when non-empty", () => {
  for (const format of ["markdown", "toml", "skill_md", "json"] as const) {
    it(`should include siblingContext in ${format} format when provided`, () => {
      const ctx = baseContext({ siblingContext: SAMPLE_SIBLING_CONTEXT });
      const out = generateAgentInstructions("claude", format, ctx);

      // Content signature appears regardless of format
      expect(out).toContain("Setup module");
      expect(out).toContain("export const x = 1;");
    });
  }

  it("markdown should include a header pointing to sibling context section", () => {
    const ctx = baseContext({ siblingContext: SAMPLE_SIBLING_CONTEXT });
    const out = generateAgentInstructions("claude", "markdown", ctx);
    expect(out).toMatch(/## .*[Ss]ibling/); // some Sibling-ish section header
  });
});

describe("AC2 — Silent absence when siblingContext is empty or undefined", () => {
  for (const format of ["markdown", "toml", "skill_md", "json"] as const) {
    it(`should NOT add sibling-context section in ${format} when empty string`, () => {
      const ctx = baseContext({ siblingContext: "" });
      const out = generateAgentInstructions("claude", format, ctx);
      expect(out.toLowerCase()).not.toContain("sibling context");
      expect(out.toLowerCase()).not.toContain("siblingcontext");
    });

    it(`should NOT add sibling-context section in ${format} when undefined`, () => {
      const ctx = baseContext({});
      const out = generateAgentInstructions("claude", format, ctx);
      expect(out.toLowerCase()).not.toContain("sibling context");
      expect(out.toLowerCase()).not.toContain("siblingcontext");
    });
  }

  it("json format should omit siblingContext key when empty", () => {
    const ctx = baseContext({ siblingContext: "" });
    const out = generateAgentInstructions("claude", "json", ctx);
    const parsed = JSON.parse(out);
    expect(parsed.siblingContext).toBeUndefined();
  });

  it("json format should include siblingContext key when non-empty", () => {
    const ctx = baseContext({ siblingContext: SAMPLE_SIBLING_CONTEXT });
    const out = generateAgentInstructions("claude", "json", ctx);
    const parsed = JSON.parse(out);
    expect(parsed.siblingContext).toBe(SAMPLE_SIBLING_CONTEXT);
  });
});

describe("Backward compat — existing fields still render", () => {
  it("should still render phase, principles, tasks when siblingContext added", () => {
    const ctx = baseContext({
      constitutionPrinciples: [{ title: "TDD", description: "Test first" }],
      relevantNodes: [{ id: "n1", title: "Task 1", status: "in_progress" }],
      siblingContext: SAMPLE_SIBLING_CONTEXT,
    });
    const out = generateAgentInstructions("claude", "markdown", ctx);

    expect(out).toContain("IMPLEMENT");
    expect(out).toContain("TDD");
    expect(out).toContain("Task 1");
    expect(out).toContain("Setup module");
  });
});
