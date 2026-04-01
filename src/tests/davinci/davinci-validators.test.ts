import { describe, it, expect } from "vitest";
import {
  validatePreConversion,
  validatePostGeneration,
  validateBuildResult,
} from "../../core/davinci/davinci-validators.js";
import { parseDaVinciCode } from "../../core/davinci/davinci-parser.js";
import type { GeneratePluginResult } from "../../core/davinci/plugin-generator.js";
import type { BuildResult } from "../../core/davinci/davinci-types.js";

describe("davinci-validators", () => {
  describe("validatePreConversion", () => {
    it("should pass for valid DaVinci code", () => {
      const code = `module.exports = a = async ({params}) => { return { ok: true }; }`;
      const analysis = parseDaVinciCode(code);
      const result = validatePreConversion(code, analysis);

      expect(result.valid).toBe(true);
    });

    it("should error on empty code", () => {
      const analysis = parseDaVinciCode("");
      const result = validatePreConversion("", analysis);

      expect(result.valid).toBe(false);
      expect(result.issues.find((i) => i.code === "empty_code")).toBeDefined();
    });

    it("should warn on require() usage", () => {
      const code = `module.exports = a = async ({params}) => { const fs = require("fs"); return {}; }`;
      const analysis = parseDaVinciCode(code);
      const result = validatePreConversion(code, analysis);

      expect(result.issues.find((i) => i.code === "require_usage")).toBeDefined();
    });

    it("should warn on fs readFileSync usage", () => {
      const code = `module.exports = a = async ({params}) => { const data = fs.readFileSync("/tmp"); return {}; }`;
      const analysis = parseDaVinciCode(code);
      const result = validatePreConversion(code, analysis);

      expect(result.issues.find((i) => i.code === "fs_usage")).toBeDefined();
    });

    it("should warn on missing module.exports", () => {
      const code = `const x = 42; function foo() { return x; }`;
      const analysis = parseDaVinciCode(code);
      const result = validatePreConversion(code, analysis);

      expect(result.issues.find((i) => i.code === "no_module_exports")).toBeDefined();
    });

    it("should info on simple code without variables", () => {
      const code = `module.exports = a = async ({params}) => { return { ok: true }; }`;
      const analysis = parseDaVinciCode(code);
      const result = validatePreConversion(code, analysis);

      expect(result.issues.find((i) => i.code === "simple_code")).toBeDefined();
    });

    it("should return typed issues with severity and code", () => {
      const code = "";
      const analysis = parseDaVinciCode(code);
      const result = validatePreConversion(code, analysis);

      for (const issue of result.issues) {
        expect(["error", "warning", "info"]).toContain(issue.severity);
        expect(issue.code.length).toBeGreaterThan(0);
        expect(issue.message.length).toBeGreaterThan(0);
      }
    });
  });

  describe("validatePostGeneration", () => {
    const validResult: GeneratePluginResult = {
      javaCode: `package com.example;\nimport java.util.*;\npublic class MyPlugin { }`,
      pomXml: `<?xml version="1.0"?><project></project>`,
      pfInfContent: "com.example.MyPlugin",
      pfInfType: "idp-authn-adapters",
      pluginType: "idp-adapter",
      confidence: 0.8,
      warnings: [],
      analysis: { variableCount: 2, apiCallCount: 1, flowLogic: {} as Record<string, boolean> },
    };

    it("should pass for valid generation result", () => {
      const result = validatePostGeneration(validResult);
      expect(result.valid).toBe(true);
    });

    it("should error when no Java code generated", () => {
      const result = validatePostGeneration({ ...validResult, javaCode: "// No template available" });
      expect(result.valid).toBe(false);
      expect(result.issues.find((i) => i.code === "no_java_code")).toBeDefined();
    });

    it("should error when POM is missing", () => {
      const result = validatePostGeneration({ ...validResult, pomXml: "" });
      expect(result.valid).toBe(false);
      expect(result.issues.find((i) => i.code === "no_pom")).toBeDefined();
    });

    it("should warn on low confidence", () => {
      const result = validatePostGeneration({ ...validResult, confidence: 0.3 });
      expect(result.issues.find((i) => i.code === "low_confidence")).toBeDefined();
    });

    it("should propagate generation warnings", () => {
      const result = validatePostGeneration({ ...validResult, warnings: ["test warning"] });
      expect(result.issues.find((i) => i.message === "test warning")).toBeDefined();
    });
  });

  describe("validateBuildResult", () => {
    it("should pass for successful build with JAR", () => {
      const build: BuildResult = { success: true, jarPath: "/tmp/target/plugin.jar", stdout: "BUILD SUCCESS", stderr: "", durationMs: 5000 };
      const result = validateBuildResult(build);
      expect(result.valid).toBe(true);
    });

    it("should error on failed build", () => {
      const build: BuildResult = { success: false, stdout: "", stderr: "Compilation error", durationMs: 3000 };
      const result = validateBuildResult(build);
      expect(result.valid).toBe(false);
      expect(result.issues.find((i) => i.code === "build_failed")).toBeDefined();
    });

    it("should warn when build succeeded but no JAR found", () => {
      const build: BuildResult = { success: true, stdout: "BUILD SUCCESS", stderr: "", durationMs: 5000 };
      const result = validateBuildResult(build);
      expect(result.issues.find((i) => i.code === "no_jar")).toBeDefined();
    });

    it("should info on slow builds over 60s", () => {
      const build: BuildResult = { success: true, jarPath: "/tmp/plugin.jar", stdout: "", stderr: "", durationMs: 90000 };
      const result = validateBuildResult(build);
      expect(result.issues.find((i) => i.code === "slow_build")).toBeDefined();
    });
  });
});
