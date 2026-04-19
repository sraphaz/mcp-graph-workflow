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
import { parseDaVinciCode } from "../../core/davinci/davinci-parser.js";
import { detectPluginType } from "../../core/davinci/plugin-type-detector.js";
import { resolveVariables } from "../../core/davinci/variable-resolver.js";
import { checkBuildEnvironment } from "../../core/davinci/build-runner.js";

// These tests validate the core functions that MCP tools will wrap.
// MCP tool registration tests require McpServer mock which is complex,
// so we test the underlying logic directly.

const SAMPLE_CODE = `module.exports = a = async ({params}) => {
  const apiKey = "{{global.variables.apiKey}}";
  const response = await fetch("https://api.example.com/auth", { method: "POST" });
  return { authenticated: true };
}`;

describe("davinci MCP tool logic", () => {
  describe("davinci_analyze logic", () => {
    it("should parse code and return analysis with variables", () => {
      const analysis = parseDaVinciCode(SAMPLE_CODE);

      expect(analysis.variables.length).toBeGreaterThanOrEqual(1);
      expect(analysis.apiCalls.length).toBeGreaterThanOrEqual(1);
      expect(analysis.codeLocation).toBe("custom_function");
      expect(analysis.sourceLineCount).toBeGreaterThan(0);
    });

    it("should resolve variables from analysis", () => {
      const analysis = parseDaVinciCode(SAMPLE_CODE);
      const resolved = resolveVariables(analysis.variables);

      expect(resolved.length).toBeGreaterThanOrEqual(1);
      expect(resolved[0].javaExpression).toContain("getFieldValue");
    });
  });

  describe("davinci_convert logic", () => {
    it("should detect plugin type from code", () => {
      const analysis = parseDaVinciCode(SAMPLE_CODE);
      const detection = detectPluginType(analysis, "pingfederate", {
        sourceCode: SAMPLE_CODE,
      });

      expect(detection.pluginType).toBeDefined();
      expect(detection.confidence).toBeGreaterThanOrEqual(0);
      expect(detection.confidence).toBeLessThanOrEqual(1);
    });

    it("should allow plugin type override", () => {
      const analysis = parseDaVinciCode(SAMPLE_CODE);
      const detection = detectPluginType(analysis, "pingfederate", {
        sourceCode: SAMPLE_CODE,
        override: "token-generator",
      });

      expect(detection.pluginType).toBe("token-generator");
      expect(detection.confidence).toBe(1);
    });
  });

  describe("davinci_build logic", () => {
    it("should check build environment and return items", () => {
      const env = checkBuildEnvironment();

      expect(env.items).toBeDefined();
      expect(env.items.length).toBe(3);
      expect(typeof env.readyToBuild).toBe("boolean");
    });

    it("should include install URLs for missing tools", () => {
      const env = checkBuildEnvironment();

      for (const item of env.items) {
        if (!item.available) {
          expect(item.installUrl).toBeDefined();
          expect(item.instruction).toBeDefined();
        }
      }
    });
  });
});
