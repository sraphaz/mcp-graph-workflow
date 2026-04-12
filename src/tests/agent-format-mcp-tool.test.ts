import { describe, it, expect } from "vitest";
import {
  handleAgentGenerate,
  handleAgentListFormats,
  handleAgentListAgents,
} from "../mcp/tools/agent-format.js";

describe("Agent format MCP tool handlers", () => {
  describe("handleAgentListFormats", () => {
    it("should return 4 formats with descriptions", () => {
      const result = handleAgentListFormats();
      expect(result.ok).toBe(true);
      expect(result.formats).toHaveLength(4);
      expect(result.formats.map((f: { name: string }) => f.name)).toContain("markdown");
    });
  });

  describe("handleAgentListAgents", () => {
    it("should return supported agents", () => {
      const result = handleAgentListAgents();
      expect(result.ok).toBe(true);
      expect(result.agents.length).toBeGreaterThanOrEqual(3);
      expect(result.agents.map((a: { name: string }) => a.name)).toContain("claude");
    });
  });

  describe("handleAgentGenerate", () => {
    it("should generate instructions for claude in markdown", () => {
      const result = handleAgentGenerate({
        agentName: "claude",
        format: "markdown",
        phase: "IMPLEMENT",
      });
      expect(result.ok).toBe(true);
      expect(result.output).toContain("IMPLEMENT");
      expect(result.output).toContain("Claude");
    });

    it("should generate JSON format", () => {
      const result = handleAgentGenerate({
        agentName: "generic",
        format: "json",
        phase: "DESIGN",
      });
      expect(result.ok).toBe(true);
      const parsed = JSON.parse(result.output);
      expect(parsed.phase).toBe("DESIGN");
    });
  });
});
