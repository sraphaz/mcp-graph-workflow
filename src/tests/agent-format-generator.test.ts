import { describe, it, expect } from "vitest";
import {
  generateAgentInstructions,
  listFormats,
  listAgents,
  type AgentContext,
} from "../core/agents/agent-format-generator.js";

const baseContext: AgentContext = {
  phase: "IMPLEMENT",
  constitutionPrinciples: [
    { title: "TDD mandatory", description: "Test before code" },
    { title: "No external infra", description: "SQLite only" },
    { title: "Library-first", description: "Prefer libraries" },
  ],
  relevantNodes: [
    { id: "n1", title: "Build auth module", status: "in_progress" },
    { id: "n2", title: "Add login endpoint", status: "in_progress" },
  ],
};

describe("Agent format generator", () => {
  describe("generateAgentInstructions", () => {
    it("should generate markdown format for claude", () => {
      const result = generateAgentInstructions("claude", "markdown", baseContext);
      expect(result).toContain("# ");
      expect(result).toContain("IMPLEMENT");
      expect(result).toContain("TDD mandatory");
      expect(result).toContain("Build auth module");
    });

    it("should generate TOML format for cursor", () => {
      const result = generateAgentInstructions("cursor", "toml", baseContext);
      expect(result).toContain("[");
      expect(result).toContain("phase");
      expect(result).toContain("IMPLEMENT");
    });

    it("should generate skill.md format for copilot", () => {
      const result = generateAgentInstructions("copilot", "skill_md", baseContext);
      expect(result).toContain("---");
      expect(result).toContain("description:");
    });

    it("should generate JSON format", () => {
      const result = generateAgentInstructions("generic", "json", baseContext);
      const parsed = JSON.parse(result);
      expect(parsed.phase).toBe("IMPLEMENT");
      expect(parsed.principles).toHaveLength(3);
      expect(parsed.tasks).toHaveLength(2);
    });

    it("should include constitution principles", () => {
      const result = generateAgentInstructions("claude", "markdown", baseContext);
      expect(result).toContain("TDD mandatory");
      expect(result).toContain("No external infra");
      expect(result).toContain("Library-first");
    });

    it("should include relevant nodes with titles", () => {
      const result = generateAgentInstructions("claude", "markdown", baseContext);
      expect(result).toContain("Build auth module");
      expect(result).toContain("Add login endpoint");
    });
  });

  describe("listFormats", () => {
    it("should return 4 formats", () => {
      const formats = listFormats();
      expect(formats).toHaveLength(4);
      const names = formats.map((f) => f.name);
      expect(names).toContain("markdown");
      expect(names).toContain("toml");
      expect(names).toContain("skill_md");
      expect(names).toContain("json");
    });
  });

  describe("listAgents", () => {
    it("should include claude, cursor, copilot", () => {
      const agents = listAgents();
      const names = agents.map((a) => a.name);
      expect(names).toContain("claude");
      expect(names).toContain("cursor");
      expect(names).toContain("copilot");
      expect(agents.length).toBeGreaterThanOrEqual(3);
    });
  });
});
