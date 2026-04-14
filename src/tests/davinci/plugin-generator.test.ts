import { describe, it, expect } from "vitest";
import { generatePlugin } from "../../core/davinci/plugin-generator.js";
import type { GeneratePluginOptions } from "../../core/davinci/plugin-generator.js";

const SAMPLE_DAVINCI_CODE = `module.exports = a = async ({params}) => {
  const apiKey = "{{global.variables.apiKey}}";
  const baseUrl = "{{global.company.variables.baseUrl}}";
  const response = await fetch(baseUrl + "/api/auth", { method: "POST" });
  const data = JSON.parse(response.body);
  if (data.authenticated) {
    return { userId: data.id, status: "success" };
  } else {
    return { userId: null, status: "failed" };
  }
}`;

function makeOptions(overrides: Partial<GeneratePluginOptions> = {}): GeneratePluginOptions {
  return {
    code: SAMPLE_DAVINCI_CODE,
    pluginName: "my-auth-adapter",
    packageName: "com.example.adapter",
    className: "MyAuthAdapter",
    targetSdk: "pingfederate",
    attributeContract: ["userId", "status"],
    ...overrides,
  };
}

describe("plugin-generator", () => {
  describe("generatePlugin - end to end", () => {
    it("should generate Java class with correct package and class name", () => {
      const result = generatePlugin(makeOptions());

      expect(result.javaCode).toContain("package com.example.adapter;");
      expect(result.javaCode).toContain("public class MyAuthAdapter");
    });

    it("should include GUI fields from DaVinci variables", () => {
      const result = generatePlugin(makeOptions());

      expect(result.javaCode).toContain("TextFieldDescriptor");
      expect(result.javaCode).toContain("apiKey");
    });

    it("should include configure() body with getFieldValue", () => {
      const result = generatePlugin(makeOptions());

      expect(result.javaCode).toContain("configure(Configuration configuration)");
      expect(result.javaCode).toContain('configuration.getFieldValue("apiKey")');
    });

    it("should include attribute contract", () => {
      const result = generatePlugin(makeOptions({
        attributeContract: ["userId", "status"],
      }));

      expect(result.javaCode).toContain('contract.add("userId")');
      expect(result.javaCode).toContain('contract.add("status")');
    });

    it("should generate valid POM XML", () => {
      const result = generatePlugin(makeOptions());

      expect(result.pomXml).toContain("<?xml");
      expect(result.pomXml).toContain("<project");
      expect(result.pomXml).toContain("my-auth-adapter");
    });

    it("should generate PF-INF descriptor content", () => {
      const result = generatePlugin(makeOptions());

      expect(result.pfInfContent).toBe("com.example.adapter.MyAuthAdapter");
      expect(result.pfInfType).toBeDefined();
      expect(result.pfInfType.length).toBeGreaterThan(0);
    });

    it("should detect plugin type with confidence", () => {
      const result = generatePlugin(makeOptions());

      expect(result.pluginType).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it("should include analysis metadata", () => {
      const result = generatePlugin(makeOptions());

      expect(result.analysis.variableCount).toBeGreaterThanOrEqual(2);
      expect(result.analysis.apiCallCount).toBeGreaterThanOrEqual(1);
      expect(result.analysis.flowLogic.hasConditionals).toBe(true);
      expect(result.analysis.flowLogic.hasJsonParse).toBe(true);
    });
  });

  describe("PingAccess target", () => {
    it("should generate PingAccess style class with extends", () => {
      const result = generatePlugin(makeOptions({
        targetSdk: "pingaccess",
        pluginType: "rule",
      }));

      expect(result.javaCode).toContain("extends");
      expect(result.javaCode).toContain("@Rule");
      expect(result.pluginType).toBe("rule");
    });

    it("should generate PingAccess POM with SDK dependency", () => {
      const result = generatePlugin(makeOptions({
        targetSdk: "pingaccess",
      }));

      expect(result.pomXml).toContain("pingaccess-sdk");
      expect(result.pomXml).toContain("9.0.1.0");
    });
  });

  describe("plugin type override", () => {
    it("should respect manual plugin type override", () => {
      const result = generatePlugin(makeOptions({
        pluginType: "token-generator",
      }));

      expect(result.pluginType).toBe("token-generator");
      expect(result.confidence).toBe(1);
      expect(result.javaCode).toContain("TokenGenerator");
    });
  });

  describe("warnings propagation", () => {
    it("should propagate parser warnings", () => {
      const codeWithRequire = `module.exports = a = async ({params}) => {
        const fs = require("fs");
        const data = fs.readFileSync("/tmp/test");
        return { data: data.toString() };
      }`;

      const result = generatePlugin(makeOptions({ code: codeWithRequire }));

      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("edge cases", () => {
    it("should handle simple code without variables", () => {
      const result = generatePlugin(makeOptions({
        code: `module.exports = a = async ({params}) => { return { ok: true }; }`,
      }));

      expect(result.javaCode).toContain("public class MyAuthAdapter");
      expect(result.analysis.variableCount).toBe(0);
    });

    it("should handle unknown plugin type gracefully", () => {
      const result = generatePlugin(makeOptions({
        targetSdk: "pingaccess",
        pluginType: "nonexistent-type",
      }));

      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      expect(result.javaCode).toContain("No template available");
    });

    it("should reject unsafe attributeContract values with quotes", () => {
      expect(() => generatePlugin(makeOptions({
        attributeContract: ["userId", "x\"); Runtime.getRuntime().exec(\"evil\") //"],
      }))).toThrow("Invalid attributeContract");
    });

    it("should reject unsafe attributeContract values with newline", () => {
      expect(() => generatePlugin(makeOptions({
        attributeContract: ["line\nbreak"],
      }))).toThrow("Invalid attributeContract");
    });
  });
});
