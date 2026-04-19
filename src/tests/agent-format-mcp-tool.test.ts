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
