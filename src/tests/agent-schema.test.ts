/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import {
  AgentDefinitionSchema,
  type AgentDefinition,
} from "../schemas/agent.schema.js";

describe("AgentDefinitionSchema — valid inputs", () => {
  const minimal: AgentDefinition = {
    name: "prd-analyst",
    description: "Analyzes PRD documents",
    tools: ["import_prd", "analyze"],
    model: "claude-haiku-4-5",
    systemPrompt: "You are a PRD analyst.",
    phase: "ANALYZE",
  };

  it("accepts a fully valid agent definition", () => {
    expect(AgentDefinitionSchema.safeParse(minimal).success).toBe(true);
  });

  it("schema covers name field (string, required)", () => {
    expect(AgentDefinitionSchema.safeParse({ ...minimal, name: "" }).success).toBe(false);
    expect(AgentDefinitionSchema.safeParse({ ...minimal, name: 42 }).success).toBe(false);
  });

  it("schema covers description field (string, required)", () => {
    const { description: _, ...rest } = minimal;
    expect(AgentDefinitionSchema.safeParse(rest).success).toBe(false);
  });

  it("schema covers tools field (string array)", () => {
    expect(AgentDefinitionSchema.safeParse({ ...minimal, tools: [] }).success).toBe(true);
    expect(AgentDefinitionSchema.safeParse({ ...minimal, tools: [42] }).success).toBe(false);
  });

  it("schema covers model field (optional string)", () => {
    const { model: _, ...withoutModel } = minimal;
    expect(AgentDefinitionSchema.safeParse(withoutModel).success).toBe(true);
  });

  it("schema covers systemPrompt field (string, required)", () => {
    const { systemPrompt: _, ...rest } = minimal;
    expect(AgentDefinitionSchema.safeParse(rest).success).toBe(false);
  });

  it("schema covers phase field — all 9 lifecycle phases accepted", () => {
    const phases = [
      "ANALYZE", "DESIGN", "PLAN", "IMPLEMENT",
      "VALIDATE", "REVIEW", "HANDOFF", "DEPLOY", "LISTENING",
    ] as const;
    for (const p of phases) {
      expect(AgentDefinitionSchema.safeParse({ ...minimal, phase: p }).success).toBe(true);
    }
  });
});

describe("AgentDefinitionSchema — invalid inputs", () => {
  const base = {
    name: "architect",
    description: "Designs systems",
    tools: ["context"],
    systemPrompt: "You are an architect.",
    phase: "DESIGN",
  };

  it("rejects unknown phase string", () => {
    expect(AgentDefinitionSchema.safeParse({ ...base, phase: "BUILD" }).success).toBe(false);
    expect(AgentDefinitionSchema.safeParse({ ...base, phase: "auto" }).success).toBe(false);
    expect(AgentDefinitionSchema.safeParse({ ...base, phase: "" }).success).toBe(false);
    expect(AgentDefinitionSchema.safeParse({ ...base, phase: 42 }).success).toBe(false);
  });

  it("rejects missing name", () => {
    const { name: _, ...rest } = base;
    expect(AgentDefinitionSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects missing systemPrompt", () => {
    const { systemPrompt: _, ...rest } = base;
    expect(AgentDefinitionSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects missing phase", () => {
    const { phase: _, ...rest } = base;
    expect(AgentDefinitionSchema.safeParse(rest).success).toBe(false);
  });
});

describe("AgentDefinitionSchema — TypeScript type export", () => {
  it("z.infer<AgentDefinitionSchema> produces AgentDefinition type at runtime", () => {
    const agent: AgentDefinition = {
      name: "tester",
      description: "Writes and runs tests",
      tools: ["analyze"],
      systemPrompt: "You are a tester.",
      phase: "IMPLEMENT",
    };
    expect(agent.phase).toBe("IMPLEMENT");
    expect(Array.isArray(agent.tools)).toBe(true);
  });
});
