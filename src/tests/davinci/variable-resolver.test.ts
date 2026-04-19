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
  resolveVariable,
  resolveVariables,
  generateGuiFieldCode,
  generateConfigureCode,
} from "../../core/davinci/variable-resolver.js";
import type { DaVinciVariable } from "../../core/davinci/davinci-types.js";

// ── Factory ───────────────────────────────────────────────────────────

function makeVariable(overrides: Partial<DaVinciVariable> = {}): DaVinciVariable {
  return {
    kind: "global",
    rawTemplate: "{{global.variables.apiKey}}",
    path: ["global", "variables", "apiKey"],
    fieldName: "apiKey",
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("variable-resolver", () => {
  describe("resolveVariable", () => {
    it("should map global.variables to Configuration.getFieldValue", () => {
      const variable = makeVariable({
        kind: "global",
        rawTemplate: "{{global.variables.apiKey}}",
        path: ["global", "variables", "apiKey"],
        fieldName: "apiKey",
      });

      const result = resolveVariable(variable);

      expect(result.javaExpression).toBe('configuration.getFieldValue("apiKey")');
      expect(result.original).toEqual(variable);
    });

    it("should map global.company.variables to Configuration.getFieldValue", () => {
      const variable = makeVariable({
        kind: "global",
        rawTemplate: "{{global.company.variables.baseUrl}}",
        path: ["global", "company", "variables", "baseUrl"],
        fieldName: "baseUrl",
      });

      const result = resolveVariable(variable);

      expect(result.javaExpression).toBe('configuration.getFieldValue("baseUrl")');
    });

    it("should map global.flow.variables to Configuration.getFieldValue", () => {
      const variable = makeVariable({
        kind: "flow",
        rawTemplate: "{{global.flow.variables.flowToken}}",
        path: ["global", "flow", "variables", "flowToken"],
        fieldName: "flowToken",
      });

      const result = resolveVariable(variable);

      expect(result.javaExpression).toBe('configuration.getFieldValue("flowToken")');
    });

    it("should map local.nodeId to inMap.get with comment", () => {
      const variable = makeVariable({
        kind: "local",
        rawTemplate: "{{local.httpNode.makeRequest.output.userId}}",
        path: ["local", "httpNode", "makeRequest", "output", "userId"],
        fieldName: "userId",
        nodeId: "httpNode",
        capability: "makeRequest",
      });

      const result = resolveVariable(variable);

      expect(result.javaExpression).toContain('inMap.get("userId")');
      expect(result.javaExpression).toContain(".getValue()");
    });

    it("should map parameter variables to Configuration.getFieldValue", () => {
      const variable = makeVariable({
        kind: "parameter",
        rawTemplate: "{{username}}",
        path: ["username"],
        fieldName: "username",
      });

      const result = resolveVariable(variable);

      expect(result.javaExpression).toBe('configuration.getFieldValue("username")');
    });
  });

  describe("generateGuiFieldCode", () => {
    it("should generate TextFieldDescriptor for global variable", () => {
      const variable = makeVariable({
        kind: "global",
        fieldName: "apiKey",
      });

      const code = generateGuiFieldCode(variable);

      expect(code).toContain("TextFieldDescriptor");
      expect(code).toContain('"apiKey"');
      expect(code).toContain("guiDescriptor.addField");
    });

    it("should generate TextFieldDescriptor for each unique variable", () => {
      const vars: DaVinciVariable[] = [
        makeVariable({ fieldName: "apiKey" }),
        makeVariable({ fieldName: "baseUrl" }),
        makeVariable({ fieldName: "timeout" }),
      ];

      const codes = vars.map(generateGuiFieldCode);

      expect(codes[0]).toContain('"apiKey"');
      expect(codes[1]).toContain('"baseUrl"');
      expect(codes[2]).toContain('"timeout"');
    });

    it("should NOT generate GUI field for local variables", () => {
      const variable = makeVariable({
        kind: "local",
        fieldName: "userId",
        nodeId: "httpNode",
      });

      const code = generateGuiFieldCode(variable);

      expect(code).toBe("");
    });
  });

  describe("generateConfigureCode", () => {
    it("should generate configuration.getFieldValue assignment", () => {
      const variable = makeVariable({
        kind: "global",
        fieldName: "apiKey",
      });

      const code = generateConfigureCode(variable);

      expect(code).toContain("apiKey");
      expect(code).toContain('configuration.getFieldValue("apiKey")');
    });

    it("should NOT generate configure code for local variables", () => {
      const variable = makeVariable({
        kind: "local",
        fieldName: "userId",
        nodeId: "httpNode",
      });

      const code = generateConfigureCode(variable);

      expect(code).toBe("");
    });
  });

  describe("resolveVariables (batch)", () => {
    it("should resolve all variables and return ResolvedVariable array", () => {
      const variables: DaVinciVariable[] = [
        makeVariable({ kind: "global", fieldName: "apiKey" }),
        makeVariable({
          kind: "local",
          fieldName: "userId",
          rawTemplate: "{{local.httpNode.makeRequest.output.userId}}",
          path: ["local", "httpNode", "makeRequest", "output", "userId"],
          nodeId: "httpNode",
          capability: "makeRequest",
        }),
        makeVariable({ kind: "parameter", fieldName: "username", rawTemplate: "{{username}}", path: ["username"] }),
      ];

      const results = resolveVariables(variables);

      expect(results).toHaveLength(3);
      expect(results[0].javaExpression).toContain("getFieldValue");
      expect(results[1].javaExpression).toContain("inMap.get");
      expect(results[2].javaExpression).toContain("getFieldValue");
    });

    it("should deduplicate variables with same fieldName", () => {
      const variables: DaVinciVariable[] = [
        makeVariable({ fieldName: "apiKey" }),
        makeVariable({ fieldName: "apiKey" }),
        makeVariable({ fieldName: "baseUrl" }),
      ];

      const results = resolveVariables(variables);

      expect(results).toHaveLength(2);
    });
  });

  describe("JSON.parse → ObjectMapper mapping", () => {
    it("should resolve JSON.parse pattern variable with ObjectMapper expression", () => {
      const variable = makeVariable({
        kind: "global",
        rawTemplate: '{{global.variables.jsonPayload}}',
        path: ["global", "variables", "jsonPayload"],
        fieldName: "jsonPayload",
      });

      const result = resolveVariable(variable, { jsonParseContext: true });

      expect(result.javaExpression).toContain("ObjectMapper");
      expect(result.javaExpression).toContain("readTree");
    });
  });
});
